# Production Environment Configuration for Railway

This document outlines the required environment variables for deploying WebQx EMR to Railway according to the ROADMAP.md specifications.

## Core Platform Configuration

### API Gateway (Node.js Service)
```bash
# Runtime
NODE_ENV=production
PORT=3000

# CORS & Security
ALLOWED_ORIGINS=https://webqx.github.io,https://webqx-healthcare.github.io
API_RATE_LIMIT_MAX=1000
API_RATE_LIMIT_WINDOW_MS=900000

# Health Check
HEALTH_CHECK_ENABLED=true
HEALTH_CHECK_TIMEOUT=5000
```

### OAuth2 Authentication (Production)
```bash
# OAuth2 Provider Configuration
OAUTH2_ISSUER=https://auth.webqx.health
OAUTH2_CLIENT_ID=webqx-healthcare-platform-prod
OAUTH2_CLIENT_SECRET=[SECURE_CLIENT_SECRET]
OAUTH2_REDIRECT_URI=https://webqx.github.io/auth/oauth2/callback
OAUTH2_SCOPE=openid profile email patient/*.read patient/*.write user/*.read
OAUTH2_JWKS_URI=https://auth.webqx.health/.well-known/jwks.json

# Token Configuration
OAUTH2_TOKEN_CACHE_ENABLED=true
OAUTH2_TOKEN_CACHE_TTL=300
OAUTH2_VALIDATE_AUDIENCE=true
OAUTH2_VALIDATE_ISSUER=true
OAUTH2_CLOCK_TOLERANCE=60
```

### Provider SSO (Microsoft, Google, Apple)
```bash
# Microsoft Entra ID (work/school)
AZURE_CLIENT_ID=<entra_app_client_id>
AZURE_CLIENT_SECRET=<entra_app_client_secret>
# Optional: set tenant or keep 'common' (handled in code)
AZURE_TENANT_ID=<tenant_id>

# Google OAuth2 (OpenID Connect)
GOOGLE_CLIENT_ID=<google_oauth_client_id>
GOOGLE_CLIENT_SECRET=<google_oauth_client_secret>

# Apple Sign In
APPLE_CLIENT_ID=<apple_service_id_or_client_id>
APPLE_CLIENT_SECRET=<apple_client_secret_or_jwt>
# Note: Apple uses id_token claims for user info; ensure redirect URIs are configured in Apple developer console.

# Optional: Keycloak / SMART on FHIR
KEYCLOAK_CLIENT_ID=<keycloak_client_id>
KEYCLOAK_CLIENT_SECRET=<keycloak_client_secret>
KEYCLOAK_TOKEN_URL=<keycloak_token_endpoint>
KEYCLOAK_USERINFO_URL=<keycloak_userinfo_endpoint>
FHIR_CLIENT_ID=<smart_fhir_client_id>
FHIR_CLIENT_SECRET=<smart_fhir_client_secret>
FHIR_TOKEN_URL=<smart_fhir_token_endpoint>
FHIR_USERINFO_URL=<smart_fhir_userinfo_or_practitioner_endpoint>
```

### OpenEMR Integration
```bash
# OpenEMR Service Configuration
USE_REMOTE_OPENEMR=true
OPENEMR_REMOTE_URL=https://emr.webqx.health
OPENEMR_API_KEY=[SECURE_EMR_API_KEY]
OPENEMR_CLIENT_ID=webqx-api-gateway
OPENEMR_CLIENT_SECRET=[SECURE_EMR_CLIENT_SECRET]

# FHIR R4 Configuration
FHIR_BASE_URL=https://emr.webqx.health/apis/default/fhir
PUBLIC_FHIR_BASE=https://api.webqx.health/fhir
FHIR_VALIDATE_RESOURCES=true
```

### HIPAA Compliance
```bash
# Encryption (REQUIRED - Generate secure 64-character hex key)
HIPAA_ENCRYPTION_KEY=[64_CHARACTER_HEX_KEY]
HIPAA_AUDIT_ENABLED=true
HIPAA_COMPLIANT_MODE=true
HIPAA_RETENTION_DAYS=2555

# Audit Logging
AUDIT_LOG_RETENTION_DAYS=2555
AUDIT_LOG_PATH=/app/logs/hipaa-audit.log
PHI_DETECTION_ENABLED=true
PHI_ANONYMIZATION_ENABLED=true

# Security Requirements
SESSION_TIMEOUT_MINUTES=60
MAX_CONCURRENT_SESSIONS=10
REQUIRE_PATIENT_CONSENT=true
```

