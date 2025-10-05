# WebQx EMR - Complete Module Integration Plan
## Touch-Optimized UI with Nextcloud + Medplum + OpenAI Whisper

**Date:** October 5, 2025  
**Goal:** Ensure every module has full WebQx EMR functionality with user-friendly touch interfaces

---

## 🎯 Integration Requirements

Every module must have:

### 1. **Nextcloud Integration** (File Storage)
- ✅ Upload medical documents (PDFs, images, lab results)
- ✅ Download/view existing files
- ✅ Organize by patient and category
- ✅ Touch-friendly file picker with preview
- ✅ Drag-and-drop support on desktop
- ✅ Camera integration on mobile devices

### 2. **Medplum Integration** (FHIR Patient Data)
- ✅ Real-time patient search with autocomplete
- ✅ Display patient demographics (name, DOB, MRN, contact)
- ✅ Show appointments, encounters, medications
- ✅ Lab results with trending graphs
- ✅ Allergies and conditions
- ✅ Provider notes and clinical documentation

### 3. **OpenAI Whisper Integration** (Medical Transcription)
- ✅ Voice dictation button (mic icon)
- ✅ Real-time transcription display
- ✅ Insert transcribed text into forms
- ✅ Medical terminology support
- ✅ Multi-language capability
- ✅ Save transcriptions to patient record

### 4. **Touch Screen Optimization**
- ✅ Minimum 44px × 44px touch targets
- ✅ Swipe gestures for navigation
- ✅ Pull-to-refresh on lists
- ✅ Bottom navigation bar on mobile
- ✅ Large, finger-friendly buttons
- ✅ Haptic feedback on interactions
- ✅ Pinch-to-zoom on images/documents

---

## 📱 Module-by-Module Requirements

### **PROVIDER PORTAL**

#### 1. Patient Records Module
**File:** `/provider/patients/index.html` (TO CREATE)

**Features:**
- 🔍 Search patients via Medplum API
- 👤 Display patient demographics card
- 📋 List recent encounters
- 💊 Show active medications
- 🧪 Display latest lab results
- 📄 **Nextcloud:** Upload/view patient documents
- 🎙️ **Whisper:** Dictate clinical notes
- 📱 Touch: Swipe patient cards, tap to expand details

**API Endpoints:**
```javascript
GET /emr/patients?search={query}
GET /emr/patient/{id}
GET /emr/patient/{id}/encounters
GET /emr/patient/{id}/medications
GET /emr/patient/{id}/files         // Nextcloud
POST /emr/patient/{id}/upload       // Nextcloud
POST /emr/transcribe                // Whisper
```

---

#### 2. Prescriptions Module
**File:** `/provider/prescriptions/index.html` (TO CREATE)

**Features:**
- 💊 Search medications (RxNorm API)
- 📝 E-prescribe with digital signature
- ⚠️ Drug interaction checks
- 👤 Patient allergy warnings
- 📋 Refill requests
- 📄 **Nextcloud:** Upload prescription images
- 🎙️ **Whisper:** Dictate prescription instructions
- 📱 Touch: Large medication search, tap-to-select dosing

**API Endpoints:**
```javascript
GET /emr/medications?search={drug}
POST /emr/patient/{id}/prescription
GET /emr/patient/{id}/allergies     // Medplum
GET /emr/drug-interactions?drugs={ids}
```

---

#### 3. Lab Results Module
**File:** `/provider/lab-results/index.html` (TO CREATE)

**Features:**
- 🧪 Display lab results from Medplum
- 📊 Trending graphs (glucose, A1C, lipids)
- ⚠️ Flag abnormal values
- 📄 **Nextcloud:** View lab report PDFs
- 🎙️ **Whisper:** Dictate interpretations
- 📱 Touch: Tap lab values to see trends, pinch-to-zoom graphs

**API Endpoints:**
```javascript
GET /emr/patient/{id}/observations  // Medplum lab results
GET /emr/patient/{id}/files?type=lab // Nextcloud PDFs
POST /emr/patient/{id}/note         // Add interpretation
```

---

#### 4. Imaging Module
**File:** `/provider/imaging/index.html` (TO CREATE)

**Features:**
- 🔬 Display imaging studies list
- 🖼️ **Nextcloud:** View DICOM images, X-rays, MRIs
- 📄 Read radiology reports
- 🔍 Zoom and pan images
- 🎙️ **Whisper:** Dictate findings
- 📱 Touch: Pinch-to-zoom, swipe between images

**API Endpoints:**
```javascript
GET /emr/patient/{id}/imaging       // Medplum ImagingStudy
GET /emr/file/{fileId}              // Nextcloud retrieve image
POST /emr/patient/{id}/imaging-note
```

---

