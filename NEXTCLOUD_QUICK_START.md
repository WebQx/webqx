# 🚀 Nextcloud All-in-One - Quick Start for WebQx EMR

## ⚡ 5-Minute Setup

### Prerequisites
- ✅ Ubuntu/Debian server or VPS
- ✅ Domain name pointing to server
- ✅ Ports 80, 443, 8080 open

### Step 1: Install Docker (30 seconds)
```bash
curl -fsSL https://get.docker.com | sudo sh
```

### Step 2: Run Nextcloud AIO (1 minute)
```bash
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

### Step 3: Access AIO Interface (1 minute)
1. Navigate to: `https://YOUR-SERVER-IP:8080`
2. **SAVE THE PASSWORD SHOWN!** (You'll need it)
3. Click "Open Nextcloud AIO login"

### Step 4: Configure Domain (2 minutes)
1. Log in with saved password
2. Enter your domain: `nextcloud.yourdomain.com`
3. Wait for domain validation (green checkmark)
4. Click "Start containers"

### Step 5: Wait for Deployment (10-15 minutes)
- AIO will download and configure all containers
- Go get coffee ☕
- Don't close the browser tab

### Step 6: Access Nextcloud (30 seconds)
- Visit: `https://nextcloud.yourdomain.com`
- Login: `admin` / (password shown in AIO interface)
- 🎉 Done!

---

## 🔗 Connect to WebQx EMR

### 1. Create App Password
In Nextcloud:
1. Click profile icon → Settings
2. Security → Devices & sessions
3. Create new app password: "WebQx EMR"
4. Copy the password (looks like: `xxxxx-xxxxx-xxxxx-xxxxx-xxxxx`)

### 2. Get WebDAV URL
```
https://nextcloud.yourdomain.com/remote.php/dav/files/admin/
```

### 3. Add to Railway Variables
```bash
NEXTCLOUD_WEBDAV_URL=https://nextcloud.yourdomain.com/remote.php/dav/files/admin/
NEXTCLOUD_USERNAME=admin
NEXTCLOUD_PASSWORD=xxxxx-xxxxx-xxxxx-xxxxx-xxxxx
```

### 4. Test Connection
```bash
curl -u admin:xxxxx-xxxxx-xxxxx-xxxxx-xxxxx \
  -X PROPFIND \
  https://nextcloud.yourdomain.com/remote.php/dav/files/admin/
```

**Expected response**: XML with folder structure ✅

---

## 🎤 Usage in WebQx

### Audio Recording Workflow
```javascript
// 1. Record audio in browser
const recorder = new MediaRecorder(stream);

// 2. Upload to Nextcloud
const uploadToNextcloud = async (audioBlob, fileName) => {
  const response = await fetch(
    `${process.env.NEXTCLOUD_WEBDAV_URL}${fileName}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Basic ${btoa(
          `${process.env.NEXTCLOUD_USERNAME}:${process.env.NEXTCLOUD_PASSWORD}`
        )}`,
        'Content-Type': 'audio/webm'
      },
      body: audioBlob
    }
  );
  return response.ok;
};

// 3. Transcribe with OpenAI Whisper
const transcribe = async (audioBlob) => {
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.webm');
  formData.append('model', 'whisper-1');
  
  const response = await fetch('/emr/transcribe', {
    method: 'POST',
    body: formData
  });
  
  return await response.json();
};

// 4. Save to Medplum FHIR
const saveTranscription = async (patientId, transcriptionText, audioUrl) => {
  await medplum.createResource({
    resourceType: 'DocumentReference',
    status: 'current',
    type: { text: 'Voice Note Transcription' },
    subject: { reference: `Patient/${patientId}` },
    content: [{
      attachment: {
        contentType: 'text/plain',
        data: btoa(transcriptionText),
        url: audioUrl
      }
    }]
  });
};
```

---

## 📊 What You Get

### Automatically Configured:
- ✅ **Nextcloud Server** - File storage & sync
- ✅ **PostgreSQL** - Database for Nextcloud
- ✅ **Redis** - Caching layer
- ✅ **Apache/Caddy** - Web server with SSL
- ✅ **Automatic SSL** - Let's Encrypt certificates
- ✅ **Backups** - Automated backup system
- ✅ **Updates** - One-click updates

### Optional Add-ons (Enable in AIO):
- 📝 **Collabora Office** - Office document editing
- 📞 **Nextcloud Talk** - Video calls (alternative to Jitsi)
- 🔍 **Full-text Search** - Search inside documents
- 🛡️ **ClamAV** - Antivirus scanning

---

## 🔧 Common Issues

### "Domain not accepted"
**Solution**: Check DNS propagation
```bash
# Test DNS:
nslookup nextcloud.yourdomain.com

# Should show your server IP
```

### "Port 443 already in use"
**Solution**: Check what's using port 443
```bash
sudo lsof -i :443
sudo systemctl stop nginx  # or apache2
```

### "Container failed to start"
**Solution**: Check logs
```bash
sudo docker logs nextcloud-aio-mastercontainer
sudo docker logs nextcloud-aio-nextcloud
```

### "WebDAV 401 Unauthorized"
**Solution**: 
1. Use app password (not main password)
2. Check username is correct
3. Verify password has no typos

---

## 📦 Files Created

After deployment, you'll have these Docker containers:

```bash
sudo docker ps --filter name=nextcloud-aio

# You should see:
nextcloud-aio-mastercontainer  # AIO management interface
nextcloud-aio-apache           # Web server
nextcloud-aio-nextcloud        # Nextcloud application
nextcloud-aio-database         # PostgreSQL
nextcloud-aio-redis            # Redis cache
nextcloud-aio-clamav           # (if enabled)
nextcloud-aio-collabora        # (if enabled)
nextcloud-aio-talk             # (if enabled)
```

---

## 🔄 Maintenance

### Update Nextcloud
1. Go to AIO interface: `https://YOUR-IP:8080`
2. Click "Check for updates"
3. Click "Update containers"
4. Wait 5-10 minutes
5. Done!

### Backup Now
1. AIO interface → Backup section
2. Set backup location: `/mnt/backup-drive/`
3. Click "Create backup"

### View Logs
```bash
# AIO logs:
sudo docker logs nextcloud-aio-mastercontainer

# Nextcloud logs:
sudo docker exec -it nextcloud-aio-nextcloud \
  tail -f /var/www/html/data/nextcloud.log
```

---

## 🎯 Success Checklist

After setup, you should be able to:

- [x] Access Nextcloud web interface
- [x] Login with admin account
- [x] Upload files via web interface
- [x] Create app password for WebQx
- [x] Test WebDAV connection with curl
- [x] See files in Nextcloud folder structure
- [x] WebQx uploads audio files successfully
- [x] Audio files appear in Nextcloud
- [x] Transcription workflow works end-to-end

---

## 💡 Pro Tips

### 1. Use Dedicated User for WebQx
Instead of `admin`, create `webqx-service` user:
- More secure (limited permissions)
- Easier to track which files WebQx created
- Can revoke access without affecting admin

### 2. Organize Files
Create folder structure:
```
WebQx-EMR/
  ├── audio/
  ├── documents/
  └── images/
```

### 3. Enable Versioning
Nextcloud automatically keeps file versions. Configure retention:
- Settings → Administration → Additional settings
- Versions: Keep all versions for 30 days

### 4. Monitor Storage
Check disk usage:
```bash
sudo docker exec nextcloud-aio-nextcloud du -sh /mnt/ncdata
```

---

## 🆘 Support

- **Nextcloud AIO Docs**: https://github.com/nextcloud/all-in-one
- **Nextcloud Forum**: https://help.nextcloud.com
- **WebDAV Docs**: https://docs.nextcloud.com/server/latest/user_manual/en/files/access_webdav.html
- **WebQx Issues**: https://github.com/WebQx/EMR/issues

---

**Total Setup Time**: ~20 minutes (mostly waiting for downloads)

**Difficulty**: ⭐⭐☆☆☆ (Beginner-friendly)

**Production Ready**: ✅ Yes

**Cost**: $0 (Nextcloud is 100% free and open source)

---

🎉 **You're done!** Your WebQx EMR now has enterprise-grade file storage powered by Nextcloud AIO.
