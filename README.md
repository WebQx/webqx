# WebQX™ — Modular, Open, Multilingual Healthcare Platform

Welcome to WebQX™, a collaborative open-source effort to democratize clinical transcription and workflow design. This repo includes foundational modules for radiology transcription, multilingual dictation, and batch transcription testing.

## 🚀 Features
- Whisper-based transcription modules (English + multilingual)
- PACS-integrated radiology workflow
- ACI-simulated ambient capture layer
- Batch queue manager for dictations
- Role-based access system for provider verification

## 🧱 Modules
- /transcription-core
- /radiology-workflow
- /multilingual-engine
- /queue-manager
- /samples (de-identified ICD-10 transcripts)

## 🔐 Licensing & IP
All contributors must sign:
- NDA Template (see `/legal/nda.md`)
- Contributor IP Assignment Addendum (`/legal/ip-addendum.md`)

## 🌱 Getting Started
```bash
git clone https://github.com/webqx-platform/core
npm install
npm run dev

