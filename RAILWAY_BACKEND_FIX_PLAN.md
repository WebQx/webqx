# Railway Production Backend Fix Plan
## Complete WebQx EMR Backend Integration
### Nextcloud + Medplum + OpenAI Whisper

**Target:** https://webqx-production.up.railway.app  
**Goal:** Integrate Light EMR Adapter for full Medplum (FHIR) and Nextcloud (WebDAV) backend support

---

## 🎯 Objective

After users log in at `/auth/providers/login.html`, they should have:
1. ✅ **Working authentication** → Already working
2. ✅ **Real patient data from Medplum** → Needs integration
3. ✅ **File storage via Nextcloud** → Needs integration
4. ✅ **Medical transcription via OpenAI Whisper** → Needs integration
5. ✅ **Unified WebQx EMR backend** → Needs service integration

---

## 🏗️ Architecture Overview

### Current State
```
Railway Deployment
│
└─ Main Server (unified-server.js)
   ├─ Port 8080 (Main Gateway)
   ├─ Port 3001 (Django Auth)
   ├─ Port 3002 (OpenEMR)
   └─ Port 3003 (Telehealth)

❌ Missing: WebQx EMR Service
❌ /emr/status → returns HTML (404)
❌ /emr/patients → not accessible
❌ /emr/transcribe → not accessible
```

### Target State
```
Railway Deployment
│
└─ Main Server (unified-server.js)
   ├─ Port 8080 (Main Gateway)
   │  └─ Proxy /emr/* → Port 3100
   ├─ Port 3001 (Django Auth)
   ├─ Port 3002 (OpenEMR)
   ├─ Port 3003 (Telehealth)
   └─ Port 3100 (WebQx EMR Service) ← NEW!
      ├─ GET /emr/status
      ├─ GET /emr/patients
      ├─ POST /emr/transcribe
      ├─ Connects to Medplum API (FHIR patient data)
      ├─ Connects to Nextcloud WebDAV (file storage)
      └─ Connects to OpenAI Whisper (transcription)
```

---

## 📋 Step-by-Step Implementation

### Step 1: Modify unified-server.js

**File:** `/workspaces/webqx/core/unified-server.js`

#### 1.1 Add adapter port to config (around line 52)

```javascript
this.config = {
    mainPort: process.env.PORT || process.env.MAIN_PORT || 3000,
    djangoPort: process.env.DJANGO_PORT || 3001,
    openEMRPort: process.env.OPENEMR_PORT || 3002,
    telehealthPort: process.env.TELEHEALTH_PORT || 3003,
    webqxEmrPort: process.env.WEBQX_EMR_PORT || 3100, // ← ADD THIS
    // ... rest of config
}
```

#### 1.2 Add adapter health status (around line 73)

```javascript
this.serviceHealth = {
    django: false,
    openemr: false,
    telehealth: false,
    webqxEmr: false, // ← ADD THIS (Nextcloud + Medplum + Whisper)
    main: false
};
```

#### 1.3 Reserve adapter port (around line 91)

```javascript
try {
    this.config.djangoPort = await this.portManager.reservePort('django', this.config.djangoPort);
    if (!this.config.useRemoteOpenEMR) {
        this.config.openEMRPort = await this.portManager.reservePort('openemr', this.config.openEMRPort);
    }
    this.config.telehealthPort = await this.portManager.reservePort('telehealth', this.config.telehealthPort);
    this.config.adapterPort = await this.portManager.reservePort('adapter', this.config.adapterPort); // ← ADD THIS
    this.config.mainPort = await this.portManager.reservePort('main', this.config.mainPort);
} catch (e) {
    this.log('warn', `Port reservation issue: ${e.message}`);
}
```

#### 1.4 Start adapter service (around line 130, after starting other services)

```javascript
// Start WebQx EMR Service (Nextcloud + Medplum + Whisper)
if (process.env.WEBQX_EMR_ENABLED !== 'false') {
    await this.startWebQxEMR();
}
```

