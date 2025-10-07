# 🚀 Railway Configuration Guide - Medplum + Nextcloud + OpenAI

**Date:** October 5, 2025  
**Action Required:** Manual Railway variable configuration  
**Reason:** Railway token has limited API access - needs manual setup

---

## 🎯 WHAT YOU NEED TO DO

Since the Railway API token has limited permissions, please **manually add these variables** to Railway:

### **0. Core Database (MySQL/MariaDB)**

Add these first so the portal can persist data. If you attached Railway's MySQL plugin, you can reference it directly.

```bash
# Recommended: use the managed connection string
# Variable Name: DB_URL
# Value: ${{ MySQL.MYSQL_URL }}

# Optional: Override individual fields if you prefer explicit host/port variables
# DB_HOST=${{ MySQL.HOST }}
# DB_PORT=${{ MySQL.PORT }}
# DB_USER=${{ MySQL.USER }}
# DB_PASSWORD=${{ MySQL.PASSWORD }}
# DB_NAME=${{ MySQL.DATABASE }}
```

> ℹ️ The application now auto-detects `DB_URL`, `DATABASE_URL`, or `MYSQL_URL`, including SSL flags such as `?ssl=true`. If your provider requires custom certificates, set `DB_SSL_CA`, `DB_SSL_CERT`, and `DB_SSL_KEY` as additional variables.

After saving the variable, trigger a redeploy (Railway usually does this automatically) so the server restarts and the new connection string is parsed. Watch the deployment logs for:

```
ℹ️ MariaDB connector configured via connection string (...)
```

If you see `Unknown database 'railway.'`, double-check that your URL doesn't have a trailing dot—Railway sometimes shows this when copying. The connector now strips trailing dots automatically, but confirming the dashboard value helps avoid typos.

### **Step-by-Step Instructions:**

1. **Go to Railway Dashboard:**  
   👉 https://railway.app/dashboard

2. **Select Your Project:**  
   Click on **"webqx-production"** (or whatever your project is named)

3. **Select Your Service:**  
   Click on the main service (should be the unified-server)

4. **Go to Variables Tab:**  
   Click **"Variables"** in the left sidebar

5. **Add ALL These Variables:**  
   Click **"+ New Variable"** for each one below

---

## 🔑 REQUIRED VARIABLES TO ADD

### **1. Medplum FHIR Server (BACKBONE #1)**

```bash
# Variable Name: MEDPLUM_API_URL
# Value: https://api.medplum.com
# (Or your self-hosted Medplum URL)

# Variable Name: MEDPLUM_CLIENT_ID
# Value: [YOUR_MEDPLUM_CLIENT_ID]
# Get from: https://app.medplum.com/ → Settings → Client Applications

# Variable Name: MEDPLUM_CLIENT_SECRET  
# Value: [YOUR_MEDPLUM_CLIENT_SECRET]
# Get from: https://app.medplum.com/ → Settings → Client Applications
```

**Where to get Medplum credentials:**
1. Go to https://app.medplum.com/
2. Sign in to your Medplum account
3. Click your project
4. Go to **Settings** → **Client Applications**
5. Click **"Create new client application"**
6. Copy the Client ID and Secret

---

### **2. Nextcloud File Storage (BACKBONE #2)**

```bash
# Variable Name: NEXTCLOUD_WEBDAV_URL
# Value: https://your-nextcloud-domain.com/remote.php/dav/files/admin/
# (Replace with your actual Nextcloud URL)

# Variable Name: NEXTCLOUD_USERNAME
# Value: admin
# (Or your Nextcloud username)

# Variable Name: NEXTCLOUD_PASSWORD
# Value: [YOUR_NEXTCLOUD_APP_PASSWORD]
# Get from: Nextcloud → Settings → Security → Create app password
```

**Where to get Nextcloud credentials:**
1. Log in to your Nextcloud instance
2. Go to **Settings** → **Security**
3. Scroll to **"Devices & sessions"**
4. Click **"Create new app password"**
5. Name it "WebQx EMR Railway"
6. Copy the generated password (NOT your main password!)

**WebDAV URL format:**
```
https://[your-nextcloud-domain]/remote.php/dav/files/[username]/
```

---

### **3. OpenAI Whisper API (TRANSCRIPTION)**

```bash
# Variable Name: OPENAI_API_KEY
# Value: sk-proj-[YOUR_OPENAI_API_KEY]
# Get from: https://platform.openai.com/api-keys

# Variable Name: WHISPER_BASE_URL (Optional)
# Value: https://api.openai.com/v1

# Variable Name: WHISPER_MODEL (Optional)
# Value: whisper-1
```

**Where to get OpenAI API Key:**
1. Go to https://platform.openai.com/api-keys
2. Click **"+ Create new secret key"**
3. Name it "WebQx EMR Production"
4. Copy the key (starts with `sk-proj-` or `sk-`)
5. **IMPORTANT:** Save it immediately - you can't view it again!

---

## 📋 VERIFICATION CHECKLIST

After adding all variables, check these boxes:

### **Medplum Variables:**
- [ ] `MEDPLUM_API_URL` added
- [ ] `MEDPLUM_CLIENT_ID` added
- [ ] `MEDPLUM_CLIENT_SECRET` added
- [ ] Values are correct (no typos, no extra spaces)

### **Nextcloud Variables:**
- [ ] `NEXTCLOUD_WEBDAV_URL` added (includes `/remote.php/dav/files/username/`)
- [ ] `NEXTCLOUD_USERNAME` added
- [ ] `NEXTCLOUD_PASSWORD` added (use App Password, not main password!)
- [ ] WebDAV URL ends with trailing slash `/`

