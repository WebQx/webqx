# WebQX™ Telehealth Deployment Configurations

This directory contains deployment configurations for both standalone and full-suite telehealth deployments.

## 📁 Directory Structure

```
deployment/
├── README.md                    # This documentation
├── standalone/                  # Individual component deployments
│   ├── video-consultation/      # Video consultation only
│   ├── messaging/               # Secure messaging only
│   ├── ehr-integration/         # EHR integration only
│   └── fhir-sync/               # FHIR sync only
├── full-suite/                  # Integrated deployment
│   ├── docker-compose.yml       # Full suite Docker composition
│   ├── .env.example             # Environment variables template
│   └── nginx.conf               # Load balancer configuration
└── shared/                      # Common deployment resources
    ├── scripts/                 # Deployment scripts
    ├── monitoring/              # Health check configurations
    └── security/                # Security policies
```

## 🚀 Deployment Options

### 1. Full Suite Deployment

Deploy all telehealth components as an integrated platform:

```bash
# Navigate to full-suite directory
cd deployment/full-suite

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your configuration

# Start the full telehealth suite
docker-compose up -d

# Verify deployment
curl http://localhost:3000/health/telehealth
```

**Features:**
- Unified dashboard with all telehealth capabilities
- Shared authentication and session management
- Cross-component data flow and interoperability
- Centralized monitoring and logging

### 2. Standalone Component Deployment

Deploy individual components independently:

#### Video Consultation Only
```bash
cd deployment/standalone/video-consultation
docker-compose up -d
```

#### Secure Messaging Only
```bash
cd deployment/standalone/messaging
docker-compose up -d
```

#### EHR Integration Only
```bash
cd deployment/standalone/ehr-integration
docker-compose up -d
```

#### FHIR Synchronization Only
```bash
cd deployment/standalone/fhir-sync
docker-compose up -d
```

## 🔧 Configuration

### Environment Variables

All deployments use the following environment variables:

#### Core Configuration
```bash
# Deployment mode
TELEHEALTH_DEPLOYMENT_MODE=full-suite  # or 'standalone'
TELEHEALTH_ENABLED_COMPONENTS=video-consultation,messaging,ehr-integration,fhir-sync

# Security
TELEHEALTH_SECRET_KEY=your-256-bit-secret-key
TELEHEALTH_ENCRYPTION_ALGORITHM=aes-256-gcm
TELEHEALTH_JWT_SECRET=your-jwt-secret

# Logging
TELEHEALTH_LOG_LEVEL=info
TELEHEALTH_AUDIT_ENABLED=true
TELEHEALTH_AUDIT_RETENTION_DAYS=2555  # 7 years for HIPAA compliance
```

#### Video Consultation Configuration
```bash
# Jitsi Settings
JITSI_DOMAIN=meet.webqx.health
JITSI_APP_ID=webqx-telehealth
JITSI_JWT_APP_SECRET=your-jitsi-jwt-secret
JITSI_JWT_KEY_ID=your-jitsi-key-id

# Recording
VIDEO_RECORDING_ENABLED=true
VIDEO_RECORDING_STORAGE=s3  # or 'local', 'azure'
VIDEO_RECORDING_RETENTION_DAYS=2555
```

#### Messaging Configuration
```bash
# Matrix Settings
MATRIX_HOMESERVER_URL=https://matrix.webqx.health
MATRIX_ACCESS_TOKEN=your-matrix-access-token
MATRIX_USER_ID=@webqx-telehealth:matrix.webqx.health
MATRIX_DEVICE_ID=WEBQX_TELEHEALTH_001

# Encryption
MATRIX_ENABLE_E2EE=true
MATRIX_VERIFY_DEVICES=true
MATRIX_CROSS_SIGNING=true
```

#### EHR Integration Configuration
```bash
# OpenEMR Settings
OPENEMR_BASE_URL=https://openemr.webqx.health
OPENEMR_API_KEY=your-openemr-api-key
OPENEMR_CLIENT_ID=your-openemr-client-id
OPENEMR_VERSION=7.0.2

# Sync Settings
EHR_SYNC_INTERVAL=60000  # 1 minute
EHR_SYNC_BATCH_SIZE=50
EHR_CONFLICT_RESOLUTION=latest  # or 'manual', 'merge'
```

#### FHIR Synchronization Configuration
```bash
# FHIR Server Settings
FHIR_SERVER_BASE_URL=https://fhir.webqx.health/fhir/R4
FHIR_SERVER_VERSION=R4
FHIR_AUTH_TYPE=oauth2  # or 'none', 'basic', 'bearer'
FHIR_CLIENT_ID=your-fhir-client-id
FHIR_CLIENT_SECRET=your-fhir-client-secret

# Synchronization
FHIR_SYNC_MODE=real-time  # or 'batch', 'scheduled'
FHIR_SYNC_DIRECTION=bidirectional  # or 'to-fhir', 'from-fhir'
FHIR_VALIDATE_RESOURCES=true
FHIR_ENABLED_TYPES=Patient,Appointment,Encounter,Observation
```