#### 1.5 Add adapter startup method (around line 1100, near other service methods)

```javascript
/**
 * Start Light EMR Adapter (Medplum + Nextcloud bridge)
 */
async startLightEMRAdapter() {
    return new Promise((resolve) => {
        this.log('info', `Starting Light EMR Adapter on port ${this.config.adapterPort}`);
        
        const adapterPath = path.join(__dirname, '../light-emr-adapter/src/server.js');
        
        if (!fs.existsSync(adapterPath)) {
            this.log('warn', 'Light EMR Adapter not found, skipping');
            return resolve();
        }

        const env = {
            ...process.env,
            PORT: String(this.config.adapterPort),
            MEDPLUM_API_URL: process.env.MEDPLUM_API_URL || '',
            NEXTCLOUD_WEBDAV_URL: process.env.NEXTCLOUD_WEBDAV_URL || '',
            NEXTCLOUD_USERNAME: process.env.NEXTCLOUD_USERNAME || '',
            NEXTCLOUD_PASSWORD: process.env.NEXTCLOUD_PASSWORD || '',
            ADAPTER_CACHE_TTL_MS: process.env.ADAPTER_CACHE_TTL_MS || '30000',
            ADAPTER_LOG_LEVEL: process.env.ADAPTER_LOG_LEVEL || 'info',
            ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'https://webqx.github.io'
        };

        const adapterProcess = spawn('node', [adapterPath], {
            env,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        adapterProcess.stdout.on('data', (data) => {
            const msg = data.toString().trim();
            if (msg) this.log('info', `[Adapter] ${msg}`);
        });

        adapterProcess.stderr.on('data', (data) => {
            const msg = data.toString().trim();
            if (msg) this.log('warn', `[Adapter] ${msg}`);
        });

        adapterProcess.on('error', (error) => {
            this.log('error', `Adapter process error: ${error.message}`);
        });

        adapterProcess.on('exit', (code) => {
            this.serviceHealth.adapter = false;
            this.log('warn', `Adapter exited with code ${code}`);
            
            // Auto-restart after 5 seconds
            setTimeout(() => {
                this.log('info', 'Restarting Light EMR Adapter...');
                this.startLightEMRAdapter();
            }, 5000);
        });

        this.services.set('adapter', adapterProcess);

        // Wait for adapter to be ready
        setTimeout(async () => {
            try {
                const response = await fetch(`http://localhost:${this.config.adapterPort}/health`);
                if (response.ok) {
                    this.serviceHealth.adapter = true;
                    this.log('info', `✅ Light EMR Adapter started on port ${this.config.adapterPort}`);
                } else {
                    this.log('warn', `⚠️ Adapter health check failed: ${response.status}`);
                }
            } catch (error) {
                this.log('warn', `⚠️ Adapter health check error: ${error.message}`);
            }
            resolve();
        }, 2000);
    });
}
```

#### 1.6 Add adapter proxy routes (in setupServiceProxies method, around line 900)

```javascript
// Proxy /emr/* to Light EMR Adapter
if (this.serviceHealth.adapter || process.env.LIGHT_EMR_ADAPTER_ENABLED !== 'false') {
    this.app.use('/emr', createProxyMiddleware({
        target: `http://localhost:${this.config.adapterPort}`,
        changeOrigin: true,
        pathRewrite: {
            '^/emr': '/emr'
        },
        onError: (err, req, res) => {
            this.log('error', `EMR Adapter proxy error: ${err.message}`);
            res.status(503).json({
                error: 'EMR_ADAPTER_UNAVAILABLE',
                message: 'EMR adapter service is currently unavailable'
            });
        },
        onProxyReq: (proxyReq, req) => {
            this.log('info', `[Proxy] ${req.method} /emr${req.url} -> Adapter:${this.config.adapterPort}`);
        }
    }));
}
```

#### 1.7 Update health endpoint to include adapter (around line 420)

```javascript
this.app.get('/health', (req, res) => {
    const allHealthy = this.serviceHealth.django 
        && this.serviceHealth.openemr 
        && this.serviceHealth.telehealth
        && this.serviceHealth.adapter; // ← ADD THIS
    
    res.json({
        status: allHealthy ? 'healthy' : 'degraded',
        service: 'WebQX Healthcare Platform Gateway',
        timestamp: new Date().toISOString(),
        version: 'v0.1.0',
        services: this.serviceHealth,
        ports: {
            main: String(this.config.mainPort),
            django: this.config.djangoPort,
            openemr: this.config.openEMRPort,
            telehealth: this.config.telehealthPort,
            adapter: this.config.adapterPort // ← ADD THIS
        },
        config: {
            environment: this.config.environment,
            useRemoteOpenEMR: this.config.useRemoteOpenEMR,
            transcriptionConfigured: Boolean(this.config.transcriptionBaseUrl),
            adapterEnabled: process.env.LIGHT_EMR_ADAPTER_ENABLED !== 'false' // ← ADD THIS
        }
    });
});
```

---

### Step 2: Update package.json

**File:** `/workspaces/webqx/package.json`

Add adapter start script (around line 13):

```json
"scripts": {
  "start": "node server.js",
  "start:railway": "node server.js",
  "start:adapter": "cd light-emr-adapter && node src/server.js",
  // ... rest of scripts
}
```

---

### Step 3: Railway Environment Variables

Go to Railway Dashboard → webqx-production → Variables tab:

#### Required Variables

```bash
# Enable Light EMR Adapter
LIGHT_EMR_ADAPTER_ENABLED=true
LIGHT_EMR_ADAPTER_PORT=3100

