# 🔌 WebQX™ Messaging Plugins

This directory contains the plugin system for extending WebQX™ messaging functionality. Plugins allow for modular enhancement of the messaging infrastructure with specialty-specific features, integrations, and custom workflows.

## 🏗️ Plugin Architecture

The WebQX™ messaging plugin system is designed with healthcare compliance and modularity in mind:

- **Event-Driven**: Plugins respond to messaging events (message sent, file uploaded, user joined, etc.)
- **Async/Await**: All plugin methods are asynchronous for non-blocking operation
- **Audit Integration**: Plugin actions are automatically logged for compliance
- **Error Isolation**: Plugin failures don't affect core messaging functionality
- **Configuration**: Each plugin has its own configuration system

## 📋 Plugin Interface

All plugins must implement the `MessagingPlugin` interface:

```typescript
interface MessagingPlugin {
  name: string;
  version: string;
  enabled: boolean;
  
  // Optional event handlers
  onMessage?(message: WebQXMessage, channel: any): Promise<void>;
  onChannelJoin?(userId: string, channelId: string): Promise<void>;
  onChannelLeave?(userId: string, channelId: string): Promise<void>;
  onEncryptedMessage?(event: any): Promise<void>;
  onFileUpload?(file: WebQXFile, options: FileUploadOptions): Promise<void>;
  onAuditEvent?(entry: AuditEntry): Promise<void>;
}
```

## 🧬 Available Plugin Hooks

### Message Events
- `onMessage` - Process incoming messages
- `onEncryptedMessage` - Handle encrypted message events

### Channel Events
- `onChannelJoin` - User joins a channel
- `onChannelLeave` - User leaves a channel

### File Events
- `onFileUpload` - File uploaded to channel

### System Events
- `onAuditEvent` - Audit events for compliance monitoring

## 📦 Built-in Plugins

### Whisper Transcription Plugin
Automatic transcription of voice messages using WebQX™'s Whisper integration.

**Features:**
- Multi-language transcription
- Medical terminology recognition
- Specialty-specific vocabulary
- HIPAA-compliant transcription storage

**Configuration:**
```javascript
{
  enabled: true,
  supportedLanguages: ['en', 'es', 'fr', 'pt'],
  maxAudioDurationMinutes: 10,
  autoTranscribe: true,
  medicalVocabulary: true
}
```

### EHR Integration Plugin
Automatic synchronization with Electronic Health Record systems.

**Features:**
- Patient data synchronization
- Automatic channel creation for new patients
- Message linking to patient records
- Multi-EHR system support

**Configuration:**
```javascript
{
  enabled: true,
  ehrSystems: ['openemr', 'openmrs', 'librehealth'],
  syncPatientData: true,
  autoCreateChannels: true,
  syncInterval: 300000 // 5 minutes
}
```

### FHIR Messaging Plugin
FHIR-compliant message formatting and validation.

**Features:**
- FHIR R4 message formatting
- Message validation against FHIR schemas
- Automatic FHIR resource creation
- Interoperability with FHIR servers

**Configuration:**
```javascript
{
  enabled: true,
  fhirServerUrl: 'https://fhir.webqx.health',
  messageFormat: 'FHIR_R4',
  validateMessages: true,
  createResources: true
}
```

## 🛠️ Creating a Custom Plugin

### 1. Create Plugin Class

```javascript
const { MessagingPlugin } = require('../core/plugin-base');
const { AuditLogger } = require('../utils/audit');

class MyCustomPlugin extends MessagingPlugin {
  constructor(options = {}) {
    super('my-custom-plugin', '1.0.0', options);
    this.auditLogger = new AuditLogger();
    this.config = options.config || {};
  }

  async onMessage(message, channel) {
    // Custom message processing logic
    this.auditLogger.log('plugin', 'Custom plugin processed message', {
      plugin: this.name,
      messageType: message.msgtype,
      channelType: channel.channelType
    });
  }

  async onFileUpload(file, options) {
    // Custom file processing logic
    if (this.shouldProcessFile(file)) {
      await this.processFile(file, options);
    }
  }

  shouldProcessFile(file) {
    return this.config.processedFileTypes?.includes(
      this.getFileExtension(file.name)
    );
  }

  async processFile(file, options) {
    // Custom file processing implementation
  }

  getFileExtension(filename) {
    return filename.split('.').pop()?.toLowerCase() || '';
  }
}

module.exports = MyCustomPlugin;
```

### 2. Register Plugin

```javascript
const { MatrixMessaging } = require('./core/matrix-client');
const MyCustomPlugin = require('./plugins/my-custom-plugin');

const messaging = new MatrixMessaging(config);
const customPlugin = new MyCustomPlugin({
  config: {
    processedFileTypes: ['pdf', 'dcm'],
    customSetting: 'value'
  }
});

messaging.registerPlugin('my-custom-plugin', customPlugin);
```

### 3. Plugin Configuration

Add plugin configuration to the main config:

