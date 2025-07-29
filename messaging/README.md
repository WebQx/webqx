# 💬 WebQX™ Messaging Infrastructure

A secure, modular communication infrastructure for the WebQX™ Healthcare Platform leveraging the Matrix protocol. This directory provides the foundation for encrypted, compliant healthcare communications with support for specialty-specific workflows and extensible plugin architecture.

## 🏗️ Architecture Overview

The WebQX™ messaging infrastructure is designed with healthcare compliance and modularity at its core:

- **Matrix Protocol**: Decentralized, encrypted communication with end-to-end security
- **Specialty Channels**: Dedicated communication channels for different medical specialties
- **Plugin System**: Extensible architecture for adding custom communication features
- **Audit & Compliance**: HIPAA-compliant audit trails and message retention
- **Multilingual Support**: Compatible with WebQX™'s global multilingual framework

## 📁 Directory Structure

```
messaging/
├── README.md                 # This file - setup and documentation
├── core/                     # Core Matrix protocol infrastructure
│   ├── matrix-client.js      # Matrix client configuration and connection
│   ├── encryption.js         # End-to-end encryption utilities
│   └── config.js             # Configuration management
├── plugins/                  # Extensible plugin system
│   └── README.md             # Plugin development guide
├── channels/                 # Specialty-specific channel management
│   ├── patient-provider.js   # Patient-Provider communication
│   ├── provider-admin.js     # Provider-Admin messaging
│   └── specialty-channels.js # Specialty-specific channels
├── utils/                    # Utility modules
│   ├── validation.js         # Message validation and sanitization
│   └── audit.js              # Audit logging for compliance
├── types/                    # TypeScript type definitions
│   └── messaging.types.ts    # Messaging type definitions
└── examples/                 # Integration examples
    └── basic-integration.js  # Basic Matrix integration example
```

## 🚀 Quick Start

### Prerequisites

1. **Node.js** (v16.0.0 or higher)
2. **Matrix Homeserver** access (Synapse, Dendrite, or hosted service)
3. **WebQX™ Core Platform** (for integration)

### Installation

1. Install Matrix SDK dependencies:
```bash
npm install matrix-js-sdk
npm install @matrix-org/matrix-sdk-crypto-nodejs
```

2. Configure your Matrix homeserver settings:
```bash
cp messaging/core/config.js.example messaging/core/config.js
# Edit config.js with your Matrix homeserver details
```

3. Initialize the messaging service:
```javascript
const { MatrixMessaging } = require('./messaging/core/matrix-client');

const messaging = new MatrixMessaging({
  homeserverUrl: 'https://your-matrix-server.com',
  accessToken: 'your-access-token',
  userId: '@webqx-service:your-matrix-server.com'
});

await messaging.start();
```

## 🔐 Security & Compliance

### HIPAA Compliance
- **End-to-End Encryption**: All messages encrypted using Matrix's Olm/Megolm protocols
- **Audit Logging**: Comprehensive audit trails for all communications
- **Access Controls**: Role-based access to channels and messages
- **Data Retention**: Configurable message retention policies

### Encryption Features
- **Device Verification**: Cross-signing and device verification
- **Key Backup**: Secure key backup and recovery
- **Forward Secrecy**: Perfect forward secrecy for all communications

## 📋 Channel Types

### Patient-Provider Channels
- Direct messaging between patients and healthcare providers
- Secure file sharing for medical documents
- Appointment scheduling integration

### Provider-Admin Channels
- Administrative communications
- Policy updates and announcements
- System maintenance notifications

### Specialty Channels
- **Primary Care**: General practice communications
- **Radiology**: Imaging results and consultations
- **Cardiology**: Cardiac care coordination
- **Psychiatry**: Mental health secure messaging
- **Oncology**: Cancer care team communications
- **Pediatrics**: Pediatric care coordination

## 🔌 Plugin System

The messaging infrastructure supports plugins for extending functionality:

### Creating a Plugin
```javascript
const { MessagingPlugin } = require('../core/plugin-base');

class CustomPlugin extends MessagingPlugin {
  constructor(options) {
    super('custom-plugin', options);
  }

  async onMessage(message, channel) {
    // Custom message processing logic
  }

  async onChannelJoin(userId, channelId) {
    // Custom channel join logic
  }
}

module.exports = CustomPlugin;
```

### Available Plugin Hooks
- `onMessage`: Process incoming messages
- `onChannelJoin/Leave`: Handle channel membership changes
- `onEncryptedMessage`: Handle encrypted message events
- `onFileUpload`: Process file uploads
- `onAuditEvent`: Custom audit logging

