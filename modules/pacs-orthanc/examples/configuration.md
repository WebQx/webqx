# WebQX™ Orthanc PACS Integration - Example Configuration

This document provides example configurations for the WebQX PACS integration with Orthanc.

## Basic Configuration

```typescript
import { createPACSConfig, createPACSIntegration } from './modules/pacs-orthanc';

// Basic configuration with all plugins enabled
const config = createPACSConfig({
  orthanc: {
    baseUrl: 'http://orthanc-server:8042',
    username: 'orthanc',
    password: 'orthanc',
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
    ssl: {
      enabled: false,
      verifySSL: true
    }
  },
  
  cloudStorage: {
    provider: 'aws',
    region: 'us-east-1',
    bucketName: 'webqx-dicom-storage',
    credentials: {
      aws: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
      }
    },
    retentionPolicy: {
      defaultRetentionDays: 2555, // ~7 years
      modalitySpecificRetention: {
        'CT': 3650,  // 10 years
        'MR': 3650,  // 10 years
        'MG': 3650,  // 10 years for mammography
        'US': 1825,  // 5 years
        'XR': 2555   // 7 years
      },
      archiveAfterDays: 365,
      glacierTransitionDays: 90
    },
    encryptionEnabled: true,
    compressionEnabled: true,
    pathTemplate: '{year}/{month}/{studyId}/{seriesId}'
  },
  
  rbac: {
    enabled: true,
    defaultPermissions: [
      { resource: 'study', action: 'read' },
      { resource: 'series', action: 'read' },
      { resource: 'instance', action: 'read' }
    ],
    roleHierarchy: {
      'admin': ['radiologist', 'technician', 'viewer'],
      'radiologist': ['technician', 'viewer'],
      'technician': ['viewer']
    },
    auditLogging: true,
    sessionTimeout: 28800, // 8 hours
    mfaRequired: false
  },
  
  multilingual: {
    defaultLanguage: 'en',
    supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'ar'],
    autoDetectLanguage: true,
    translationProvider: 'google',
    cacheTranslations: true,
    translationQuality: 'high'
  },
  
  imageViewing: {
    enableThumbnails: true,
    thumbnailSizes: [64, 128, 256, 512],
    maxPreviewSize: 1024,
    imageFormats: ['jpeg', 'png', 'webp'],
    compressionQuality: 85,
    cacheEnabled: true,
    cacheExpirationHours: 24,
    watermarkEnabled: true,
    allowDownload: true
  },
  
  database: {
    type: 'postgresql',
    config: {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'webqx_pacs',
      username: process.env.POSTGRES_USER || 'webqx',
      password: process.env.POSTGRES_PASSWORD || ''
    }
  },
  
  webqx: {
    apiUrl: process.env.WEBQX_API_URL || 'http://localhost:3000',
    apiKey: process.env.WEBQX_API_KEY || ''
  }
});

// Initialize the PACS integration service
const pacsService = await createPACSIntegration(config);
```

## Environment Variables

Create a `.env` file with the following variables:

```bash
# Orthanc Configuration
ORTHANC_URL=http://orthanc-server:8042
ORTHANC_USERNAME=orthanc
ORTHANC_PASSWORD=orthanc
ORTHANC_SSL_ENABLED=false
ORTHANC_SSL_VERIFY=true

# Cloud Storage Configuration
CLOUD_STORAGE_PROVIDER=aws
CLOUD_STORAGE_REGION=us-east-1
CLOUD_STORAGE_BUCKET=webqx-dicom-storage
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key

# Database Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=webqx_pacs
POSTGRES_USER=webqx
POSTGRES_PASSWORD=your_postgres_password

# WebQX Integration
WEBQX_API_URL=http://localhost:3000
WEBQX_API_KEY=your_webqx_api_key

# Multilingual Configuration
DEFAULT_LANGUAGE=en
SUPPORTED_LANGUAGES=en,es,fr,de,it,pt,zh,ja,ko,ar
TRANSLATION_PROVIDER=google

# Security
RBAC_ENABLED=true
RBAC_AUDIT_LOGGING=true
RBAC_SESSION_TIMEOUT=28800
RBAC_MFA_REQUIRED=false

# Image Processing
ENABLE_THUMBNAILS=true
THUMBNAIL_SIZES=64,128,256,512
MAX_PREVIEW_SIZE=1024
IMAGE_COMPRESSION_QUALITY=85
WATERMARK_ENABLED=true
ALLOW_DOWNLOAD=true

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
LOG_OUTPUTS=console,file
```

## API Usage Examples

Once initialized, you can use the PACS integration service in your WebQX application:

```typescript
import express from 'express';
import { createPACSIntegration, createPACSConfig } from './modules/pacs-orthanc';

const app = express();
const config = createPACSConfig(/* your config */);
const pacsService = await createPACSIntegration(config);

// Authentication endpoint
app.post('/api/pacs/auth', async (req, res) => {
  try {
    const { token } = req.body;
    const userContext = await pacsService.authenticateUser(token, req.ip, req.get('User-Agent'));
    res.json({ success: true, session: userContext.sessionId });
  } catch (error) {
    res.status(401).json({ success: false, error: error.message });
  }
});

// Search studies endpoint
app.get('/api/pacs/studies/search', async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'] as string;
    const query = req.query;
    
    const results = await pacsService.searchStudies(query, sessionId);
    res.json({ success: true, results });
  } catch (error) {
    res.status(403).json({ success: false, error: error.message });
  }
});

// Get study metadata endpoint
app.get('/api/pacs/studies/:studyId', async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'] as string;
    const { studyId } = req.params;
    
    const metadata = await pacsService.getLocalizedStudyMetadata(studyId, sessionId);
    res.json({ success: true, metadata });
  } catch (error) {
    res.status(403).json({ success: false, error: error.message });
  }
});

// Get image preview endpoint
app.get('/api/pacs/images/:instanceId/preview', async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'] as string;
    const { instanceId } = req.params;
    const { sizes } = req.query;
    
    const preview = await pacsService.getImagePreview(
      instanceId, 
      sessionId, 
      sizes ? sizes.split(',').map(Number) : undefined
    );
    
    res.json({ success: true, preview });
  } catch (error) {
    res.status(403).json({ success: false, error: error.message });
  }
});

// Health check endpoint
app.get('/api/pacs/health', async (req, res) => {
  const health = await pacsService.getHealthStatus();
  res.json(health);
});

app.listen(3001, () => {
  console.log('WebQX PACS Integration API running on port 3001');
});
```