### RabbitMQ Messaging
```bash
# RabbitMQ Configuration (Production)
RABBITMQ_URL=amqps://[USERNAME]:[PASSWORD]@[RABBITMQ_HOST]:5671/[VHOST]
RABBITMQ_MANAGEMENT_URL=https://[RABBITMQ_HOST]:15671
RABBITMQ_HEARTBEAT=60
RABBITMQ_CONNECTION_TIMEOUT=10000

# Message Retention
MESSAGE_RETENTION_DAYS=2555
DEAD_LETTER_TTL_MS=86400000
```

### OpenAI Integration
```bash
# ChatEHR Service
CHATEHR_API_URL=https://api.openai.com/v1
CHATEHR_API_KEY=[SECURE_OPENAI_API_KEY]
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_MAX_TOKENS=4096
OPENAI_TEMPERATURE=0.3

# Rate Limiting
OPENAI_RATE_LIMIT_RPM=1000
OPENAI_RATE_LIMIT_TPM=100000
```

### Whisper Transcription Service
```bash
# Whisper Configuration
TRANSCRIPTION_BASE_URL=https://whisper.webqx.health
WHISPER_API_KEY=[SECURE_WHISPER_API_KEY]
WHISPER_MODEL=whisper-1
WHISPER_LANGUAGE=auto
WHISPER_RESPONSE_FORMAT=json

# Audio Processing
MAX_AUDIO_FILE_SIZE_MB=25
ALLOWED_AUDIO_FORMATS=mp3,wav,m4a,flac
AUDIO_PROCESSING_TIMEOUT=300000
```

### Database Configuration
```bash
# PostgreSQL (for Django Ops)
DATABASE_URL=postgresql://[USERNAME]:[PASSWORD]@[HOST]:[PORT]/[DATABASE]
DATABASE_SSL_MODE=require
DATABASE_POOL_SIZE=10
DATABASE_MAX_OVERFLOW=20

# Redis (for caching)
REDIS_URL=redis://[USERNAME]:[PASSWORD]@[HOST]:[PORT]/[DATABASE]
REDIS_SSL=true
REDIS_POOL_SIZE=10
```

### DICOMweb/PACS Integration
```bash
# PACS Configuration
DICOMWEB_PROXY_TARGET=https://pacs.webqx.health/dcm4chee-arc/aets/DCM4CHEE/rs
DICOMWEB_BASIC_AUTH_USER=[PACS_USERNAME]
DICOMWEB_BASIC_AUTH_PASS=[PACS_PASSWORD]
OHIF_VIEWER_URL=https://viewer.webqx.health
```

### Monitoring & Observability
```bash
# Logging
LOG_LEVEL=info
LOG_FORMAT=json
STRUCTURED_LOGGING=true

# Metrics
METRICS_ENABLED=true
METRICS_PORT=9090
PROMETHEUS_ENDPOINT=/metrics

# Health Checks
HEALTH_CHECK_INTERVAL=30000
SERVICE_DISCOVERY_TIMEOUT=5000
```

## Deployment Commands

### Railway Service Deployment
```bash
# Deploy API Gateway
railway deploy --service=api-gateway

# Deploy OpenEMR
railway deploy --service=openemr

# Deploy Whisper Service  
railway deploy --service=whisper

# Deploy RabbitMQ (if self-hosted)
railway deploy --service=rabbitmq
```

### Environment Variable Setup
```bash
# Set all production environment variables
railway variables:set NODE_ENV=production
railway variables:set OAUTH2_CLIENT_SECRET=[SECRET]
railway variables:set HIPAA_ENCRYPTION_KEY=[64_CHAR_HEX]
# ... continue for all variables above
```

## Security Checklist

- [ ] All secrets use strong, randomly generated values
- [ ] HIPAA encryption key is exactly 64 hex characters
- [ ] OAuth2 client credentials are properly secured
- [ ] Database and Redis connections use SSL/TLS
- [ ] RabbitMQ uses AMQPS (SSL) connection
- [ ] API keys for OpenAI/Whisper are rotated regularly
- [ ] CORS origins are restricted to production domains
- [ ] Health check endpoints don't expose sensitive data
- [ ] Audit logging is enabled for all services
- [ ] Rate limiting is configured appropriately

## Service Dependencies

The services must be deployed in this order:
1. PostgreSQL Database
2. Redis Cache
3. RabbitMQ Message Broker
4. OpenEMR Core Service
5. Whisper Transcription Service
6. API Gateway (this service)

Each service includes health check endpoints for Railway to monitor service availability.