# Medplum Configuration
MEDPLUM_API_URL=https://api.medplum.com
# MEDPLUM_CLIENT_ID=your_client_id_here       # Add when available
# MEDPLUM_CLIENT_SECRET=your_client_secret    # Add when available

# Nextcloud Configuration  
# NEXTCLOUD_WEBDAV_URL=https://your-nextcloud.com/remote.php/dav/files/username/
# NEXTCLOUD_USERNAME=admin
# NEXTCLOUD_PASSWORD=password123

# Adapter Settings
ADAPTER_CACHE_TTL_MS=30000
ADAPTER_LOG_LEVEL=info

# CORS
ALLOWED_ORIGINS=https://webqx.github.io,https://webqx.com
```

**Note:** Medplum and Nextcloud variables can be added later. The adapter will run in "disabled" mode for those services until credentials are provided.

---

### Step 4: Test Locally First

Before deploying to Railway, test the integration locally:

```bash
# Terminal 1: Set environment variables
export LIGHT_EMR_ADAPTER_ENABLED=true
export LIGHT_EMR_ADAPTER_PORT=3100
export MEDPLUM_API_URL=https://api.medplum.com
export NODE_ENV=development

# Start the unified server
npm start
```

```bash
# Terminal 2: Test endpoints
# Main health (should show adapter status)
curl http://localhost:3000/health | jq .

# EMR adapter status (proxied through main gateway)
curl http://localhost:3000/emr/status | jq .

# Direct adapter health
curl http://localhost:3100/health | jq .
```

**Expected Results:**

1. Main `/health` shows:
```json
{
  "status": "healthy",
  "services": {
    "adapter": true
  },
  "ports": {
    "adapter": 3100
  }
}
```

2. `/emr/status` returns JSON:
```json
{
  "status": "degraded",
  "dependencies": {
    "medplum": {
      "enabled": false,
      "status": "disabled"
    },
    "nextcloud": {
      "enabled": false,
      "status": "disabled"
    }
  }
}
```

---

### Step 5: Deploy to Railway

```bash
# Commit changes
git add core/unified-server.js package.json
git commit -m "feat(backend): integrate Light EMR Adapter for Medplum/Nextcloud support"
git push origin main
```

Railway will auto-deploy. Monitor logs for:
- ✅ "Starting Light EMR Adapter on port 3100"
- ✅ "✅ Light EMR Adapter started on port 3100"
- ✅ "/emr/status returns JSON"

---

### Step 6: Verify Production

```bash
# Health check
curl https://webqx-production.up.railway.app/health | jq .

