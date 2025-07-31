# Whisper-Ottehr Integration Examples

This directory contains configuration examples and usage patterns for the Whisper-Ottehr integration.

## Configuration Examples

### Basic Integration Setup

```typescript
import { WhisperOttehrIntegration } from '../services/whisperOttehrIntegration';

// Basic configuration
const integration = new WhisperOttehrIntegration({
  whisper: {
    apiUrl: 'https://api.openai.com/v1/audio/transcriptions',
    timeout: 30000,
    maxFileSize: 25 * 1024 * 1024
  },
  ottehr: {
    apiBaseUrl: 'https://api.ottehr.com',
    apiKey: process.env.OTTEHR_API_KEY,
    environment: 'production'
  },
  integration: {
    autoTranscribe: true,
    autoTranslate: false,
    medicalSpecialty: 'general',
    hipaaCompliant: true
  }
});
```

### Healthcare-Specific Configuration

```typescript
// Cardiology department configuration
const cardiologyIntegration = new WhisperOttehrIntegration({
  whisper: {
    apiUrl: process.env.WHISPER_API_URL,
    timeout: 60000, // Longer timeout for detailed consultations
    allowedFileTypes: [
      'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/webm'
    ]
  },
  ottehr: {
    apiBaseUrl: process.env.OTTEHR_API_BASE_URL,
    apiKey: process.env.OTTEHR_API_KEY,
    enableNotifications: true,
    enableOrdering: true
  },
  integration: {
    autoTranscribe: true,
    autoTranslate: true,
    defaultTargetLanguage: 'en',
    medicalSpecialty: 'cardiology',
    enableNotifications: true,
    hipaaCompliant: true
  }
});

// Emergency department configuration
const emergencyIntegration = new WhisperOttehrIntegration({
  whisper: {
    timeout: 15000, // Faster processing for emergency situations
    maxFileSize: 50 * 1024 * 1024 // Larger files for longer recordings
  },
  ottehr: {
    apiBaseUrl: process.env.OTTEHR_API_BASE_URL,
    apiKey: process.env.OTTEHR_API_KEY,
    enableNotifications: true,
    enableOrdering: false // Disable ordering in emergency context
  },
  integration: {
    autoTranscribe: true,
    autoTranslate: true,
    medicalSpecialty: 'emergency',
    enableNotifications: true,
    hipaaCompliant: true
  }
});
```

## React Component Usage Examples

### Basic Usage

```tsx
import React from 'react';
import { OttehrVoiceTranscription } from '../patient-portal/components/OttehrVoiceTranscription';

function PatientConsultation() {
  const handleTranscriptionComplete = (result) => {
    console.log('Transcription completed:', result);
    // Handle the transcription result
  };

  const handleError = (error) => {
    console.error('Transcription error:', error);
    // Handle the error
  };

  return (
    <OttehrVoiceTranscription
      patientId="patient-123"
      encounterType="consultation"
      specialty="general"
      onTranscriptionComplete={handleTranscriptionComplete}
      onError={handleError}
    />
  );
}
```

### Advanced Usage with Order Creation

```tsx
import React, { useState } from 'react';
import { OttehrVoiceTranscription } from '../patient-portal/components/OttehrVoiceTranscription';

function AdvancedConsultation() {
  const [orders, setOrders] = useState([]);

  const handleOrderCreated = (orderId, transcriptionResult) => {
    setOrders(prev => [...prev, { orderId, transcriptionResult }]);
    console.log(`Order ${orderId} created from transcription`);
  };

  return (
    <div>
      <OttehrVoiceTranscription
        patientId="patient-456"
        encounterType="prescription"
        specialty="pharmacy"
        enableTranslation={true}
        targetLanguage="es"
        enableOrderCreation={true}
        customPrompt="Prescription consultation with medication names and dosages"
        onOrderCreated={handleOrderCreated}
        integrationConfig={{
          integration: {
            autoTranscribe: true,
            autoTranslate: true,
            medicalSpecialty: 'pharmacy'
          }
        }}
      />
      
      {/* Display created orders */}
      {orders.length > 0 && (
        <div>
          <h3>Created Orders</h3>
          {orders.map(order => (
            <div key={order.orderId}>
              Order ID: {order.orderId}
              <br />
              Transcription: {order.transcriptionResult.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Multi-language Support

```tsx
import React, { useState } from 'react';
import { OttehrVoiceTranscription } from '../patient-portal/components/OttehrVoiceTranscription';

