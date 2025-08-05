# ChatEHR Integration Documentation

## Overview

The WebQx platform now includes comprehensive integration with ChatEHR, enabling seamless communication between physician and patient portals. This integration supports real-time consultation requests, appointment synchronization, and secure messaging while maintaining HIPAA compliance.

## Features

### Physician Portal Integration
- **Real-time Consultation Requests**: Physicians can view and respond to consultation requests from patients
- **Appointment Synchronization**: Automatic sync of appointment schedules from ChatEHR
- **Secure Messaging**: HIPAA-compliant messaging system for physician-patient communication
- **Role-based Access Control**: Appropriate access controls for medical professionals

### Patient Portal Integration
- **Consultation Request Submission**: Patients can submit consultation requests through ChatEHR
- **Appointment Confirmations**: Display of appointment confirmations and updates from ChatEHR
- **Secure Patient Messaging**: Encrypted messaging for patient-physician interactions
- **Specialty Selection**: Support for multiple medical specialties

## Architecture

### Components

1. **ChatEHRService** (`/services/chatEHRService.js`)
   - Core integration service for ChatEHR API communication
   - Handles authentication, encryption, and audit logging
   - Provides methods for consultations, appointments, and messaging

2. **ChatEHR Routes** (`/routes/chatehr.js`)
   - RESTful API endpoints for ChatEHR integration
   - Includes validation, authentication, and rate limiting
   - Supports both physician and patient workflows

3. **Mock ChatEHR Server** (`/services/mockChatEHRServer.js`)
   - Development and testing server that simulates ChatEHR API
   - Provides realistic responses for all integration scenarios
   - Includes test data for development and testing

4. **UI Components**
   - Patient Portal: `ChatEHRMessaging.jsx`
   - Physician Portal: `ChatEHRPhysicianDashboard.jsx`

## API Endpoints

### Consultation Management

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| POST | `/api/chatehr/consultations` | Create consultation request | Patient, Physician |
| GET | `/api/chatehr/consultations` | List consultation requests | Patient, Physician |
| PUT | `/api/chatehr/consultations/:id` | Update consultation status | Physician only |

### Appointment Synchronization

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| GET | `/api/chatehr/appointments` | Sync appointments from ChatEHR | Patient, Physician |

### Secure Messaging

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| POST | `/api/chatehr/messages` | Send secure message | Patient, Physician |
| GET | `/api/chatehr/messages/:consultationId` | Get consultation messages | Patient, Physician |

### System Information

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| GET | `/api/chatehr/health` | ChatEHR service health check | Public |
| GET | `/api/chatehr/specialties` | Available medical specialties | Authenticated |

## Configuration

### Environment Variables

Add the following variables to your `.env` file:

```bash
# ChatEHR Integration Configuration
CHATEHR_API_URL=https://api.chatehr.com/v1
CHATEHR_API_KEY=your_chatehr_api_key
CHATEHR_CLIENT_ID=your_chatehr_client_id
CHATEHR_CLIENT_SECRET=your_chatehr_client_secret
CHATEHR_TIMEOUT=30000
CHATEHR_ENABLE_AUDIT=true
CHATEHR_ENABLE_ENCRYPTION=true

# Development Configuration
MOCK_CHATEHR_PORT=4000
MOCK_CHATEHR_ENABLED=true
```

### Development Setup

1. **Start Mock ChatEHR Server** (for development):
   ```bash
   npm run chatehr:mock
   ```

2. **Configure WebQx to use Mock Server**:
   ```bash
   export CHATEHR_API_URL=http://localhost:4000/v1
   export MOCK_CHATEHR_ENABLED=true
   ```

3. **Start WebQx Server**:
   ```bash
   npm start
   ```

## Security & Compliance

### HIPAA Compliance
- **Audit Logging**: All ChatEHR interactions are logged with timestamps and user information
- **Message Encryption**: Patient-physician messages are encrypted using AES-256-GCM
- **Access Control**: Role-based permissions ensure appropriate access to sensitive data
- **Data Retention**: Configurable retention policies for audit logs and message history

### Authentication & Authorization
- **OAuth2 Integration**: Leverages existing WebQx authentication system
- **Role-based Access**: Different permissions for patients, physicians, and administrators
- **Session Management**: Secure session handling with configurable timeouts

### Rate Limiting
- **API Protection**: Rate limiting applied to all ChatEHR endpoints
- **Configurable Limits**: Adjustable request limits per IP address
- **DDoS Protection**: Protection against abuse and denial of service attacks

## Usage Examples

### Patient: Creating a Consultation Request

