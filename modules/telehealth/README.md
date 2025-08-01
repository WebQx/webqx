# 🩺 WebQX™ Telehealth Module

## Overview

The WebQX™ Telehealth Module provides comprehensive video consultation capabilities with ambient documentation, multilingual support, and FHIR-compliant messaging for healthcare providers and patients.

## Features

### 1. Ambient Documentation
- Real-time speech transcription using Whisper integration
- Automatic conversion to FHIR ClinicalNote resources
- Medical terminology optimization for different specialties
- Secure handling of clinical conversations

### 2. Multilingual Interface
- Support for 12+ languages with automatic detection
- Localized UI for both provider and patient interfaces
- Real-time translation capabilities for cross-language consultations
- Accessibility features including screen reader support

### 3. FHIR Messaging
- Post-visit summary generation and delivery
- Follow-up instruction templates
- Patient notification system
- Compliance with FHIR Messaging standards

## Directory Structure

```
modules/telehealth/
├── components/          # UI components for provider and patient interfaces
├── services/           # Core telehealth services
├── models/             # FHIR resource models and types
├── locales/            # Multilingual resource files
├── utils/              # Helper utilities and adapters
└── __tests__/          # Test suites
```

## Integration

This module integrates with:
- WebQX™ Whisper Service for transcription
- FHIR infrastructure for clinical notes and messaging
- Matrix messaging system for secure communication
- i18next framework for internationalization
- Existing authentication and authorization systems

## Usage

### Provider Interface
```typescript
import { TelehealthProvider } from './components/TelehealthProvider';

<TelehealthProvider 
  patientId="patient-123"
  providerId="provider-456"
  sessionId="session-789"
  enableTranscription={true}
  language="en"
/>
```

### Patient Interface
```typescript
import { TelehealthPatient } from './components/TelehealthPatient';

<TelehealthPatient 
  sessionId="session-789"
  language="es"
  enableAutoTranslation={true}
/>
```

## Security & Compliance

- HIPAA-compliant handling of all clinical data
- End-to-end encryption for video sessions
- Secure storage and transmission of transcripts
- Audit logging for all telehealth activities