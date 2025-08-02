/**
 * @fileoverview Telehealth Session FHIR Adapter Usage Examples
 * 
 * Demonstrates how to use the telehealth session adapter to synchronize
 * OpenEMR telehealth sessions with FHIR resources.
 */

import { 
  TelehealthSessionFHIRAdapter,
  TelehealthAdapterConfig,
  TelehealthSessionMetadata,
  TelehealthPatientConsent
} from '../adapters/TelehealthSessionAdapter';
import { PostVisitSummaryPayload } from '../resources/Communication';

/**
 * Example configuration for the telehealth adapter
 */
const exampleConfig: TelehealthAdapterConfig = {
  openemr: {
    baseUrl: process.env.OPENEMR_BASE_URL || 'https://openemr.example.com',
    apiVersion: '7.0.2',
    oauth: {
      clientId: process.env.OPENEMR_CLIENT_ID!,
      clientSecret: process.env.OPENEMR_CLIENT_SECRET!,
      redirectUri: process.env.OPENEMR_REDIRECT_URI!,
      scopes: ['openid', 'fhirUser', 'patient/Patient.read', 'patient/Encounter.write']
    },
    fhir: {
      enabled: true,
      baseUrl: process.env.OPENEMR_FHIR_URL || 'https://openemr.example.com/apis/default/fhir'
    },
    security: {
      verifySSL: true,
      timeout: 30000
    },
    features: {
      enableAudit: true,
      enableSync: true,
      syncInterval: 15
    }
  },
  fhir: {
    baseUrl: process.env.FHIR_SERVER_URL || 'https://fhir.webqx.health',
    timeout: 30000,
    authentication: {
      type: 'bearer',
      token: process.env.FHIR_SERVER_TOKEN
    }
  },
  whisper: {
    timeout: 120000,
    maxFileSize: 25 * 1024 * 1024, // 25MB
    enableAmbientCapture: true
  },
  features: {
    enableConsentManagement: true,
    enableAmbientDocumentation: true,
    enablePostVisitSummary: true,
    enableAuditLogging: true
  }
};

/**
 * Example 1: Complete Telehealth Session Workflow
 */
