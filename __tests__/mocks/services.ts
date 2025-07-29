/**
 * Mock Services for Integration Testing
 * 
 * This module provides comprehensive mock implementations for all external services
 * used by the WebQx platform, ensuring consistent and reliable integration testing.
 */

import { Request, Response } from 'express';
import nock from 'nock';

/**
 * Mock FHIR Server
 */
export class MockFHIRServer {
  private scope: nock.Scope;

  constructor(baseUrl: string = 'https://test-fhir.webqx.health') {
    this.scope = nock(baseUrl);
  }

  mockPatientSearch() {
    return this.scope
      .get('/fhir/Patient')
      .query(true)
      .reply(200, {
        resourceType: 'Bundle',
        id: 'test-bundle',
        type: 'searchset',
        total: 1,
        entry: [{
          resource: {
            resourceType: 'Patient',
            id: 'test-patient-123',
            active: true,
            name: [{
              use: 'usual',
              family: 'Doe',
              given: ['John']
            }],
            gender: 'male',
            birthDate: '1990-01-01'
          }
        }]
      });
  }

  mockPatientById(patientId: string = 'test-patient-123') {
    return this.scope
      .get(`/fhir/Patient/${patientId}`)
      .reply(200, {
        resourceType: 'Patient',
        id: patientId,
        active: true,
        name: [{
          use: 'usual',
          family: 'Doe',
          given: ['John']
        }],
        gender: 'male',
        birthDate: '1990-01-01',
        telecom: [{
          system: 'email',
          value: 'john.doe@example.com'
        }]
      });
  }

  mockAppointmentCreate() {
    return this.scope
      .post('/fhir/Appointment')
      .reply(201, {
        resourceType: 'Appointment',
        id: 'new-appointment-123',
        status: 'booked',
        start: '2024-02-15T10:00:00Z',
        end: '2024-02-15T10:30:00Z',
        participant: [{
          actor: {
            reference: 'Patient/test-patient-123'
          },
          status: 'accepted'
        }]
      });
  }

  mockCapabilityStatement() {
    return this.scope
      .get('/fhir/metadata')
      .reply(200, {
        resourceType: 'CapabilityStatement',
        id: 'webqx-capability',
        status: 'active',
        date: '2024-01-01',
        kind: 'instance',
        software: {
          name: 'WebQx FHIR Server',
          version: '1.0.0'
        },
        fhirVersion: '4.0.1',
        format: ['json', 'xml'],
        rest: [{
          mode: 'server',
          resource: [
            { type: 'Patient', interaction: [{ code: 'read' }, { code: 'search-type' }] },
            { type: 'Appointment', interaction: [{ code: 'create' }, { code: 'read' }] }
          ]
        }]
      });
  }

  cleanup() {
    this.scope.persist(false);
    nock.cleanAll();
  }
}

/**
 * Mock OpenAI/Whisper Service
 */
export class MockOpenAIService {
  private scope: nock.Scope;

  constructor(baseUrl: string = 'https://api.openai.com') {
    this.scope = nock(baseUrl);
  }

  mockTranscription() {
    return this.scope
      .post('/v1/audio/transcriptions')
      .reply(200, {
        text: 'Take two tablets daily with food. Do not exceed recommended dosage.',
        duration: 5.2,
        language: 'en',
        confidence: 0.95
      });
  }

  mockChatCompletion() {
    return this.scope
      .post('/v1/chat/completions')
      .reply(200, {
        id: 'chatcmpl-test123',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-3.5-turbo',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Based on the provided medical information, I recommend consulting with your healthcare provider about potential interactions.'
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 25,
          total_tokens: 75
        }
      });
  }

  cleanup() {
    this.scope.persist(false);
    nock.cleanAll();
  }
}

/**
 * Mock Firebase Service
 */
export class MockFirebaseService {
  private authScope: nock.Scope;
  private firestoreScope: nock.Scope;

  constructor() {
    this.authScope = nock('https://identitytoolkit.googleapis.com');
    this.firestoreScope = nock('https://firestore.googleapis.com');
  }

  mockAuthentication() {
    return this.authScope
      .post('/v1/accounts:verifyCustomToken')
      .query(true)
      .reply(200, {
        kind: 'identitytoolkit#VerifyCustomTokenResponse',
        idToken: 'test-firebase-id-token',
        refreshToken: 'test-firebase-refresh-token',
        expiresIn: '3600',
        localId: 'test-user-id'
      });
  }