#### 5. Telehealth Module
**File:** `/provider/telehealth-scheduling.html` (EXISTS - ENHANCE)

**Enhancements Needed:**
- 🎥 Integrate with Medplum appointments
- 📄 **Nextcloud:** Share files during call
- 🎙️ **Whisper:** Real-time call transcription
- 📱 Touch: Large call controls, swipe to end call

**New API Endpoints:**
```javascript
GET /emr/patient/{id}/appointments
POST /emr/appointment
POST /emr/transcribe-stream         // Real-time Whisper
```

---

#### 6. Scheduling Module
**File:** `/provider/scheduling/index.html` (TO CREATE)

**Features:**
- 📅 Calendar view of appointments (Medplum)
- 🔍 Search available slots
- 👤 Book appointments for patients
- ⏰ Send SMS/email reminders
- 🎙️ **Whisper:** Voice commands for booking
- 📱 Touch: Tap dates, swipe weeks, drag-to-book

**API Endpoints:**
```javascript
GET /emr/schedule?provider={id}&date={date}
GET /emr/patient/{id}/appointments
POST /emr/appointment
PUT /emr/appointment/{id}
DELETE /emr/appointment/{id}
```

---

#### 7. Billing Module
**File:** `/provider/billing/index.html` (TO CREATE)

**Features:**
- 💰 Generate superbills
- 📋 ICD-10 and CPT code lookup
- 💳 Track payments
- 📄 **Nextcloud:** Upload insurance documents
- 🎙️ **Whisper:** Dictate billing notes
- 📱 Touch: Tap codes, swipe through claims

**API Endpoints:**
```javascript
GET /emr/patient/{id}/claims
POST /emr/claim
GET /emr/codes?search={query}       // ICD-10/CPT
```

---

### **PATIENT PORTAL**

#### 1. Patient Dashboard
**File:** `/patient-portal/dashboard/index.html` (TO CREATE)

**Features:**
- 👤 View own demographics (Medplum)
- 📅 Upcoming appointments
- 💊 Active medications list
- 🧪 Recent lab results (simplified)
- 📄 **Nextcloud:** Download medical records
- 📱 Touch: Card-based layout, large buttons

**API Endpoints:**
```javascript
GET /emr/patient/me                 // Current patient
GET /emr/patient/me/appointments
GET /emr/patient/me/medications
GET /emr/patient/me/labs
GET /emr/patient/me/files
```

---

#### 2. Appointments Module
**File:** `/patient-portal/appointments/index.html` (TO CREATE)

**Features:**
- 📅 View upcoming appointments (Medplum)
- 🔍 Search available providers
- 📝 Book new appointments
- 🎥 Join telehealth sessions
- 📄 **Nextcloud:** Upload pre-visit forms
- 📱 Touch: Calendar swipe, tap to book

**API Endpoints:**
```javascript
GET /emr/patient/me/appointments
GET /emr/providers?specialty={type}
POST /emr/appointment
GET /emr/appointment/{id}/telehealth-link
```

---

#### 3. Medical Records Module
**File:** `/patient-portal/records/index.html` (TO CREATE)

**Features:**
- 📋 View visit summaries (Medplum)
- 🧪 Lab results with explanations
- 💊 Medication history
- 📄 **Nextcloud:** Download PDF records
- 📄 **Nextcloud:** Upload health documents
- 📱 Touch: Swipe through records, tap to expand

**API Endpoints:**
```javascript
GET /emr/patient/me/encounters
GET /emr/patient/me/observations
GET /emr/patient/me/files
POST /emr/patient/me/upload
```

---

#### 4. Messaging Module
**File:** `/patient-portal/messages/index.html` (TO CREATE)

**Features:**
- 💬 Secure messaging with providers
- 📄 **Nextcloud:** Attach files to messages
- 🔔 Notification badges
- 🎙️ **Whisper:** Voice messages (transcribed)
- 📱 Touch: Swipe to delete, pull-to-refresh

**API Endpoints:**
```javascript
GET /emr/messages
POST /emr/message
POST /emr/message/voice             // Whisper transcription
```

---

#### 5. Prescriptions Module
**File:** `/patient-portal/prescriptions/index.html` (TO CREATE)

**Features:**
- 💊 View active prescriptions (Medplum)
- 🔄 Request refills
- 📍 Find nearby pharmacies
- 📄 **Nextcloud:** View prescription images
- 📱 Touch: Large refill buttons, tap pharmacy addresses

**API Endpoints:**
```javascript
GET /emr/patient/me/medications
POST /emr/patient/me/refill-request
GET /emr/pharmacies?location={zip}
```

---

### **ADMIN CONSOLE**

#### 1. Admin Dashboard
**File:** `/admin-console/index.html` (EXISTS - ENHANCE)

