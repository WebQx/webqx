# WebQx EMR™ Backend Architecture
## The Complete Healthcare Data Stack

**Official Name:** WebQx EMR  
**Components:** Nextcloud + Medplum + OpenAI Whisper  
**Purpose:** Unified healthcare data backend for patient records, file storage, and medical transcription

---

## 🏗️ What is WebQx EMR?

**WebQx EMR** is the complete backend infrastructure that powers the WebQx Healthcare Platform. It integrates three best-in-class services to provide a comprehensive electronic medical records system:

```
┌─────────────────────────────────────────────────────────┐
│                     WebQx EMR™                          │
│    The Unified Healthcare Data Backend                 │
└─────────────────────────────────────────────────────────┘
                          │
           ┌──────────────┼──────────────┐
           │              │              │
    ┌──────▼─────┐ ┌─────▼──────┐ ┌────▼──────┐
    │ Nextcloud  │ │  Medplum   │ │  Whisper  │
    │    AIO     │ │   Cloud    │ │  OpenAI   │
    └────────────┘ └────────────┘ └───────────┘
    File Storage   FHIR Records   Transcription
```

---

## 📦 The Three Pillars

### 1. **Nextcloud AIO** - File Storage & Document Management
**Purpose:** Secure, HIPAA-compliant file storage for medical documents

**What it stores:**
- 📄 Patient consent forms
- 🔬 Lab result PDFs
- 📸 Medical imaging (X-rays, MRIs, CT scans)
- 📋 Clinical notes and reports
- 💊 Prescription records
- 📊 Insurance documents

**Technology:**
- WebDAV protocol for file access
- End-to-end encryption
- Role-based access control
- Audit logging for compliance
- Cross-platform sync

**Why Nextcloud?**
- ✅ Self-hosted (data sovereignty)
- ✅ HIPAA compliant
- ✅ Open source
- ✅ Active development
- ✅ Healthcare-focused features

---

### 2. **Medplum Cloud** - FHIR Backend & Patient Records
**Purpose:** HL7 FHIR R4 compliant patient data management

**What it manages:**
- 👤 Patient demographics (name, DOB, contact info)
- 📅 Appointments and scheduling
- 🏥 Encounters (visits, admissions)
- 💊 Medications and prescriptions
- 🧪 Lab results and observations
- ⚕️ Healthcare provider directory
- 🏥 Organization and facility data
- 🩺 Conditions and diagnoses
- 💉 Immunization records
- 🧬 Family history

**Technology:**
- FHIR R4 REST API
- OAuth2 authentication
- Real-time data sync
- GraphQL support
- Built-in audit logs

**Why Medplum?**
- ✅ Full FHIR R4 compliance
- ✅ Cloud-hosted (no infrastructure management)
- ✅ Developer-friendly API
- ✅ Built for healthcare
- ✅ Scales automatically

---

### 3. **OpenAI Whisper** - Medical Transcription
**Purpose:** Convert clinical voice notes to accurate medical text

**What it transcribes:**
- 🎙️ Provider dictation (SOAP notes, H&P)
- 👂 Patient interviews
- 🎥 Telehealth consultations
- 📞 Phone call documentation
- 🗣️ Voice commands
- 🩺 Bedside notes

**Technology:**
- State-of-the-art speech recognition
- Medical terminology support
- Multi-language capability
- Punctuation and formatting
- Speaker diarization
- Real-time and batch processing

**Why OpenAI Whisper?**
- ✅ Best-in-class accuracy
- ✅ Medical vocabulary trained
- ✅ Handles accents and background noise
- ✅ Cost-effective
- ✅ API-first design

---

## 🔌 How They Connect

### WebQx EMR Service (Port 3100)
The microservice that coordinates all three backends:

```javascript
// Simplified architecture
WebQx EMR Service
  ├─ /emr/status          → Check health of all three services
  ├─ /emr/patients        → Fetch from Medplum
  ├─ /emr/documents       → Access Nextcloud files
  ├─ /emr/transcribe      → Send audio to Whisper
  └─ /emr/patient/:id     → Unified patient view
```

**Responsibilities:**
1. **Unified API:** Single endpoint for all EMR operations
2. **Authentication:** OAuth2 tokens for Medplum, WebDAV auth for Nextcloud, API keys for Whisper
3. **Caching:** Reduce external API calls, improve performance
4. **Error Handling:** Circuit breakers, retries, fallbacks
5. **Audit Logging:** HIPAA-compliant request tracking
6. **Data Transformation:** Convert between formats (FHIR ↔ UI models)

---

## 🎯 Complete User Flow

### Example: Provider Viewing Patient Record

1. **User logs in** → `/auth/providers/login.html`
   - JWT token issued by Railway backend
   
2. **Dashboard loads** → `/provider/dashboard/`
   - Calls `/emr/patients` for patient list
   