# EMR status
curl https://webqx-production.up.railway.app/emr/status | jq .

# EMR patients (will return empty until Medplum configured)
curl https://webqx-production.up.railway.app/emr/patients | jq .
```

---

## 🎯 Success Criteria

After implementation, users should be able to:

1. ✅ Login at `/auth/providers/login.html`
2. ✅ Access provider dashboard at `/provider/dashboard/`
3. ✅ Backend endpoints respond with JSON:
   - `/health` includes adapter status
   - `/emr/status` shows Medplum/Nextcloud connection status
   - `/emr/patients` returns patient list (once Medplum configured)

---

## 🔐 Security Considerations

1. **Environment Variables**: Never commit Medplum/Nextcloud credentials to git
2. **CORS**: Ensure ALLOWED_ORIGINS includes only trusted domains
3. **Rate Limiting**: Light EMR Adapter has built-in rate limits
4. **Audit Logging**: Adapter logs all requests for HIPAA compliance
5. **HTTPS Only**: Ensure all external API calls use HTTPS

---

## 📊 Monitoring

After deployment, monitor:
- Railway logs for adapter startup messages
- `/health` endpoint for service status
- `/emr/status` for backend connectivity
- Response times for `/emr/*` endpoints

---

## 🐛 Troubleshooting

### Issue: `/emr/status` still returns HTML

**Causes:**
- Adapter not started
- Port conflict
- Proxy not configured

**Solutions:**
1. Check Railway logs: `railway logs`
2. Verify adapter process: Look for "Light EMR Adapter started"
3. Test direct adapter health: `curl localhost:3100/health`

### Issue: Adapter starts but crashes immediately

**Causes:**
- Missing dependencies
- Port already in use
- Invalid environment variables

**Solutions:**
1. Check Railway logs for error messages
2. Ensure `light-emr-adapter/node_modules` exists
3. Verify PORT environment variable is unique

### Issue: Medplum/Nextcloud showing "offline"

**Expected Behavior:** This is normal without credentials!

The adapter will show:
```json
{
  "medplum": {
    "enabled": false,
    "status": "disabled"
  }
}
```

**To fix:** Add MEDPLUM_API_URL, MEDPLUM_CLIENT_ID, MEDPLUM_CLIENT_SECRET to Railway variables.

---

## 📝 Next Steps After Integration

1. **Setup Medplum Account**
   - Sign up: https://app.medplum.com/register
   - Create project
   - Generate client credentials
   - Add to Railway environment variables

2. **Deploy Nextcloud**
   - Option A: Railway template
   - Option B: Docker container
   - Option C: Managed hosting
   - Configure WebDAV endpoint
   - Add credentials to Railway

3. **Frontend Integration**
   - Update provider dashboard to call `/emr/patients`
   - Add patient search UI
   - Implement file upload/download via Nextcloud
   - Display real FHIR data in patient records

---

## ✅ Completion Checklist

- [ ] Modified `core/unified-server.js` with adapter integration
- [ ] Updated `package.json` with adapter script
- [ ] Set `LIGHT_EMR_ADAPTER_ENABLED=true` on Railway
- [ ] Tested locally: `/health` shows adapter status
- [ ] Tested locally: `/emr/status` returns JSON
- [ ] Committed changes to git
- [ ] Pushed to main branch
- [ ] Railway deployment successful
- [ ] Production `/health` shows adapter running
- [ ] Production `/emr/status` returns JSON
- [ ] (Optional) Added Medplum credentials
- [ ] (Optional) Added Nextcloud credentials
- [ ] Updated `BACKEND_INTEGRATION_STATUS.md` with results

---

**Estimated Time:** 1-2 hours for code integration + testing  
**Priority:** HIGH - Required for full backend functionality  
**Dependencies:** None (Medplum/Nextcloud can be added later)
