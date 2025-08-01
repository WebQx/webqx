/**
 * @fileoverview Example Implementation of Whisper-OpenEMR Integration
 * 
 * Complete working example showing how to integrate Whisper speech recognition
 * with OpenEMR for clinical documentation. Includes setup, configuration,
 * and usage examples for different clinical scenarios.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import React, { useState, useEffect } from 'react';
import { WhisperOpenEMRIntegration, ClinicalTranscriptionResult } from '../services/whisperIntegration';
import { ClinicalVoiceTranscription } from '../components/ClinicalVoiceTranscription';
import { createConfig, validateConfig } from '../config/whisperConfig';

/**
 * Example: Basic Clinical Voice Transcription Setup
 */
export const BasicClinicalTranscriptionExample: React.FC = () => {
  const [integrationService, setIntegrationService] = useState<WhisperOpenEMRIntegration | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string>('');

  // Example patient and provider data
  const examplePatient = {
    id: 'patient-12345',
    name: 'John Doe'
  };
  
  const exampleProvider = {
    id: 'provider-67890',
    name: 'Dr. Sarah Smith'
  };

  const exampleEncounter = {
    id: 'encounter-abcdef',
    date: new Date().toISOString()
  };

  useEffect(() => {
    initializeIntegration();
  }, []);

  const initializeIntegration = async () => {
    try {
      // Create configuration for development environment
      const config = createConfig('development', 'general', {
        openemr: {
          baseUrl: process.env.REACT_APP_OPENEMR_BASE_URL || 'http://localhost:8080',
          oauth: {
            clientId: process.env.REACT_APP_OPENEMR_CLIENT_ID || 'demo-client-id',
            clientSecret: process.env.REACT_APP_OPENEMR_CLIENT_SECRET || 'demo-client-secret',
            redirectUri: process.env.REACT_APP_OPENEMR_REDIRECT_URI || 'http://localhost:3000/callback',
            scopes: [
              'openid',
              'fhirUser',
              'patient/Patient.read',
              'patient/Encounter.read',
              'patient/Encounter.write',
              'patient/DocumentReference.write'
            ]
          }
        }
      });

      // Validate configuration
      const validation = validateConfig(config);
      if (!validation.isValid) {
        setError(`Configuration validation failed: ${validation.errors.join(', ')}`);
        return;
      }

      // Initialize integration service
      const service = new WhisperOpenEMRIntegration(config);
      await service.initialize();
      
      setIntegrationService(service);
      setIsReady(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize integration';
      setError(errorMessage);
    }
  };

  const handleTranscriptionComplete = (result: ClinicalTranscriptionResult) => {
    console.log('Transcription completed:', result);
    // Handle the completed transcription - e.g., display in UI, save to form, etc.
    alert(`Transcription completed: ${result.text.substring(0, 100)}...`);
  };

  const handleTranscriptionError = (error: Error) => {
    console.error('Transcription error:', error);
    setError(error.message);
  };

  if (error) {
    return (
      <div style={{ padding: '20px', border: '1px solid #red', borderRadius: '8px', background: '#ffebee' }}>
        <h3>⚠️ Integration Error</h3>
        <p>{error}</p>
        <button onClick={() => { setError(''); initializeIntegration(); }}>
          Retry Initialization
        </button>
      </div>
    );
  }

  if (!isReady || !integrationService) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h3>🔄 Initializing Whisper-OpenEMR Integration...</h3>
        <p>Please wait while we set up the speech recognition service.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>🎤 Clinical Voice Transcription Demo</h2>
      
      {/* Patient Information */}
      <div style={{ 
        padding: '15px', 
        background: '#f5f5f5', 
        borderRadius: '8px', 
        marginBottom: '20px' 
      }}>
        <h3>📋 Current Session</h3>
        <p><strong>Patient:</strong> {examplePatient.name} (ID: {examplePatient.id})</p>
        <p><strong>Provider:</strong> {exampleProvider.name} (ID: {exampleProvider.id})</p>
        <p><strong>Encounter:</strong> {exampleEncounter.id}</p>
        <p><strong>Date:</strong> {new Date(exampleEncounter.date).toLocaleString()}</p>
      </div>

      {/* Voice Transcription Component */}
      <ClinicalVoiceTranscription
        patientId={examplePatient.id}
        encounterId={exampleEncounter.id}
        providerId={exampleProvider.id}
        transcriptionType="encounter_note"
        integrationService={integrationService}
        clinicalContext="Annual wellness visit with preventive care focus"
        onTranscriptionComplete={handleTranscriptionComplete}
        onError={handleTranscriptionError}
        enableStreaming={true}
      />
    </div>
  );
};

