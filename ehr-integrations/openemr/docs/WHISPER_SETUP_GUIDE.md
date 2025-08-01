# OpenEMR Whisper Integration - Setup and Configuration Guide

## Overview

This guide provides comprehensive instructions for setting up and configuring the Whisper-OpenEMR integration, enabling healthcare providers to use voice transcription for clinical documentation within OpenEMR workflows.

## Prerequisites

### System Requirements

- Node.js 16.0.0 or higher
- OpenEMR 7.0.0 or higher (for full FHIR support)
- Valid OpenAI API key for Whisper service
- HTTPS-enabled environment (required for microphone access)

### OpenEMR Configuration

1. **Enable API Access**:
   ```bash
   # In OpenEMR Administration
   Administration → Globals → Connectors
   ✓ Enable "Enable REST API"
   ✓ Enable "Enable FHIR REST API"
   ```

2. **Register OAuth2 Client**:
   ```bash
   # In OpenEMR Administration
   Administration → System → API Clients
   # Create new client with required scopes
   ```

3. **Required OAuth2 Scopes**:
   ```javascript
   const requiredScopes = [
     'openid',
     'fhirUser',
     'patient/Patient.read',
     'patient/Patient.write',
     'patient/Encounter.read',
     'patient/Encounter.write',
     'patient/Observation.read',
     'patient/Observation.write',
     'patient/DocumentReference.read',
     'patient/DocumentReference.write'
   ];
   ```

## Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Create a `.env` file in your project root:

```env
# OpenEMR Configuration
OPENEMR_BASE_URL=https://your-openemr-instance.com
OPENEMR_API_VERSION=7.0.2
OPENEMR_CLIENT_ID=your-oauth-client-id
OPENEMR_CLIENT_SECRET=your-oauth-client-secret
OPENEMR_REDIRECT_URI=https://your-app.com/callback

# Whisper Configuration
WHISPER_API_KEY=your-openai-api-key
WHISPER_API_URL=https://api.openai.com/v1/audio/transcriptions
WHISPER_TIMEOUT=30000
WHISPER_MAX_FILE_SIZE=26214400

# FHIR Configuration
OPENEMR_FHIR_ENABLED=true
OPENEMR_FHIR_BASE_URL=https://your-openemr-instance.com/apis/default/fhir

# Security Settings
OPENEMR_VERIFY_SSL=true
OPENEMR_TIMEOUT_MS=30000

# Feature Flags
ENABLE_STREAMING_TRANSCRIPTION=true
ENABLE_AUTO_SAVE=true
ENABLE_AUDIT_LOGGING=true
ENABLE_PHI_PROTECTION=true

# Clinical Settings
DEFAULT_LANGUAGE=en
MEDICAL_TEMPERATURE=0.1
USE_MEDICAL_VOCABULARY=true
```

### 3. SSL Certificate Setup (Required for Microphone Access)

For development:
```bash
# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Start with HTTPS
npm run dev-https
```

For production:
```bash
# Use Let's Encrypt or your SSL provider
# Ensure your application is served over HTTPS
```

## Basic Usage

### 1. Initialize the Integration

```typescript
import { WhisperOpenEMRIntegration } from './ehr-integrations/openemr/services/whisperIntegration';
import { createConfig } from './ehr-integrations/openemr/config/whisperConfig';

// Create configuration
const config = createConfig('production', 'general');

// Initialize integration
const integration = new WhisperOpenEMRIntegration(config);
await integration.initialize();
```

### 2. Basic Voice Transcription

```typescript
// Prepare clinical context
const clinicalContext = {
  patientId: 'patient-12345',
  encounterId: 'encounter-67890',
  providerId: 'provider-abcde',
  transcriptionType: 'encounter_note',
  clinicalContext: 'Annual wellness visit'
};

// Transcribe audio file
const audioFile = new File([audioBlob], 'recording.wav', { type: 'audio/wav' });
const result = await integration.transcribeClinicalAudio(audioFile, clinicalContext);

console.log('Transcription:', result.text);
console.log('Saved to encounter:', result.savedToEncounterId);
```

### 3. Real-time Streaming Transcription

```typescript
// Start streaming transcription
await integration.startStreamingTranscription(clinicalContext, {
  onTranscription: (text, isFinal) => {
    if (isFinal) {
      console.log('Final transcription:', text);
    } else {
      console.log('Interim transcription:', text);
    }
  },
  onError: (error) => {
    console.error('Streaming error:', error);
  },
  onStateChange: (isRecording) => {
    console.log('Recording state:', isRecording);
  }
});

// Stop when done
await integration.stopStreamingTranscription();
```

## React Component Integration

### 1. Import and Setup

```typescript
import React from 'react';
import { ClinicalVoiceTranscription } from './ehr-integrations/openemr/components/ClinicalVoiceTranscription';
import { WhisperOpenEMRIntegration } from './ehr-integrations/openemr/services/whisperIntegration';
```

### 2. Component Usage

