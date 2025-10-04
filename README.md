# WebQX™ Healthcare Platform

> Cloud-based, FHIR-compliant, global healthcare ecosystem with OpenEMR integration

## 🌍 Live Demo
**GitHub Pages:** https://webqx.github.io/webqx/  
**OpenEMR Instance:** https://fuzzy-goldfish-7vx645x7wgvv3rjxg-8085.app.github.dev

---

## ✨ Features

### 🏥 **OpenEMR 7.0.3 Integration**
- Fully branded WebQX EMR system
- Complete patient management
- Clinical workflows and documentation
- HIPAA compliant with audit trails

### 👤 **Patient Portal**
- Secure patient access to medical records
- Appointment scheduling and management
- Prescription tracking and refills
- Lab results and imaging access

### 👨‍⚕️ **Provider Portal**
- Complete clinical workflow management
- EHR integration with OpenEMR
- Clinical decision support tools
- Documentation and billing integration

### ⚙️ **Admin Console**
- System administration and configuration
- User management and role-based access
- Integration monitoring and maintenance
- Compliance reporting and audit logs

### 🌐 **Global Telehealth**
- 24/7 emergency consultations
- Scheduled virtual appointments
- Crisis intervention and support
- Multi-language support
- Care Navigation (D3.js/Neo4j)

### Provider Panel
- EHR Dashboard (React + GraphQL)
- Prescription Management (RxNorm + SmartRx)
- Secure Messaging (Matrix channels)
- Clinical Alerts/Decision Support (OpenCDS/Drools)
- CME Tracker (Open Badges)
- Provider Assistant Bot (LLM + Whisper)
- Transcription Suite (Whisper + Google Speech-to-Text)

### Admin Console
- Access Control (Keycloak/Firebase)
- Localization (i18next + Whisper)
- UI Theming (Tailwind/CSS-in-JS)
- Analytics (Grafana/Metabase)
- AI Tuning (YAML configs)
- Integration Engine (HL7/FHIR + OHIF PACS)
- Billing Logic (JSON rules)
- Compliance Modules (PostgreSQL + Vault)

### Telehealth
- Video Consultations (HIPAA-compliant)
- Real-Time Chat (encrypted)
- Remote Monitoring (IoT)
- Electronic Prescriptions
- Appointment Scheduling

---

## 🧑‍⚕️ MUP Access Program

Free/sponsored access for clinics serving Medically Underserved Populations.

**Eligibility:**
- Rural/tribal health centers
- Refugee/humanitarian clinics
- Disability/elder care facilities
- Low-income urban clinics

📥 [Apply for Equity Access](https://webqx.healthcare/equity-access)

---

## 🧱 Architecture Overview

```plaintext
[PWA Client] → [API Gateway] → [Microservices] → [PostgreSQL / FHIR DB]
```
- Authentication: OAuth2/Keycloak
- Adapter Plugins: OpenEMR, Epic, Cerner, etc.
- API Gateway: FHIR endpoints
- Session Control: Stateless tokens, audit trails
- Frontend: React dashboard
- Multilingual: i18n-ready UI

---

## 📁 Directory Structure

```plaintext
webqx-ehr/
├── modules/                  # Specialty modules & transcription
├── sso/                     # SSO (OAuth2/SAML)
├── ehr-integrations/        # EHR integrations
├── auth/                    # Authentication & access control
├── interoperability/        # HL7 FHIR, openEHR
├── messaging/               # Matrix messaging
└── docs/                    # Legal, contribution, IP
```

---

## 🏥 Interoperability

- Seamless EHR data exchange (OpenEMR, Epic, Cerner)
- HL7/FHIR via Mirth Connect
- Multilingual support

---

## 🧬 Supported Specialties

Primary Care, Radiology, Cardiology, Pediatrics, Oncology, Psychiatry, Endocrinology, Orthopedics, Neurology, Gastroenterology, Pulmonology, Dermatology, OBGYN

---

## 🛡️ Security & Compliance

- TLS encryption
- Audit-ready backend
- NDA & IP templates
- BAA readiness (HIPAA)

**Regulatory Coverage:**
| Country          | Protocols                 |
|------------------|--------------------------|
| 🇺🇸 US            | HIPAA, HITECH            |
| 🇪🇺 EU            | GDPR, ePrivacy           |
| 🇨🇦 Canada        | PIPEDA, PHIPA            |
| 🇮🇳 India         | DISHA, NDHM              |
| 🇧🇷 Brazil        | LGPD                     |
| 🇿🇦 South Africa  | POPIA                    |
| 🇵🇰 Pakistan      | PHIM, HIPC               |
| 🇦🇪 UAE           | DHA, DoH Data Law        |
| 🇸🇦 Saudi Arabia  | NHIC, PDPL               |

---

## 🧪 Lab Results Integration

- HL7 v2 → FHIR R4 via Mirth Connect
- Real-time lab results, filtering, sorting
- Security: TLS, HIPAA, audit logging

---

## 🩺 ChatEHR Integration

- Real-time messaging, appointment sync, dashboards
- Security: AES-256-GCM, audit logging, RBAC

---

## 🚀 Deployment

- AWS Lambda: Automated packaging, optimized dependencies
- Railway: Zero-config deployment, health monitoring
- Local: Mock FHIR/openEHR servers

---

## 🤝 Contribution Guide

- Fork, suggest specialty workflows
- Sign IP Addendum/NDA before PR
- Use feature branches, submit YAML logic + compliance notes

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) and [`specialties.yaml`](./admin-console/ai-tuning/specialties.yaml)

---

## 📜 License

Apache 2.0 — Contributor IP addendums for legal clarity and scalability  
See [`LICENSE.md`](./LICENSE.md), [`nda-template.md`](./legal/nda-template.md), [`ip-addendum.md`](./legal/ip-addendum.md)

---

Contact: [info@webqx.healthcare](https://github.com/webqx-health)  
_“Care equity begins with code equity.”_