export async function exampleTelehealthWorkflow() {
  console.log('Starting telehealth session workflow example...');

  // Initialize the adapter
  const adapter = new TelehealthSessionFHIRAdapter(exampleConfig);
  await adapter.initialize();

  // Step 1: Record patient consent before session
  const patientConsent: TelehealthPatientConsent = {
    patientId: 'patient-12345',
    consentTimestamp: new Date().toISOString(),
    consentContext: {
      sessionType: 'video',
      recordingConsent: true,
      dataSharing: {
        allowProviderAccess: true,
        allowEmergencyAccess: true,
        allowResearchUse: false
      },
      communicationPreferences: {
        preferredContactMethod: 'email',
        emergencyContact: {
          reference: 'RelatedPerson/emergency-contact-123'
        }
      },
      technicalConsent: {
        platformAgreement: true,
        dataTransmissionConsent: true,
        deviceDataCollection: true
      }
    },
    consentMethod: 'digital-signature',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  };

  console.log('Recording patient consent...');
  const consentResult = await adapter.mapPatientConsentToFHIR(patientConsent);
  if (consentResult.success) {
    console.log('✓ Patient consent recorded successfully:', consentResult.data?.id);
  } else {
    console.error('✗ Failed to record consent:', consentResult.error);
    return;
  }

  // Step 2: Start telehealth session and map to FHIR Encounter
  const sessionMetadata: TelehealthSessionMetadata = {
    sessionId: 'telehealth-session-67890',
    patientId: 'patient-12345',
    providerId: 'practitioner-54321',
    sessionType: 'video',
    scheduledStart: '2024-01-15T10:00:00Z',
    scheduledEnd: '2024-01-15T10:30:00Z',
    actualStart: '2024-01-15T10:02:00Z',
    actualEnd: '2024-01-15T10:28:00Z',
    status: 'finished',
    technicalContext: {
      sessionId: 'telehealth-session-67890',
      platformType: 'video',
      connectionQuality: 'good',
      technicalIssues: ['minor audio echo at start'],
      recordingConsent: true,
      sessionRecordingId: 'recording-98765'
    },
    appointmentId: 'appointment-11111',
    reasonForVisit: 'Annual wellness visit and medication review'
  };

  console.log('Mapping session to FHIR Encounter...');
  const encounterResult = await adapter.mapSessionToEncounter(sessionMetadata);
  if (encounterResult.success) {
    console.log('✓ Session mapped to FHIR Encounter:', encounterResult.data?.id);
  } else {
    console.error('✗ Failed to map session:', encounterResult.error);
    return;
  }

  // Step 3: Process ambient documentation (simulated audio file)
  console.log('Processing ambient documentation...');
  
  // In a real scenario, this would be the actual audio file from the session
  const mockAudioBlob = new Blob(['mock audio data for demonstration'], { type: 'audio/wav' });
  const mockAudioFile = new File([mockAudioBlob], 'session-audio.wav', { type: 'audio/wav' });

  const ambientDocResult = await adapter.processAmbientDocumentation(
    sessionMetadata.sessionId,
    sessionMetadata.patientId,
    sessionMetadata.providerId,
    mockAudioFile,
    {
      audioQuality: 'excellent',
      speakerIdentification: true,
      speakerCount: 2,
      sessionDuration: 'PT26M'
    }
  );

  if (ambientDocResult.success) {
    console.log('✓ Ambient documentation processed:', ambientDocResult.data?.id);
  } else {
    console.error('✗ Failed to process ambient documentation:', ambientDocResult.error);
  }

  // Step 4: Generate post-visit summary
  const postVisitSummary: PostVisitSummaryPayload = {
    visitSummary: {
      encounterDate: '2024-01-15',
      duration: '26 minutes',
      provider: 'Dr. Jane Smith, MD',
      visitType: 'Annual Wellness Visit (Telehealth)',
      chiefComplaint: 'Annual wellness visit and medication review'
    },
    clinicalSummary: {
      assessment: [
        'Patient appears well and in good spirits',
        'Blood pressure within normal limits',
        'No acute concerns reported',
        'Medication adherence good'
      ],
      treatmentPlan: [
        'Continue current medications as prescribed',
        'Annual blood work recommended',
        'Follow up in 12 months for next wellness visit'
      ],
      medications: [
        {
          name: 'Lisinopril',
          dosage: '10mg',
          instructions: 'Take once daily in the morning with food'
        },
        {
          name: 'Metformin',
          dosage: '500mg',
          instructions: 'Take twice daily with meals'
        }
      ]
    },
    followUpInstructions: {
      nextAppointment: '2025-01-15 (Annual wellness visit)',
      labWork: [
        'Comprehensive metabolic panel',
        'Lipid panel',
        'HbA1c',
        'Complete blood count'
      ],
      specialInstructions: [
        'Continue monitoring blood glucose at home',
        'Maintain current diet and exercise routine',
        'Call office if any concerns arise'
      ]
    },
    educationalResources: [
      {
        title: 'Diabetes Management Tips',
        url: 'https://webqx.health/education/diabetes-management',
        description: 'Comprehensive guide to managing diabetes with diet and lifestyle'
      },
      {
        title: 'Blood Pressure Monitoring',
        url: 'https://webqx.health/education/bp-monitoring',
        description: 'How to properly monitor blood pressure at home'
      }
    ],
    emergencyContact: {
      name: 'Dr. Smith On-Call Service',
      phone: '(555) 123-4567',
      whenToCall: [
        'Blood glucose levels consistently above 300 mg/dL',
        'Severe hypoglycemic symptoms',
        'Chest pain or difficulty breathing',
        'Any other urgent medical concerns'
      ]
    },
    technicalNotes: {
      connectionQuality: 'Good throughout session',
      technicalIssues: ['Minor audio echo resolved after 2 minutes'],
      recordingInfo: 'Session recorded with patient consent for quality assurance'
    }
  };

  console.log('Generating post-visit summary...');
  const summaryResult = await adapter.createPostVisitSummary(
    sessionMetadata.sessionId,
    sessionMetadata.patientId,
    sessionMetadata.providerId,
    postVisitSummary
  );

  if (summaryResult.success) {
    console.log('✓ Post-visit summary created:', summaryResult.data?.id);
  } else {
    console.error('✗ Failed to create post-visit summary:', summaryResult.error);
  }

  console.log('\nTelehealth session workflow completed successfully!');
  console.log('All FHIR resources have been created and synchronized.');
}

/**
 * Example 2: Emergency Telehealth Session
 */
