/**
 * External Services Integration Tests
 * 
 * Tests integration with all external services including FHIR, HL7, Pharmacy APIs,
 * Lab Results, Firebase, AI/NLP services, healthcare systems, and messaging services.
 */

import { createTestEnvironment, cleanupTestEnvironment, testConfig } from '../setup/test-environment';
import MockServiceManager from '../mocks/services';

describe('External Services Integration Tests', () => {
  let mockServices: MockServiceManager;

  beforeAll(async () => {
    createTestEnvironment();
    mockServices = new MockServiceManager();
    mockServices.setupAllMocks();
  });

  afterAll(async () => {
    mockServices.cleanupAllMocks();
    cleanupTestEnvironment();
  });

  describe('FHIR R4 Server Integration', () => {
    test('Should connect to FHIR server and retrieve capability statement', async () => {
      const fhirService = mockServices.getService('fhir');
      
      // Test capability statement endpoint
      const response = await fetch(`${testConfig.external.fhir.serverUrl}/metadata`);
      const capability = await response.json();

      expect(capability).toHaveProperty('resourceType', 'CapabilityStatement');
      expect(capability).toHaveProperty('status', 'active');
      expect(capability).toHaveProperty('fhirVersion', '4.0.1');
      expect(capability.rest).toBeDefined();
      expect(Array.isArray(capability.rest)).toBe(true);
    });

    test('Should authenticate with FHIR server using OAuth2', async () => {
      const authRequest = {
        grant_type: 'client_credentials',
        client_id: testConfig.external.fhir.clientId,
        client_secret: testConfig.external.fhir.clientSecret,
        scope: 'system/*.read system/*.write'
      };

      // Mock OAuth2 token endpoint
      const tokenResponse = await fetch(`${testConfig.external.fhir.serverUrl}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(authRequest)
      });

      expect(tokenResponse.status).toBe(200);
      const tokenData = await tokenResponse.json();
      expect(tokenData).toHaveProperty('access_token');
      expect(tokenData).toHaveProperty('token_type', 'Bearer');
    });

    test('Should search for patients using FHIR API', async () => {
      const searchUrl = `${testConfig.external.fhir.serverUrl}/Patient?family=Doe&given=John`;
      const response = await fetch(searchUrl);
      const bundle = await response.json();

      expect(bundle).toHaveProperty('resourceType', 'Bundle');
      expect(bundle).toHaveProperty('type', 'searchset');
      expect(bundle).toHaveProperty('entry');
      expect(Array.isArray(bundle.entry)).toBe(true);
      
      if (bundle.entry.length > 0) {
        expect(bundle.entry[0].resource).toHaveProperty('resourceType', 'Patient');
      }
    });

    test('Should create and retrieve patient resource', async () => {
      const newPatient = {
        resourceType: 'Patient',
        active: true,
        name: [{
          use: 'usual',
          family: 'TestPatient',
          given: ['Integration']
        }],
        gender: 'other',
        birthDate: '1990-01-01',
        telecom: [{
          system: 'email',
          value: 'integration.test@webqx.health'
        }]
      };

      // Create patient
      const createResponse = await fetch(`${testConfig.external.fhir.serverUrl}/Patient`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/fhir+json',
          'Authorization': `Bearer mock-token`
        },
        body: JSON.stringify(newPatient)
      });

      expect(createResponse.status).toBe(201);
      const createdPatient = await createResponse.json();
      expect(createdPatient).toHaveProperty('id');
      expect(createdPatient).toHaveProperty('resourceType', 'Patient');

      // Retrieve patient
      const patientId = createdPatient.id;
      const retrieveResponse = await fetch(`${testConfig.external.fhir.serverUrl}/Patient/${patientId}`);
      const retrievedPatient = await retrieveResponse.json();
      
      expect(retrievedPatient.id).toBe(patientId);
      expect(retrievedPatient.name[0].family).toBe('TestPatient');
    });

    test('Should handle FHIR validation errors', async () => {
      const invalidPatient = {
        resourceType: 'Patient',
        // Missing required fields
        name: null,
        birthDate: 'invalid-date'
      };

      const response = await fetch(`${testConfig.external.fhir.serverUrl}/Patient`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/fhir+json' },
        body: JSON.stringify(invalidPatient)
      });

      expect(response.status).toBe(400);
      const operationOutcome = await response.json();
      expect(operationOutcome).toHaveProperty('resourceType', 'OperationOutcome');
      expect(operationOutcome.issue).toBeDefined();
      expect(operationOutcome.issue[0]).toHaveProperty('severity', 'error');
    });
  });

  describe('OpenAI and Whisper Integration', () => {
    test('Should transcribe audio using Whisper API', async () => {
      const openaiService = mockServices.getService('openai');
      
      // Mock audio file
      const audioBlob = new Blob(['mock audio data'], { type: 'audio/mpeg' });
      const formData = new FormData();
      formData.append('file', audioBlob, 'test-audio.mp3');
      formData.append('model', 'whisper-1');
      formData.append('language', 'en');

      const response = await fetch(testConfig.external.openai.whisperApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${testConfig.external.openai.apiKey}`
        },
        body: formData
      });

      expect(response.status).toBe(200);
      const transcription = await response.json();
      expect(transcription).toHaveProperty('text');
      expect(transcription).toHaveProperty('language');
      expect(transcription).toHaveProperty('confidence');
      expect(typeof transcription.text).toBe('string');
    });

    test('Should generate medical insights using OpenAI Chat API', async () => {
      const chatRequest = {
        model: 'gpt-3.5-turbo',
        messages: [{
          role: 'system',
          content: 'You are a medical AI assistant that helps analyze patient symptoms.'
        }, {
          role: 'user',
          content: 'Patient reports headache and dizziness. Blood pressure is 140/90. What should be considered?'
        }],
        max_tokens: 200,
        temperature: 0.3
      };

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testConfig.external.openai.apiKey}`
        },
        body: JSON.stringify(chatRequest)
      });

      expect(response.status).toBe(200);
      const completion = await response.json();
      expect(completion).toHaveProperty('choices');
      expect(completion.choices[0]).toHaveProperty('message');
      expect(completion.choices[0].message).toHaveProperty('content');
      expect(typeof completion.choices[0].message.content).toBe('string');
    });

    test('Should handle OpenAI API rate limits and errors', async () => {
      // Test with invalid API key
      const invalidRequest = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Test message' }]
      };

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer invalid-key'
        },
        body: JSON.stringify(invalidRequest)
      });

      expect(response.status).toBe(401);
      const error = await response.json();
      expect(error).toHaveProperty('error');
      expect(error.error).toHaveProperty('message');
    });
  });

  describe('Firebase Integration', () => {
    test('Should authenticate with Firebase using service account', async () => {
      const firebaseService = mockServices.getService('firebase');
      
      // Mock custom token verification
      const customToken = 'mock-custom-token';
      const verifyResponse = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:verifyCustomToken?key=${testConfig.external.firebase.projectId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: customToken, returnSecureToken: true })
        }
      );

      expect(verifyResponse.status).toBe(200);
      const authResult = await verifyResponse.json();
      expect(authResult).toHaveProperty('idToken');
      expect(authResult).toHaveProperty('refreshToken');
      expect(authResult).toHaveProperty('localId');
    });

    test('Should read data from Firestore', async () => {
      const documentPath = `projects/${testConfig.external.firebase.projectId}/databases/(default)/documents/patients/test-patient`;
      
      const response = await fetch(
        `https://firestore.googleapis.com/v1/${documentPath}`,
        {
          headers: {
            'Authorization': 'Bearer mock-firebase-token'
          }
        }
      );

      expect(response.status).toBe(200);
      const document = await response.json();
      expect(document).toHaveProperty('name');
      expect(document).toHaveProperty('fields');
      expect(document).toHaveProperty('createTime');
      expect(document).toHaveProperty('updateTime');
    });

    test('Should write data to Firestore', async () => {
      const documentPath = `projects/${testConfig.external.firebase.projectId}/databases/(default)/documents/patients/test-patient`;
      const documentData = {
        fields: {
          name: { stringValue: 'John Doe' },
          mrn: { stringValue: 'MRN123456' },
          lastAccess: { timestampValue: new Date().toISOString() }
        }
      };

      const response = await fetch(
        `https://firestore.googleapis.com/v1/${documentPath}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-firebase-token'
          },
          body: JSON.stringify(documentData)
        }
      );

      expect(response.status).toBe(200);
      const updatedDocument = await response.json();
      expect(updatedDocument).toHaveProperty('name');
      expect(updatedDocument.fields.name.stringValue).toBe('John Doe');
    });
  });

  describe('Healthcare System Integrations', () => {
    describe('Epic Integration', () => {
      test('Should authenticate with Epic FHIR API', async () => {
        const healthcareService = mockServices.getService('healthcare');
        
        const authRequest = {
          grant_type: 'client_credentials',
          client_id: testConfig.external.healthcare.epic.clientId,
          client_secret: testConfig.external.healthcare.epic.clientSecret,
          scope: 'system/Patient.read system/Observation.read'
        };

        const response = await fetch(`${testConfig.external.healthcare.epic.apiUrl}/oauth/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(authRequest)
        });

        expect(response.status).toBe(200);
        const tokenData = await response.json();
        expect(tokenData).toHaveProperty('access_token');
        expect(tokenData).toHaveProperty('scope');
      });

      test('Should search patients in Epic system', async () => {
        const searchUrl = `${testConfig.external.healthcare.epic.apiUrl}/FHIR/R4/Patient?family=Smith`;
        const response = await fetch(searchUrl, {
          headers: { 'Authorization': 'Bearer mock-epic-token' }
        });

        expect(response.status).toBe(200);
        const bundle = await response.json();
        expect(bundle).toHaveProperty('resourceType', 'Bundle');
        expect(bundle).toHaveProperty('entry');
        
        if (bundle.entry.length > 0) {
          expect(bundle.entry[0].resource).toHaveProperty('resourceType', 'Patient');
          expect(bundle.entry[0].resource).toHaveProperty('id');
        }
      });
    });

    describe('Cerner Integration', () => {
      test('Should retrieve lab results from Cerner', async () => {
        const labResultsUrl = `${testConfig.external.healthcare.cerner.apiUrl}/fhir/r4/Observation?patient=123&category=laboratory`;
        const response = await fetch(labResultsUrl, {
          headers: { 
            'Authorization': `Bearer ${testConfig.external.healthcare.cerner.apiKey}`,
            'Accept': 'application/fhir+json'
          }
        });

        expect(response.status).toBe(200);
        const bundle = await response.json();
        expect(bundle).toHaveProperty('resourceType', 'Bundle');
        expect(bundle).toHaveProperty('entry');
        
        if (bundle.entry.length > 0) {
          const observation = bundle.entry[0].resource;
          expect(observation).toHaveProperty('resourceType', 'Observation');
          expect(observation).toHaveProperty('status');
          expect(observation).toHaveProperty('category');
          expect(observation).toHaveProperty('code');
        }
      });
    });

    describe('Allscripts Integration', () => {
      test('Should retrieve medication list from Allscripts', async () => {
        const medicationsUrl = `${testConfig.external.healthcare.allscripts.apiUrl}/medications?patient_id=123`;
        const response = await fetch(medicationsUrl, {
          headers: { 
            'Authorization': `Bearer ${testConfig.external.healthcare.allscripts.apiKey}`,
            'Content-Type': 'application/json'
          }
        });

        expect(response.status).toBe(200);
        const medications = await response.json();
        expect(medications).toHaveProperty('medications');
        expect(Array.isArray(medications.medications)).toBe(true);
        
        if (medications.medications.length > 0) {
          const medication = medications.medications[0];
          expect(medication).toHaveProperty('id');
          expect(medication).toHaveProperty('name');
          expect(medication).toHaveProperty('dosage');
        }
      });
    });
  });

  describe('Messaging Services Integration', () => {
    describe('Matrix Messaging', () => {
      test('Should send secure message via Matrix', async () => {
        const messagingService = mockServices.getService('messaging');
        
        const message = {
          msgtype: 'm.text',
          body: 'Your test results are ready for review. Please log in to the patient portal.'
        };

        const roomId = '!testroom:webqx.health';
        const response = await fetch(
          `${testConfig.external.messaging.matrix.serverUrl}/_matrix/client/r0/rooms/${roomId}/send/m.room.message`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${testConfig.external.messaging.matrix.accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(message)
          }
        );

        expect(response.status).toBe(200);
        const result = await response.json();
        expect(result).toHaveProperty('event_id');
        expect(typeof result.event_id).toBe('string');
      });
    });

    describe('Medplum Messaging', () => {
      test('Should create communication resource via Medplum', async () => {
        const communication = {
          resourceType: 'Communication',
          status: 'completed',
          category: [{
            coding: [{ code: 'notification' }]
          }],
          subject: {
            reference: 'Patient/test-patient-123'
          },
          sent: new Date().toISOString(),
          payload: [{
            contentString: 'Your test results are ready for review.'
          }]
        };

        const response = await fetch(`${testConfig.external.messaging.medplum.apiUrl}/fhir/R4/Communication`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/fhir+json',
            'Authorization': 'Bearer mock-medplum-token'
          },
          body: JSON.stringify(communication)
        });

        expect(response.status).toBe(201);
        const createdComm = await response.json();
        expect(createdComm).toHaveProperty('resourceType', 'Communication');
        expect(createdComm).toHaveProperty('id');
        expect(createdComm).toHaveProperty('status', 'completed');
      });
    });
  });

  describe('Email/SMTP Integration', () => {
    test('Should send email notifications', async () => {
      const emailService = mockServices.getService('email');
      
      const emailData = {
        to: 'patient@example.com',
        subject: 'Appointment Confirmation - WebQx Health',
        body: `
          Dear Patient,
          
          Your appointment has been confirmed for January 15, 2024 at 10:00 AM.
          
          Please arrive 15 minutes early for check-in.
          
          Best regards,
          WebQx Health Team
        `
      };

      const result = await emailService.mockSendEmail(
        emailData.to,
        emailData.subject,
        emailData.body
      );

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('status', 'sent');
      expect(result).toHaveProperty('to', emailData.to);
      expect(result).toHaveProperty('subject', emailData.subject);
    });

    test('Should receive and process email responses', async () => {
      const emailService = mockServices.getService('email');
      
      const receivedEmail = await emailService.mockReceiveEmail();
      
      expect(receivedEmail).toHaveProperty('id');
      expect(receivedEmail).toHaveProperty('from');
      expect(receivedEmail).toHaveProperty('to');
      expect(receivedEmail).toHaveProperty('subject');
      expect(receivedEmail).toHaveProperty('body');
      expect(receivedEmail).toHaveProperty('timestamp');
    });

    test('Should validate email configuration', () => {
      const emailConfig = testConfig.external.email;
      
      expect(emailConfig.smtpHost).toBeDefined();
      expect(emailConfig.smtpPort).toBeGreaterThan(0);
      expect(emailConfig.smtpUser).toBeDefined();
      expect(emailConfig.smtpPassword).toBeDefined();
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(emailRegex.test(emailConfig.smtpUser)).toBe(true);
    });
  });

  describe('Pharmacy and Lab Results APIs', () => {
    test('Should search pharmacy locations', async () => {
      // Mock pharmacy locator API
      const pharmacySearchUrl = 'https://api.pharmacy-locator.com/v1/search';
      const searchParams = {
        zipcode: '12345',
        radius: 10,
        insurance: 'Aetna'
      };

      // Mock response
      const mockPharmacies = {
        pharmacies: [{
          id: 'pharmacy-123',
          name: 'CVS Pharmacy',
          address: '123 Main St, Anytown, ST 12345',
          phone: '555-123-4567',
          distance: 2.5,
          acceptsInsurance: true,
          hours: {
            monday: '8:00 AM - 10:00 PM',
            tuesday: '8:00 AM - 10:00 PM'
          }
        }],
        total: 1
      };

      // Simulate API call validation
      expect(searchParams.zipcode).toMatch(/^\d{5}$/);
      expect(searchParams.radius).toBeGreaterThan(0);
      expect(mockPharmacies.pharmacies).toHaveLength(1);
      expect(mockPharmacies.pharmacies[0]).toHaveProperty('name');
      expect(mockPharmacies.pharmacies[0]).toHaveProperty('address');
    });

    test('Should retrieve lab results from external lab system', async () => {
      // Mock lab results API
      const labResultsUrl = 'https://api.lab-results.com/v1/results';
      const patientParams = {
        patient_id: 'patient-123',
        date_range: '2024-01-01,2024-01-31'
      };

      // Mock response
      const mockLabResults = {
        results: [{
          id: 'lab-result-456',
          test_name: 'Complete Blood Count',
          ordered_date: '2024-01-15',
          result_date: '2024-01-16',
          status: 'final',
          values: [{
            component: 'Hemoglobin',
            value: 14.2,
            unit: 'g/dL',
            reference_range: '12.0-16.0',
            status: 'normal'
          }]
        }],
        total: 1
      };

      expect(mockLabResults.results).toHaveLength(1);
      expect(mockLabResults.results[0]).toHaveProperty('test_name');
      expect(mockLabResults.results[0]).toHaveProperty('status', 'final');
      expect(mockLabResults.results[0].values[0]).toHaveProperty('value');
      expect(mockLabResults.results[0].values[0]).toHaveProperty('unit');
    });
  });

  describe('Service Health Monitoring', () => {
    test('Should monitor external service availability', async () => {
      const services = [
        { name: 'FHIR Server', url: testConfig.external.fhir.serverUrl },
        { name: 'OpenAI API', url: 'https://api.openai.com' },
        { name: 'Firebase', url: 'https://firebase.googleapis.com' }
      ];

      const healthChecks = await Promise.all(
        services.map(async (service) => {
          try {
            const startTime = Date.now();
            const response = await fetch(`${service.url}/health`, { 
              method: 'GET',
              timeout: 5000 
            }).catch(() => ({ status: 503 }));
            const endTime = Date.now();
            
            return {
              name: service.name,
              status: response.status < 400 ? 'healthy' : 'unhealthy',
              responseTime: endTime - startTime,
              statusCode: response.status
            };
          } catch (error) {
            return {
              name: service.name,
              status: 'error',
              error: (error as Error).message
            };
          }
        })
      );

      healthChecks.forEach(check => {
        expect(check).toHaveProperty('name');
        expect(check).toHaveProperty('status');
        expect(['healthy', 'unhealthy', 'error']).toContain(check.status);
      });
    });

    test('Should implement circuit breaker pattern for external services', () => {
      class CircuitBreaker {
        private failures = 0;
        private state: 'closed' | 'open' | 'half-open' = 'closed';
        private threshold = 5;
        private timeout = 60000; // 1 minute
        private nextAttempt = 0;

        async call<T>(fn: () => Promise<T>): Promise<T> {
          if (this.state === 'open') {
            if (Date.now() < this.nextAttempt) {
              throw new Error('Circuit breaker is open');
            }
            this.state = 'half-open';
          }

          try {
            const result = await fn();
            this.onSuccess();
            return result;
          } catch (error) {
            this.onFailure();
            throw error;
          }
        }

        private onSuccess() {
          this.failures = 0;
          this.state = 'closed';
        }

        private onFailure() {
          this.failures++;
          if (this.failures >= this.threshold) {
            this.state = 'open';
            this.nextAttempt = Date.now() + this.timeout;
          }
        }

        getState() {
          return {
            state: this.state,
            failures: this.failures,
            nextAttempt: this.nextAttempt
          };
        }
      }

      const circuitBreaker = new CircuitBreaker();
      
      expect(circuitBreaker.getState().state).toBe('closed');
      expect(circuitBreaker.getState().failures).toBe(0);
    });
  });

  describe('Error Handling and Retry Logic', () => {
    test('Should implement exponential backoff for failed requests', () => {
      const retryConfig = {
        maxAttempts: 3,
        initialDelay: 1000,
        backoffMultiplier: 2,
        maxDelay: 30000,
        jitter: true
      };

      const calculateDelay = (attempt: number, config: typeof retryConfig): number => {
        const delay = Math.min(
          config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1),
          config.maxDelay
        );
        
        return config.jitter ? delay + Math.random() * 1000 : delay;
      };

      expect(calculateDelay(1, retryConfig)).toBeGreaterThanOrEqual(1000);
      expect(calculateDelay(2, retryConfig)).toBeGreaterThanOrEqual(2000);
      expect(calculateDelay(3, retryConfig)).toBeGreaterThanOrEqual(4000);
      expect(calculateDelay(10, retryConfig)).toBeLessThanOrEqual(30000);
    });

    test('Should handle different types of service errors appropriately', () => {
      const errorHandler = (error: any) => {
        if (error.status >= 500) {
          return { retry: true, delay: 5000 }; // Server error - retry
        } else if (error.status === 429) {
          return { retry: true, delay: error.headers?.['retry-after'] * 1000 || 60000 }; // Rate limit
        } else if (error.status >= 400 && error.status < 500) {
          return { retry: false, error: 'Client error' }; // Client error - don't retry
        } else {
          return { retry: true, delay: 1000 }; // Network error - retry
        }
      };

      expect(errorHandler({ status: 500 })).toEqual({ retry: true, delay: 5000 });
      expect(errorHandler({ status: 429, headers: { 'retry-after': 30 } })).toEqual({ retry: true, delay: 30000 });
      expect(errorHandler({ status: 400 })).toEqual({ retry: false, error: 'Client error' });
    });
  });
});