```tsx
const ClinicalDocumentationPage: React.FC = () => {
  const [integrationService, setIntegrationService] = useState<WhisperOpenEMRIntegration>();

  useEffect(() => {
    const initService = async () => {
      const config = createConfig('production');
      const service = new WhisperOpenEMRIntegration(config);
      await service.initialize();
      setIntegrationService(service);
    };
    initService();
  }, []);

  if (!integrationService) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>Patient Encounter Documentation</h1>
      
      <ClinicalVoiceTranscription
        patientId="patient-12345"
        encounterId="encounter-67890"
        providerId="provider-abcde"
        transcriptionType="encounter_note"
        integrationService={integrationService}
        clinicalContext="Annual wellness visit with preventive care focus"
        onTranscriptionComplete={(result) => {
          console.log('Transcription completed:', result);
          // Handle completed transcription
        }}
        onError={(error) => {
          console.error('Transcription error:', error);
          // Handle errors
        }}
        enableStreaming={true}
      />
    </div>
  );
};
```

## Configuration Options

### Environment-Specific Configurations

```typescript
// Development configuration
const devConfig = createConfig('development', 'general', {
  openemr: {
    debug: true,
    security: { verifySSL: false }
  }
});

// Production configuration
const prodConfig = createConfig('production', 'general', {
  whisper: {
    timeout: 60000,
    maxFileSize: 50 * 1024 * 1024
  },
  clinical: {
    medicalTemperature: 0.05
  }
});

// Multilingual clinic configuration
const multilingualConfig = createConfig('production', 'multilingual', {
  clinical: {
    defaultLanguage: 'auto',
    medicalTemperature: 0.2
  }
});

// Emergency department configuration
const emergencyConfig = createConfig('production', 'emergency', {
  whisper: {
    timeout: 30000
  },
  openemr: {
    security: { timeout: 20000 },
    features: { syncInterval: 5 }
  }
});
```

### Advanced Configuration

```typescript
const advancedConfig = {
  openemr: {
    baseUrl: process.env.OPENEMR_BASE_URL,
    apiVersion: '7.0.2',
    oauth: {
      clientId: process.env.OPENEMR_CLIENT_ID,
      clientSecret: process.env.OPENEMR_CLIENT_SECRET,
      redirectUri: process.env.OPENEMR_REDIRECT_URI,
      scopes: [
        'openid', 'fhirUser',
        'patient/Patient.read', 'patient/Patient.write',
        'patient/Encounter.read', 'patient/Encounter.write',
        'patient/Observation.read', 'patient/Observation.write',
        'patient/DocumentReference.read', 'patient/DocumentReference.write'
      ]
    },
    fhir: {
      enabled: true,
      baseUrl: process.env.OPENEMR_FHIR_BASE_URL
    },
    security: {
      verifySSL: true,
      timeout: 45000
    },
    features: {
      enableAudit: true,
      enableSync: true,
      syncInterval: 10
    }
  },
  whisper: {
    timeout: 60000,
    maxFileSize: 50 * 1024 * 1024,
    allowedFileTypes: [
      'audio/mpeg', 'audio/mp4', 'audio/wav',
      'audio/webm', 'audio/ogg', 'audio/flac'
    ]
  },
  clinical: {
    useMedicalVocabulary: true,
    defaultLanguage: 'en',
    medicalTemperature: 0.1,
    enablePHIProtection: true
  },
  features: {
    enableStreaming: true,
    autoSaveToEncounter: true,
    enableAuditLogging: true
  }
};
```

## Authentication Flow

### 1. OAuth2 Setup

```typescript
// Get authorization URL
const authUrl = integration.getAuthorizationUrl();
window.location.href = authUrl;

// Handle callback
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');
const state = urlParams.get('state');

if (code) {
  const tokens = await integration.exchangeCodeForTokens(code, state);
  console.log('Authentication successful:', tokens);
}
```

### 2. Token Management

```typescript
// Automatic token refresh
try {
  const patient = await integration.getPatient('patient-123');
} catch (error) {
  if (error.code === 'UNAUTHORIZED') {
    await integration.refreshAccessToken();
    // Retry the operation
    const patient = await integration.getPatient('patient-123');
  }
}
```

## Clinical Workflows

### 1. Complete Encounter Documentation

```typescript
const encounterWorkflow = async (patientId: string, providerId: string) => {
  const encounterId = `encounter-${Date.now()}`;
  
  // Step 1: Chief Complaint
  const chiefComplaintResult = await integration.transcribeClinicalAudio(
    chiefComplaintAudio,
    {
      patientId,
      encounterId,
      providerId,
      transcriptionType: 'encounter_note',
      clinicalContext: 'Chief complaint and history of present illness'
    }
  );
  
  // Step 2: Physical Examination
  const examResult = await integration.transcribeClinicalAudio(
    examAudio,
    {
      patientId,
      encounterId,
      providerId,
      transcriptionType: 'assessment',
      clinicalContext: 'Physical examination findings'
    }
  );
  
  // Step 3: Assessment and Plan
  const planResult = await integration.transcribeClinicalAudio(
    planAudio,
    {
      patientId,
      encounterId,
      providerId,
      transcriptionType: 'plan',
      clinicalContext: 'Clinical assessment and treatment plan'
    }
  );
  
  return {
    chiefComplaint: chiefComplaintResult.text,
    examination: examResult.text,
    plan: planResult.text,
    encounterId
  };
};
```