**Enhancements Needed:**
- 📊 WebQx EMR backend status (Nextcloud + Medplum + Whisper)
- 💾 Storage usage (Nextcloud metrics)
- 👥 Active users count
- 🔍 System health checks
- 📱 Touch: Status cards, swipe dashboards

**New API Endpoints:**
```javascript
GET /emr/status                     // All three backends
GET /emr/metrics                    // Usage statistics
GET /emr/storage                    // Nextcloud usage
```

---

#### 2. User Management
**File:** `/admin-console/users/index.html` (TO CREATE)

**Features:**
- 👥 List all users (providers, patients, staff)
- ➕ Add new users
- ✏️ Edit user permissions
- 🚫 Deactivate accounts
- 📄 **Medplum:** Sync user roles
- 📱 Touch: Swipe users, tap to edit

**API Endpoints:**
```javascript
GET /api/users
POST /api/users
PUT /api/users/{id}
DELETE /api/users/{id}
```

---

#### 3. System Settings
**File:** `/admin-console/settings/index.html` (TO CREATE)

**Features:**
- ⚙️ Configure Nextcloud connection
- ⚙️ Configure Medplum credentials
- ⚙️ Configure OpenAI Whisper API key
- 🔐 Security settings
- 📧 Email/SMS configuration
- 📱 Touch: Large toggle switches, tap to save

**API Endpoints:**
```javascript
GET /api/settings
PUT /api/settings
POST /api/test-connection          // Test each backend
```

---

#### 4. Analytics Module
**File:** `/admin-console/analytics/index.html` (TO CREATE)

**Features:**
- 📊 Patient visit trends
- 💰 Revenue reports
- 👥 Provider productivity
- 📄 **Nextcloud:** Storage analytics
- 🎙️ **Whisper:** Transcription usage
- 📱 Touch: Swipe charts, pinch-to-zoom graphs

**API Endpoints:**
```javascript
GET /api/analytics/visits
GET /api/analytics/revenue
GET /api/analytics/storage
GET /api/analytics/transcriptions
```

---

## 🎨 Touch-Friendly UI Components

### Common Component Library

#### 1. Patient Search (Medplum)
```html
<div class="patient-search-touch">
  <input type="text" 
         class="search-input-large" 
         placeholder="🔍 Search patients..."
         style="font-size: 18px; padding: 16px; min-height: 56px;">
  <div class="search-results">
    <!-- Results with 56px min-height cards -->
  </div>
</div>
```

#### 2. File Upload (Nextcloud)
```html
<div class="file-upload-touch">
  <button class="upload-btn-large" style="min-height: 56px; min-width: 200px;">
    📄 Upload Document
  </button>
  <input type="file" id="fileInput" hidden accept="image/*,application/pdf">
  <div class="file-preview"></div>
</div>
```

#### 3. Voice Dictation (Whisper)
```html
<div class="voice-dictation-touch">
  <button class="mic-btn-large" 
          style="width: 64px; height: 64px; border-radius: 50%;">
    🎙️
  </button>
  <div class="transcription-display" 
       style="min-height: 120px; font-size: 16px; padding: 16px;">
    <!-- Real-time transcription -->
  </div>
</div>
```

#### 4. Bottom Navigation Bar (Mobile)
```html
<nav class="bottom-nav-touch" 
     style="position: fixed; bottom: 0; height: 72px;">
  <button style="min-width: 72px; min-height: 72px;">🏠 Home</button>
  <button style="min-width: 72px; min-height: 72px;">👥 Patients</button>
  <button style="min-width: 72px; min-height: 72px;">📅 Calendar</button>
  <button style="min-width: 72px; min-height: 72px;">💬 Messages</button>
  <button style="min-width: 72px; min-height: 72px;">⚙️ Settings</button>
</nav>
```

---

## 📏 Touch Target Specifications

### Minimum Sizes (WCAG 2.5.5 AAA)
- ✅ **Buttons:** 44px × 44px minimum
- ✅ **Touch targets:** 48px × 48px recommended
- ✅ **Primary actions:** 56px × 56px for emphasis
- ✅ **Spacing:** 8px minimum between targets

### Font Sizes
- ✅ **Body text:** 16px minimum (mobile), 18px recommended
- ✅ **Headings:** 24px+ for H2, 32px+ for H1
- ✅ **Input fields:** 16px+ to prevent iOS zoom
- ✅ **Buttons:** 18px for button text

### Interactive Areas
- ✅ **Form inputs:** 56px height minimum
- ✅ **Dropdowns:** 56px height with large chevrons
- ✅ **Checkboxes/radios:** 32px × 32px minimum
- ✅ **Sliders:** 48px touch area

---

