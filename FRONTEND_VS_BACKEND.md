# WebQx EMR - Frontend vs Backend Architecture

## 🏗️ System Architecture

Your WebQx EMR has **TWO SEPARATE** components:

---

## 🎨 FRONTEND (User Interface)

**URL**: https://webqx.github.io/EMR/

### Purpose
- User interface for doctors, nurses, and patients
- Static HTML/CSS/JavaScript pages
- Hosted on GitHub Pages

### What Users See
- Patient registration forms
- Patient list and search
- Video consultation interface (Jitsi Meet)
- Audio recording widget
- File upload interface
- Medical notes editor

### Technology
- **Hosting**: GitHub Pages (free)
- **Framework**: Static HTML/JS
- **Video**: Jitsi Meet embedded
- **Audio**: Web Audio API

### Code Location
- Repository: `WebQx/EMR` (GitHub)
- Branch: `main` (or `gh-pages`)
- Path: `/` root or `/docs` folder

---

## ⚙️ BACKEND (API Server)

**URL**: https://webqx-production.up.railway.app

### Purpose
- REST API for data operations
- Integration with external services
- Authentication and authorization
- Business logic

### What Backend Does
- Store/retrieve patient records (via Medplum)
- Transcribe audio (via OpenAI Whisper)
- Store files (via Nextcloud)
- Health monitoring
- Data validation

### Technology
- **Hosting**: Railway (production server)
- **Framework**: Node.js + Express
- **Ports**: 
  - Port 8080: Unified Server (gateway)
  - Port 3100: WebQx EMR Service (API)
  - Port 3003: Telehealth Server

### Services Integrated
1. **Medplum FHIR** (Patient records)
2. **OpenAI Whisper** (Transcription)
3. **Nextcloud AIO** (File storage)

---

## 🔄 How They Connect

```
┌─────────────────────────────────────────────────────────┐
│  FRONTEND (User Interface)                              │
│  https://webqx.github.io/EMR/                           │
│                                                          │
│  • Static HTML/CSS/JavaScript                           │
│  • Runs in user's browser                               │
│  • GitHub Pages hosting                                 │
│                                                          │
│  Components:                                             │
│  • Patient forms                                         │
│  • Jitsi Meet integration                               │
│  • Audio recorder                                        │
│  • File uploader                                         │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ HTTPS API Calls
                     │ (fetch, axios, XMLHttpRequest)
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  BACKEND (API Server)                                   │
│  https://webqx-production.up.railway.app                │
│                                                          │
│  • Node.js + Express server                             │
│  • Railway cloud hosting                                │
│  • REST API endpoints                                   │
│                                                          │
│  API Endpoints:                                          │
│  • POST /emr/patients         (Create patient)          │
│  • GET  /emr/patients         (List patients)           │
│  • GET  /emr/patients/:id     (Get patient)             │
│  • PUT  /emr/patients/:id     (Update patient)          │
│  • GET  /emr/patients/search  (Search patients)         │
│  • POST /emr/transcribe       (Transcribe audio)        │
│  • GET  /emr/health/full      (Health check)            │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ External API Calls
                     │
        ┌────────────┼────────────┬─────────────┐
        │            │             │             │
        ▼            ▼             ▼             ▼
┌───────────┐ ┌───────────┐ ┌──────────┐ ┌────────────┐
│  Medplum  │ │ Nextcloud │ │  OpenAI  │ │   Jitsi    │
│   FHIR    │ │    AIO    │ │ Whisper  │ │    Meet    │
│           │ │           │ │          │ │            │
│  Patient  │ │   File    │ │  Speech  │ │   Video    │
│  Records  │ │  Storage  │ │ to Text  │ │   Calls    │
└───────────┘ └───────────┘ └──────────┘ └────────────┘
```

---

## 📡 API Communication Example

### Frontend Code (JavaScript)
```javascript
// Running at: https://webqx.github.io/EMR/

const BACKEND_URL = 'https://webqx-production.up.railway.app:3100';

// Create a patient
async function createPatient(patientData) {
  const response = await fetch(`${BACKEND_URL}/emr/patients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patientData)
  });
  return await response.json();
}

// Transcribe audio
async function transcribeAudio(audioBlob) {
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.mp3');
  
  const response = await fetch(`${BACKEND_URL}/emr/transcribe`, {
    method: 'POST',
    body: formData
  });
  return await response.json();
}
```

### Backend Code (Node.js)
```javascript
// Running at: https://webqx-production.up.railway.app

