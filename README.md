# 
# 🌐 WebQX™: Modular Healthcare Platform  
_A multilingual, specialty-aware, and privacy-first blueprint for global clinical care._

## 🚀 Overview  
WebQX™ is a comprehensive modular healthcare stack designed to empower both patients and providers across 12 core medical specialties, including Primary Care, Psychiatry, Radiology, Pediatrics, Oncology, Cardiology, and more. Our platform champions multilingual support, health equity, and enhanced health literacy to ensure accessible care for diverse global communities.

Built with compliance at its core, WebQX™ adheres to global healthcare standards including HIPAA and FHIR, providing healthcare organizations with confidence in data security and interoperability. The platform's modular architecture enables seamless scalability and customization, adapting to the unique needs of healthcare settings from rural clinics to major urban hospitals.

At the heart of WebQX™ is our commitment to accessibility, collaborative care, and patient empowerment—leveraging technology to break down barriers and improve global healthcare access for all.

## 🧩 Modular Architecture

### ✅ Patient Portal  
Built with React, supporting user-friendly access to clinical services:

- 📅 **Appointments & Scheduling** → LibreHealth Toolkit / OpenEMR calendar  
- 💊 **Pharmacy Access** → OpenEMR Rx + FDA APIs  
- 🧪 **Lab Results Viewer** → HL7/FHIR integration via Mirth Connect with filtering and sorting  
- 📬 **Secure Messaging** → Medplum or Matrix protocol with encryption  
- 💵 **Billing & Insurance** → OpenMRS + Bahmni billing packages  
- 📚 **Health Literacy Assistant** → Whisper + spaCy or Haystack NLP  
- 🧭 **Care Navigation** → D3.js or Neo4j referral engine  

### 🩺 Provider Panel  
Modular EHR engine enhancements via OpenEMR / OpenMRS:

- 📋 **EHR Summary Dashboard** → React + GraphQL  
- 💊 **Prescription Management** → RxNorm + SmartRx UI  
- 📬 **Secure Messaging** → Scoped Matrix channels  
- 📊 **Clinical Alerts / Decision Support** → OpenCDS or Drools rule engine  
- 🧠 **CME Tracker** → Open Badges (BadgeOS/Moodle)  
- 🤖 **Provider Assistant Bot** → LLM + private Whisper API  
- 📝 **Transcription Suite** → Whisper + Google Cloud Speech-to-Text + specialty macros  

### 🛠️ Admin Console  
Role-based access and modular configuration for deployment:

- 🔐 **Access Control** → Keycloak / Firebase Auth  
- 🌐 **Localization Tools** → i18next + Whisper translation overlay  
- 🎨 **UI Theming** → Tailwind or CSS-in-JS  
- 📊 **Analytics** → Grafana / Metabase  
- 🎛️ **AI Tuning** → YAML configs + admin webhooks  
- 🔗 **Integration Engine** → HL7/FHIR via Mirth Connect + OHIF PACS viewer  
- 💰 **Billing Logic** → JSON-based rule engine  
- 🗄️ **Compliance Modules** → PostgreSQL + Vault + audit logging  

## 📁 WebQx-EHR Directory Structure  
The WebQx-EHR project follows a modular directory structure designed for scalability and maintainability across healthcare specialties and integrations:

```
webqx-ehr/
├── modules/
│   ├── transcription/
│   ├── specialty-primary-care/
│   ├── specialty-radiology/
│   ├── specialty-cardiology/
│   ├── specialty-neurology/
│   ├── specialty-pulmonology/
│   └── specialty-oncology/
├── ehr-integrations/
│   ├── openemr/
│   ├── openmrs/
│   ├── librehealth/
│   ├── gnuhealth/
│   └── hospitalrun/
├── auth/
│   ├── firebase/
│   ├── specialty-access-control/
│   └── provider-verification/
├── interoperability/
│   ├── openEHR-layer/
│   ├── terminology-maps/
│   └── fhir-interfaces/
├── messaging/
│   └── matrix-overlay/
└── docs/
    ├── CONTRIBUTING.md
    ├── LICENSING.md
    ├── NDAs/
    └── IP-assignment/
```

