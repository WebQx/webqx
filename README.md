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
   git clone https://github.com/WebQx/webqx
   ```