```javascript
// Using the ChatEHRMessaging component
const request = {
  specialty: 'cardiology',
  urgency: 'urgent',
  description: 'Chest pain and irregular heartbeat for the past 2 days'
};

// Component handles API call automatically
// POST /api/chatehr/consultations
```

### Physician: Accepting a Consultation

```javascript
// Using the ChatEHRPhysicianDashboard component
const updateConsultation = async (consultationId) => {
  await axios.put(`/api/chatehr/consultations/${consultationId}`, {
    status: 'assigned',
    physicianId: currentPhysicianId,
    notes: 'Consultation accepted, will review shortly'
  });
};
```

### Sending Secure Messages

```javascript
// Patient or physician sending a message
const sendMessage = async () => {
  await axios.post('/api/chatehr/messages', {
    toId: recipientId,
    content: messageText,
    consultationId: currentConsultationId,
    type: 'text'
  });
};
```

## Testing

### Running Tests

```bash
# Run all ChatEHR tests
npm run chatehr:test

# Run all tests including ChatEHR
npm test

# Health check
npm run chatehr:health
```

### Test Coverage

The integration includes comprehensive tests for:
- **Service Layer**: ChatEHRService functionality
- **API Routes**: All endpoint validation and responses
- **Mock Server**: Simulated ChatEHR API behavior
- **Security**: Authentication, authorization, and encryption
- **Error Handling**: Network failures, timeouts, and invalid data

### Test Data

The mock server includes realistic test data:
- **Consultations**: Various specialties, urgency levels, and statuses
- **Appointments**: Scheduled appointments with different physicians
- **Messages**: Sample patient-physician conversations
- **Users**: Test patient and physician accounts

## Monitoring & Debugging

### Health Checks

```bash
# Check ChatEHR service health
curl http://localhost:3000/api/chatehr/health

# Check mock server health (development)
curl http://localhost:4000/v1/health
```

### Logging

The integration provides detailed logging for:
- **API Requests**: All ChatEHR API calls with timing information
- **Audit Events**: HIPAA-compliant audit logs for all interactions
- **Error Conditions**: Detailed error messages and stack traces
- **Performance Metrics**: Response times and throughput statistics

### Common Issues

1. **Connection Refused**: Ensure ChatEHR API URL is correct and accessible
2. **Authentication Failures**: Verify API key and client credentials
3. **Rate Limiting**: Check if request limits are being exceeded
4. **Message Encryption Errors**: Verify client secret is configured properly

## Deployment

### Production Deployment

1. **Configure Environment Variables**: Set production ChatEHR API credentials
2. **Enable Audit Logging**: Ensure HIPAA compliance logging is enabled
3. **Set Up Monitoring**: Configure health checks and alerting
4. **Security Review**: Verify encryption and access controls

### Docker Configuration

```dockerfile
# Add to your Dockerfile
ENV CHATEHR_API_URL=https://api.chatehr.com/v1
ENV CHATEHR_ENABLE_AUDIT=true
ENV CHATEHR_ENABLE_ENCRYPTION=true
```

### Load Balancing

The ChatEHR integration is stateless and supports horizontal scaling:
- **Session Storage**: Uses existing WebQx session management
- **Message Persistence**: Messages are stored in ChatEHR, not locally
- **Health Checks**: Built-in endpoints for load balancer health monitoring

## Migration & Maintenance

### Data Migration

When migrating from other systems:
1. **Export Existing Data**: Extract consultations and messages from legacy systems
2. **Transform Data**: Convert to ChatEHR format using provided utilities
3. **Import Process**: Use bulk import APIs to transfer historical data
4. **Validation**: Verify data integrity after migration

### Regular Maintenance

- **Update Dependencies**: Keep ChatEHR client libraries up to date
- **Monitor Performance**: Track API response times and error rates
- **Review Logs**: Regular audit log review for compliance
- **Security Updates**: Apply security patches promptly

## Support & Resources

### Documentation
- [ChatEHR API Documentation](https://docs.chatehr.com)
- [WebQx Integration Guide](./INTEGRATION_GUIDE.md)
- [HIPAA Compliance Guide](./HIPAA_COMPLIANCE.md)

### Support Channels
- **Technical Issues**: Create GitHub issues for bugs and feature requests
- **Security Concerns**: Contact security@webqx.health
- **General Questions**: Use project discussions or community forums

### Contributing

To contribute to the ChatEHR integration:
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request with detailed description

---

**Note**: This integration is designed to be production-ready with proper security, monitoring, and compliance features. Always review and test thoroughly in your environment before deployment.