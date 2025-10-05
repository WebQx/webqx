# 🚂 Railway Deployment: WebQx EMR™ Integration

## ✅ PRODUCTION INTEGRATION COMPLETE

WebQx EMR service (Nextcloud + Medplum + OpenAI Whisper) is now **fully integrated** into `unified-server.js` and ready for Railway deployment.

---

## 🎯 What Changed

### 1. **Unified Server Integration** (`/core/unified-server.js`)
- ✅ Added `webqxEMRPort: 3100` configuration
- ✅ Added `startWebQxEMR()` method to spawn `/light-emr-adapter/src/server.js`
- ✅ Added proxy route: `/emr/*` → `http://localhost:3100/emr/*`
- ✅ Added WebQx EMR to service health checks and status display
- ✅ Passes backend credentials via environment variables

### 2. **Client Library Updates** (`/assets/webqx-emr-client.js`)
- ✅ Auto-detects production vs development environment
- ✅ Uses relative paths (`/emr/*`) in production (proxied through unified server)
- ✅ Uses `wss://` for secure WebSockets in production (HTTPS)
- ✅ Falls back to `ws://localhost:3100` in local development

### 3. **Demo Page Ready** (`/provider/webqx-emr-demo.html`)
- ✅ Complete touch-optimized demo with all WebQx EMR features
- ✅ Patient search (Medplum FHIR)
- ✅ File upload (Nextcloud WebDAV)
- ✅ Voice transcription (OpenAI Whisper)
- ✅ Backend status dashboard

---

## 🔧 Required Railway Environment Variables

Add these to your Railway service settings:

### **Medplum (FHIR R4 Backend)**
```bash
MEDPLUM_BASE_URL=https://api.medplum.com
MEDPLUM_CLIENT_ID=your_medplum_client_id_here
MEDPLUM_CLIENT_SECRET=your_medplum_client_secret_here
```

**Get Medplum Credentials:**
1. Sign up at https://app.medplum.com
2. Create a new project
3. Go to **Project Settings** → **Clients**
4. Create a new Client Application (type: `ClientApplication`)
5. Copy the **Client ID** and **Secret**

### **Nextcloud (File Storage)**
```bash
NEXTCLOUD_BASE_URL=https://your-nextcloud-instance.com
NEXTCLOUD_USERNAME=admin_or_api_user
NEXTCLOUD_PASSWORD=your_nextcloud_password
```

**Options for Nextcloud:**
- **Self-hosted**: Deploy Nextcloud AIO on a VPS/cloud server
- **Managed**: Use https://nextcloud.com/signup for hosted Nextcloud
- **Railway**: Deploy Nextcloud from Railway template marketplace

### **OpenAI Whisper (Transcription)**
```bash
OPENAI_API_KEY=sk-proj-...your_openai_api_key
WHISPER_BASE_URL=https://api.openai.com/v1
```

**Get OpenAI API Key:**
1. Go to https://platform.openai.com/api-keys
2. Create new secret key
3. Copy and store securely

### **Existing Variables (Keep These)**
```bash
# Main application
PORT=8080
NODE_ENV=production
JWT_SECRET=your_jwt_secret_here

# Sub-services (auto-assigned by unified-server)
DJANGO_PORT=3001
OPENEMR_PORT=3002
TELEHEALTH_PORT=3003
WEBQX_EMR_PORT=3100

# Authentication
ALLOWED_ORIGINS=https://webqx-production.up.railway.app,https://webqx.com

# Optional
JITSI_DOMAIN=meet.jit.si
ALLOW_IFRAME=true
```

---

## 🚀 Deployment Steps

### **Step 1: Update Code on Railway**
```bash
# Commit changes to your GitHub repo
cd /workspaces/webqx
git add core/unified-server.js assets/webqx-emr-client.js provider/webqx-emr-demo.html
git commit -m "🏥 Integrate WebQx EMR service (Nextcloud+Medplum+Whisper) into unified server"
git push origin main
```

Railway will auto-deploy when you push to the connected branch.

### **Step 2: Add Environment Variables**
1. Go to https://railway.app/dashboard
2. Select your **webqx-production** service
3. Go to **Variables** tab
4. Add the Medplum, Nextcloud, and OpenAI variables above
5. Click **Deploy** (or Railway will auto-redeploy)

### **Step 3: Verify Deployment**
```bash
# Check overall health
curl https://webqx-production.up.railway.app/health

# Check WebQx EMR status specifically
curl https://webqx-production.up.railway.app/emr/status

# Expected response:
{
  "status": "online",
  "service": "webqx-emr",
  "version": "0.1.0",
  "dependencies": {
    "medplum": { "status": "online", "latency_ms": 123 },
    "nextcloud": { "status": "online", "latency_ms": 89 },
    "whisper": { "status": "online", "latency_ms": 234 }
  }
}
```

### **Step 4: Test in Browser**
```
https://webqx-production.up.railway.app/provider/webqx-emr-demo.html
```