  mockFirestoreRead() {
    return this.firestoreScope
      .get(/\/v1\/projects\/.*\/databases\/\(default\)\/documents\/.*/)
      .reply(200, {
        name: 'projects/test-project/databases/(default)/documents/patients/test-patient',
        fields: {
          name: { stringValue: 'John Doe' },
          mrn: { stringValue: 'MRN123456' },
          lastAccess: { timestampValue: new Date().toISOString() }
        },
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString()
      });
  }

  mockFirestoreWrite() {
    return this.firestoreScope
      .patch(/\/v1\/projects\/.*\/databases\/\(default\)\/documents\/.*/)
      .reply(200, {
        name: 'projects/test-project/databases/(default)/documents/patients/test-patient',
        fields: {
          name: { stringValue: 'John Doe' },
          mrn: { stringValue: 'MRN123456' },
          lastAccess: { timestampValue: new Date().toISOString() }
        },
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString()
      });
  }

  cleanup() {
    this.authScope.persist(false);
    this.firestoreScope.persist(false);
    nock.cleanAll();
  }
}

/**
 * Mock Healthcare System Integrations
 */
export class MockHealthcareIntegrations {
  private epicScope: nock.Scope;
  private cernerScope: nock.Scope;
  private allscriptsScope: nock.Scope;

  constructor() {
    this.epicScope = nock('https://test-epic.webqx.health');
    this.cernerScope = nock('https://test-cerner.webqx.health');
    this.allscriptsScope = nock('https://test-allscripts.webqx.health');
  }

  mockEpicPatientSearch() {
    return this.epicScope
      .get('/api/FHIR/R4/Patient')
      .query(true)
      .reply(200, {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 1,
        entry: [{
          resource: {
            resourceType: 'Patient',
            id: 'epic-patient-123',
            identifier: [{ value: 'EPIC123456' }],
            name: [{ family: 'Smith', given: ['Jane'] }],
            gender: 'female',
            birthDate: '1985-05-15'
          }
        }]
      });
  }

  mockCernerLabResults() {
    return this.cernerScope
      .get('/api/fhir/r4/Observation')
      .query(true)
      .reply(200, {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 2,
        entry: [{
          resource: {
            resourceType: 'Observation',
            id: 'cerner-lab-123',
            status: 'final',
            category: [{ coding: [{ code: 'laboratory' }] }],
            code: { coding: [{ code: '33747-0', display: 'Hemoglobin' }] },
            valueQuantity: { value: 14.2, unit: 'g/dL' },
            subject: { reference: 'Patient/cerner-patient-456' }
          }
        }]
      });
  }

  mockAllscriptsMedications() {
    return this.allscriptsScope
      .get('/api/medications')
      .query(true)
      .reply(200, {
        medications: [{
          id: 'allscripts-med-789',
          name: 'Lisinopril 10mg',
          dosage: '10mg daily',
          instructions: 'Take once daily in the morning',
          prescriber: 'Dr. Johnson',
          dateWritten: '2024-01-15'
        }]
      });
  }

  cleanup() {
    this.epicScope.persist(false);
    this.cernerScope.persist(false);
    this.allscriptsScope.persist(false);
    nock.cleanAll();
  }
}

/**
 * Mock Email/SMTP Service
 */
export class MockEmailService {
  private messages: any[] = [];

  constructor() {
    // Mock SMTP server simulation
  }

  mockSendEmail(to: string, subject: string, body: string) {
    const message = {
      id: `msg-${Date.now()}`,
      to,
      subject,
      body,
      timestamp: new Date().toISOString(),
      status: 'sent'
    };
    this.messages.push(message);
    return Promise.resolve(message);
  }

  mockReceiveEmail() {
    return Promise.resolve({
      id: `msg-received-${Date.now()}`,
      from: 'noreply@webqx.health',
      to: 'patient@example.com',
      subject: 'Appointment Confirmation',
      body: 'Your appointment has been confirmed for January 15, 2024.',
      timestamp: new Date().toISOString()
    });
  }

  getMessages() {
    return this.messages;
  }

  cleanup() {
    this.messages = [];
  }
}

/**
 * Mock Database Service
 */
export class MockDatabaseService {
  private connected = false;
  private testData: Map<string, any> = new Map();

