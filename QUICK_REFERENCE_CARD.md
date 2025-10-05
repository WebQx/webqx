# 🚀 WebQx EMR - Quick Reference Card

## 📋 Essential URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | https://webqx.github.io | Patient/Provider interface |
| **Backend API** | https://webqx-production.up.railway.app | REST API endpoints |
| **Nextcloud** | https://nextcloud.yourdomain.com | File storage dashboard |
| **Nextcloud Admin** | https://YOUR-VPS-IP:8080 | AIO management interface |
| **Medplum** | https://app.medplum.com | FHIR server dashboard |
| **Railway** | https://railway.app/dashboard | Deployment dashboard |

---

## 🔑 Quick Commands

### Check System Health
```bash
curl https://webqx-production.up.railway.app/emr/status
```

### Test Medplum Connection
```bash
curl https://webqx-production.up.railway.app/emr/status | jq '.services.medplum'
```

### Test Nextcloud Connection
```bash
curl -u admin:APP_PASSWORD \
  -X PROPFIND \
  https://nextcloud.yourdomain.com/remote.php/dav/files/admin/
```

### View Railway Logs
```bash
# In Railway dashboard → Deployments → Logs
# Or use CLI:
railway logs
```

### View Nextcloud Logs
```bash
ssh root@YOUR-VPS-IP
docker logs nextcloud-aio-mastercontainer
docker logs nextcloud-aio-nextcloud
```

---

## 🎤 Test Transcription

```bash
# Download test audio:
curl -o test.mp3 https://www2.cs.uic.edu/~i101/SoundFiles/BabyElephantWalk60.wav

# Upload for transcription:
curl -X POST https://webqx-production.up.railway.app/emr/transcribe \
  -F "file=@test.mp3" \
  -F "language=en"
```

---

## 📤 Test File Upload to Nextcloud

```bash
# Create test file:
echo "Test from WebQx" > test.txt

# Upload:
curl -u admin:APP_PASSWORD \
  -T test.txt \
  https://nextcloud.yourdomain.com/remote.php/dav/files/admin/test.txt

# Verify in browser:
# https://nextcloud.yourdomain.com/apps/files
```

---

## 🔧 Common Maintenance Tasks

### Update Nextcloud (Monthly)
1. Go to https://YOUR-VPS-IP:8080
2. Log in to AIO interface
3. Click "Check for updates"
4. Click "Update containers"
5. Wait 5-10 minutes

### Backup Nextcloud (Weekly)
```bash
# In AIO interface → Backup section → Create backup
# Or via command line:
ssh root@YOUR-VPS-IP
docker exec nextcloud-aio-borgbackup /start.sh backup
```

### Check Medplum Usage
1. Go to https://app.medplum.com
2. Admin → Usage
3. Verify requests < 100/month

### Clean Up Old Audio Files
```bash
# Delete files older than 90 days:
ssh root@YOUR-VPS-IP
docker exec nextcloud-aio-nextcloud find /mnt/ncdata/admin/files/audio/ -type f -mtime +90 -delete
```

---

## 🆘 Emergency Troubleshooting

### Backend Down
```bash
# Check Railway status:
railway status

# Restart:
railway up

# Or in Railway dashboard:
# Deployments → Latest → Redeploy
```

### Nextcloud Down
```bash
ssh root@YOUR-VPS-IP

# Check containers:
docker ps -a | grep nextcloud

# Restart AIO:
docker restart nextcloud-aio-mastercontainer

# Restart all containers:
docker restart $(docker ps -aq --filter name=nextcloud-aio)
```

### Out of Medplum Requests
**Solutions:**
1. Wait until next month (resets on 1st)
2. Upgrade to paid plan ($99/month)
3. Implement caching (see optimization guide)

### WebDAV 401 Error
**Solution:** Regenerate app password
1. Nextcloud → Settings → Security
2. Revoke old app password
3. Create new app password: "WebQx EMR"
4. Update Railway variables:
   ```
   NEXTCLOUD_PASSWORD=<new-app-password>
   ```

---

## 📊 Monthly Checklist

### Week 1:
- [ ] Check Medplum request count
- [ ] Review Railway usage
- [ ] Check Nextcloud storage (should be <35GB)
- [ ] Backup Nextcloud data

### Week 2:
- [ ] Update Nextcloud (if updates available)
- [ ] Review application logs for errors
- [ ] Test voice recording workflow

### Week 3:
- [ ] Clean up old audio files (>90 days)
- [ ] Check OpenAI Whisper costs
- [ ] Verify all services responding

### Week 4:
- [ ] Export Medplum data for backup
- [ ] Review user access logs
- [ ] Test disaster recovery plan
- [ ] Update documentation if needed

---

## 🎯 Performance Benchmarks