// Backend handles the business logic
router.post('/emr/patients', async (req, res) => {
  // 1. Validate input
  if (!req.body.name) {
    return res.status(400).json({ error: 'Name required' });
  }
  
  // 2. Authenticate with Medplum using OAuth2
  const token = await getAccessToken();
  
  // 3. Create patient in Medplum FHIR
  const patient = await createPatient(req.body);
  
  // 4. Return result to frontend
  res.status(201).json({ patient });
});
```

---

## 🔒 CORS Configuration

The backend **MUST** allow requests from the frontend domain.

### Backend CORS Setup
```javascript
// light-emr-adapter/src/server.js

import cors from 'cors';

// Allow frontend domain
const allowedOrigins = [
  'https://webqx.github.io',  // GitHub Pages domain
  'http://localhost:3000'      // Local development
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
```

### Railway Environment Variable
```bash
ALLOWED_ORIGINS=https://webqx.github.io,http://localhost:3000
```

---

## 🚀 Deployment Checklist

### Frontend Deployment (GitHub Pages)
- [x] Code pushed to GitHub repository
- [x] GitHub Pages enabled
- [x] Custom domain configured (optional)
- [x] HTTPS enabled (automatic)
- [ ] Update all API calls to use production backend URL

### Backend Deployment (Railway)
- [x] Code deployed to Railway
- [x] Environment variables set:
  - `MEDPLUM_CLIENT_ID`
  - `MEDPLUM_CLIENT_SECRET`
  - `OPENAI_API_KEY`
  - `NEXTCLOUD_WEBDAV_URL`
  - `NEXTCLOUD_USERNAME`
  - `NEXTCLOUD_PASSWORD`
  - `ALLOWED_ORIGINS`
- [x] Ports exposed (8080, 3100, 3003)
- [x] CORS configured for frontend domain

---

## 📊 Key Differences

| Aspect | Frontend | Backend |
|--------|----------|---------|
| **URL** | https://webqx.github.io/EMR/ | https://webqx-production.up.railway.app |
| **Purpose** | User interface | API server |
| **Hosting** | GitHub Pages | Railway |
| **Language** | HTML/CSS/JavaScript | Node.js |
| **Cost** | $0 (free) | $0-5/month |
| **Credentials** | None (public) | API keys, OAuth tokens |
| **Data** | None (stateless) | Connects to Medplum, OpenAI, Nextcloud |
| **Users Access** | ✅ Yes, directly | ❌ No, only via API |

---

## 🧪 Testing

### Test Frontend (in browser)
1. Open: https://webqx.github.io/EMR/
2. Open browser console (F12)
3. Check for API connection errors

### Test Backend (command line)
```bash
# Health check
curl https://webqx-production.up.railway.app:3100/emr/health/full

# Test all services
./test-complete-workflow.sh https://webqx-production.up.railway.app
```

### Test CORS (in browser console)
```javascript
// Should work if CORS is configured correctly
fetch('https://webqx-production.up.railway.app:3100/emr/health/full')
  .then(r => r.json())
  .then(data => console.log('CORS working:', data))
  .catch(err => console.error('CORS error:', err));
```

---

## 💡 Important Notes

### 1. Frontend Does NOT Store Credentials
❌ **NEVER** put these in frontend code:
- `MEDPLUM_CLIENT_SECRET`
- `OPENAI_API_KEY`
- `NEXTCLOUD_PASSWORD`

✅ **Credentials ONLY in backend** (Railway environment variables)

### 2. Frontend Makes API Calls
```javascript
// Frontend sends request to backend
fetch('https://webqx-production.up.railway.app:3100/emr/patients')

// Backend uses credentials to fetch from Medplum
// Backend returns data to frontend
```

### 3. URLs Are Different
- **Frontend**: https://webqx.github.io/EMR/ (GitHub Pages)
- **Backend**: https://webqx-production.up.railway.app (Railway)

**DO NOT MIX THEM!**

---

## 🎯 Summary

### Frontend (https://webqx.github.io/EMR/)
- **What**: User interface
- **Where**: GitHub Pages
- **Who**: End users (doctors, patients)
- **Access**: Public, anyone can visit

### Backend (https://webqx-production.up.railway.app)
- **What**: API server
- **Where**: Railway cloud
- **Who**: Frontend makes API calls
- **Access**: Programmatic only (API endpoints)

### Flow
```
User → Frontend → Backend → External Services
                            (Medplum, OpenAI, Nextcloud)
```

---

## ✅ Verification

### Frontend is Working
- Visit: https://webqx.github.io/EMR/
- Should see: Patient management interface

### Backend is Working
- Visit: https://webqx-production.up.railway.app:3100/emr/health/full
- Should see: JSON health status

### They're Connected
- Frontend can make API calls to backend
- CORS allows cross-origin requests
- Authentication happens on backend only

---

**Remember**: Keep frontend and backend **SEPARATE** at all times!