function MultilingualConsultation() {
  const [selectedLanguage, setSelectedLanguage] = useState('en');

  const supportedLanguages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ar', name: 'Arabic' }
  ];

  return (
    <div>
      <div>
        <label htmlFor="language-select">Target Language:</label>
        <select 
          id="language-select"
          value={selectedLanguage}
          onChange={(e) => setSelectedLanguage(e.target.value)}
        >
          {supportedLanguages.map(lang => (
            <option key={lang.code} value={lang.code}>
              {lang.name}
            </option>
          ))}
        </select>
      </div>

      <OttehrVoiceTranscription
        patientId="patient-789"
        encounterType="consultation"
        specialty="general"
        enableTranslation={true}
        targetLanguage={selectedLanguage}
        integrationConfig={{
          integration: {
            autoTranslate: true,
            defaultTargetLanguage: selectedLanguage
          }
        }}
      />
    </div>
  );
}
```

## Service Integration Examples

### Healthcare Workflow Integration

```typescript
import { WhisperOttehrIntegration } from '../services/whisperOttehrIntegration';

class HealthcareWorkflow {
  private integration: WhisperOttehrIntegration;

  constructor() {
    this.integration = new WhisperOttehrIntegration({
      integration: {
        autoTranscribe: true,
        enableNotifications: true,
        hipaaCompliant: true
      }
    });

    // Set up event listeners
    this.integration.on('transcriptionCompleted', this.handleTranscription.bind(this));
    this.integration.on('orderWithTranscriptionCreated', this.handleOrderCreated.bind(this));
  }

  async processPatientConsultation(audioFile: File, patientId: string) {
    try {
      const result = await this.integration.transcribeWithHealthcareContext({
        audioFile,
        patientId,
        encounterType: 'consultation',
        specialty: 'general'
      });

      // Process the transcription result
      await this.updatePatientRecord(patientId, result);
      
      return result;
    } catch (error) {
      console.error('Consultation processing failed:', error);
      throw error;
    }
  }

  private async handleTranscription(result) {
    // Auto-create clinical notes
    if (result.patientContext) {
      await this.createClinicalNote(result);
    }
  }

  private async handleOrderCreated({ orderId, transcriptionResult }) {
    // Update order management system
    await this.updateOrderManagement(orderId, transcriptionResult);
  }

  private async updatePatientRecord(patientId: string, result) {
    // Update patient medical record with transcription
    console.log(`Updating patient ${patientId} record with transcription`);
  }

  private async createClinicalNote(result) {
    // Create clinical note from transcription
    console.log('Creating clinical note from transcription');
  }

  private async updateOrderManagement(orderId: string, result) {
    // Update order management system
    console.log(`Updating order ${orderId} with transcription data`);
  }
}
```

### Batch Processing Example

```typescript
import { WhisperOttehrIntegration } from '../services/whisperOttehrIntegration';

class BatchTranscriptionProcessor {
  private integration: WhisperOttehrIntegration;

  constructor() {
    this.integration = new WhisperOttehrIntegration({
      whisper: {
        timeout: 120000 // Longer timeout for batch processing
      },
      integration: {
        autoTranscribe: true,
        hipaaCompliant: true
      }
    });
  }