3. **WebQx EMR Service:**
   ```
   GET /emr/patients
     ↓
   Medplum: GET /Patient?_count=20
     ↓
   Returns: [{ id, name, dob, mrn, ... }]
   ```

4. **User selects patient** → `/provider/patient/12345`
   - Calls multiple endpoints in parallel:
   
   ```
   GET /emr/patient/12345          → Medplum (demographics)
   GET /emr/patient/12345/records  → Medplum (encounters, labs)
   GET /emr/patient/12345/files    → Nextcloud (documents, images)
   ```

5. **User uploads document:**
   ```
   POST /emr/patient/12345/upload
     ↓
   Nextcloud WebDAV: PUT /patients/12345/lab-result.pdf
     ↓
   Medplum: POST /DocumentReference (metadata)
   ```

6. **User dictates note:**
   ```
   POST /emr/transcribe
   Body: { audio: <base64>, patientId: 12345 }
     ↓
   Whisper: POST /v1/audio/transcriptions
     ↓
   Returns: { text: "Patient presents with..." }
     ↓
   Medplum: POST /DocumentReference (clinical note)
   ```

---

## 🔐 Security & Compliance

### Authentication Flow
```
User Login
  ↓
Railway Backend → JWT Token
  ↓
WebQx EMR Service receives JWT
  ↓
├─ Medplum: Exchange JWT for OAuth2 token
├─ Nextcloud: Use WebDAV credentials
└─ Whisper: Use API key
```

### Data Protection
- **At Rest:** Nextcloud encryption, Medplum encrypted database
- **In Transit:** TLS 1.3 for all connections
- **Access Control:** Role-based permissions (RBAC)
- **Audit Trail:** All operations logged with timestamp, user, action
- **Data Retention:** Configurable per HIPAA requirements (7 years default)

### HIPAA Compliance
- ✅ **PHI Encryption:** All patient data encrypted
- ✅ **Access Logs:** Every data access tracked
- ✅ **User Authentication:** Multi-factor available
- ✅ **Data Backup:** Automated backups
- ✅ **Business Associate Agreements:** Required for Medplum, OpenAI
- ✅ **Minimum Necessary:** Scoped API requests

---

## 💻 Technical Implementation

### Directory Structure
```
/workspaces/webqx/
├─ light-emr-adapter/          ← WebQx EMR Service code
│  ├─ src/
│  │  ├─ server.js             → Main Express server
│  │  ├─ medplum.js            → Medplum API client
│  │  ├─ nextcloud.js          → Nextcloud WebDAV client
│  │  ├─ whisper.js            → (TO ADD) OpenAI Whisper client
│  │  ├─ routes/
│  │  │  ├─ status.js          → Health checks
│  │  │  ├─ patients.js        → Patient data endpoints
│  │  │  └─ transcribe.js      → (TO ADD) Transcription endpoints
│  │  └─ middleware/
│  │     ├─ audit.js           → HIPAA audit logging
│  │     └─ rateLimits.js      → Rate limiting
│  └─ package.json
└─ core/
   └─ unified-server.js         → Main gateway (spawns WebQx EMR)
```

### Environment Variables
```bash
# WebQx EMR Service
WEBQX_EMR_ENABLED=true
WEBQX_EMR_PORT=3100

# Medplum (FHIR Backend)
MEDPLUM_API_URL=https://api.medplum.com
MEDPLUM_CLIENT_ID=your_client_id
MEDPLUM_CLIENT_SECRET=your_client_secret

# Nextcloud (File Storage)
NEXTCLOUD_WEBDAV_URL=https://cloud.yourdomain.com/remote.php/dav/files/admin/
NEXTCLOUD_USERNAME=webqx_admin
NEXTCLOUD_PASSWORD=secure_password

# OpenAI Whisper (Transcription)
WHISPER_API_URL=https://api.openai.com/v1/audio/transcriptions
WHISPER_API_KEY=sk-...
WHISPER_MODEL=whisper-1
WHISPER_LANGUAGE=en

# Configuration
EMR_CACHE_TTL_MS=30000
EMR_LOG_LEVEL=info
ALLOWED_ORIGINS=https://webqx.github.io
```

---

## 📊 API Endpoints

### Health & Status
```bash
GET /emr/status
# Returns health of Medplum, Nextcloud, Whisper
Response: {
  status: "online",
  dependencies: {
    medplum: { status: "online", latency_ms: 120 },
    nextcloud: { status: "online", latency_ms: 85 },
    whisper: { status: "online", latency_ms: 200 }
  }
}
```

### Patient Data (via Medplum)
```bash
GET /emr/patients?limit=20
GET /emr/patient/:id
GET /emr/patient/:id/encounters
GET /emr/patient/:id/medications
GET /emr/patient/:id/labs
POST /emr/patient (create new patient)
PUT /emr/patient/:id (update patient)
```