## 🔌 WebQx EMR Service Integration

### Client-Side JavaScript Library
**File:** `/assets/webqx-emr-client.js` (TO CREATE)

```javascript
/**
 * WebQx EMR Client Library
 * Unified access to Nextcloud + Medplum + Whisper
 */

class WebQxEMR {
  constructor(baseUrl = '/emr') {
    this.baseUrl = baseUrl;
  }

  // Medplum - Patient Data
  async searchPatients(query) {
    return fetch(`${this.baseUrl}/patients?search=${query}`).then(r => r.json());
  }

  async getPatient(id) {
    return fetch(`${this.baseUrl}/patient/${id}`).then(r => r.json());
  }

  async getPatientEncounters(id) {
    return fetch(`${this.baseUrl}/patient/${id}/encounters`).then(r => r.json());
  }

  // Nextcloud - File Storage
  async uploadFile(patientId, file, category) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    
    return fetch(`${this.baseUrl}/patient/${patientId}/upload`, {
      method: 'POST',
      body: formData
    }).then(r => r.json());
  }

  async getPatientFiles(patientId) {
    return fetch(`${this.baseUrl}/patient/${patientId}/files`).then(r => r.json());
  }

  async downloadFile(fileId) {
    return fetch(`${this.baseUrl}/file/${fileId}`).then(r => r.blob());
  }

  // OpenAI Whisper - Transcription
  async transcribeAudio(audioBlob, language = 'en') {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    formData.append('language', language);
    
    return fetch(`${this.baseUrl}/transcribe`, {
      method: 'POST',
      body: formData
    }).then(r => r.json());
  }

  // Real-time transcription (WebSocket)
  connectStreamingTranscription(onTranscript) {
    const ws = new WebSocket(`wss://${window.location.host}/emr/transcribe-stream`);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onTranscript(data.text, data.isFinal);
    };
    return ws;
  }

  // Health check
  async getStatus() {
    return fetch(`${this.baseUrl}/status`).then(r => r.json());
  }
}

// Global instance
window.webqxEMR = new WebQxEMR();
```

---

## 🚀 Implementation Priority

### Phase 1: Core Integration (Week 1)
1. ✅ Create `/assets/webqx-emr-client.js` library
2. ✅ Integrate Medplum patient search in Provider Dashboard
3. ✅ Add Nextcloud file upload in Patient Records
4. ✅ Implement Whisper voice button in clinical notes
5. ✅ Update touch targets to 44px minimum

### Phase 2: Provider Modules (Week 2)
1. ✅ Create Patient Records module with full FHIR data
2. ✅ Create Prescriptions module with e-prescribe
3. ✅ Create Lab Results with trending graphs
4. ✅ Create Imaging viewer with Nextcloud
5. ✅ Enhance Telehealth with real-time transcription

### Phase 3: Patient Portal (Week 3)
1. ✅ Create Patient Dashboard with Medplum data
2. ✅ Create Appointments booking with calendar
3. ✅ Create Medical Records viewer
4. ✅ Create Messaging with voice messages
5. ✅ Create Prescriptions with refill requests

### Phase 4: Admin & Analytics (Week 4)
1. ✅ Enhance Admin Dashboard with backend status
2. ✅ Create User Management module
3. ✅ Create System Settings with connection tests
4. ✅ Create Analytics module with charts
5. ✅ Final touch optimization and testing

---

## ✅ Completion Checklist

### Provider Portal
- [ ] Patient Records (Medplum + Nextcloud + Whisper)
- [ ] Prescriptions (Medplum + RxNorm + Whisper)
- [ ] Lab Results (Medplum + Nextcloud PDFs)
- [ ] Imaging (Nextcloud DICOM viewer)
- [ ] Scheduling (Medplum appointments)
- [ ] Telehealth (Enhanced with Whisper)
- [ ] Billing (ICD-10/CPT codes)

### Patient Portal
- [ ] Dashboard (Medplum demographics)
- [ ] Appointments (Medplum booking)
- [ ] Medical Records (Medplum + Nextcloud)
- [ ] Messaging (Whisper voice messages)
- [ ] Prescriptions (Medplum medications)

### Admin Console
- [ ] Dashboard (Backend status)
- [ ] User Management
- [ ] System Settings (Backend config)
- [ ] Analytics (Usage reports)

### Touch Optimization
- [ ] All buttons 44px × 44px minimum
- [ ] Font sizes 16px+ on mobile
- [ ] Bottom navigation on mobile
- [ ] Swipe gestures implemented
- [ ] Pinch-to-zoom on images
- [ ] Tested on: iPhone, iPad, Android phone, Android tablet

---

**Next Step:** Start with creating the core WebQx EMR client library and integrating it into the Provider Dashboard.