**Expected Response Times:**

| Endpoint | Expected Time | Acceptable |
|----------|--------------|-----------|
| `/health` | <50ms | <200ms |
| `/emr/status` | <500ms | <2s |
| `/emr/transcribe` | 5-15s | <30s |
| Nextcloud file upload | 1-3s | <10s |
| Medplum FHIR query | 200-500ms | <2s |

**If slower, investigate:**
- Railway container sleeping (cold start)
- Nextcloud VPS overloaded
- Network latency
- Large file uploads

---

## 💡 Pro Tips

### 1. Bookmark These URLs
- AIO Admin: `https://YOUR-VPS-IP:8080`
- Medplum Dashboard: `https://app.medplum.com`
- Railway Dashboard: `https://railway.app/project/YOUR-PROJECT-ID`

### 2. Set Up Alerts
```javascript
// Add to your monitoring:
if (medplumRequests > 80) {
  alert('80% of Medplum free tier used!');
}

if (nextcloudStorage > 35) {
  alert('Nextcloud storage at 35GB (88% full)');
}
```

### 3. Keep Credentials Secure
- Use password manager (1Password, Bitwarden)
- Never commit secrets to git
- Rotate app passwords quarterly

### 4. Test Before Deployment
```bash
# Local testing:
npm run test

# Staging deployment:
git push staging

# Production deployment:
git push main
```

---

## 📱 Mobile Quick Reference

**For on-the-go management:**

### Check if System is Up (via browser)
```
https://webqx-production.up.railway.app/health
```
Should show: `{"status":"ok"}`

### Access Nextcloud Mobile App
1. Download "Nextcloud" app (iOS/Android)
2. Server: `https://nextcloud.yourdomain.com`
3. Login: `admin` / `<your-password>`
4. View uploaded files on mobile

### Emergency Restart (via phone)
1. Railway app → Your project → Redeploy
2. Or SSH from phone (Termius app):
   ```bash
   ssh root@YOUR-VPS-IP
   docker restart nextcloud-aio-mastercontainer
   ```

---

## 🔍 Useful Jq Queries

**Parse JSON responses:**

```bash
# Get Medplum status:
curl https://webqx.../emr/status | jq '.services.medplum.status'

# Get all service latencies:
curl https://webqx.../emr/status | jq '.services[].latency_ms'

# Check if any service is down:
curl https://webqx.../emr/status | jq '.services | to_entries[] | select(.value.status != "available")'
```

---

## 📞 Support Contacts

| Issue Type | Contact |
|-----------|---------|
| Code bugs | https://github.com/WebQx/EMR/issues |
| Nextcloud issues | https://help.nextcloud.com |
| Medplum issues | support@medplum.com |
| Railway issues | https://railway.app/help |
| OpenAI issues | https://help.openai.com |

---

## 🎓 Learning Resources

- **FHIR Basics**: https://www.hl7.org/fhir/
- **WebDAV Protocol**: https://datatracker.ietf.org/doc/html/rfc4918
- **Docker Commands**: https://docs.docker.com/engine/reference/commandline/cli/
- **Nextcloud Admin Guide**: https://docs.nextcloud.com/server/latest/admin_manual/
- **Medplum Docs**: https://www.medplum.com/docs

---

## ✅ Daily Health Check (30 seconds)

```bash
#!/bin/bash
# Save as: check-webqx-health.sh

echo "🏥 WebQx EMR Health Check"
echo "========================="

# 1. Backend API
echo -n "Backend API: "
if curl -s https://webqx-production.up.railway.app/health | grep -q "ok"; then
  echo "✅ UP"
else
  echo "❌ DOWN"
fi

# 2. Nextcloud
echo -n "Nextcloud: "
if curl -s https://nextcloud.yourdomain.com | grep -q "Nextcloud"; then
  echo "✅ UP"
else
  echo "❌ DOWN"
fi

# 3. Medplum
echo -n "Medplum: "
if curl -s https://api.medplum.com/healthcheck | grep -q "ok"; then
  echo "✅ UP"
else
  echo "❌ DOWN"
fi

echo "========================="
echo "✅ All systems operational!"
```

**Usage:**
```bash
chmod +x check-webqx-health.sh
./check-webqx-health.sh
```

---

## 🎉 Success Indicators

You're doing great if:
- ✅ All health checks pass
- ✅ Medplum requests < 80/month
- ✅ Nextcloud storage < 35GB
- ✅ Railway uptime > 99%
- ✅ Response times < 2 seconds
- ✅ No critical errors in logs
- ✅ Backups running weekly
- ✅ Users reporting good performance

---

**Last Updated**: October 5, 2025

**Keep this card handy!** Print it out or bookmark this page.

---

*Need help? Check the full documentation in the repository.*