### **OpenAI Variables:**
- [ ] `OPENAI_API_KEY` added (starts with `sk-proj-` or `sk-`)
- [ ] API key is valid (test at https://platform.openai.com/playground)
- [ ] Billing is set up in OpenAI account

---

## 🚀 AFTER ADDING VARIABLES

### **Step 1: Railway Will Auto-Redeploy**

Railway automatically redeploys when you add/change variables. Wait 2-3 minutes.

### **Step 2: Test the Deployment**

Run this command to verify everything is working:

```bash
./check-production-status.sh
```

**Expected Result:**
```
✅ OpenAI Whisper Transcription: ONLINE
   Model: whisper-1
   Max File Size: 25MB

✅ WebQx EMR Service: ONLINE
   Medplum: ONLINE (latency: ~200ms)
   Nextcloud: ONLINE (latency: ~150ms)

✅ PRODUCTION READY - All systems operational!
```

### **Step 3: Test Voice Transcription**

1. Visit: https://webqx-production.up.railway.app/provider/webqx-emr-demo.html
2. Click the microphone icon
3. Allow browser microphone access
4. Speak clearly
5. Click Stop
6. Text should appear automatically ✅

### **Step 4: Test Telehealth**

1. Visit: https://webqx-production.up.railway.app/provider/telehealth-scheduling.html
2. Click "Schedule New Telehealth Visit"
3. Start a video call
4. Jitsi Meet should load ✅

---

## 🐛 TROUBLESHOOTING

### **If Medplum shows OFFLINE:**

**Check:**
- Is `MEDPLUM_API_URL` correct? (Should be `https://api.medplum.com` or your URL)
- Is `MEDPLUM_CLIENT_ID` correct? (No typos, no spaces)
- Is `MEDPLUM_CLIENT_SECRET` correct?
- Test directly: `curl https://api.medplum.com/metadata`

**Fix:**
- Log in to https://app.medplum.com/
- Go to Settings → Client Applications
- Verify or recreate your client
- Update Railway variables

---

### **If Nextcloud shows OFFLINE:**

**Check:**
- Is `NEXTCLOUD_WEBDAV_URL` correct format?
  - Should include `/remote.php/dav/files/username/`
  - Should end with trailing slash `/`
- Is username correct?
- Is password an **App Password** (not main password)?

**Test WebDAV manually:**
```bash
curl -u "username:app_password" \
  -X PROPFIND \
  -H "Depth: 0" \
  https://your-nextcloud.com/remote.php/dav/files/username/
```

**Fix:**
- Generate new App Password in Nextcloud
- Check WebDAV URL format
- Update Railway variables

---

### **If Transcription shows OFFLINE:**

**Check:**
- Is `OPENAI_API_KEY` set?
- Does it start with `sk-proj-` or `sk-`?
- Is billing set up in OpenAI account?

**Test API key:**
```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Fix:**
- Go to https://platform.openai.com/api-keys
- Generate new key
- Add billing: https://platform.openai.com/account/billing
- Update Railway variable

---

## 📊 WHAT EACH SERVICE DOES

### **Medplum (FHIR Server):**
- ✅ Stores patient demographics
- ✅ Stores medical encounters
- ✅ Stores prescriptions
- ✅ Stores lab results
- ✅ Provides FHIR API for queries
- ❌ **Without it:** Cannot save any medical data

### **Nextcloud (File Storage):**
- ✅ Stores audio recordings
- ✅ Stores documents (PDFs, images)
- ✅ Stores patient files
- ✅ Provides file versioning
- ✅ Enables file sharing
- ❌ **Without it:** Cannot store any files

### **OpenAI Whisper (Transcription):**
- ✅ Converts speech to text
- ✅ Supports 90+ languages
- ✅ Medical terminology aware
- ✅ Real-time transcription
- ❌ **Without it:** Voice button won't work

---

## 💰 COST ESTIMATE

### **After Configuration:**
- **Railway:** $5-20/month (hosting)
- **Medplum:** Free tier (100 API calls/day) or $99/month
- **Nextcloud:** Your hosting cost (if self-hosted) or $5-50/month (managed)
- **OpenAI:** $0.006/minute (~$6/month for 1000 minutes)

**Total: $11-175/month** (depending on Medplum/Nextcloud choices)

---

## 🆘 IF YOU NEED HELP

### **Option 1: You Already Have These Services**
→ Just provide the URLs and credentials above

### **Option 2: You Need to Set Up Medplum**
→ Let me know and I'll provide setup guide

### **Option 3: You Need to Set Up Nextcloud**
→ Let me know and I'll provide deployment guide

### **Option 4: You Need to Set Up OpenAI**
→ Go to https://platform.openai.com/signup

---

## ✅ SUMMARY

**What to do RIGHT NOW:**

1. **Go to Railway Dashboard** → Variables tab
2. **Add Medplum variables** (API URL, Client ID, Client Secret)
3. **Add Nextcloud variables** (WebDAV URL, Username, App Password)
4. **Add OpenAI variable** (API Key)
5. **Wait for auto-redeploy** (2-3 minutes)
6. **Run test script:** `./check-production-status.sh`
7. **Test voice button and telehealth**

---

**Status:** ⏳ Waiting for Railway variables to be added  
**Action Required:** Manual configuration in Railway dashboard  
**Expected Time:** 10-15 minutes to add all variables  
**Result:** Full WebQx EMR with Medplum + Nextcloud + Transcription! 🎉