  async connect() {
    this.connected = true;
    return { success: true, message: 'Connected to test database' };
  }

  async disconnect() {
    this.connected = false;
    this.testData.clear();
    return { success: true, message: 'Disconnected from test database' };
  }

  isConnected() {
    return this.connected;
  }

  async executeQuery(query: string, params?: any[]) {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    // Simulate different query types
    if (query.toLowerCase().includes('select')) {
      return {
        rows: [
          { id: 1, name: 'Test Patient', mrn: 'TEST123' },
          { id: 2, name: 'Another Patient', mrn: 'TEST456' }
        ],
        rowCount: 2
      };
    }

    if (query.toLowerCase().includes('insert')) {
      const id = Math.floor(Math.random() * 1000);
      return {
        rows: [{ id }],
        rowCount: 1
      };
    }

    if (query.toLowerCase().includes('update')) {
      return {
        rows: [],
        rowCount: 1
      };
    }

    return { rows: [], rowCount: 0 };
  }

  async testConnection() {
    return this.connected ? 
      { success: true, latency: 5 } : 
      { success: false, error: 'Not connected' };
  }
}

/**
 * Mock Messaging Services
 */
export class MockMessagingServices {
  private matrixScope: nock.Scope;
  private medplumScope: nock.Scope;

  constructor() {
    this.matrixScope = nock('https://test-matrix.webqx.health');
    this.medplumScope = nock('https://test-medplum.webqx.health');
  }

  mockMatrixSendMessage() {
    return this.matrixScope
      .post('/_matrix/client/r0/rooms/!testroom:webqx.health/send/m.room.message')
      .query(true)
      .reply(200, {
        event_id: '$test-event-id:webqx.health'
      });
  }

  mockMedplumCommunication() {
    return this.medplumScope
      .post('/fhir/R4/Communication')
      .reply(201, {
        resourceType: 'Communication',
        id: 'test-communication-123',
        status: 'completed',
        category: [{ coding: [{ code: 'notification' }] }],
        subject: { reference: 'Patient/test-patient-123' },
        sent: new Date().toISOString(),
        payload: [{
          contentString: 'Your test results are ready for review.'
        }]
      });
  }

  cleanup() {
    this.matrixScope.persist(false);
    this.medplumScope.persist(false);
    nock.cleanAll();
  }
}

/**
 * Comprehensive Mock Service Manager
 */
export class MockServiceManager {
  private services: {
    fhir: MockFHIRServer;
    openai: MockOpenAIService;
    firebase: MockFirebaseService;
    healthcare: MockHealthcareIntegrations;
    email: MockEmailService;
    database: MockDatabaseService;
    messaging: MockMessagingServices;
  };

  constructor() {
    this.services = {
      fhir: new MockFHIRServer(),
      openai: new MockOpenAIService(),
      firebase: new MockFirebaseService(),
      healthcare: new MockHealthcareIntegrations(),
      email: new MockEmailService(),
      database: new MockDatabaseService(),
      messaging: new MockMessagingServices()
    };
  }

  setupAllMocks() {
    // Setup FHIR mocks
    this.services.fhir.mockPatientSearch();
    this.services.fhir.mockPatientById();
    this.services.fhir.mockAppointmentCreate();
    this.services.fhir.mockCapabilityStatement();

    // Setup OpenAI mocks
    this.services.openai.mockTranscription();
    this.services.openai.mockChatCompletion();

    // Setup Firebase mocks
    this.services.firebase.mockAuthentication();
    this.services.firebase.mockFirestoreRead();
    this.services.firebase.mockFirestoreWrite();

    // Setup Healthcare integration mocks
    this.services.healthcare.mockEpicPatientSearch();
    this.services.healthcare.mockCernerLabResults();
    this.services.healthcare.mockAllscriptsMedications();

    // Setup Messaging mocks
    this.services.messaging.mockMatrixSendMessage();
    this.services.messaging.mockMedplumCommunication();

    return this.services;
  }

  cleanupAllMocks() {
    Object.values(this.services).forEach(service => {
      if (service.cleanup) {
        service.cleanup();
      }
    });
    nock.cleanAll();
  }

  getService<K extends keyof typeof this.services>(serviceName: K): typeof this.services[K] {
    return this.services[serviceName];
  }
}

export default MockServiceManager;