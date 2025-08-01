import { TelehealthMessagingService } from '../services/TelehealthMessagingService';

// Mock fetch globally
global.fetch = jest.fn();

describe('TelehealthMessagingService', () => {
  let service: TelehealthMessagingService;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    service = new TelehealthMessagingService({
      messagingEndpoint: '/test/messaging',
      fhirServerUrl: '/test/fhir'
    });
    mockFetch = fetch as jest.MockedFunction<typeof fetch>;
    jest.clearAllMocks();
  });

  describe('Post-Visit Summary', () => {
    it('should send post-visit summary successfully', async () => {
      const summary = {
        sessionId: 'session-123',
        patientId: 'patient-456',
        providerId: 'provider-789',
        visitDate: '2023-12-01T10:00:00Z',
        summary: 'Routine consultation completed. Patient is stable.',
        diagnosis: ['Hypertension', 'Type 2 Diabetes'],
        medications: [
          { name: 'Metformin 500mg' },
          { name: 'Lisinopril 10mg' }
        ],
        followUpInstructions: 'Continue current medications. Follow up in 3 months.',
        nextAppointment: '2024-03-01T10:00:00Z',
        language: 'en'
      };

      // Mock successful response
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'message-123' })
      } as Response);

      const result = await service.sendPostVisitSummary(summary);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.deliveryStatus).toBe('sent');

      // Verify fetch was called with correct parameters
      expect(mockFetch).toHaveBeenCalledWith('/test/messaging', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/fhir+json',
          'Accept': 'application/fhir+json'
        },
        body: expect.stringContaining('"resourceType":"Bundle"')
      });

      // Parse the message body to verify structure
      const callArgs = mockFetch.mock.calls[0];
      const messageBody = JSON.parse(callArgs[1]?.body as string);
      
      expect(messageBody.resourceType).toBe('Bundle');
      expect(messageBody.type).toBe('message');
      expect(messageBody.entry).toHaveLength(4); // MessageHeader + Communication + 2 Conditions
      
      // Verify MessageHeader
      const messageHeader = messageBody.entry.find((entry: any) => 
        entry.resource.resourceType === 'MessageHeader'
      );
      expect(messageHeader).toBeDefined();
      expect(messageHeader.resource.eventCoding.code).toBe('patient-summary');
      expect(messageHeader.resource.sender.reference).toBe('Practitioner/provider-789');

      // Verify Communication
      const communication = messageBody.entry.find((entry: any) => 
        entry.resource.resourceType === 'Communication'
      );
      expect(communication).toBeDefined();
      expect(communication.resource.subject.reference).toBe('Patient/patient-456');
      expect(communication.resource.payload[0].contentString).toContain('Routine consultation completed');
      expect(communication.resource.payload[0].contentString).toContain('Hypertension');
      expect(communication.resource.payload[0].contentString).toContain('Metformin 500mg');

      // Verify Conditions (diagnoses)
      const conditions = messageBody.entry.filter((entry: any) => 
        entry.resource.resourceType === 'Condition'
      );
      expect(conditions).toHaveLength(2);
      expect(conditions[0].resource.code.text).toBe('Hypertension');
      expect(conditions[1].resource.code.text).toBe('Type 2 Diabetes');
    });

    it('should handle messaging service errors', async () => {
      const summary = {
        sessionId: 'session-123',
        patientId: 'patient-456',
        providerId: 'provider-789',
        visitDate: '2023-12-01T10:00:00Z',
        summary: 'Test summary'
      };

      // Mock failed response
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      } as Response);

      const result = await service.sendPostVisitSummary(summary);

      expect(result.success).toBe(false);
      expect(result.error).toContain('HTTP 500');
    });

    it('should handle network errors', async () => {
      const summary = {
        sessionId: 'session-123',
        patientId: 'patient-456',
        providerId: 'provider-789',
        visitDate: '2023-12-01T10:00:00Z',
        summary: 'Test summary'
      };

      // Mock network error
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await service.sendPostVisitSummary(summary);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('Follow-up Instructions', () => {
    it('should send follow-up instructions successfully', async () => {
      const instructions = {
        sessionId: 'session-123',
        patientId: 'patient-456',
        providerId: 'provider-789',
        instructions: 'Please take your medication as prescribed and monitor your blood pressure daily.',
        priority: 'routine' as const,
        dueDate: '2023-12-15T10:00:00Z',
        language: 'es'
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'message-456' })
      } as Response);

      const result = await service.sendFollowUpInstructions(instructions);

      expect(result.success).toBe(true);
      expect(result.deliveryStatus).toBe('sent');

      // Verify message structure
      const callArgs = mockFetch.mock.calls[0];
      const messageBody = JSON.parse(callArgs[1]?.body as string);
      
      expect(messageBody.resourceType).toBe('Bundle');
      expect(messageBody.entry).toHaveLength(2); // MessageHeader + Communication

      const communication = messageBody.entry.find((entry: any) => 
        entry.resource.resourceType === 'Communication'
      );
      expect(communication.resource.priority).toBe('routine');
      expect(communication.resource.payload[0].contentString).toContain('monitor your blood pressure');
      
      // Check for language and due date extensions
      const extensions = communication.resource.extension;
      const languageExt = extensions.find((ext: any) => ext.url.includes('/language'));
      const dueDateExt = extensions.find((ext: any) => ext.url.includes('/due-date'));
      
      expect(languageExt.valueString).toBe('es');
      expect(dueDateExt.valueDateTime).toBe('2023-12-15T10:00:00Z');
    });

    it('should handle high priority instructions', async () => {
      const instructions = {
        sessionId: 'session-123',
        patientId: 'patient-456',
        providerId: 'provider-789',
        instructions: 'Urgent: Contact your doctor immediately if symptoms worsen.',
        priority: 'urgent' as const
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'message-urgent' })
      } as Response);

      const result = await service.sendFollowUpInstructions(instructions);

      expect(result.success).toBe(true);

      const callArgs = mockFetch.mock.calls[0];
      const messageBody = JSON.parse(callArgs[1]?.body as string);
      
      const communication = messageBody.entry.find((entry: any) => 
        entry.resource.resourceType === 'Communication'
      );
      expect(communication.resource.priority).toBe('urgent');
    });
  });

  describe('Message Templates', () => {
    it('should provide correct message templates', () => {
      const templates = service.getMessageTemplates();

      expect(templates.postVisitSummary).toBeDefined();
      expect(templates.followUpInstructions).toBeDefined();
      expect(templates.appointmentReminder).toBeDefined();

      expect(templates.postVisitSummary.title).toBe('Post-Visit Summary');
      expect(templates.postVisitSummary.template).toContain('{visitDate}');
      expect(templates.postVisitSummary.template).toContain('{summary}');
      expect(templates.postVisitSummary.template).toContain('{diagnosis}');

      expect(templates.followUpInstructions.title).toBe('Follow-up Instructions');
      expect(templates.followUpInstructions.template).toContain('{instructions}');
      expect(templates.followUpInstructions.template).toContain('{priority}');

      expect(templates.appointmentReminder.title).toBe('Appointment Reminder');
      expect(templates.appointmentReminder.template).toContain('{appointmentDate}');
    });
  });

  describe('Message Validation', () => {
    it('should validate FHIR messages correctly', () => {
      const validMessage = {
        resourceType: 'Bundle' as const,
        id: 'test-message',
        type: 'message' as const,
        timestamp: new Date().toISOString(),
        entry: [
          {
            resource: {
              resourceType: 'MessageHeader',
              id: 'header-1'
            }
          }
        ]
      };

      // Access private method for testing
      const validateMessage = (service as any).validateMessage.bind(service);
      const result = validateMessage(validMessage);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid message structure', () => {
      const invalidMessage = {
        resourceType: 'Patient' as any,
        id: 'test-message',
        type: 'document' as any,
        timestamp: new Date().toISOString(),
        entry: []
      };

      const validateMessage = (service as any).validateMessage.bind(service);
      const result = validateMessage(invalidMessage);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Message must be a Bundle resource');
      expect(result.errors).toContain('Bundle type must be "message"');
      expect(result.errors).toContain('Message must contain at least one entry');
    });

    it('should detect missing MessageHeader', () => {
      const messageWithoutHeader = {
        resourceType: 'Bundle' as const,
        id: 'test-message',
        type: 'message' as const,
        timestamp: new Date().toISOString(),
        entry: [
          {
            resource: {
              resourceType: 'Communication',
              id: 'comm-1'
            }
          }
        ]
      };

      const validateMessage = (service as any).validateMessage.bind(service);
      const result = validateMessage(messageWithoutHeader);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Message must contain a MessageHeader');
    });
  });

  describe('Message Formatting', () => {
    it('should format post-visit summary correctly', () => {
      const summary = {
        sessionId: 'session-123',
        patientId: 'patient-456',
        providerId: 'provider-789',
        visitDate: '2023-12-01T10:00:00Z',
        summary: 'Patient is doing well.',
        diagnosis: ['Hypertension'],
        medications: [{ name: 'Lisinopril 10mg' }],
        followUpInstructions: 'Continue medication as prescribed.',
        nextAppointment: '2024-01-01T10:00:00Z'
      };

      // Access private method for testing
      const formatPostVisitSummary = (service as any).formatPostVisitSummary.bind(service);
      const formatted = formatPostVisitSummary(summary);

      expect(formatted).toContain('Post-Visit Summary');
      expect(formatted).toContain('Visit Date: 12/1/2023');
      expect(formatted).toContain('Patient is doing well.');
      expect(formatted).toContain('• Hypertension');
      expect(formatted).toContain('• Lisinopril 10mg');
      expect(formatted).toContain('Continue medication as prescribed.');
      expect(formatted).toContain('Next Appointment: 2024-01-01T10:00:00Z');
    });

    it('should handle missing optional fields in summary', () => {
      const minimalSummary = {
        sessionId: 'session-123',
        patientId: 'patient-456',
        providerId: 'provider-789',
        visitDate: '2023-12-01T10:00:00Z',
        summary: 'Basic consultation completed.'
      };

      const formatPostVisitSummary = (service as any).formatPostVisitSummary.bind(service);
      const formatted = formatPostVisitSummary(minimalSummary);

      expect(formatted).toContain('Post-Visit Summary');
      expect(formatted).toContain('Basic consultation completed.');
      expect(formatted).not.toContain('Diagnosis:');
      expect(formatted).not.toContain('Medications:');
      expect(formatted).not.toContain('Follow-up Instructions:');
      expect(formatted).not.toContain('Next Appointment:');
    });
  });

  describe('Service Configuration', () => {
    it('should use default configuration when none provided', () => {
      const defaultService = new TelehealthMessagingService();
      
      // Access private properties for testing
      expect((defaultService as any).messagingEndpoint).toBe('/fhir/messaging');
      expect((defaultService as any).fhirServerUrl).toBe('/fhir');
    });

    it('should use custom configuration when provided', () => {
      const customService = new TelehealthMessagingService({
        messagingEndpoint: '/custom/messaging',
        fhirServerUrl: '/custom/fhir'
      });
      
      expect((customService as any).messagingEndpoint).toBe('/custom/messaging');
      expect((customService as any).fhirServerUrl).toBe('/custom/fhir');
    });
  });
});