  async processBatch(audioFiles: Array<{
    file: File;
    patientId: string;
    encounterType: string;
    specialty: string;
  }>) {
    const results = [];

    for (const item of audioFiles) {
      try {
        console.log(`Processing audio for patient ${item.patientId}`);
        
        const result = await this.integration.transcribeWithHealthcareContext({
          audioFile: item.file,
          patientId: item.patientId,
          encounterType: item.encounterType as any,
          specialty: item.specialty
        });

        results.push({
          patientId: item.patientId,
          success: true,
          result
        });

        // Add delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        results.push({
          patientId: item.patientId,
          success: false,
          error: error.message
        });
        console.error(`Failed to process audio for patient ${item.patientId}:`, error);
      }
    }

    return results;
  }
}
```

## Configuration Best Practices

### Environment Variables

```bash
# Required environment variables
WHISPER_API_KEY=your_openai_api_key_here
WHISPER_API_URL=https://api.openai.com/v1/audio/transcriptions

OTTEHR_API_BASE_URL=https://api.ottehr.com
OTTEHR_API_KEY=your_ottehr_api_key_here
OTTEHR_ENVIRONMENT=production

# Optional environment variables
WHISPER_TIMEOUT=30000
WHISPER_MAX_FILE_SIZE=26214400
OTTEHR_ENABLE_NOTIFICATIONS=true
OTTEHR_ENABLE_ORDERING=true
INTEGRATION_AUTO_TRANSCRIBE=true
INTEGRATION_AUTO_TRANSLATE=false
INTEGRATION_DEFAULT_TARGET_LANGUAGE=en
INTEGRATION_MEDICAL_SPECIALTY=general
INTEGRATION_HIPAA_COMPLIANT=true
```

### Docker Configuration

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Set environment variables
ENV NODE_ENV=production
ENV WHISPER_API_URL=https://api.openai.com/v1/audio/transcriptions
ENV OTTEHR_API_BASE_URL=https://api.ottehr.com

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  webqx-app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - WHISPER_API_KEY=${WHISPER_API_KEY}
      - WHISPER_API_URL=${WHISPER_API_URL}
      - OTTEHR_API_KEY=${OTTEHR_API_KEY}
      - OTTEHR_API_BASE_URL=${OTTEHR_API_BASE_URL}
      - INTEGRATION_HIPAA_COMPLIANT=true
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## Error Handling Examples

### Graceful Error Handling

```typescript
import { WhisperOttehrIntegration } from '../services/whisperOttehrIntegration';

class RobustIntegrationHandler {
  private integration: WhisperOttehrIntegration;
  private retryAttempts = 3;
  private retryDelay = 1000;

  constructor() {
    this.integration = new WhisperOttehrIntegration();
    this.setupErrorHandling();
  }

  private setupErrorHandling() {
    this.integration.on('transcriptionError', (error) => {
      console.error('Transcription error:', error);
      // Send error to monitoring service
      this.sendErrorToMonitoring('transcription_error', error);
    });
  }

  async transcribeWithRetry(request) {
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        return await this.integration.transcribeWithHealthcareContext(request);
      } catch (error) {
        console.warn(`Transcription attempt ${attempt} failed:`, error.message);
        
        if (attempt === this.retryAttempts) {
          throw error;
        }
        
        // Exponential backoff
        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  private sendErrorToMonitoring(type: string, error: any) {
    // Implementation for error monitoring service
    console.log(`Sending ${type} to monitoring:`, error);
  }
}
```

### Health Check Implementation

```typescript
import { WhisperOttehrIntegration } from '../services/whisperOttehrIntegration';

class HealthCheckService {
  private integration: WhisperOttehrIntegration;

  constructor() {
    this.integration = new WhisperOttehrIntegration();
  }

  async performHealthCheck() {
    try {
      const health = await this.integration.getHealthStatus();
      
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          whisper: health.whisper,
          ottehr: health.ottehr,
          integration: health.integration
        },
        configuration: {
          valid: health.integration.configValid
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }
}

// Express.js health check endpoint
app.get('/health', async (req, res) => {
  const healthCheck = new HealthCheckService();
  const health = await healthCheck.performHealthCheck();
  
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});
```

These examples demonstrate various ways to integrate and configure the Whisper-Ottehr integration for different healthcare scenarios, from basic usage to advanced workflows with error handling and monitoring.