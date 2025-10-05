# Nextcloud All-in-One (AIO) Setup Guide for WebQx EMR

## 🎯 Overview
Nextcloud All-in-One is the **OFFICIAL** Nextcloud deployment method that includes:
- ✅ Nextcloud Server (file storage, WebDAV)
- ✅ PostgreSQL Database
- ✅ Redis Caching
- ✅ Apache/Caddy Reverse Proxy
- ✅ Collabora Office (optional)
- ✅ Talk (video calls - optional)
- ✅ Full-text Search (optional)
- ✅ Automatic Backups
- ✅ All pre-configured and ready to use

**This is PERFECT for WebQx EMR's file storage backbone!**

---

## 📋 Deployment Options

### Option 1: Railway Deployment (Recommended if supported)
⚠️ **IMPORTANT**: Nextcloud AIO requires:
- Docker socket access (`/var/run/docker.sock`)
- Ability to create sibling containers
- Port 8080 for AIO admin interface
- Port 443 (or custom) for Nextcloud access

**Railway may not support full Docker socket access.** Check Railway documentation first.

---

### Option 2: Separate VPS/Server (RECOMMENDED)
Deploy Nextcloud AIO on a **separate server** with full Docker access:

#### Requirements:
- Ubuntu/Debian server
- 2GB+ RAM (4GB recommended)
- 20GB+ disk space for system
- Separate storage volume for data
- Domain name (e.g., `nextcloud.yourdomain.com`)

#### Quick Install:
```bash
# Install Docker
curl -fsSL https://get.docker.com | sudo sh

# Enable IPv6 (optional but recommended)
# See: https://github.com/nextcloud/all-in-one/blob/main/docker-ipv6-support.md

# Run Nextcloud AIO Master Container
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

#### Setup Process:
1. **Access AIO Interface**: Navigate to `https://your-server-ip:8080`
2. **Save Initial Password**: You'll see a generated passphrase - SAVE IT!
3. **Enter Domain**: Enter `nextcloud.yourdomain.com`
4. **DNS Configuration**:
   - Set A record: `nextcloud.yourdomain.com` → Your server IP
   - Wait for DNS propagation (5-15 minutes)
5. **Start Containers**: Click "Start containers" in AIO interface
6. **Wait**: First deployment takes 10-20 minutes
7. **Login**: Access Nextcloud at `https://nextcloud.yourdomain.com`
   - Initial username: `admin`
   - Initial password: Shown in AIO interface

---

## 🔗 WebQx EMR Integration

### After Nextcloud AIO is Running:

#### 1. Get WebDAV URL
```
https://nextcloud.yourdomain.com/remote.php/dav/files/admin/
```

#### 2. Create App Password for WebQx
In Nextcloud:
1. Go to Settings → Personal → Security
2. Create new app password named "WebQx EMR"
3. Copy the generated password (format: `xxxxx-xxxxx-xxxxx-xxxxx-xxxxx`)

#### 3. Configure WebQx Environment Variables in Railway

Add these to Railway → Variables:

```bash
# Nextcloud File Storage (BACKBONE #2)
NEXTCLOUD_WEBDAV_URL=https://nextcloud.yourdomain.com/remote.php/dav/files/admin/
NEXTCLOUD_USERNAME=admin
NEXTCLOUD_PASSWORD=xxxxx-xxxxx-xxxxx-xxxxx-xxxxx  # App password from step 2
```

#### 4. Test Connection
```bash
curl -u admin:xxxxx-xxxxx-xxxxx-xxxxx-xxxxx \
  -X PROPFIND \
  https://nextcloud.yourdomain.com/remote.php/dav/files/admin/
```

Should return XML with file list (even if empty).

---

## 🎤 Audio File Storage Workflow

### How WebQx Will Use Nextcloud:

```javascript
// 1. Patient records audio in WebQx
const audioBlob = recordedAudio;

// 2. Upload to Nextcloud
const fileName = `patient-${patientId}-${timestamp}.webm`;
const response = await fetch(
  `${NEXTCLOUD_WEBDAV_URL}${fileName}`,
  {
    method: 'PUT',
    headers: {
      'Authorization': `Basic ${btoa(`${username}:${password}`)}`,
      'Content-Type': 'audio/webm'
    },
    body: audioBlob
  }
);

// 3. Store Nextcloud file URL in Medplum
const media = await medplum.createResource({
  resourceType: 'Media',
  status: 'completed',
  content: {
    url: `${NEXTCLOUD_WEBDAV_URL}${fileName}`,
    contentType: 'audio/webm'
  },
  subject: {
    reference: `Patient/${patientId}`
  }
});

// 4. Send to OpenAI Whisper for transcription
const formData = new FormData();
formData.append('file', audioBlob, fileName);
formData.append('model', 'whisper-1');

const transcription = await fetch(
  'https://api.openai.com/v1/audio/transcriptions',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: formData
  }
);

// 5. Store transcription in Medplum
await medplum.createResource({
  resourceType: 'DocumentReference',
  status: 'current',
  type: {
    text: 'Voice Transcription'
  },
  subject: {
    reference: `Patient/${patientId}`
  },
  content: [{
    attachment: {
      contentType: 'text/plain',
      data: btoa(transcription.text)
    }
  }],
  context: {
    related: [{
      reference: `Media/${media.id}`
    }]
  }
});
```