### File Storage (via Nextcloud)
```bash
GET /emr/patient/:id/files
GET /emr/file/:fileId (download)
POST /emr/patient/:id/upload (upload document)
DELETE /emr/file/:fileId
```

### Transcription (via Whisper)
```bash
POST /emr/transcribe
Body: {
  audio: "base64_encoded_audio",
  format: "mp3",
  language: "en",
  patientId: "12345"
}
Response: {
  text: "Patient presents with acute onset...",
  duration: 45.2,
  confidence: 0.95
}
```

---

## 🚀 Deployment Architecture

### Local Development
```
Your Computer
  ├─ Main Server (port 3000)
  ├─ WebQx EMR Service (port 3100)
  │  ├─ Connects to: Medplum Cloud (internet)
  │  ├─ Connects to: Nextcloud (Docker container)
  │  └─ Connects to: OpenAI API (internet)
  └─ Frontend (port 5173 - Vite dev server)
```

### Production (Railway)
```
Railway Container
  ├─ Main Server (PORT env var, typically 8080)
  ├─ WebQx EMR Service (port 3100)
  │  ├─ Connects to: Medplum Cloud (api.medplum.com)
  │  ├─ Connects to: Nextcloud (separate Railway service or external)
  │  └─ Connects to: OpenAI API (api.openai.com)
  ├─ Django (port 3001)
  ├─ OpenEMR (port 3002)
  └─ Telehealth (port 3003)
```

---

## 🎯 Why This Architecture?

### Separation of Concerns
- **Medplum:** Structured clinical data (FHIR)
- **Nextcloud:** Unstructured files (documents, images)
- **Whisper:** Real-time conversion (voice → text)

### Best of Breed
Each component is the **best-in-class** solution for its domain:
- Medplum = most developer-friendly FHIR server
- Nextcloud = most mature self-hosted file system
- Whisper = most accurate transcription AI

### Flexibility
- Can replace any component without affecting others
- Can add more backends (Epic, Cerner) alongside
- Can scale each service independently

### Compliance
- Each service handles HIPAA differently
- WebQx EMR service orchestrates compliance requirements
- Unified audit log across all three

---

## 📈 Scalability

### Current Limits
- **Medplum:** 10,000 patients (free tier)
- **Nextcloud:** Limited by server disk space
- **Whisper:** 50 requests/minute (OpenAI tier dependent)

### Production Scale
- **Medplum:** Millions of patients (paid tiers)
- **Nextcloud:** Petabytes (clustered deployment)
- **Whisper:** Thousands of requests/minute (enterprise)

### Load Distribution
```
1 WebQx EMR instance → 1000 concurrent users
  ├─ Medplum: Handles 100 req/sec
  ├─ Nextcloud: Handles 50 uploads/sec
  └─ Whisper: Handles 20 transcriptions/sec
```

---

## 🔄 Future Enhancements

### Phase 1 (Current)
- ✅ Medplum patient data integration
- ✅ Nextcloud file storage integration
- ⏳ OpenAI Whisper transcription integration

### Phase 2 (Q1 2026)
- 📋 Appointment scheduling via Medplum
- 🔔 Real-time notifications
- 📊 Analytics dashboard
- 🔍 Full-text search across all data sources

### Phase 3 (Q2 2026)
- 🤖 AI-powered clinical decision support
- 📈 Predictive analytics
- 🌐 Multi-tenant support
- 🔗 Epic/Cerner integration

---

## 📞 Getting Started

### 1. Sign up for Services
- **Medplum:** https://app.medplum.com/register
- **Nextcloud:** Deploy via Docker or use managed hosting
- **OpenAI:** https://platform.openai.com/signup

### 2. Get Credentials
- Medplum: Client ID + Secret from project settings
- Nextcloud: Admin username + password + WebDAV URL
- OpenAI: API key from account dashboard

### 3. Configure Railway
- Add environment variables to Railway dashboard
- Redeploy service

### 4. Test Integration
```bash
curl https://webqx-production.up.railway.app/emr/status
```

---

## 🏆 Summary

**WebQx EMR** is not just an adapter or middleware—it's a **complete healthcare data platform** that brings together:

- 📁 **Nextcloud** for secure file storage
- 🏥 **Medplum** for FHIR-compliant patient records
- 🎙️ **OpenAI Whisper** for medical transcription

Together, these three services power the entire **WebQx Healthcare Platform**, providing clinicians and patients with a modern, compliant, and scalable electronic medical records system.

---

**Official Branding:** Always refer to this as **"WebQx EMR"**, never "Light EMR" or "EMR Adapter"  
**Backend Stack:** Nextcloud + Medplum + OpenAI Whisper  
**Purpose:** Unified healthcare data infrastructure for the WebQx platform