### 2. Medication Documentation

```typescript
const medicationTranscription = async (patientId: string, providerId: string) => {
  const result = await integration.transcribeClinicalAudio(
    medicationAudio,
    {
      patientId,
      providerId,
      transcriptionType: 'medication_note',
      clinicalContext: 'Medication review and prescription management'
    }
  );
  
  return result;
};
```

## Testing

### 1. Run Tests

```bash
# Run all Whisper integration tests
npm test -- --testPathPatterns="whisperIntegration"

# Run with coverage
npm test -- --coverage --testPathPatterns="whisperIntegration"

# Run specific test suite
npm test -- --testNamePattern="WhisperOpenEMRIntegration"
```

### 2. Integration Testing

```typescript
describe('Integration Tests', () => {
  test('should complete full clinical workflow', async () => {
    const config = createConfig('development');
    const integration = new WhisperOpenEMRIntegration(config);
    await integration.initialize();
    
    // Test complete workflow
    const mockAudioFile = new File(['audio data'], 'test.wav', { type: 'audio/wav' });
    const result = await integration.transcribeClinicalAudio(mockAudioFile, {
      patientId: 'test-patient',
      providerId: 'test-provider',
      transcriptionType: 'encounter_note'
    });
    
    expect(result.text).toBeDefined();
    expect(result.timestamp).toBeInstanceOf(Date);
  });
});
```

## Troubleshooting

### Common Issues

1. **Microphone Access Denied**
   ```javascript
   // Ensure HTTPS is enabled
   // Check browser permissions
   // Test with: navigator.mediaDevices.getUserMedia({ audio: true })
   ```

2. **OpenEMR Authentication Errors**
   ```javascript
   // Verify OAuth2 client configuration
   // Check client ID and secret
   // Ensure redirect URI matches exactly
   ```

3. **Whisper API Errors**
   ```javascript
   // Verify API key is correct
   // Check network connectivity
   // Ensure file size is within limits
   ```

4. **CORS Issues**
   ```javascript
   // Configure OpenEMR CORS settings
   // Ensure your domain is whitelisted
   // Check preflight request handling
   ```

### Debug Mode

```typescript
const debugConfig = createConfig('development', 'general', {
  openemr: {
    debug: true // Enables detailed logging
  }
});
```

### Health Checks

```typescript
// Check system health
const status = await integration.getStatus();
console.log('System status:', status);

// Test connectivity
try {
  await integration.initialize();
  console.log('Integration healthy');
} catch (error) {
  console.error('Integration unhealthy:', error);
}
```

## Production Deployment

### 1. Environment Setup

```bash
# Production environment variables
NODE_ENV=production
OPENEMR_BASE_URL=https://emr.yourhospital.com
OPENEMR_CLIENT_ID=${VAULT_OPENEMR_CLIENT_ID}
OPENEMR_CLIENT_SECRET=${VAULT_OPENEMR_CLIENT_SECRET}
WHISPER_API_KEY=${VAULT_WHISPER_API_KEY}
ENABLE_AUDIT_LOGGING=true
ENABLE_PHI_PROTECTION=true
```

### 2. Security Considerations

- Use HTTPS everywhere
- Store secrets in secure vault
- Enable audit logging
- Configure PHI protection
- Implement proper RBAC
- Regular security audits

### 3. Monitoring

```typescript
// Set up health monitoring
setInterval(async () => {
  try {
    const status = await integration.getStatus();
    if (!status.healthy) {
      // Alert operations team
      console.error('Integration unhealthy:', status);
    }
  } catch (error) {
    console.error('Health check failed:', error);
  }
}, 60000); // Check every minute
```

### 4. Performance Optimization

```typescript
// Production optimizations
const prodConfig = createConfig('production', 'general', {
  whisper: {
    timeout: 60000, // Longer timeout for production
    maxFileSize: 50 * 1024 * 1024 // 50MB for production
  },
  openemr: {
    features: {
      syncInterval: 5 // More frequent sync
    }
  },
  clinical: {
    medicalTemperature: 0.05 // Lower for consistency
  }
});
```

## Support and Resources

- [OpenEMR Documentation](https://open-emr.org/wiki/index.php/Help_Documentation)
- [OpenAI Whisper API Documentation](https://platform.openai.com/docs/guides/speech-to-text)
- [WebQX Health Support](https://github.com/WebQx/webqx/discussions)
- [Healthcare Compliance Guide](./docs/HEALTHCARE_COMPLIANCE.md)

## License

This integration is licensed under the Apache License 2.0. See the [LICENSE.md](../../LICENSE.md) file for details.