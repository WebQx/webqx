# 🚨 CRITICAL: Medplum & Nextcloud Configuration Required

**Date:** October 5, 2025  
**Status:** ❌ BLOCKING DEPLOYMENT  
**Issue:** WebQx EMR backbone services NOT configured in Railway

---

## 🔴 CRITICAL ISSUE

**WebQx EMR IS NOT WORKING** because the production Railway instance is missing:
- ❌ Medplum FHIR server configuration (REQUIRED for patient records)
- ❌ Nextcloud file storage configuration (REQUIRED for documents/audio)
- ❌ OpenAI Whisper API key (REQUIRED for transcription)

**Current Status from Production:**
```
WebQx EMR: ❌ OFFLINE
Transcription: ❌ NOT CONFIGURED
EMR Service: Cannot start without Medplum + Nextcloud
```

---

## ✅ WHAT YOU NEED TO PROVIDE

### **1. Medplum FHIR Server** (REQUIRED - BACKBONE #1)

You mentioned you have Medplum working. Please provide:

```bash
# Option A: Medplum Cloud (Hosted)
MEDPLUM_API_URL=https://api.medplum.com
MEDPLUM_CLIENT_ID=________________  # ← YOUR CLIENT ID
MEDPLUM_CLIENT_SECRET=________________  # ← YOUR SECRET

# Option B: Self-Hosted Medplum
MEDPLUM_API_URL=https://your-medplum-instance.com
MEDPLUM_CLIENT_ID=________________
MEDPLUM_CLIENT_SECRET=________________
```

**Where to get:**
- If using Medplum Cloud: https://app.medplum.com/ → Settings → Client Applications
- If self-hosted: Your Medplum admin panel

---

### **2. Nextcloud File Storage** (REQUIRED - BACKBONE #2)

You mentioned you have Nextcloud working. Please provide:

```bash
# Nextcloud WebDAV Configuration
NEXTCLOUD_WEBDAV_URL=https://________________/remote.php/dav/files/admin/
NEXTCLOUD_USERNAME=________________
NEXTCLOUD_PASSWORD=________________  # Use App Password, not main password!
```

**Where to get:**
- Nextcloud URL: Your Nextcloud domain (e.g., `cloud.yourdomain.com`)
- WebDAV Path: `https://[domain]/remote.php/dav/files/[username]/`
- App Password: Settings → Security → Devices & sessions → Create new app password

---

### **3. OpenAI Whisper** (REQUIRED for transcription)

```bash
OPENAI_API_KEY=sk-proj-________________
```

**Where to get:**
- https://platform.openai.com/api-keys

---

## 🚀 HOW TO ADD TO RAILWAY

### **Step 1: Go to Railway Dashboard**
1. Visit: https://railway.app/dashboard
2. Select your **webqx-production** service
3. Click **Variables** tab

### **Step 2: Add ALL Required Variables**

Click "+ New Variable" and add each one:

```bash
# MEDPLUM (REQUIRED)
MEDPLUM_API_URL=https://api.medplum.com
MEDPLUM_CLIENT_ID=your_client_id_here
MEDPLUM_CLIENT_SECRET=your_secret_here

# NEXTCLOUD (REQUIRED)
NEXTCLOUD_WEBDAV_URL=https://your-cloud.com/remote.php/dav/files/admin/
NEXTCLOUD_USERNAME=admin
NEXTCLOUD_PASSWORD=your_app_password_here

# OPENAI WHISPER (REQUIRED)
OPENAI_API_KEY=sk-proj-your_key_here
WHISPER_BASE_URL=https://api.openai.com/v1
WHISPER_MODEL=whisper-1
```

### **Step 3: Deploy**

Railway will automatically redeploy when you save variables.

### **Step 4: Verify**

After 2-3 minutes, run:
```bash
./check-production-status.sh
```

**Expected Result:**
```
✅ WebQx EMR: ONLINE
✅ Medplum: ONLINE (latency: ~200ms)
✅ Nextcloud: ONLINE (latency: ~150ms)
✅ Transcription: ONLINE
```

---

## 🔍 WHAT I NEED FROM YOU

Please provide the following information so I can help you configure Railway:

### **Question 1: Medplum**
- [ ] Are you using **Medplum Cloud** (https://api.medplum.com)?
- [ ] Or do you have a **self-hosted Medplum** instance?
- [ ] What is your Medplum URL?
- [ ] Do you have your Client ID and Secret ready?

### **Question 2: Nextcloud**
- [ ] Are you using **Nextcloud AIO** (All-In-One)?
- [ ] Or a **managed Nextcloud** service?
- [ ] Or a **self-hosted Nextcloud** instance?
- [ ] What is your Nextcloud domain?
- [ ] Can you access the WebDAV URL? (Test: `https://your-domain/remote.php/dav/files/admin/`)

### **Question 3: OpenAI**
- [ ] Do you have an OpenAI account with API access?
- [ ] Have you added billing/credits?
- [ ] Do you have an API key already?

---

## 🎯 IMMEDIATE ACTION REQUIRED

**Option A: You have the credentials**
→ Provide them now and I'll help you add them to Railway immediately

**Option B: You need to set up Medplum/Nextcloud**
→ I'll provide step-by-step setup guides for both

**Option C: They're already running somewhere**
→ Tell me where and I'll help you get the connection details

---

## 📋 WHY THIS IS CRITICAL

**Without Medplum:**
- ❌ Cannot store patient records
- ❌ Cannot save medical encounters
- ❌ Cannot query patient data
- ❌ No FHIR resources
- ❌ No structured medical data

**Without Nextcloud:**
- ❌ Cannot store audio recordings
- ❌ Cannot upload documents
- ❌ Cannot attach images/PDFs
- ❌ No file versioning
- ❌ No file sharing

**Without OpenAI:**
- ❌ Cannot transcribe audio
- ❌ Voice button won't work
- ❌ No speech-to-text

**Bottom line:** WebQx EMR **WILL NOT FUNCTION** without all three. They are the **CORE INFRASTRUCTURE**, not optional add-ons.

---

## 🆘 HELP ME HELP YOU

Please respond with ONE of these:

**Response 1:** "Here are my credentials" + paste the values above  
**Response 2:** "I need help setting up Medplum"  
**Response 3:** "I need help setting up Nextcloud"  
**Response 4:** "They're running at [URL], how do I connect?"  

I apologize for the confusion. You're absolutely right - **Medplum and Nextcloud are the backbone**, not optional. Let's get them configured in Railway RIGHT NOW.

---

**Status:** 🚨 BLOCKED - Waiting for Medplum + Nextcloud + OpenAI credentials  
**Priority:** CRITICAL - EMR cannot function without these  
**Action Required:** Provide connection details for all three services