```javascript
// In core/config.js
PLUGINS: {
  myCustomPlugin: {
    enabled: process.env.PLUGIN_CUSTOM_ENABLED === 'true',
    config: {
      processedFileTypes: ['pdf', 'dcm'],
      customSetting: process.env.CUSTOM_PLUGIN_SETTING || 'default'
    }
  }
}
```

## 🔧 Plugin Development Guidelines

### Error Handling
```javascript
async onMessage(message, channel) {
  try {
    // Plugin logic here
    await this.processMessage(message, channel);
  } catch (error) {
    this.auditLogger.logError('Plugin error', {
      plugin: this.name,
      error: error.message,
      messageId: message.eventId
    });
    // Don't throw - let other plugins continue
  }
}
```

### Configuration Validation
```javascript
constructor(options = {}) {
  super('my-plugin', '1.0.0', options);
  
  this.validateConfig(options.config);
  this.config = { ...this.defaultConfig, ...options.config };
}

validateConfig(config) {
  const required = ['apiKey', 'endpoint'];
  const missing = required.filter(key => !config[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required config: ${missing.join(', ')}`);
  }
}
```

### Async Operations
```javascript
async onMessage(message, channel) {
  // Use Promise.all for parallel operations
  const [result1, result2] = await Promise.all([
    this.processMessagePart1(message),
    this.processMessagePart2(message)
  ]);

  // Process results
  await this.combineResults(result1, result2);
}
```

### Resource Cleanup
```javascript
async destroy() {
  // Clean up resources when plugin is unregistered
  if (this.connection) {
    await this.connection.close();
  }
  
  if (this.timer) {
    clearInterval(this.timer);
  }
}
```

## 🧪 Testing Plugins

### Unit Tests
```javascript
const MyCustomPlugin = require('../my-custom-plugin');

describe('MyCustomPlugin', () => {
  let plugin;

  beforeEach(() => {
    plugin = new MyCustomPlugin({
      config: { testMode: true }
    });
  });

  test('should process messages correctly', async () => {
    const message = {
      body: 'test message',
      msgtype: 'm.text'
    };
    
    const channel = {
      channelType: 'patient-provider'
    };

    await plugin.onMessage(message, channel);
    // Assert expected behavior
  });
});
```

### Integration Tests
```javascript
describe('Plugin Integration', () => {
  test('should integrate with messaging system', async () => {
    const messaging = new MatrixMessaging(testConfig);
    const plugin = new MyCustomPlugin(testPluginConfig);
    
    messaging.registerPlugin('test-plugin', plugin);
    
    // Send test message and verify plugin response
    const roomId = await messaging.createChannel('test-channel');
    await messaging.sendMessage(roomId, 'test message');
    
    // Verify plugin processed the message
  });
});
```

## 📊 Plugin Monitoring

### Health Checks
```javascript
async getHealthStatus() {
  return {
    name: this.name,
    version: this.version,
    enabled: this.enabled,
    status: this.isHealthy() ? 'healthy' : 'unhealthy',
    lastActivity: this.lastActivity,
    processedMessages: this.messageCount,
    errors: this.errorCount
  };
}
```

### Metrics Collection
```javascript
async onMessage(message, channel) {
  this.messageCount++;
  this.lastActivity = new Date().toISOString();
  
  // Plugin-specific metrics
  this.metrics.incrementCounter('messages_processed', {
    channel_type: channel.channelType,
    message_type: message.msgtype
  });
}
```

## 🔐 Security Considerations

### Input Validation
```javascript
async onMessage(message, channel) {
  // Validate input before processing
  if (!this.validateMessage(message)) {
    this.auditLogger.logSecurity('Invalid message rejected by plugin', {
      plugin: this.name,
      reason: 'validation_failed'
    });
    return;
  }
  
  // Process validated message
}
```

### Sensitive Data Handling
```javascript
async processPatientData(data) {
  // Sanitize sensitive data
  const sanitized = this.sanitizePatientData(data);
  
  // Log access
  this.auditLogger.logCompliance('Patient data accessed', {
    plugin: this.name,
    patientId: sanitized.patientId,
    dataType: 'demographics'
  });
  
  // Process sanitized data
}
```

## 📚 Example Plugins

See the `/examples` directory for complete plugin implementations:

- **Basic Message Logger** - Simple message logging plugin
- **File Virus Scanner** - File security scanning
- **Translation Plugin** - Multi-language message translation
- **Appointment Reminder** - Automated appointment reminders
- **Clinical Decision Support** - AI-powered clinical recommendations

## 🤝 Contributing Plugins

1. Fork the repository
2. Create your plugin in the `plugins/` directory
3. Add comprehensive tests
4. Update documentation
5. Submit a pull request

### Plugin Submission Checklist
- [ ] Implements `MessagingPlugin` interface
- [ ] Includes error handling
- [ ] Has unit and integration tests
- [ ] Follows security guidelines
- [ ] Includes configuration documentation
- [ ] Provides health check endpoints
- [ ] Complies with healthcare regulations

## 📜 License

Plugin system licensed under Apache 2.0. Individual plugins may have different licenses - check individual plugin directories for details.

---

**WebQX™ Health** - *"Extensible messaging for global healthcare innovation."*