export async function exampleEmergencyTelehealthSession() {
  console.log('Starting emergency telehealth session example...');

  const adapter = new TelehealthSessionFHIRAdapter(exampleConfig);
  await adapter.initialize();

  // Emergency session with minimal consent (verbal consent only)
  const emergencyConsent: TelehealthPatientConsent = {
    patientId: 'patient-emergency-001',
    consentTimestamp: new Date().toISOString(),
    consentContext: {
      sessionType: 'video',
      recordingConsent: false, // No recording for emergency
      dataSharing: {
        allowProviderAccess: true,
        allowEmergencyAccess: true,
        allowResearchUse: false
      },
      communicationPreferences: {
        preferredContactMethod: 'phone'
      },
      technicalConsent: {
        platformAgreement: true,
        dataTransmissionConsent: true,
        deviceDataCollection: false
      }
    },
    consentMethod: 'verbal',
    ipAddress: '10.0.0.15'
  };

  const emergencySession: TelehealthSessionMetadata = {
    sessionId: 'emergency-session-001',
    patientId: 'patient-emergency-001',
    providerId: 'emergency-provider-001',
    sessionType: 'video',
    scheduledStart: new Date().toISOString(),
    scheduledEnd: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes
    actualStart: new Date().toISOString(),
    status: 'in-progress',
    technicalContext: {
      sessionId: 'emergency-session-001',
      platformType: 'video',
      connectionQuality: 'fair',
      technicalIssues: [],
      recordingConsent: false
    },
    reasonForVisit: 'Urgent: Chest pain and shortness of breath'
  };

  console.log('Processing emergency consent...');
  const consentResult = await adapter.mapPatientConsentToFHIR(emergencyConsent);
  
  console.log('Mapping emergency session...');
  const encounterResult = await adapter.mapSessionToEncounter(emergencySession);

  if (encounterResult.success) {
    console.log('✓ Emergency session mapped successfully');
    console.log('✓ Priority: URGENT - immediate provider notification enabled');
  }
}

/**
 * Example 3: Batch Processing Multiple Sessions
 */
export async function exampleBatchProcessing() {
  console.log('Starting batch processing example...');

  const adapter = new TelehealthSessionFHIRAdapter(exampleConfig);
  await adapter.initialize();

  const sessions = [
    'session-001', 'session-002', 'session-003', 'session-004', 'session-005'
  ];

  console.log(`Processing ${sessions.length} telehealth sessions...`);

  const results = await Promise.allSettled(
    sessions.map(async (sessionId, index) => {
      const sessionMetadata: TelehealthSessionMetadata = {
        sessionId,
        patientId: `patient-${String(index + 1).padStart(3, '0')}`,
        providerId: `provider-${Math.ceil((index + 1) / 2)}`, // 2-3 sessions per provider
        sessionType: index % 2 === 0 ? 'video' : 'audio',
        scheduledStart: new Date(Date.now() - (60 - index * 10) * 60 * 1000).toISOString(),
        scheduledEnd: new Date(Date.now() - (30 - index * 10) * 60 * 1000).toISOString(),
        actualStart: new Date(Date.now() - (58 - index * 10) * 60 * 1000).toISOString(),
        actualEnd: new Date(Date.now() - (28 - index * 10) * 60 * 1000).toISOString(),
        status: 'finished',
        technicalContext: {
          sessionId,
          platformType: index % 2 === 0 ? 'video' : 'audio',
          connectionQuality: ['excellent', 'good', 'fair'][index % 3] as any,
          technicalIssues: [],
          recordingConsent: index % 3 !== 0 // 2/3 sessions recorded
        },
        reasonForVisit: [
          'Routine follow-up',
          'Medication review',
          'Lab results discussion',
          'Symptom check',
          'Treatment planning'
        ][index % 5]
      };

      return adapter.mapSessionToEncounter(sessionMetadata);
    })
  );

  const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
  const failed = results.length - successful;

  console.log(`✓ Batch processing completed: ${successful} successful, ${failed} failed`);
}

/**
 * Main demo function
 */
export async function runTelehealthAdapterDemo() {
  console.log('='.repeat(60));
  console.log('WebQX Telehealth Session FHIR Adapter Demo');
  console.log('='.repeat(60));

  try {
    // Example 1: Complete workflow
    await exampleTelehealthWorkflow();
    console.log('\n' + '-'.repeat(60) + '\n');

    // Example 2: Emergency session
    await exampleEmergencyTelehealthSession();
    console.log('\n' + '-'.repeat(60) + '\n');

    // Example 3: Batch processing
    await exampleBatchProcessing();

    console.log('\n' + '='.repeat(60));
    console.log('Demo completed successfully!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Demo failed:', error);
  }
}

// Export for use in other modules
export {
  exampleConfig,
  exampleTelehealthWorkflow,
  exampleEmergencyTelehealthSession,
  exampleBatchProcessing
};

// Run demo if this file is executed directly
if (require.main === module) {
  runTelehealthAdapterDemo().catch(console.error);
}