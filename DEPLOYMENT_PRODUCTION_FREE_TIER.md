# 🚀 WebQx EMR - Free Tier Production Deployment

## 💰 Cost Breakdown
- ✅ **Nextcloud AIO**: $0 (open source, self-hosted)
- ✅ **Medplum FHIR**: $0 (Free tier: 100 requests/month)
- ⚠️ **VPS for Nextcloud**: $5/month (minimum requirement)
- ✅ **Railway (WebQx Backend)**: $0 (Free tier with GitHub Student Pack)
- ✅ **OpenAI Whisper**: Pay-as-you-go (~$0.006/minute)

**Total Monthly Cost**: ~$5-10/month

---

## 📋 Prerequisites Checklist

- [ ] VPS/Server for Nextcloud (DigitalOcean, Linode, Hetzner, etc.)
- [ ] Domain name (can use subdomain: nextcloud.yourdomain.com)
- [ ] Medplum account (https://app.medplum.com/register)
- [ ] Railway account (https://railway.app)
- [ ] OpenAI API key (https://platform.openai.com/api-keys)
- [ ] GitHub account with Railway connected

---

## 🗂️ Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     WebQx EMR Production Stack                   │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐         ┌──────────────────┐
│  Railway App     │         │  Your VPS        │
│  (Free Tier)     │         │  ($5/month)      │
│                  │         │                  │
│  - WebQx Backend │◄────────┤ Nextcloud AIO    │
│  - Jitsi Server  │  HTTPS  │  - File Storage  │
│  - Transcription │         │  - WebDAV API    │
│  - Health Check  │         │  - Auto Backups  │
└──────────────────┘         └──────────────────┘
         │                            │
         │                            │
         │ HTTPS                      │ HTTPS
         │                            │
         ▼                            ▼
┌──────────────────┐         ┌──────────────────┐
│  Medplum Cloud   │         │  Users' Browsers │
│  (Free Tier)     │         │                  │
│                  │         │  - Patients      │
│  - FHIR Server   │         │  - Providers     │
│  - Patient Data  │         │  - Admin         │
│  - Encounters    │         └──────────────────┘
│  - 100 req/month │
└──────────────────┘

┌──────────────────┐
│  OpenAI API      │
│  (Pay-as-go)     │
│                  │
│  - Whisper AI    │
│  - Transcription │
└──────────────────┘
```

---

## 🚀 Step-by-Step Deployment

### PHASE 1: Set Up Medplum (5 minutes)

#### 1.1 Create Medplum Account
1. Go to https://app.medplum.com/register
2. Sign up for free account
3. Verify email address
4. Create new project: "WebQx EMR"

#### 1.2 Get Medplum Credentials
1. Click on your project → Settings
2. Go to "Clients" tab
3. Click "Create Client"
   - Name: `WebQx Backend`
   - Access Policy: Choose appropriate policy
4. **SAVE THESE CREDENTIALS**:
   ```
   MEDPLUM_API_URL=https://api.medplum.com
   MEDPLUM_CLIENT_ID=<your-client-id>
   MEDPLUM_CLIENT_SECRET=<your-client-secret>
   ```

#### 1.3 Test Medplum Connection
```bash
# Test with curl:
curl -X POST https://api.medplum.com/oauth2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET"

# Expected response: { "access_token": "...", "expires_in": 3600 }
```

✅ **Medplum Setup Complete!**

---

### PHASE 2: Deploy Nextcloud AIO (20 minutes)

#### 2.1 Choose VPS Provider

**Recommended Options:**

| Provider | Plan | Cost | Specs |
|----------|------|------|-------|
| **Hetzner** | CX21 | €4.51/mo | 2 vCPU, 4GB RAM, 40GB SSD |
| **DigitalOcean** | Basic Droplet | $6/mo | 1 vCPU, 1GB RAM, 25GB SSD |
| **Linode** | Nanode | $5/mo | 1 vCPU, 1GB RAM, 25GB SSD |
| **Vultr** | Cloud Compute | $5/mo | 1 vCPU, 1GB RAM, 25GB SSD |

**Recommended**: Hetzner (best value) or DigitalOcean (easiest)

#### 2.2 Create VPS
1. Sign up for chosen provider
2. Create new Ubuntu 22.04 LTS server
3. Select region closest to your users
4. Add SSH key for secure access
5. Note down the server IP address

#### 2.3 Configure DNS
1. Go to your domain registrar (Namecheap, GoDaddy, Cloudflare, etc.)
2. Add A record:
   ```
   Type: A
   Name: nextcloud
   Value: YOUR_VPS_IP_ADDRESS
   TTL: 300 (5 minutes)
   ```
3. Wait 5-15 minutes for DNS propagation
4. Test: `ping nextcloud.yourdomain.com` should show your VPS IP

#### 2.4 Install Nextcloud AIO

SSH into your VPS:
```bash
ssh root@YOUR_VPS_IP
```

Run this ONE command to install everything:
```bash
# Install Docker + Nextcloud AIO in one go:
curl -fsSL https://get.docker.com | sudo sh && \
sudo docker run \
  --init \
  --sig-proxy=false \
  --name nextcloud-aio-mastercontainer \
  --restart always \
  --publish 80:80 \
  --publish 8080:8080 \
  --publish 8443:8443 \
  --volume nextcloud_aio_mastercontainer:/mnt/docker-aio-config \
  --volume /var/run/docker.sock:/var/run/docker.sock:ro \
  ghcr.io/nextcloud-releases/all-in-one:latest
```

Wait 1-2 minutes for initial setup, then proceed.

#### 2.5 Access AIO Admin Interface
1. Open browser: `https://YOUR_VPS_IP:8080`
2. **CRITICAL**: Save the password shown on screen!
   ```
   Initial AIO Password: <copy-this-password>
   ```
3. Click "Open Nextcloud AIO login"

#### 2.6 Configure Nextcloud
1. Log in with saved password
2. Enter domain: `nextcloud.yourdomain.com`
3. Wait for green checkmark (domain validation)
4. Optional: Enable add-ons:
   - ✅ Collabora Office (if you need document editing)
   - ⬜ Talk (skip, we use Jitsi)
   - ⬜ ClamAV (skip on free tier, uses too much RAM)
5. Click **"Start containers"**
6. **Wait 15-20 minutes** (downloads ~2GB of images)
   - Go get coffee ☕
   - Don't close browser tab
   - Watch logs for progress

#### 2.7 Access Nextcloud
1. Once done, visit: `https://nextcloud.yourdomain.com`
2. Login credentials shown in AIO interface:
   - Username: `admin`
   - Password: `<shown-in-aio-interface>`
3. Complete initial setup wizard
4. **You now have a working Nextcloud!** 🎉

#### 2.8 Create WebQx App Password
1. In Nextcloud, click profile icon → Settings
2. Go to "Security" → "Devices & sessions"
3. Under "Create new app password":
   - Name: `WebQx EMR Backend`
   - Click "Create"
4. **SAVE THIS PASSWORD**:
   ```
   App Password: xxxxx-xxxxx-xxxxx-xxxxx-xxxxx
   ```

✅ **Nextcloud AIO Setup Complete!**

---

### PHASE 3: Configure Railway (10 minutes)

#### 3.1 Deploy to Railway
1. Go to https://railway.app
2. Sign in with GitHub
3. New Project → Deploy from GitHub repo
4. Select: `WebQx/EMR`
5. Railway will auto-detect and deploy

#### 3.2 Add Environment Variables

In Railway → Your Project → Variables tab, add:

```bash
# Node Environment
NODE_ENV=production
PORT=8080

# Medplum FHIR (BACKBONE #1)
MEDPLUM_API_URL=https://api.medplum.com
MEDPLUM_CLIENT_ID=<from-step-1.2>
MEDPLUM_CLIENT_SECRET=<from-step-1.2>

# Nextcloud File Storage (BACKBONE #2)
NEXTCLOUD_WEBDAV_URL=https://nextcloud.yourdomain.com/remote.php/dav/files/admin/
NEXTCLOUD_USERNAME=admin
NEXTCLOUD_PASSWORD=<app-password-from-step-2.8>

# OpenAI Whisper Transcription
OPENAI_API_KEY=<your-openai-api-key>
WHISPER_MODEL=whisper-1

# CORS (allow your frontend domains)
ALLOWED_ORIGINS=https://yourdomain.com,https://webqx.github.io

# Adapter Settings
ADAPTER_CACHE_TTL_MS=30000
ADAPTER_LOG_LEVEL=info
```

#### 3.3 Get Railway URL
1. Railway will auto-deploy after adding variables
2. Copy your deployment URL:
   ```
   https://webqx-production.up.railway.app
   ```

✅ **Railway Deployment Complete!**

---

### PHASE 4: Test Everything (5 minutes)

#### 4.1 Test Medplum Connection
```bash
curl https://webqx-production.up.railway.app/emr/status
```

Expected response:
```json
{
  "status": "ok",
  "services": {
    "medplum": {
      "enabled": true,
      "status": "available",
      "latency_ms": 150
    },
    "nextcloud": {
      "enabled": true,
      "status": "available",
      "latency_ms": 80
    }
  }
}
```

#### 4.2 Test Nextcloud File Upload
```bash
# Upload test file:
echo "Test file from WebQx" > test.txt

curl -u admin:YOUR_APP_PASSWORD \
  -T test.txt \
  https://nextcloud.yourdomain.com/remote.php/dav/files/admin/test.txt
```

Check in Nextcloud web interface - file should appear! ✅

#### 4.3 Test Transcription Endpoint
```bash
# Download sample audio:
curl -o test-audio.mp3 https://www2.cs.uic.edu/~i101/SoundFiles/BabyElephantWalk60.wav

# Upload for transcription:
curl -X POST https://webqx-production.up.railway.app/emr/transcribe \
  -F "file=@test-audio.mp3" \
  -F "language=en"
```

Expected: JSON with transcription ✅

#### 4.4 Test Frontend Access
1. Open: https://webqx.github.io (or your domain)
2. Try to access patient records
3. Try voice recording feature
4. Verify files appear in Nextcloud

✅ **All Systems Operational!**

---

## 🎯 Free Tier Limitations & Workarounds

### Medplum Free Tier: 100 Requests/Month

**What counts as a request?**
- Each API call to Medplum
- Reading patient data
- Creating/updating resources

**100 requests = approximately:**
- 20-30 patient records created
- 50-70 read operations
- 10-20 encounter notes

**Optimization Strategies:**

1. **Enable Caching** (already configured):
   ```javascript
   ADAPTER_CACHE_TTL_MS=30000  // Cache for 30 seconds
   ```

2. **Batch Operations**:
   ```javascript
   // Instead of 5 separate requests:
   await medplum.readResource('Patient', id1);
   await medplum.readResource('Patient', id2);
   await medplum.readResource('Patient', id3);
   
   // Use batch (1 request):
   await medplum.executeBatch({
     resourceType: 'Bundle',
     type: 'batch',
     entry: [
       { request: { method: 'GET', url: 'Patient/' + id1 } },
       { request: { method: 'GET', url: 'Patient/' + id2 } },
       { request: { method: 'GET', url: 'Patient/' + id3 } }
     ]
   });
   ```

3. **Store Non-Critical Data Elsewhere**:
   - Store transcriptions in Nextcloud (text files)
   - Only store FHIR references in Medplum

4. **Monitor Usage**:
   ```bash
   # Check Medplum dashboard:
   https://app.medplum.com/admin/usage
   ```

### Nextcloud VPS: $5/month

**Storage Limits:**
- Base: 25-40GB SSD
- Upgrade: Add block storage for $1/10GB

**Optimization:**
- Compress audio before upload (WebM already efficient)
- Delete old recordings after 90 days
- Enable Nextcloud auto-archive

### Railway Free Tier

**Limits:**
- $5 free credit/month
- ~500 hours uptime
- Sleeps after inactivity

**Optimization:**
- Use Railway's "Always On" for production ($5/month)
- Or accept 5-10 second cold starts

---

## 📊 Expected Monthly Usage

### Typical Small Practice (10-20 patients/day):

| Resource | Usage | Cost |
|----------|-------|------|
| Medplum API calls | 80-90/month | $0 (free tier) |
| Nextcloud storage | 5-10GB | $0 (included) |
| Railway compute | ~720 hours | $0-5 (free tier) |
| OpenAI Whisper | 30 min audio | $0.18 |
| VPS (Nextcloud) | 1 server | $5 |
| **TOTAL** | | **$5-10/month** |

### When to Upgrade:

**Medplum** (>100 requests/month):
- Self-host Medplum ($0 but needs VPS)
- Or upgrade to $99/month plan (10K requests)

**Nextcloud** (>40GB storage):
- Add block storage: $1/10GB
- Or larger VPS plan

**Railway** (24/7 uptime needed):
- Add $5/month for always-on

---

## 🔧 Maintenance

### Weekly Tasks:
- [ ] Check Medplum request count
- [ ] Monitor Nextcloud storage usage
- [ ] Review Railway logs for errors

### Monthly Tasks:
- [ ] Update Nextcloud (via AIO interface)
- [ ] Backup Nextcloud data
- [ ] Review OpenAI Whisper costs
- [ ] Clean up old audio files

### Backup Strategy:

**Nextcloud Automatic Backups:**
1. AIO Interface → Backup section
2. Set location: `/mnt/backup/` (on VPS)
3. Or setup remote backup:
   ```bash
   # BorgBackup to external storage
   BORG_REPO=ssh://user@backup-server/repo
   ```

**Medplum Data Export:**
```bash
# Export all data monthly:
curl https://api.medplum.com/fhir/R4/Patient?_count=1000 \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  > medplum-backup-$(date +%Y%m%d).json
```

---

## 🚨 Troubleshooting

### "Medplum 401 Unauthorized"
**Solution**: Refresh credentials
```bash
# Get new access token:
curl -X POST https://api.medplum.com/oauth2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=$MEDPLUM_CLIENT_ID" \
  -d "client_secret=$MEDPLUM_CLIENT_SECRET"
```

### "Nextcloud WebDAV 401"
**Solution**: Regenerate app password (Step 2.8)

### "Railway container crashed"
**Solution**: Check logs
```bash
# Railway dashboard → Deployments → Logs
# Common issues:
# - Missing environment variables
# - Port conflicts
# - Memory limits exceeded
```

### "Out of Medplum requests"
**Solutions**:
1. Wait until next month (resets 1st of month)
2. Upgrade to paid plan
3. Self-host Medplum on separate VPS

---

## 📈 Scaling Path

### As Your Practice Grows:

**50-100 patients/day:**
- Upgrade Medplum to $99/month (10K requests)
- Larger VPS for Nextcloud ($10-15/month)
- Railway always-on ($5/month)
- **Total: ~$115-120/month**

**100+ patients/day:**
- Self-host Medplum ($20/month VPS)
- Dedicated Nextcloud server ($20/month)
- Railway Pro ($20/month)
- **Total: ~$60-70/month** (cheaper than SaaS!)

---

## ✅ Success Metrics

After completing this setup, you should have:

- [x] Medplum FHIR server storing patient data
- [x] Nextcloud storing audio files and documents
- [x] WebQx backend deployed on Railway
- [x] All services communicating correctly
- [x] Voice recording → Upload → Transcription working
- [x] Jitsi video calls functional
- [x] Admin interface accessible
- [x] Automatic backups configured
- [x] Monitoring dashboards set up
- [x] Total cost: $5-10/month

---

## 🎉 You're Production Ready!

Your WebQx EMR is now running with:
- ✅ FHIR-compliant patient records (Medplum)
- ✅ Secure file storage (Nextcloud)
- ✅ AI transcription (OpenAI Whisper)
- ✅ Video telehealth (Jitsi Meet)
- ✅ All for **$5-10/month**

**Next Steps:**
1. Customize EMR templates
2. Add your organization branding
3. Configure user roles
4. Import existing patient data
5. Train staff on the system

**Support:**
- Documentation: https://github.com/WebQx/EMR
- Issues: https://github.com/WebQx/EMR/issues
- Community: Discord/Slack (coming soon)

---

**Deployment Date**: _________________

**Deployed By**: _________________

**Production URL**: _________________

**Medplum Project ID**: _________________

**Nextcloud URL**: _________________

---

*Made with ❤️ by the WebQx Team*
