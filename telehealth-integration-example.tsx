import React from 'react';
import { createRoot } from 'react-dom/client';
import { 
  TelehealthProvider,
  TelehealthPatient,
  AmbientDocumentationService,
  TelehealthMessagingService,
  languageManager
} from './modules/telehealth';

/**
 * Example integration of the WebQX™ Telehealth Module
 * 
 * This demonstrates how to integrate the telehealth components
 * into the main WebQX™ application.
 */

// Initialize services
const ambientService = new AmbientDocumentationService();

/**
 * Provider Dashboard with Telehealth Integration
 */
const ProviderDashboard: React.FC = () => {
  const [currentSession, setCurrentSession] = React.useState<string | null>(null);
  const [language, setLanguage] = React.useState('en');

  const handleStartTelehealthSession = async () => {
    const sessionId = `session-${Date.now()}`;
    const patientId = 'patient-123'; // Would come from selected patient
    const providerId = 'provider-456'; // Would come from authenticated user
    
    setCurrentSession(sessionId);
    
    // Initialize ambient documentation
    const success = await ambientService.startSession({
      sessionId,
      patientId,
      providerId,
      specialtyContext: 'primary-care',
      language,
      enableRealTime: true
    });
    
    if (!success) {
      console.error('Failed to start ambient documentation session');
    }
  };

  const handleEndSession = async () => {
    if (currentSession) {
      await ambientService.endSession(currentSession);
      setCurrentSession(null);
    }
  };

  if (currentSession) {
    return (
      <div className="provider-dashboard">
        <TelehealthProvider
          patientId="patient-123"
          providerId="provider-456"
          sessionId={currentSession}
          enableTranscription={true}
          language={language}
          specialtyContext="primary-care"
          onSessionEnd={handleEndSession}
        />
      </div>
    );
  }

  return (
    <div className="provider-dashboard">
      <h1>Provider Dashboard</h1>
      
      <div className="session-controls">
        <div className="language-selector">
          <label htmlFor="language">Language:</label>
          <select 
            id="language"
            value={language} 
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
          </select>
        </div>
        
        <button 
          className="start-session-btn"
          onClick={handleStartTelehealthSession}
        >
          🎥 Start Telehealth Session
        </button>
      </div>
      
      <div className="patient-list">
        <h2>Scheduled Patients</h2>
        <div className="patient-card">
          <h3>John Doe</h3>
          <p>Appointment: 2:00 PM</p>
          <p>Specialty: Primary Care</p>
          <button onClick={handleStartTelehealthSession}>
            Join Session
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Patient Portal with Telehealth Integration
 */
const PatientPortal: React.FC = () => {
  const [currentSession, setCurrentSession] = React.useState<string | null>(null);
  const [language, setLanguage] = React.useState('en');

  React.useEffect(() => {
    // Auto-detect language
    languageManager.autoDetectLanguage().then(detectedLang => {
      setLanguage(detectedLang);
    });
  }, []);

  const handleJoinSession = () => {
    const sessionId = 'session-123'; // Would come from appointment system
    setCurrentSession(sessionId);
  };

  const handleLeaveSession = () => {
    setCurrentSession(null);
  };

  if (currentSession) {
    return (
      <div className="patient-portal">
        <TelehealthPatient
          sessionId={currentSession}
          patientId="patient-123"
          language={language}
          enableAutoTranslation={true}
          onSessionEnd={handleLeaveSession}
        />
      </div>
    );
  }

  return (
    <div className="patient-portal">
      <h1>Patient Portal</h1>
      
      <div className="upcoming-appointments">
        <h2>Upcoming Telehealth Appointments</h2>
        <div className="appointment-card">
          <h3>Dr. Smith - Primary Care</h3>
          <p>Today at 2:00 PM</p>
          <p>Duration: 30 minutes</p>
          <button onClick={handleJoinSession}>
            Join Telehealth Session
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Main Application Router
 */
const TelehealthApp: React.FC = () => {
  const [userType, setUserType] = React.useState<'provider' | 'patient'>('provider');

  return (
    <div className="telehealth-app">
      <nav className="app-nav">
        <h1>WebQX™ Telehealth</h1>
        <div className="nav-controls">
          <button 
            className={userType === 'provider' ? 'active' : ''}
            onClick={() => setUserType('provider')}
          >
            Provider View
          </button>
          <button 
            className={userType === 'patient' ? 'active' : ''}
            onClick={() => setUserType('patient')}
          >
            Patient View
          </button>
        </div>
      </nav>
      
      <main className="app-main">
        {userType === 'provider' ? <ProviderDashboard /> : <PatientPortal />}
      </main>
    </div>
  );
};

/**
 * Service Usage Examples
 */
export class TelehealthServiceExamples {
  private ambientService = new AmbientDocumentationService();
  private messagingService = new TelehealthMessagingService();

  /**
   * Example: Process uploaded audio for ambient documentation
   */
  async processSessionAudio(audioFile: File, sessionData: any) {
    try {
      const result = await this.ambientService.processAudioFile(audioFile, {
        sessionId: sessionData.sessionId,
        patientId: sessionData.patientId,
        providerId: sessionData.providerId,
        specialtyContext: sessionData.specialtyContext || 'primary-care',
        language: sessionData.language || 'en'
      });

      if (result.success) {
        console.log('✅ Clinical note created:', result.clinicalNote);
        console.log('📝 Transcription:', result.transcriptionText);
        
        // Save to FHIR server (implementation would go here)
        return result.clinicalNote;
      } else {
        console.error('❌ Transcription failed:', result.error);
        return null;
      }
    } catch (error) {
      console.error('💥 Service error:', error);
      return null;
    }
  }

  /**
   * Example: Send post-visit summary to patient
   */
  async sendPostVisitSummary(sessionData: any) {
    try {
      const summary = {
        sessionId: sessionData.sessionId,
        patientId: sessionData.patientId,
        providerId: sessionData.providerId,
        visitDate: new Date().toISOString(),
        summary: sessionData.clinicalSummary || 'Telehealth consultation completed successfully.',
        diagnosis: sessionData.diagnosis || [],
        medications: sessionData.medications || [],
        followUpInstructions: sessionData.followUpInstructions,
        nextAppointment: sessionData.nextAppointment,
        language: sessionData.language || 'en'
      };

      const result = await this.messagingService.sendPostVisitSummary(summary);
      
      if (result.success) {
        console.log('✅ Post-visit summary sent:', result.messageId);
        return result;
      } else {
        console.error('❌ Failed to send summary:', result.error);
        return null;
      }
    } catch (error) {
      console.error('💥 Messaging error:', error);
      return null;
    }
  }

  /**
   * Example: Send follow-up instructions
   */
  async sendFollowUpInstructions(instructionsData: any) {
    try {
      const result = await this.messagingService.sendFollowUpInstructions({
        sessionId: instructionsData.sessionId,
        patientId: instructionsData.patientId,
        providerId: instructionsData.providerId,
        instructions: instructionsData.instructions,
        priority: instructionsData.priority || 'routine',
        dueDate: instructionsData.dueDate,
        language: instructionsData.language || 'en'
      });

      if (result.success) {
        console.log('✅ Follow-up instructions sent:', result.messageId);
        return result;
      } else {
        console.error('❌ Failed to send instructions:', result.error);
        return null;
      }
    } catch (error) {
      console.error('💥 Instructions error:', error);
      return null;
    }
  }

  /**
   * Example: Handle language switching
   */
  async handleLanguageChange(newLanguage: string) {
    try {
      await languageManager.changeLanguage(newLanguage);
      console.log('✅ Language changed to:', newLanguage);
      
      // Update any active sessions with new language
      const activeSessions = this.ambientService.getActiveSessions();
      for (const session of activeSessions) {
        // Restart session with new language if needed
        if (session.enableRealTime) {
          await this.ambientService.endSession(session.sessionId);
          await this.ambientService.startSession({
            ...session,
            language: newLanguage
          });
        }
      }
    } catch (error) {
      console.error('💥 Language change error:', error);
    }
  }
}

// Application CSS (would typically be in a separate file)
const styles = `
.telehealth-app {
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.app-nav {
  background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%);
  color: white;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.nav-controls button {
  background: rgba(255,255,255,0.2);
  color: white;
  border: 1px solid rgba(255,255,255,0.3);
  padding: 8px 16px;
  margin: 0 4px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.nav-controls button.active,
.nav-controls button:hover {
  background: rgba(255,255,255,0.3);
}

.app-main {
  padding: 2rem;
}

.provider-dashboard, .patient-portal {
  max-width: 1200px;
  margin: 0 auto;
}

.session-controls {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.language-selector select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-left: 8px;
}

.start-session-btn {
  background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  font-size: 16px;
  cursor: pointer;
  transition: transform 0.2s;
}

.start-session-btn:hover {
  transform: scale(1.05);
}

.patient-card, .appointment-card {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 1.5rem;
  margin: 1rem 0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.patient-card h3, .appointment-card h3 {
  margin: 0 0 8px 0;
  color: #2c3e50;
}

.patient-card p, .appointment-card p {
  margin: 4px 0;
  color: #666;
}

.patient-card button, .appointment-card button {
  background: #3498db;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 8px;
}
`;

// Inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);

// Initialize React application
const container = document.getElementById('telehealth-app-root');
if (container) {
  const root = createRoot(container);
  root.render(<TelehealthApp />);
}

export default TelehealthApp;
export { TelehealthServiceExamples };