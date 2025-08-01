# Telehealth Session Module

This module provides comprehensive telehealth session capabilities for the WebQX healthcare platform, including video conferencing, participant management, and compliance tracking.

## Features

### 🎥 Video & Audio Conferencing
- WebRTC-based real-time communication
- High-quality video (720p, 1080p, 4K support)
- Audio with noise reduction, echo cancellation, and auto-gain control
- Screen sharing with audio support
- Participant video controls (mute/unmute, video on/off)

### 👥 Participant Management
- Support for multiple participant roles (provider, patient, interpreter, caregiver, specialist)
- Role-based permissions system
- Third-party participant invitations via email
- Maximum participant limits and session capacity management
- Real-time participant status tracking

### 🎛️ Session Controls
- Session minimize/maximize for easy note-taking
- Session pause/resume functionality
- Recording capabilities with consent tracking
- Screen sharing controls
- Session timeout management

### 📊 Compliance & Auditing
- HIPAA-compliant audit logging
- Consent tracking for recording and data sharing
- Detailed session analytics and reporting
- Technical issue logging and error tracking
- Configurable compliance levels and retention policies

## Usage

### Basic Session Setup

```typescript
import { TelehealthSessionService } from '@webqx/telehealth-session';

// Configure session
const sessionConfig = {
  id: 'session-123',
  patientId: 'patient-456',
  providerId: 'provider-789',
  sessionType: 'consultation',
  maxParticipants: 5,
  recordingEnabled: true,
  allowScreenSharing: true,
  allowThirdPartyParticipants: true,
  sessionTimeout: 60,
  compliance: {
    enableAuditLogging: true,
    enableConsentTracking: true,
    logLevel: 'standard'
  }
};

// Initialize service
const telehealthService = new TelehealthSessionService(sessionConfig);

// Start session
const { success, sessionState } = await telehealthService.startSession();
if (success) {
  console.log('Session started:', sessionState);
}
```

### Adding Participants

```typescript
// Add provider
await telehealthService.addParticipant({
  id: 'provider-123',
  name: 'Dr. Smith',
  role: 'provider',
  email: 'dr.smith@hospital.com'
});

// Add patient
await telehealthService.addParticipant({
  id: 'patient-456',
  name: 'John Doe',
  role: 'patient',
  email: 'john.doe@email.com'
});
```

### Inviting Third-Party Participants

```typescript
// Invite an interpreter
const inviteResult = await telehealthService.inviteParticipant(
  'provider-123',
  'interpreter@service.com',
  'Maria Interpreter',
  'interpreter',
  'Please join for Spanish interpretation'
);

if (inviteResult.success) {
  console.log('Invitation sent:', inviteResult.invitationId);
}
```

### Session Controls

```typescript
// Start screen sharing
await telehealthService.startScreenShare('provider-123');

// Start recording (requires consent)
telehealthService.logConsent('patient-456', 'recording', true);
await telehealthService.startRecording('provider-123');

// Minimize for note-taking
telehealthService.minimizeSession();

// Mute participant
await telehealthService.muteParticipant('patient-456', true, 'provider-123');
```

### Session Management

```typescript
// Pause session
await telehealthService.pauseSession();

// Resume session
await telehealthService.resumeSession();

// End session
const { analytics } = await telehealthService.endSession('normal');
console.log('Session analytics:', analytics);
```

## API Reference

### TelehealthSessionService

Main service class that orchestrates all telehealth functionality.

#### Methods

- `startSession()` - Initialize and start the session
- `endSession(reason?)` - End the session with analytics
- `addParticipant(participant)` - Add a participant to the session
- `removeParticipant(participantId)` - Remove a participant
- `inviteParticipant(invitedBy, email, name, role, message?)` - Invite third-party participant
- `acceptInvitation(invitationId, participantId)` - Accept an invitation
- `startScreenShare(participantId)` - Start screen sharing
- `stopScreenShare()` - Stop screen sharing
- `startRecording(participantId)` - Start session recording
- `stopRecording()` - Stop session recording
- `minimizeSession()` - Minimize session window
- `maximizeSession()` - Maximize session window
- `pauseSession()` - Pause the session
- `resumeSession()` - Resume the session
- `muteParticipant(participantId, muted, mutedBy)` - Mute/unmute participant

#### Properties

- `getSessionState()` - Get current session state
- `getParticipants()` - Get all participants
- `getConnectedParticipants()` - Get connected participants only
- `getPendingInvitations()` - Get pending invitations
- `getComplianceData()` - Get compliance and audit data
- `getSessionAnalytics()` - Get session analytics

### Types

#### SessionParticipant
```typescript
interface SessionParticipant {
  id: string;
  name: string;
  role: 'provider' | 'patient' | 'interpreter' | 'caregiver' | 'specialist';
  email?: string;
  phone?: string;
  avatar?: string;
  isConnected: boolean;
  joinedAt?: Date;
  leftAt?: Date;
  permissions: ParticipantPermissions;
}
```

#### SessionConfiguration
```typescript
interface SessionConfiguration {
  id: string;
  patientId: string;
  providerId: string;
  appointmentId?: string;
  sessionType: 'consultation' | 'follow-up' | 'emergency' | 'interpretation';
  maxParticipants: number;
  recordingEnabled: boolean;
  transcriptionEnabled: boolean;
  encryptionEnabled: boolean;
  allowScreenSharing: boolean;
  allowThirdPartyParticipants: boolean;
  sessionTimeout: number;
  compliance: ComplianceSettings;
}
```

## Compliance Features

### Audit Logging
All session activities are logged with timestamps and compliance levels:
- High: Session start/end, consent events, participant join/leave
- Medium: Screen sharing, recording, technical issues
- Low: UI interactions, settings changes

### Data Retention
Configurable retention policies for session data and audit logs.

### Consent Tracking
Built-in consent management for recording, data sharing, and session participation.

### Error Handling
Comprehensive error tracking with categorization and retry logic.

## Testing

Run the test suite:

```bash
npm test modules/telehealth-session
```

The module includes comprehensive tests for:
- Session lifecycle management
- Participant operations
- Compliance logging
- Error handling
- Permission enforcement

## Browser Support

- Chrome 80+
- Firefox 74+
- Safari 13+
- Edge 80+

WebRTC features require HTTPS in production environments.

## Security Considerations

- All media streams are encrypted end-to-end
- Audit logs are stored securely with encryption
- Permission-based access control for all operations
- Session timeouts prevent unauthorized access
- Invite links expire automatically

## Integration

This module integrates with the existing WebQX platform:
- Uses WebQX authentication system
- Follows WebQX compliance standards
- Compatible with existing EHR integrations
- Supports WebQX theming and internationalization