/**
 * Example: Multiple Transcription Types Demo
 */
export const MultipleTranscriptionTypesExample: React.FC = () => {
  const [activeTranscriptionType, setActiveTranscriptionType] = useState<
    'encounter_note' | 'history' | 'assessment' | 'plan' | 'medication_note' | 'general'
  >('encounter_note');
  
  const [integrationService, setIntegrationService] = useState<WhisperOpenEMRIntegration | null>(null);

  const transcriptionTypes = [
    { value: 'encounter_note', label: '📝 Encounter Note', context: 'Chief complaint and clinical findings' },
    { value: 'history', label: '📚 Patient History', context: 'Medical, family, and social history' },
    { value: 'assessment', label: '🔍 Clinical Assessment', context: 'Diagnosis and clinical reasoning' },
    { value: 'plan', label: '📋 Treatment Plan', context: 'Treatment recommendations and follow-up' },
    { value: 'medication_note', label: '💊 Medication Note', context: 'Prescription and medication management' },
    { value: 'general', label: '📄 General Note', context: 'General clinical documentation' }
  ];

  useEffect(() => {
    // Initialize integration service
    const initService = async () => {
      const config = createConfig('development');
      const service = new WhisperOpenEMRIntegration(config);
      await service.initialize();
      setIntegrationService(service);
    };
    
    initService();
  }, []);

  const currentType = transcriptionTypes.find(type => type.value === activeTranscriptionType);

  return (
    <div style={{ padding: '20px' }}>
      <h2>🎯 Multiple Transcription Types Demo</h2>
      
      {/* Type Selection */}
      <div style={{ marginBottom: '20px' }}>
        <h3>Select Transcription Type:</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {transcriptionTypes.map((type) => (
            <button
              key={type.value}
              onClick={() => setActiveTranscriptionType(type.value as any)}
              style={{
                padding: '10px 15px',
                border: `2px solid ${activeTranscriptionType === type.value ? '#007bff' : '#ccc'}`,
                borderRadius: '8px',
                background: activeTranscriptionType === type.value ? '#007bff' : 'white',
                color: activeTranscriptionType === type.value ? 'white' : 'black',
                cursor: 'pointer'
              }}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Active Transcription Component */}
      {integrationService && currentType && (
        <ClinicalVoiceTranscription
          patientId="demo-patient-123"
          encounterId="demo-encounter-456"
          providerId="demo-provider-789"
          transcriptionType={activeTranscriptionType}
          integrationService={integrationService}
          clinicalContext={currentType.context}
          onTranscriptionComplete={(result) => {
            console.log(`${currentType.label} transcription:`, result);
          }}
          enableStreaming={true}
        />
      )}
    </div>
  );
};

/**
 * Example: Advanced Configuration Demo
 */
export const AdvancedConfigurationExample: React.FC = () => {
  const [environment, setEnvironment] = useState<'development' | 'staging' | 'production'>('development');
  const [useCase, setUseCase] = useState<'general' | 'multilingual' | 'emergency' | 'pediatric'>('general');
  const [configPreview, setConfigPreview] = useState<string>('');

  useEffect(() => {
    // Generate configuration preview
    const config = createConfig(environment, useCase);
    setConfigPreview(JSON.stringify(config, null, 2));
  }, [environment, useCase]);

  return (
    <div style={{ padding: '20px' }}>
      <h2>⚙️ Advanced Configuration Demo</h2>
      
      {/* Configuration Options */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        <div>
          <h3>Environment</h3>
          <select 
            value={environment} 
            onChange={(e) => setEnvironment(e.target.value as any)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px' }}
          >
            <option value="development">Development</option>
            <option value="staging">Staging</option>
            <option value="production">Production</option>
          </select>
        </div>
        
        <div>
          <h3>Use Case</h3>
          <select 
            value={useCase} 
            onChange={(e) => setUseCase(e.target.value as any)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px' }}
          >
            <option value="general">General Practice</option>
            <option value="multilingual">Multilingual Clinic</option>
            <option value="emergency">Emergency Department</option>
            <option value="pediatric">Pediatric Clinic</option>
          </select>
        </div>
      </div>

      {/* Configuration Preview */}
      <div>
        <h3>Generated Configuration</h3>
        <pre style={{ 
          background: '#f5f5f5', 
          padding: '15px', 
          borderRadius: '8px', 
          overflow: 'auto',
          maxHeight: '400px',
          fontSize: '12px'
        }}>
          {configPreview}
        </pre>
      </div>

      {/* Usage Instructions */}
      <div style={{ marginTop: '20px', padding: '15px', background: '#e8f4fd', borderRadius: '8px' }}>
        <h3>💡 Usage Instructions</h3>
        <p>
          This configuration can be used to initialize the Whisper-OpenEMR integration:
        </p>
        <pre style={{ background: 'white', padding: '10px', borderRadius: '4px', fontSize: '14px' }}>
{`const config = createConfig('${environment}', '${useCase}');
const integration = new WhisperOpenEMRIntegration(config);
await integration.initialize();`}
        </pre>
      </div>
    </div>
  );
};

/**
 * Example: Complete Clinical Workflow
 */
export const CompleteClinicalWorkflowExample: React.FC = () => {
  const [step, setStep] = useState(1);
  const [patientData, setPatientData] = useState<any>(null);
  const [transcriptionResults, setTranscriptionResults] = useState<ClinicalTranscriptionResult[]>([]);
  const [integrationService, setIntegrationService] = useState<WhisperOpenEMRIntegration | null>(null);

  useEffect(() => {
    // Initialize service
    const initService = async () => {
      const config = createConfig('development', 'general');
      const service = new WhisperOpenEMRIntegration(config);
      await service.initialize();
      setIntegrationService(service);
    };
    
    initService();
  }, []);

  const mockPatient = {
    id: 'workflow-patient-001',
    name: 'Jane Smith',
    age: 45,
    mrn: 'MRN-78901'
  };

  const workflowSteps = [
    { id: 1, title: 'Patient Check-in', type: 'general' as const },
    { id: 2, title: 'Medical History', type: 'history' as const },
    { id: 3, title: 'Clinical Assessment', type: 'assessment' as const },
    { id: 4, title: 'Treatment Plan', type: 'plan' as const },
    { id: 5, title: 'Review & Submit', type: 'general' as const }
  ];

  const currentStep = workflowSteps.find(s => s.id === step);

  const handleStepComplete = (result: ClinicalTranscriptionResult) => {
    setTranscriptionResults(prev => [...prev, result]);
    if (step < workflowSteps.length) {
      setStep(step + 1);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>🏥 Complete Clinical Workflow Example</h2>
      
      {/* Progress Indicator */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          {workflowSteps.map((workflowStep) => (
            <div
              key={workflowStep.id}
              style={{
                padding: '8px 12px',
                borderRadius: '4px',
                background: workflowStep.id === step ? '#007bff' : workflowStep.id < step ? '#28a745' : '#f8f9fa',
                color: workflowStep.id <= step ? 'white' : 'black',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
            >
              {workflowStep.id}. {workflowStep.title}
            </div>
          ))}
        </div>
        <div style={{ 
          width: '100%', 
          height: '4px', 
          background: '#f8f9fa', 
          borderRadius: '2px' 
        }}>
          <div style={{ 
            width: `${(step / workflowSteps.length) * 100}%`, 
            height: '100%', 
            background: '#007bff', 
            borderRadius: '2px',
            transition: 'width 0.3s ease'
          }} />
        </div>
      </div>

      {/* Patient Information */}
      <div style={{ 
        padding: '15px', 
        background: '#f8f9fa', 
        borderRadius: '8px', 
        marginBottom: '20px' 
      }}>
        <h3>👤 Patient: {mockPatient.name}</h3>
        <p>MRN: {mockPatient.mrn} | Age: {mockPatient.age}</p>
      </div>

      {/* Current Step */}
      {currentStep && integrationService && step <= workflowSteps.length && (
        <div>
          <h3>Step {step}: {currentStep.title}</h3>
          <ClinicalVoiceTranscription
            patientId={mockPatient.id}
            encounterId={`encounter-${Date.now()}`}
            providerId="workflow-provider-001"
            transcriptionType={currentStep.type}
            integrationService={integrationService}
            clinicalContext={`Workflow step: ${currentStep.title}`}
            onTranscriptionComplete={handleStepComplete}
            enableStreaming={true}
          />
        </div>
      )}

      {/* Workflow Complete */}
      {step > workflowSteps.length && (
        <div style={{ padding: '20px', background: '#d4edda', borderRadius: '8px' }}>
          <h3>✅ Workflow Complete!</h3>
          <p>All transcriptions have been completed and saved to the patient's record.</p>
          
          <h4>Summary:</h4>
          <ul>
            {transcriptionResults.map((result, index) => (
              <li key={index}>
                <strong>{result.context.transcriptionType}:</strong> {result.text.substring(0, 100)}...
              </li>
            ))}
          </ul>
          
          <button 
            onClick={() => { setStep(1); setTranscriptionResults([]); }}
            style={{ 
              padding: '10px 20px', 
              background: '#007bff', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer',
              marginTop: '10px'
            }}
          >
            Start New Workflow
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Main Examples Container
 */
export const WhisperOpenEMRExamples: React.FC = () => {
  const [activeExample, setActiveExample] = useState('basic');

  const examples = [
    { id: 'basic', title: '🎤 Basic Transcription', component: BasicClinicalTranscriptionExample },
    { id: 'types', title: '🎯 Multiple Types', component: MultipleTranscriptionTypesExample },
    { id: 'config', title: '⚙️ Configuration', component: AdvancedConfigurationExample },
    { id: 'workflow', title: '🏥 Complete Workflow', component: CompleteClinicalWorkflowExample }
  ];

  const ActiveComponent = examples.find(ex => ex.id === activeExample)?.component || BasicClinicalTranscriptionExample;

  return (
    <div>
      {/* Example Navigation */}
      <div style={{ 
        padding: '15px', 
        background: '#f8f9fa', 
        borderBottom: '1px solid #dee2e6',
        marginBottom: '20px'
      }}>
        <h1>🎤 Whisper-OpenEMR Integration Examples</h1>
        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          {examples.map(example => (
            <button
              key={example.id}
              onClick={() => setActiveExample(example.id)}
              style={{
                padding: '8px 16px',
                border: `1px solid ${activeExample === example.id ? '#007bff' : '#dee2e6'}`,
                borderRadius: '4px',
                background: activeExample === example.id ? '#007bff' : 'white',
                color: activeExample === example.id ? 'white' : 'black',
                cursor: 'pointer'
              }}
            >
              {example.title}
            </button>
          ))}
        </div>
      </div>

      {/* Active Example */}
      <ActiveComponent />
    </div>
  );
};

export default WhisperOpenEMRExamples;