## 🏗️ Architecture Patterns

### Full Suite Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer (Nginx)                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────────────────┐
│                Telehealth Manager                           │
├─────────────────┬───────────────┬──────────────┬───────────┤
│ Video Component │ Msg Component │ EHR Component │ FHIR Comp │
└─────────────────┴───────────────┴──────────────┴───────────┘
                      │
┌─────────────────────┴───────────────────────────────────────┐
│              Shared Services Layer                          │
│  ┌─────────────┐ ┌──────────────┐ ┌─────────────────────┐   │
│  │ Auth/Session│ │ Event Bus    │ │ Audit & Monitoring   │   │
│  └─────────────┘ └──────────────┘ └─────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Standalone Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Video Component │    │ Msg Component   │    │ EHR Component   │
│ (Port 3001)     │    │ (Port 3002)     │    │ (Port 3003)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                      │                      │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Jitsi Meet    │    │  Matrix Server  │    │   OpenEMR API   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔍 Health Checks

All deployments include comprehensive health checks:

### Endpoints
- `GET /health` - Overall system health
- `GET /health/telehealth` - Telehealth manager health
- `GET /health/components` - Individual component health
- `GET /metrics` - Prometheus metrics

### Health Check Example
```json
{
  "status": "healthy",
  "deploymentMode": "full-suite",
  "components": {
    "video-consultation": {
      "healthy": true,
      "status": "running",
      "activeSessions": 3,
      "uptime": 3600000
    },
    "messaging": {
      "healthy": true,
      "status": "running",
      "activeChannels": 5,
      "uptime": 3600000
    }
  },
  "lastUpdated": "2025-01-08T10:30:00.000Z"
}
```

## 📊 Monitoring

### Metrics Collection
- **Prometheus**: Metrics collection and alerting
- **Grafana**: Visualization and dashboards
- **ELK Stack**: Log aggregation and analysis
- **Jaeger**: Distributed tracing

### Key Metrics
- Component health and uptime
- Active video sessions and participants
- Message throughput and delivery rates
- EHR sync success rates and latency
- FHIR resource synchronization status

## 🔒 Security

### Network Security
- TLS 1.3 encryption for all communications
- Network segmentation with VPC/subnets
- Web Application Firewall (WAF)
- DDoS protection

### Application Security
- OAuth2/OIDC authentication
- Role-based access control (RBAC)
- API rate limiting
- Input validation and sanitization

### Compliance
- HIPAA compliance configuration
- SOC 2 Type II readiness
- Audit logging for all operations
- Data encryption at rest and in transit

## 🔧 Scaling

### Horizontal Scaling
```yaml
# Auto-scaling configuration
video-consultation:
  replicas: 3
  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 10
    targetCPU: 70

messaging:
  replicas: 2
  autoscaling:
    enabled: true
    minReplicas: 1
    maxReplicas: 5
    targetCPU: 60
```

### Load Balancing
- Round-robin distribution
- Health check-based routing
- Session affinity for video components
- Geographic routing for global deployments

## 🛠️ Maintenance

### Backup Procedures
```bash
# Database backup
./scripts/backup-database.sh

# Configuration backup
./scripts/backup-config.sh

# Media files backup (recordings)
./scripts/backup-media.sh
```

### Update Procedures
```bash
# Rolling update for full suite
./scripts/rolling-update.sh

# Individual component update
./scripts/update-component.sh video-consultation
```

## 📋 Troubleshooting

### Common Issues

1. **Component Health Check Failures**
   ```bash
   # Check component logs
   docker-compose logs video-consultation
   
   # Restart specific component
   docker-compose restart video-consultation
   ```

2. **Video Call Connection Issues**
   ```bash
   # Check Jitsi configuration
   curl -v https://$JITSI_DOMAIN/config.js
   
   # Verify firewall rules for UDP ports
   sudo ufw status
   ```

3. **Message Delivery Failures**
   ```bash
   # Check Matrix server connectivity
   curl -v $MATRIX_HOMESERVER_URL/_matrix/client/versions
   
   # Verify encryption keys
   docker-compose exec messaging cat /app/keys/matrix-keys.json
   ```

### Debug Mode
```bash
# Enable debug logging
export TELEHEALTH_LOG_LEVEL=debug

# Start with debug mode
docker-compose -f docker-compose.yml -f docker-compose.debug.yml up
```

## 📞 Support

For deployment support:
- Documentation: `/docs/DEPLOYMENT.md`
- Issues: GitHub Issues
- Community: WebQX™ Health Community

---

**WebQX™ Health** - *"Flexible telehealth deployment for every healthcare environment."*