**Key Directories:**
- 🧩 **modules/** → Specialty-specific clinical modules and transcription services
- 🔗 **ehr-integrations/** → Ready-to-deploy integrations with popular open-source EHR systems
- 🔐 **auth/** → Authentication and access control mechanisms including provider verification
- 🌐 **interoperability/** → Standards-compliant data exchange layers (HL7 FHIR, openEHR)
- 💬 **messaging/** → Secure communication infrastructure using Matrix protocol
- 📚 **docs/** → Legal documentation, contribution guidelines, and IP management

# 🌐 WebQX™ Modular PACS Ecosystem

A robust, open-source PACS integration built on Orthanc, Dicoogle, OHIF, and PostDICOM—designed for specialty-aware workflows, multilingual transcription, and secure patient access.

## 🧠 Vision

The WebQX™ PACS Ecosystem unifies diagnostic imaging, specialty-specific dashboards, and inclusive patient engagement into one modular platform. Built for clinicians, optimized for global equity.

---

## 🏗️ Architecture Overview

- **DICOM Server**: Orthanc for lightweight and scalable imaging storage  
- **Advanced Search & Plugins**: Dicoogle for metadata filtering and indexing  
- **DICOM Viewer**: OHIF Viewer embedded in WebQX™ clinical dashboards  
- **Cloud Access**: PostDICOM for remote storage, API-driven imaging access  

---

## 🔐 Provider Features

- 🔑 **Single Sign-On (SSO)** via WebQX™ OAuth2/SAML  
- 🗂️ **Specialty Routing**: Radiology, cardiology, primary care views  
- 📝 **Multilingual Transcription** using Whisper-based batch overlay  
- 🔄 **Clinical Sync**: HL7 ORM/ORU + openEHR tagging  

---

## 🧑‍⚕️ Patient Portal Features

- 🖼️ Secure OHIF-based viewer (annotation-free)  
- 🗣️ Transcription playback + multilingual audio readouts  
- 📑 Annotated report access with glossary support  
- 🔏 Consent-based sharing with full audit trail  

---

## 🧰 Technical Highlights

| Component     | Functionality                             | Tech Stack        |
|---------------|--------------------------------------------|-------------------|
| Orthanc       | DICOM storage & REST API                  | C++ / REST        |
| Dicoogle      | Metadata indexing & plugin SDK            | Java / Lucene     |
| OHIF Viewer   | Embeddable specialty-aware viewer         | React / Cornerstone |
| PostDICOM     | Cloud PACS & API endpoints                | REST / Cloud-native |
| Whisper       | Transcription overlay (multilingual)      | PyTorch / Python  |
| WebQX™        | Frontend + clinical logic                 | Modular / WebQX™ Core |

---

## 🚀 Getting Started

1. Clone the repo:  
   ```bash
   git clone https://github.com/webqx/pacs-ecosystem
## 🧬 Supported Specialties  
Modular workflows are designed for:

- Primary Care  
- Radiology  
- Cardiology  
- Pediatrics  
- Oncology  
- Psychiatry  
- Endocrinology  
- Orthopedics  
- Neurology  
- Gastroenterology  
- Pulmonology  
- Dermatology  
- OBGYN  

# 🌐 WebQX™ Transcription + PACS Module

A modular, specialty-aware clinical documentation panel for WebQX™. Designed for multilingual transcription, PACS imaging reference, and role-specific workflows across Provider, Reviewer, and Admin interfaces.

---

## 🚀 Features

- 🎙️ **Live Dictation Panel** for real-time clinical transcription
- 🌍 **Multilingual & Specialty Support** including Radiology, Cardiology, Primary Care
- 🖼️ **PACS Imaging Preview** integrated into Provider dashboard
- 📡 **Whisper-style Sync** with timestamped transcript segments
- 🔐 **Privacy & Offline Modes** for secure, resilient recording
- ✅ **EMR Submission + Reviewer Queue** for quality control
- 📊 **Audit Logs + Specialty Analytics** for Admin oversight

---

## 🧠 Tech Stack

| Layer        | Tech                      |
|--------------|---------------------------|
| UI Framework | React Native + Expo       |
| State Mgmt   | useState, useEffect Hooks |
| Transcription| Simulated Whisper Sync    |
| PACS Preview | ScrollView + Image fetch  |

---

## 🧪 Module Overview

```plaintext
📱 Mobile UX
│
├── 🎙️ Provider Panel
│   ├── Dictation Controls
│   ├── Transcript Input + Segment Sync
│   ├── Privacy + Offline Toggles
│   └── 🖼️ PACS Imaging Preview
│
├── 🧐 Reviewer Panel
│   └── Transcript Queue + Flag/Approve
│
└── 📋 Admin Panel
    ├── Audit Logs
    └── Specialty Transcript Analytics
## 🛡️ Security & Compliance  
- TLS encryption for data in transit  
- Audit-ready backend with IP protection options  
- NDA & Contributor IP Assignment Addendum templates included  
- BAA readiness for HIPAA-compatible deployments  

## 🛠️ Build Stack  
| Layer       | Technology                       |
|-------------|----------------------------------|
| Frontend    | React + TypeScript               |
| Backend     | Node.js (Fastify) + Flask        |
| Database    | PostgreSQL + Firebase Sync       |
| Messaging   | Matrix / Medplum                 |
| AI/NLP      | Whisper + spaCy / Haystack       |
| Compliance  | Vault, audit logging, RBAC       |
| Interop     | HL7/FHIR + OHIF for PACS         |

## 🚀 Deployment

### Mock FHIR and openEHR Servers

WebQX includes built-in mock servers for local development and testing:

- **Mock FHIR Server**: Complete FHIR R4 implementation at `/fhir/*` endpoints
- **Mock openEHR Server**: Full openEHR REST API at `/openehr/v1/*` endpoints

#### Quick Start
```bash
# Install dependencies
npm install

# Start with mock servers (development mode)
NODE_ENV=development npm start

# Verify servers are running
curl http://localhost:3000/health
```

#### Features
- ✅ **FHIR Resources**: Patient, Observation, Appointment with full CRUD
- ✅ **openEHR Resources**: EHR, Composition, AQL queries
- ✅ **Authentication**: OAuth2 for FHIR (test tokens provided)
- ✅ **Validation**: Schema validation for both standards
- ✅ **Test Data**: Pre-populated with sample healthcare data
- ✅ **Documentation**: Complete API examples and setup guides

📚 **Documentation:**
- [Mock Servers Setup Guide](./docs/MOCK_SERVERS_SETUP.md)
- [FHIR API Examples](./docs/FHIR_API_EXAMPLES.md)
- [openEHR API Examples](./docs/OPENEHR_API_EXAMPLES.md)

### Railway Deployment

This project is ready for deployment on [Railway](https://railway.app) with zero-configuration:

1. **Connect Repository**: Connect your GitHub repository to Railway
2. **Auto-Deploy**: Railway will automatically detect the Node.js project and deploy
3. **Environment Variables**: Configure required environment variables using the `.env.example` file as reference
4. **Health Monitoring**: Built-in health check endpoint at `/health` for monitoring

#### Quick Deploy to Railway
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

#### Manual Deployment Steps
1. Fork this repository
2. Create a new project on Railway
3. Connect your forked repository
4. Add environment variables from `.env.example`
5. Deploy automatically triggers

#### Local Development
```bash
# Install dependencies
npm install

# Start development server
npm start

# Access the application
open http://localhost:3000
```

The patient portal will be available at the root URL, and health checks at `/health`.

## 🧪 Lab Results Integration with Mirth Connect

### Overview
WebQX includes a comprehensive lab results system that transforms HL7 v2 messages into FHIR R4 Observation resources using Mirth Connect, and displays them in a user-friendly Patient Portal interface.

### Mirth Connect Setup

#### Prerequisites
- Mirth Connect 4.0.0 or higher
- FHIR R4 server endpoint
- Network access to receive HL7 messages

#### Installation Steps

1. **Import Channel Configuration**
   ```bash
   # Copy the Mirth Connect channel configuration
   cp mirth-channel-config.xml /path/to/mirth/channels/
   ```

2. **Install JavaScript Transformer**
   - Open Mirth Connect Administrator
   - Navigate to Settings > Global Scripts
   - Create a new script named `hl7ToFhirTransformer`
   - Copy the contents of `hl7-to-fhir-transformer.js` into the script editor
   - Save the script

3. **Configure Channel Settings**
   - Import the channel from `mirth-channel-config.xml`
   - Update the following settings in the channel:
     - Source Connector: Set the correct TCP port (default: 6661)
     - Destination Connector: Update FHIR server URL
     - Authentication: Configure FHIR server credentials if required

4. **Deploy the Channel**
   ```bash
   # Deploy through Mirth Connect Administrator or CLI
   # Channel name: "HL7 to FHIR Observation"
   # Channel ID: "hl7-to-fhir-observation"
   ```

#### Channel Configuration Details

**Source Connector (TCP Listener)**
- Protocol: TCP
- Port: 6661 (configurable)
- Mode: Server
- Data Type: HL7 v2
- Supported Messages: ORU^R01 (Observation Result)

**Destination Connector (HTTP Sender)**
- Method: POST
- Content-Type: application/fhir+json
- Target: FHIR R4 Observation endpoint
- Transformation: HL7 to FHIR Observation

**Supported HL7 Segments**
- MSH: Message Header
- PID: Patient Identification
- OBR: Observation Request
- OBX: Observation Result (supports multiple)
- PV1: Patient Visit (optional)

#### Example HL7 Message
```
MSH|^~\&|LAB|XYZ|HOSPITAL|HOSPITAL|20250730120000||ORU^R01|123456|P|2.4
PID|1||12345^^^HOSPITAL|67890|Doe^John||19800101|M|||123 Main St^^Metropolis^IL^12345
OBR|1||54321^LAB|1234^Complete Blood Count^L|||20250730110000|||||||||67890
OBX|1|NM|789-8^Hemoglobin^LN|1|13.5|g/dL|12.0-16.0|N|||F
```

#### Resulting FHIR Observation
```json
{
  "resourceType": "Observation",
  "status": "final",
  "category": [{
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/observation-category",
      "code": "laboratory",
      "display": "Laboratory"
    }]
  }],
  "code": {
    "coding": [{
      "system": "http://loinc.org",
      "code": "789-8",
      "display": "Hemoglobin"
    }]
  },
  "subject": {
    "reference": "Patient/12345"
  },
  "effectiveDateTime": "2025-07-30T11:00:00Z",
  "valueQuantity": {
    "value": 13.5,
    "unit": "g/dL",
    "system": "http://unitsofmeasure.org"
  },
  "referenceRange": [{
    "text": "12.0-16.0",
    "low": {
      "value": 12.0,
      "unit": "g/dL"
    },
    "high": {
      "value": 16.0,
      "unit": "g/dL"
    }
  }]
}
```

### Patient Portal Lab Results Viewer

#### Features
- **Real-time Lab Results**: Displays FHIR Observation resources from connected labs
- **Advanced Filtering**: Filter by date range, status, category, and abnormal results only
- **Smart Sorting**: Sort by date, test name, value, or status
- **Detailed View**: Click any result for comprehensive details
- **Responsive Design**: Optimized for desktop and mobile devices
- **Accessibility**: Full screen reader and keyboard navigation support

#### Integration

1. **Add to Patient Portal**
   ```tsx
   import LabResultsViewer from './components/LabResultsViewer';
   
   function PatientDashboard({ patientId }) {
     return (
       <div>
         <LabResultsViewer 
           patientId={patientId}
           fhirServerUrl="/fhir"
           onError={(error) => console.error('Lab results error:', error)}
           onLoadingChange={(loading) => setLoading(loading)}
         />
       </div>
     );
   }
   ```

2. **Configure FHIR Server**
   - Ensure your FHIR server supports Observation resources
   - Configure patient-specific access controls
   - Set up proper CORS headers for web access

#### Supported Lab Categories
- **Chemistry**: Glucose, Sodium, Potassium, Creatinine
- **Hematology**: Hemoglobin, Hematocrit, WBC, Platelets  
- **Microbiology**: Cultures, Bacterial identification, Sensitivity testing
- **Custom**: Configurable based on LOINC codes

#### Security Considerations
- All lab data transmission uses TLS encryption
- Patient data access follows HIPAA compliance guidelines
- Audit logging for all lab result access
- Role-based access control integration

### Troubleshooting

#### Common Issues

1. **Channel Not Receiving Messages**
   - Check TCP port configuration and firewall settings
   - Verify HL7 message format and encoding
   - Review Mirth Connect logs for connection errors

2. **Transformation Errors**
   - Validate HL7 segment structure (MSH, PID, OBX required)
   - Check JavaScript transformer script for syntax errors
   - Verify LOINC code mappings in transformer

3. **FHIR Server Issues**
   - Confirm FHIR server endpoint accessibility
   - Validate authentication credentials
   - Check FHIR Observation resource schema compliance

4. **Patient Portal Display Issues**
   - Verify FHIR server CORS configuration
   - Check browser network console for API errors
   - Validate patient ID matching between systems

#### Monitoring and Maintenance

- **Mirth Connect Dashboard**: Monitor channel status and message throughput
- **FHIR Server Logs**: Review successful Observation resource creation
- **Patient Portal Analytics**: Track lab result viewing patterns
- **Error Alerting**: Configure notifications for transformation failures

## 🤝 Contribution Guide  
We welcome clinicians, developers, and researchers:

- Clone, fork, and suggest new specialty workflows  
- Sign IP Addendum and NDA prior to PR submission  
- Use branches like `feature/oncology-workflow-v1.0`  
- Submit YAML logic + compliance notes with PR  

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) and [`specialties.yaml`](./admin-console/ai-tuning/specialties.yaml)

## 📜 License  
Apache 2.0 — Includes contributor IP addendums for legal clarity and scalability  
See [`LICENSE.md`](./LICENSE.md), [`nda-template.md`](./legal/nda-template.md), and [`ip-addendum.md`](./legal/ip-addendum.md)

---

Crafted with ❤️ by [@webqx-health](https://github.com/webqx-health)  
_“Care equity begins with code equity.”_