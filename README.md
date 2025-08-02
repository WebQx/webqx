# 🌐 WebQX™: Modular Healthcare Platform

**A multilingual, specialty-aware, and privacy-first blueprint for global clinical care.**

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE.md)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)](package.json)
[![Test Coverage](https://img.shields.io/badge/coverage-85%25-green)](#testing)

---

## 📋 Table of Contents

- [🎯 Project Overview](#-project-overview)
- [✨ Key Features](#-key-features)
- [🚀 Quick Start](#-quick-start)
- [📥 Installation](#-installation)
- [💡 Usage Guide](#-usage-guide)
- [🏗️ Architecture](#-architecture)
- [🧩 Modules & Specialties](#-modules--specialties)
- [🔐 Security & Compliance](#-security--compliance)
- [🤝 Contributing](#-contributing)
- [📜 License](#-license)
- [📞 Support](#-support)

---

## 🎯 Project Overview

WebQX™ is a comprehensive modular healthcare stack designed to empower both patients and providers across 12 core medical specialties, including Primary Care, Psychiatry, Radiology, Pediatrics, Oncology, Cardiology, and more. Our platform champions multilingual support, health equity, and enhanced health literacy to ensure accessible care for diverse global communities.

Built with compliance at its core, WebQX™ adheres to global healthcare standards including **HIPAA** and **FHIR**, providing healthcare organizations with confidence in data security and interoperability. The platform's modular architecture enables seamless scalability and customization, adapting to the unique needs of healthcare settings from rural clinics to major urban hospitals.

### 🎯 Mission
At the heart of WebQX™ is our commitment to accessibility, collaborative care, and patient empowerment—leveraging technology to break down barriers and improve global healthcare access for all.

---

## ✨ Key Features

### 🏥 For Healthcare Providers
- **Unified Provider Login** - Single Sign-On across multiple EHR systems (OpenEMR, OpenMRS, HospitalRun, GNU Health, Ottehr)
- **FHIR-Native Compatibility** - Full HL7/FHIR integration with bridge support
- **AI-Powered Transcription** - Whisper-based multilingual clinical documentation
- **Specialty-Aware Workflows** - Customized interfaces for 12+ medical specialties
- **Clinical Decision Support** - OpenCDS/Drools rule engine integration
- **PACS Integration** - Orthanc, Dicoogle, OHIF, and PostDICOM support

### 👥 For Patients
- **Multilingual Portal** - Accessible care in multiple languages
- **Lab Results Viewer** - Real-time HL7/FHIR integration via Mirth Connect
- **Secure Messaging** - Matrix protocol with end-to-end encryption
- **Appointment Scheduling** - LibreHealth Toolkit / OpenEMR calendar integration
- **Pharmacy Access** - OpenEMR Rx + FDA APIs integration
- **Health Literacy Assistant** - Whisper + spaCy NLP support

### 🛠️ For Administrators
- **Role-Based Access Control** - Keycloak / Firebase Auth integration
- **Audit Logging** - Comprehensive HIPAA-compliant audit trails
- **Analytics Dashboard** - Grafana / Metabase integration
- **Modular Configuration** - YAML-based AI tuning and deployment
- **Integration Engine** - HL7/FHIR via Mirth Connect

---

## 🚀 Quick Start

Get WebQX™ running in under 5 minutes:

```bash
# Clone the repository
git clone https://github.com/WebQx/webqx.git
cd webqx

# Install dependencies
npm install

# Set up environment
cp .env.example .env

# Start the platform
npm start
```

🌐 **Access the platform:** http://localhost:3000

### 🚀 One-Click Deploy

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

---

## 📥 Installation

### Prerequisites

- **Node.js** ≥ 16.0.0
- **PostgreSQL** ≥ 12
- **Redis** (optional, for session management)

### Step-by-Step Installation

1. **Clone and Install**
   ```bash
   git clone https://github.com/WebQx/webqx.git
   cd webqx
   npm install
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Database Setup**
   ```bash
   # Configure PostgreSQL connection in .env
   # The application will auto-create necessary tables
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

5. **Verify Installation**
   ```bash
   curl http://localhost:3000/health
   ```

### 🐳 Docker Installation

```bash
# Start with Docker Compose
docker-compose up -d

# Or build and run individually
docker build -t webqx .
docker run -p 3000:3000 webqx
```

---

## 💡 Usage Guide

### 🔐 Authentication Setup

WebQX™ supports multiple authentication methods:

```typescript
import { SSOManager } from './sso';

const sso = new SSOManager({
  secretKey: 'your-256-bit-secret-key',
  sessionTimeout: 3600000,
  providers: {
    oauth2: {
      azure: {
        clientId: 'your-azure-client-id',
        clientSecret: 'your-azure-client-secret',
        redirectUri: 'https://your-app.com/auth/oauth2/azure/callback',
        scope: ['openid', 'profile', 'email']
      }
    }
  }
});

// Express.js integration
app.get('/dashboard', sso.requireAuth, (req, res) => {
  res.json({ user: req.user });
});
```

### 🧪 Lab Results Integration

Enable real-time lab results with Mirth Connect:

```javascript
// Configure HL7 to FHIR transformation
import LabResultsViewer from './components/LabResultsViewer';

function PatientDashboard({ patientId }) {
  return (
    <LabResultsViewer 
      patientId={patientId}
      fhirServerUrl="/fhir"
      onError={(error) => console.error('Lab results error:', error)}
      onLoadingChange={(loading) => setLoading(loading)}
    />
  );
}
```

### 🎙️ Transcription Services

Integrate multilingual clinical transcription:

```javascript
// Start transcription module
npm run telehealth:start:full

// Access transcription API
curl http://localhost:3000/api/transcription/start
```

---

## 🏗️ Architecture

WebQX™ follows a modular, microservices-inspired architecture:

```
WebQX™ Platform
├── 🔐 Authentication Layer (Keycloak, OAuth2/SAML)
├── 🌐 API Gateway (FHIR-compliant endpoints)
├── 🧩 Modular Services
│   ├── Patient Portal (React)
│   ├── Provider Panel (React + GraphQL)
│   └── Admin Console (Role-based access)
├── 🔗 EHR Integrations
│   ├── OpenEMR, OpenMRS, HospitalRun
│   ├── Epic, Cerner (via adapters)
│   └── FHIR R4 native support
└── 📊 Shared Services
    ├── Audit Logging
    ├── Real-time Updates
    └── Multilingual Support
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React.js, TypeScript, Tailwind CSS |
| **Backend** | Node.js, Express, Fastify |
| **Database** | PostgreSQL, Redis |
| **Authentication** | Keycloak, OAuth2, SAML |
| **Interoperability** | HL7 v2/v3, FHIR R4, REST APIs |
| **AI/NLP** | Whisper, spaCy, Haystack |
| **DevOps** | Docker, GitHub Actions, Railway |

---

## 🧩 Modules & Specialties

### Directory Structure

```
webqx/
├── modules/
│   ├── transcription/          # AI-powered clinical documentation
│   ├── specialty-primary-care/ # Primary care workflows
│   ├── specialty-radiology/    # Radiology and imaging
│   ├── specialty-cardiology/   # Cardiovascular care
│   ├── specialty-neurology/    # Neurological care
│   ├── specialty-pulmonology/  # Respiratory care
│   └── specialty-oncology/     # Cancer care workflows
├── sso/                        # Single Sign-On module
│   ├── providers/oauth2/       # OAuth2 providers
│   └── providers/saml/         # SAML providers
├── ehr-integrations/           # EHR system adapters
│   ├── openemr/               # OpenEMR integration
│   ├── openmrs/               # OpenMRS integration
│   ├── librehealth/           # LibreHealth integration
│   └── hospitalrun/           # HospitalRun integration
├── patient-portal/            # Patient-facing interface
├── auth/                      # Authentication services
├── interoperability/          # Standards compliance
└── docs/                      # Documentation
```

### Supported Specialties

✅ **Primary Care** | ✅ **Radiology** | ✅ **Cardiology** | ✅ **Pediatrics**  
✅ **Oncology** | ✅ **Psychiatry** | ✅ **Endocrinology** | ✅ **Orthopedics**  
✅ **Neurology** | ✅ **Gastroenterology** | ✅ **Pulmonology** | ✅ **Dermatology**  

---

## 🔐 Security & Compliance

### HIPAA Compliance
- **Encryption**: TLS 1.3 for data in transit, AES-256 for data at rest
- **Audit Logging**: Comprehensive HIPAA-compliant audit trails
- **Access Control**: Role-based access with multi-factor authentication
- **BAA Ready**: Business Associate Agreement templates included

### Security Features
- **Penetration Testing**: Regular security assessments
- **Vulnerability Management**: Automated dependency scanning
- **Session Management**: Secure JWT tokens with configurable expiration
- **Data Loss Prevention**: Automated PII detection and protection

### Compliance Standards
- ✅ **HIPAA** (Health Insurance Portability and Accountability Act)
- ✅ **FHIR R4** (Fast Healthcare Interoperability Resources)
- ✅ **HL7** (Health Level Seven International)
- ✅ **WCAG 2.1** (Web Content Accessibility Guidelines)

---

## 🤝 Contributing

We welcome contributions from clinicians, developers, and researchers worldwide!

### Getting Started

1. **Fork the Repository**
2. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Sign Legal Agreements**
   - Review and sign our [Contributor Agreement](./legal/contributor-agreement.md)
   - Complete the [IP Assignment Addendum](./legal/ip-addendum.md)
4. **Submit a Pull Request**

### Development Guidelines

- Follow our [Coding Standards](./docs/CONTRIBUTING.md)
- Add tests for new functionality
- Update documentation as needed
- Ensure HIPAA compliance for all healthcare-related features

### Specialty Module Development

Interested in developing a new specialty module? See our [Specialty Development Guide](./docs/SPECIALTY_DEVELOPMENT.md).

### 📚 Documentation

- [Contributing Guide](./docs/CONTRIBUTING.md)
- [API Documentation](./docs/API.md)
- [FHIR Integration Guide](./docs/FHIR_API_EXAMPLES.md)
- [Deployment Guide](./DEPLOYMENT.md)

---

## 📜 License

WebQX™ is licensed under the **Apache License 2.0** with contributor IP assignment requirements for legal clarity and scalability.

- **Main License**: [Apache 2.0](./LICENSE.md)
- **Contributor Agreement**: [IP Addendum](./legal/ip-addendum.md)
- **Privacy Policy**: [Privacy Terms](./legal/privacy-policy.md)

---

## 📞 Support

### 🆘 Get Help

- **Documentation**: [docs.webqx.health](https://docs.webqx.health)
- **Community Forum**: [community.webqx.health](https://community.webqx.health)
- **GitHub Issues**: [Report a bug](https://github.com/WebQx/webqx/issues)
- **Security Issues**: [security@webqx.health](mailto:security@webqx.health)

### 🏥 Healthcare Implementation Support

Need help implementing WebQX™ in your healthcare organization?

- **Implementation Guide**: [implementation.webqx.health](https://implementation.webqx.health)
- **Professional Services**: [contact@webqx.health](mailto:contact@webqx.health)
- **Training Programs**: [training.webqx.health](https://training.webqx.health)

---

<div align="center">

**Crafted with ❤️ by the WebQX Health Team**

*"Care equity begins with code equity."*

[🌐 Website](https://webqx.health) • [📧 Contact](mailto:hello@webqx.health) • [🐦 Twitter](https://twitter.com/webqx_health) • [💼 LinkedIn](https://linkedin.com/company/webqx-health)

</div>