---

## 🔒 Security Best Practices

### 1. **Use App Passwords** (Not Main Password)
- Never use your main Nextcloud password in WebQx
- Always create dedicated app passwords
- One per service/application

### 2. **Enable 2FA for Admin Account**
```bash
# In Nextcloud:
Settings → Security → Two-Factor Authentication
```

### 3. **Restrict WebDAV Access** (Optional)
Create a dedicated user for WebQx:
```bash
# In Nextcloud:
Users → Create new user: "webqx-service"
Give minimal permissions (just upload/download)
```

Then update environment variables:
```bash
NEXTCLOUD_USERNAME=webqx-service
NEXTCLOUD_PASSWORD=<app-password-for-webqx-service>
```

---

## 📊 Folder Structure Recommendation

Organize files in Nextcloud:

```
/WebQx-EMR/
  ├── audio-recordings/
  │   ├── 2025/
  │   │   ├── 01-January/
  │   │   │   ├── patient-123-20250105-101530.webm
  │   │   │   └── patient-456-20250105-143022.webm
  │   │   └── 02-February/
  │   └── 2024/
  ├── documents/
  │   ├── prescriptions/
  │   ├── lab-reports/
  │   └── discharge-summaries/
  └── images/
      ├── x-rays/
      └── photos/
```

---

## 🚀 Advanced Configuration

### Custom Data Directory (Separate Drive)
```bash
# Before starting AIO, specify custom data location:
sudo docker run \
  --env NEXTCLOUD_DATADIR=/mnt/large-storage/nextcloud-data \
  ... (rest of command)
```

### Enable Optional Services
In AIO Interface:
- ✅ **Collabora Office**: Office document editing
- ✅ **Nextcloud Talk**: Built-in video calls (can replace Jitsi)
- ⬜ **ClamAV**: Antivirus scanning (high resource usage)
- ⬜ **Imaginary**: Image preview generation

### Backup Configuration
AIO includes automatic backups:
```bash
# Set backup location in AIO interface:
/mnt/backup-drive/nextcloud-backups/
```

---

## 🔍 Troubleshooting

### Domain Validation Fails
```bash
# Check DNS propagation:
nslookup nextcloud.yourdomain.com

# Check port 443 is accessible:
curl -I https://nextcloud.yourdomain.com

# Check AIO logs:
sudo docker logs nextcloud-aio-mastercontainer
```

### WebDAV Connection Fails
```bash
# Test with curl:
curl -v -u admin:password \
  -X PROPFIND \
  https://nextcloud.yourdomain.com/remote.php/dav/files/admin/

# Check Nextcloud logs:
sudo docker exec -it nextcloud-aio-nextcloud tail -f /var/www/html/data/nextcloud.log
```

### Container Won't Start
```bash
# Check AIO status:
sudo docker ps -a | grep nextcloud-aio

# Restart AIO mastercontainer:
sudo docker restart nextcloud-aio-mastercontainer

# Full reset (CAREFUL - deletes data):
sudo docker stop $(sudo docker ps -aq --filter name=nextcloud-aio)
sudo docker rm $(sudo docker ps -aq --filter name=nextcloud-aio)
sudo docker volume rm nextcloud_aio_mastercontainer
```

---

## 📚 Resources

- **Official Docs**: https://github.com/nextcloud/all-in-one
- **Reverse Proxy Setup**: https://github.com/nextcloud/all-in-one/blob/main/reverse-proxy.md
- **WebDAV Documentation**: https://docs.nextcloud.com/server/latest/user_manual/en/files/access_webdav.html
- **API Documentation**: https://docs.nextcloud.com/server/latest/developer_manual/client_apis/index.html

---

## ✅ Deployment Checklist

- [ ] Server/VPS provisioned
- [ ] Docker installed
- [ ] Domain DNS configured (A record)
- [ ] Port 80, 443, 8080 opened in firewall
- [ ] Nextcloud AIO mastercontainer running
- [ ] AIO passphrase saved securely
- [ ] Domain validation passed
- [ ] All containers started (Nextcloud, Database, Redis, Apache)
- [ ] Nextcloud accessible via browser
- [ ] Admin account logged in
- [ ] App password created for WebQx
- [ ] WebDAV URL tested with curl
- [ ] Environment variables added to Railway
- [ ] WebQx backend deployed and connected
- [ ] Test file upload from WebQx
- [ ] Test file download from WebQx
- [ ] Backup location configured in AIO

---

## 🎯 Expected Result

After completing this setup:

1. ✅ **Nextcloud Running**: `https://nextcloud.yourdomain.com`
2. ✅ **WebQx Connected**: Files uploaded from WebQx appear in Nextcloud
3. ✅ **Audio Workflow**: Record → Upload → Store → Transcribe → Save
4. ✅ **Medplum + Nextcloud**: Patient data in FHIR, files in Nextcloud
5. ✅ **Production Ready**: Automatic backups, SSL, security

**Next Steps After Deployment:**
1. Add Nextcloud variables to Railway
2. Redeploy WebQx backend
3. Test audio recording feature
4. Verify files appear in Nextcloud
5. Test transcription workflow