You should see:
- ✅ Backend Status: All 3 services (Medplum, Nextcloud, Whisper) showing green
- ✅ Patient search working (fetches real data from Medplum)
- ✅ File upload working (uploads to Nextcloud)
- ✅ Voice transcription working (uses OpenAI Whisper)

---

## 🐛 Troubleshooting

### **WebQx EMR service shows offline**
```bash
# Check Railway logs
railway logs --service webqx-production

# Look for:
[WebQx EMR] Light EMR Adapter started on port 3100
✅ WebQx EMR health probe succeeded
```

If you see:
```
⚠️ WebQx EMR server not found at: /light-emr-adapter/src/server.js
```
Make sure `light-emr-adapter/` directory exists in your repo.

### **Medplum returns 401 Unauthorized**
- Double-check `MEDPLUM_CLIENT_ID` and `MEDPLUM_CLIENT_SECRET`
- Make sure the client is **active** in Medplum dashboard
- Try re-generating the secret

### **Nextcloud returns 401 Unauthorized**
- Check `NEXTCLOUD_USERNAME` and `NEXTCLOUD_PASSWORD`
- Make sure WebDAV is enabled on your Nextcloud instance
- Test manually: `curl -u user:pass https://your-nextcloud.com/remote.php/dav/files/user/`

### **Whisper returns 429 Rate Limit**
- You've exceeded OpenAI API quota
- Upgrade your OpenAI plan or wait for quota reset
- Check usage: https://platform.openai.com/usage

---

## 📊 Service Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Railway: webqx-production.up.railway.app (Port 8080)  │
└─────────────────────────────────────────────────────────┘
                          │
                          ├── unified-server.js (Main Gateway)
                          │
    ┌─────────────────────┼─────────────────────┬─────────────────┐
    │                     │                     │                 │
┌───▼───┐          ┌──────▼──────┐      ┌──────▼──────┐   ┌──────▼──────┐
│ Django│          │  OpenEMR    │      │ Telehealth  │   │ WebQx EMR™  │
│ :3001 │          │   :3002     │      │   :3003     │   │   :3100     │
└───────┘          └─────────────┘      └─────────────┘   └──────┬──────┘
                                                                  │
                           ┌──────────────────────────────────────┼───────────────┐
                           │                                      │               │
                    ┌──────▼──────┐                     ┌─────────▼────────┐  ┌──▼──────────┐
                    │   Medplum   │                     │    Nextcloud     │  │   Whisper   │
                    │    (FHIR)   │                     │ (File Storage)   │  │ (OpenAI AI) │
                    │   Cloud     │                     │   Self/Cloud     │  │    Cloud    │
                    └─────────────┘                     └──────────────────┘  └─────────────┘
```

**Request Flow:**
1. Browser → `https://webqx-production.up.railway.app/emr/patients?search=Smith`
2. Unified Server (port 8080) → Proxy to `http://localhost:3100/emr/patients?search=Smith`
3. WebQx EMR Service (port 3100) → Calls Medplum API `https://api.medplum.com/fhir/R4/Patient?name=Smith`
4. Medplum → Returns FHIR resources
5. WebQx EMR → Formats and returns to unified server
6. Unified Server → Returns to browser

---

## 📈 Next Steps

### **Phase 2: Provider Modules** (Week 2)
Now that WebQx EMR is integrated, build the 7 provider modules:
1. `/provider/patients/index.html` - Full patient records viewer
2. `/provider/prescriptions/index.html` - E-prescribe with pharmacy lookup
3. `/provider/lab-results/index.html` - Lab trending with graphs
4. `/provider/imaging/index.html` - DICOM viewer with Nextcloud
5. `/provider/scheduling/index.html` - Calendar with Medplum appointments
6. `/provider/telehealth-scheduling.html` - Enhance with real-time Whisper
7. `/provider/billing/index.html` - CPT/ICD-10 coding

### **Phase 3: Patient Portal** (Week 3)
5 patient-facing modules with WebQx EMR integration

### **Phase 4: Admin Console** (Week 4)
4 admin modules + final touch optimization testing

---

## 🔐 Security Notes

- ✅ All API keys stored in Railway environment variables (not in code)
- ✅ HTTPS enforced on Railway production (automatic)
- ✅ JWT authentication required for `/provider/*` and `/admin-console/*` routes
- ✅ CORS restricted to allowed origins only
- ✅ Rate limiting enabled on all API endpoints
- ✅ Helmet.js security headers active
- ✅ Medplum and Nextcloud credentials never exposed to browser

---

## 📞 Support

**Issues with WebQx EMR integration?**
- Check Railway logs: `railway logs`
- Test `/emr/status` endpoint
- Verify all environment variables are set
- Check Medplum/Nextcloud/OpenAI service status

**Medplum Support:** https://www.medplum.com/docs
**Nextcloud Support:** https://docs.nextcloud.com
**OpenAI Support:** https://help.openai.com

---

**Last Updated:** October 5, 2025
**Status:** ✅ PRODUCTION READY - Deploy to Railway now!