## 🌐 Integration with WebQX™ Platform

### EHR Integration
```javascript
const { EHRMessaging } = require('./channels/ehr-integration');

// Link messaging with patient records
const ehrMessaging = new EHRMessaging({
  ehrSystem: 'openemr', // or 'openmrs', 'librehealth'
  patientIdField: 'patient_id'
});
```

### Whisper Transcription Integration
```javascript
const { WhisperIntegration } = require('./plugins/whisper-integration');

// Voice message transcription
const whisperPlugin = new WhisperIntegration({
  whisperService: webqxWhisperService,
  supportedLanguages: ['en', 'es', 'fr', 'pt']
});
```

## 📊 Monitoring & Analytics

### Health Checks
```bash
# Check Matrix connection status
curl http://localhost:3000/messaging/health

# Verify encryption status
curl http://localhost:3000/messaging/encryption/status
```

### Metrics
- Message delivery rates
- Encryption/decryption performance
- Channel activity statistics
- User engagement metrics

## 🛠️ Configuration

### Environment Variables
```bash
MATRIX_HOMESERVER_URL=https://matrix.webqx.health
MATRIX_ACCESS_TOKEN=your_access_token
MATRIX_USER_ID=@webqx:matrix.webqx.health
MATRIX_DEVICE_ID=WEBQX_DEVICE_001

# Security Settings
MATRIX_ENABLE_E2EE=true
MATRIX_VERIFY_DEVICES=true
MATRIX_AUDIT_ENABLED=true

# Integration Settings
WEBQX_EHR_INTEGRATION=true
WEBQX_WHISPER_INTEGRATION=true
```

### Advanced Configuration
See `messaging/core/config.js` for detailed configuration options including:
- Custom encryption settings
- Audit log configuration
- Channel creation policies
- User permission models

## 🧪 Testing

### Unit Tests
```bash
npm test messaging/
```

### Integration Tests
```bash
npm run test:integration messaging/
```

### Security Tests
```bash
npm run test:security messaging/
```

## 📚 API Reference

### Core Matrix Client
- `MatrixMessaging.start()` - Initialize Matrix connection
- `MatrixMessaging.createChannel(name, type)` - Create new channel
- `MatrixMessaging.sendMessage(channelId, message)` - Send message
- `MatrixMessaging.uploadFile(channelId, file)` - Upload secure file

### Channel Management
- `ChannelManager.createSpecialtyChannel(specialty)` - Create specialty channel
- `ChannelManager.addUser(channelId, userId, role)` - Add user to channel
- `ChannelManager.setPermissions(channelId, permissions)` - Set channel permissions

### Encryption Utilities
- `Encryption.encryptMessage(message, recipients)` - Encrypt message
- `Encryption.verifyDevice(userId, deviceId)` - Verify user device
- `Encryption.backupKeys()` - Backup encryption keys

## 🚦 Deployment

### Development
```bash
npm run messaging:dev
```

### Production
```bash
# With Docker
docker-compose up messaging

# With PM2
pm2 start messaging/core/matrix-client.js --name webqx-messaging
```

### Railway Deployment
The messaging infrastructure is compatible with Railway deployment:
```bash
railway deploy --service messaging
```

## 🤝 Contributing

1. Follow WebQX™ contribution guidelines
2. Sign IP Addendum and NDA prior to PR submission
3. Use feature branches: `feature/messaging-plugin-name`
4. Include tests for new functionality
5. Update documentation for new features

## 📋 Roadmap

### Phase 1: Core Infrastructure ✅
- [x] Basic Matrix client setup
- [x] Channel management system
- [x] Plugin architecture foundation

### Phase 2: Security & Compliance 🚧
- [ ] End-to-end encryption implementation
- [ ] HIPAA audit logging
- [ ] Device verification system

### Phase 3: Integrations 📋
- [ ] EHR system integration
- [ ] Whisper transcription plugin
- [ ] FHIR message formatting

### Phase 4: Advanced Features 📋
- [ ] Voice/video calling
- [ ] File sharing with medical image support
- [ ] Multilingual message translation

## 📜 License

Apache 2.0 - See [LICENSE.md](../LICENSE.md) for details.

Includes contributor IP addendums for legal clarity and scalability.
See [nda-template.md](../legal/nda-template.md) and [ip-addendum.md](../legal/ip-addendum.md)

---

**WebQX™ Health** - *"Secure communication for global healthcare equity."*

For support: [WebQX™ Community](https://github.com/WebQx/webqx/discussions)