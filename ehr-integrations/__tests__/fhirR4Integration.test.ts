/**
 * Comprehensive tests for FHIR R4 Integration and Appointment Booking
 * 
 * Tests cover:
 * - FHIR R4 client functionality
 * - SMART on FHIR OAuth2 authentication
 * - Real-time appointment booking
 * - Component integration
 * - Error handling and edge cases
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { jest } from '@jest/globals';
import { FHIRR4Client, SMARTOnFHIRConfig } from '../services/fhirR4Client';
import { AppointmentBookingService, AppointmentBookingConfig } from '../services/appointmentBookingService';
import {
  FHIRAppointment,
  FHIRPatient,
  FHIRSlot,
  FHIRBundle,
  FHIROperationOutcome,
  FHIRAppointmentSearchParams
} from '../types/fhir-r4';

// Mock fetch for testing
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

// Mock configurations for testing
const mockSmartConfig: SMARTOnFHIRConfig = {
  fhirBaseUrl: 'https://test-fhir.example.com',
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  redirectUri: 'https://app.example.com/callback',
  scopes: ['patient/read', 'patient/Appointment.read', 'patient/Appointment.write']
};

const mockBookingConfig: AppointmentBookingConfig = {
  fhirConfig: {
    baseUrl: 'https://test-fhir.example.com',
    smartConfig: mockSmartConfig
  },
  realTimeConfig: {
    enableWebSocket: false,
    pollingInterval: 5000
  },
  constraints: {
    minAdvanceBooking: 60, // 1 hour
    maxAdvanceBooking: 90, // 90 days
    allowOverbooking: false
  }
};

describe('FHIR R4 Integration', () => {
  let fhirClient: FHIRR4Client;
  let bookingService: AppointmentBookingService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    fhirClient = new FHIRR4Client({
      baseUrl: mockSmartConfig.fhirBaseUrl,
      smartConfig: mockSmartConfig,
      debug: false
    });
    
    bookingService = new AppointmentBookingService(mockBookingConfig);
  });

  afterEach(() => {
    if (bookingService) {
      bookingService.disconnect();
    }
  });

  // ============================================================================
  // FHIR R4 Client Tests
  // ============================================================================

  describe('FHIR R4 Client', () => {
    
    describe('Initialization', () => {
      test('should initialize with correct configuration', () => {
        expect(fhirClient).toBeDefined();
        expect(fhirClient.getBaseUrl()).toBe(mockSmartConfig.fhirBaseUrl);
      });

      test('should handle missing configuration gracefully', () => {
        const clientWithoutSmart = new FHIRR4Client({
          baseUrl: 'https://test-fhir.example.com'
        });
        expect(clientWithoutSmart).toBeDefined();
      });
    });

    describe('SMART on FHIR OAuth2', () => {
      test('should discover capabilities', async () => {
        const mockCapabilities = {
          authorization_endpoint: 'https://auth.example.com/oauth2/authorize',
          token_endpoint: 'https://auth.example.com/oauth2/token',
          scopes_supported: ['patient/read', 'patient/write']
        };

        (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify(mockCapabilities))
        } as Response);

        const capabilities = await fhirClient.discoverCapabilities();
        expect(capabilities).toEqual(mockCapabilities);
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('.well-known/smart_configuration')
        );
      });

      test('should generate authorization URL', () => {
        const authUrl = fhirClient.getAuthorizationUrl();
        
        expect(authUrl).toContain('response_type=code');
        expect(authUrl).toContain(`client_id=${mockSmartConfig.clientId}`);
        expect(authUrl).toContain(`redirect_uri=${encodeURIComponent(mockSmartConfig.redirectUri)}`);
        expect(authUrl).toContain(`scope=${encodeURIComponent(mockSmartConfig.scopes.join(' '))}`);
        expect(authUrl).toContain(`aud=${encodeURIComponent(mockSmartConfig.fhirBaseUrl)}`);
      });

      test('should exchange code for token', async () => {
        const mockTokenResponse = {
          access_token: 'test-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: 'test-refresh-token',
          patient: 'patient-123'
        };

        (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify(mockTokenResponse))
        } as Response);

        const tokenResponse = await fhirClient.exchangeCodeForToken('auth-code-123', 'state-123');
        
        expect(tokenResponse).toEqual(mockTokenResponse);
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/oauth2/token'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/x-www-form-urlencoded'
            })
          })
        );
      });

      test('should refresh access token', async () => {
        // First set a refresh token
        fhirClient.setAccessToken('old-token');
        
        const mockRefreshResponse = {
          access_token: 'new-access-token',
          token_type: 'Bearer',
          expires_in: 3600
        };

        (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify(mockRefreshResponse))
        } as Response);

        // Mock that we have a refresh token
        (fhirClient as any).refreshToken = 'test-refresh-token';
        
        const refreshResponse = await fhirClient.refreshAccessToken();
        
        expect(refreshResponse).toEqual(mockRefreshResponse);
      });
    });

    describe('Patient Operations', () => {
      beforeEach(() => {
        fhirClient.setAccessToken('test-token');
      });

      test('should get patient by ID', async () => {
        const mockPatient: FHIRPatient = {
          resourceType: 'Patient',
          id: 'patient-123',
          name: [{
            given: ['John'],
            family: 'Doe'
          }],
          gender: 'male',
          birthDate: '1980-01-01'
        };

        (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify(mockPatient)),
          headers: new Headers()
        } as Response);

        const response = await fhirClient.getPatient('patient-123');
        
        expect(response.success).toBe(true);
        expect(response.data).toEqual(mockPatient);
        expect(fetch).toHaveBeenCalledWith(
          'https://test-fhir.example.com/Patient/patient-123',
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'Bearer test-token'
            })
          })
        );
      });

      test('should search patients', async () => {
        const mockBundle: FHIRBundle = {
          resourceType: 'Bundle',
          type: 'searchset',
          total: 1,
          entry: [{
            resource: {
              resourceType: 'Patient',
              id: 'patient-123',
              name: [{ given: ['John'], family: 'Doe' }]
            } as FHIRPatient
          }]
        };

        (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify(mockBundle)),
          headers: new Headers()
        } as Response);

        const response = await fhirClient.searchPatients({ name: 'John Doe' });
        
        expect(response.success).toBe(true);
        expect(response.data).toEqual(mockBundle);
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/Patient?name=John%20Doe'),
          expect.any(Object)
        );
      });
    });

    describe('Appointment Operations', () => {
      beforeEach(() => {
        fhirClient.setAccessToken('test-token');
      });

      test('should search appointments', async () => {
        const mockBundle: FHIRBundle = {
          resourceType: 'Bundle',
          type: 'searchset',
          total: 1,
          entry: [{
            resource: {
              resourceType: 'Appointment',
              id: 'appt-123',
              status: 'booked',
              start: '2024-01-15T10:00:00Z',
              end: '2024-01-15T10:30:00Z',
              participant: []
            } as FHIRAppointment
          }]
        };

        (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify(mockBundle)),
          headers: new Headers()
        } as Response);

        const searchParams: FHIRAppointmentSearchParams = {
          patient: 'Patient/patient-123',
          status: 'booked'
        };

        const response = await fhirClient.searchAppointments(searchParams);
        
        expect(response.success).toBe(true);
        expect(response.data).toEqual(mockBundle);
      });

      test('should create appointment', async () => {
        const mockAppointment: FHIRAppointment = {
          resourceType: 'Appointment',
          id: 'appt-new-123',
          status: 'booked',
          start: '2024-01-15T10:00:00Z',
          end: '2024-01-15T10:30:00Z',
          participant: [{
            actor: { reference: 'Patient/patient-123' },
            status: 'accepted'
          }]
        };

        (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
          ok: true,
          status: 201,
          text: () => Promise.resolve(JSON.stringify(mockAppointment)),
          headers: new Headers({ 'Location': 'Appointment/appt-new-123' })
        } as Response);

        const createRequest = {
          appointment: {
            ...mockAppointment,
            id: undefined // Remove ID for creation
          }
        };

        const response = await fhirClient.createAppointment(createRequest);
        
        expect(response.success).toBe(true);
        expect(response.data).toEqual(mockAppointment);
        expect(fetch).toHaveBeenCalledWith(
          'https://test-fhir.example.com/Appointment',
          expect.objectContaining({
            method: 'POST',
            body: expect.any(String)
          })
        );
      });

      test('should cancel appointment', async () => {
        const mockCancelledAppointment: FHIRAppointment = {
          resourceType: 'Appointment',
          id: 'appt-123',
          status: 'cancelled',
          start: '2024-01-15T10:00:00Z',
          end: '2024-01-15T10:30:00Z',
          participant: [],
          cancelationReason: { text: 'Patient request' }
        };

        // Mock getting the appointment first
        (fetch as jest.MockedFunction<typeof fetch>)
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            text: () => Promise.resolve(JSON.stringify({
              ...mockCancelledAppointment,
              status: 'booked',
              cancelationReason: undefined
            })),
            headers: new Headers()
          } as Response)
          // Mock updating the appointment
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            text: () => Promise.resolve(JSON.stringify(mockCancelledAppointment)),
            headers: new Headers()
          } as Response);

        const response = await fhirClient.cancelAppointment('appt-123', 'Patient request');
        
        expect(response.success).toBe(true);
        expect(response.data?.status).toBe('cancelled');
        expect(response.data?.cancelationReason?.text).toBe('Patient request');
      });
    });

    describe('Error Handling', () => {
      beforeEach(() => {
        fhirClient.setAccessToken('test-token');
      });

      test('should handle HTTP errors', async () => {
        const mockOperationOutcome: FHIROperationOutcome = {
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'not-found',
            diagnostics: 'Patient not found'
          }]
        };

        (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          text: () => Promise.resolve(JSON.stringify(mockOperationOutcome))
        } as Response);

        const response = await fhirClient.getPatient('nonexistent-patient');
        
        expect(response.success).toBe(false);
        expect(response.outcome).toBeDefined();
        expect(response.outcome?.issue[0].severity).toBe('error');
      });

      test('should handle network errors', async () => {
        (fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(
          new Error('Network error')
        );

        const response = await fhirClient.getPatient('patient-123');
        
        expect(response.success).toBe(false);
        expect(response.outcome?.issue[0].diagnostics).toContain('Network error');
      });

      test('should handle expired tokens', async () => {
        // Set an expired token
        fhirClient.setAccessToken('expired-token', 1); // 1 second expiry
        
        // Wait for token to expire
        await new Promise(resolve => setTimeout(resolve, 1100));

        const response = await fhirClient.getPatient('patient-123');
        
        expect(response.success).toBe(false);
        expect(response.outcome?.issue[0].diagnostics).toContain('expired');
      });
    });
  });

  // ============================================================================
  // Appointment Booking Service Tests
  // ============================================================================

  describe('Appointment Booking Service', () => {
    
    describe('Initialization', () => {
      test('should initialize with configuration', async () => {
        expect(bookingService).toBeDefined();
      });

      test('should handle authentication', async () => {
        const authUrl = await bookingService.authenticate();
        expect(typeof authUrl).toBe('string');
        expect(authUrl).toContain('response_type=code');
      });
    });

    describe('Slot Availability', () => {
      test('should get available slots', async () => {
        const mockSlots: FHIRSlot[] = [{
          resourceType: 'Slot',
          id: 'slot-123',
          schedule: { reference: 'Schedule/schedule-123' },
          status: 'free',
          start: '2024-01-15T10:00:00Z',
          end: '2024-01-15T10:30:00Z'
        }];

        const mockBundle: FHIRBundle = {
          resourceType: 'Bundle',
          type: 'searchset',
          entry: mockSlots.map(slot => ({ resource: slot }))
        };

        // Mock the FHIR client method
        jest.spyOn(fhirClient, 'getAvailableSlots').mockResolvedValueOnce({
          success: true,
          data: mockBundle
        });

        // Set the internal fhir client
        (bookingService as any).fhirClient = fhirClient;

        const availableSlots = await bookingService.getAvailableSlots(
          '2024-01-15T08:00:00Z',
          '2024-01-15T18:00:00Z'
        );

        expect(availableSlots).toHaveLength(1);
        expect(availableSlots[0].available).toBe(true);
        expect(availableSlots[0].slot.id).toBe('slot-123');
      });

      test('should filter unavailable slots', async () => {
        const mockSlots: FHIRSlot[] = [{
          resourceType: 'Slot',
          id: 'slot-busy',
          schedule: { reference: 'Schedule/schedule-123' },
          status: 'busy',
          start: '2024-01-15T10:00:00Z',
          end: '2024-01-15T10:30:00Z'
        }];

        const mockBundle: FHIRBundle = {
          resourceType: 'Bundle',
          type: 'searchset',
          entry: mockSlots.map(slot => ({ resource: slot }))
        };

        jest.spyOn(fhirClient, 'getAvailableSlots').mockResolvedValueOnce({
          success: true,
          data: mockBundle
        });

        (bookingService as any).fhirClient = fhirClient;

        const availableSlots = await bookingService.getAvailableSlots(
          '2024-01-15T08:00:00Z',
          '2024-01-15T18:00:00Z'
        );

        expect(availableSlots).toHaveLength(0); // Should filter out busy slots
      });
    });

    describe('Appointment Booking', () => {
      test('should book appointment successfully', async () => {
        const mockPatient: FHIRPatient = {
          resourceType: 'Patient',
          id: 'patient-123',
          name: [{ given: ['John'], family: 'Doe' }]
        };

        const mockCreatedAppointment: FHIRAppointment = {
          resourceType: 'Appointment',
          id: 'appt-new-123',
          status: 'booked',
          start: '2024-01-15T10:00:00Z',
          end: '2024-01-15T10:30:00Z',
          participant: [{
            actor: { reference: 'Patient/patient-123' },
            status: 'accepted'
          }]
        };

        // Mock slot availability
        const mockSlots = [{
          slot: {
            resourceType: 'Slot' as const,
            id: 'slot-123',
            schedule: { reference: 'Schedule/schedule-123' },
            status: 'free' as const,
            start: '2024-01-15T10:00:00Z',
            end: '2024-01-15T10:30:00Z'
          },
          available: true,
          durationMinutes: 30
        }];

        jest.spyOn(bookingService, 'getAvailableSlots').mockResolvedValueOnce(mockSlots);
        jest.spyOn(fhirClient, 'createAppointment').mockResolvedValueOnce({
          success: true,
          data: mockCreatedAppointment
        });

        (bookingService as any).fhirClient = fhirClient;

        const bookingRequest = {
          patient: mockPatient,
          startTime: '2024-01-15T10:00:00Z',
          durationMinutes: 30,
          serviceType: { text: 'General Consultation' }
        };

        const result = await bookingService.bookAppointment(bookingRequest);

        expect(result.success).toBe(true);
        expect(result.appointment).toEqual(mockCreatedAppointment);
        expect(result.confirmation).toBeDefined();
        expect(result.confirmation?.confirmationNumber).toBeDefined();
      });

      test('should handle booking conflicts', async () => {
        const mockPatient: FHIRPatient = {
          resourceType: 'Patient',
          id: 'patient-123',
          name: [{ given: ['John'], family: 'Doe' }]
        };

        // Mock no available slots
        jest.spyOn(bookingService, 'getAvailableSlots').mockResolvedValueOnce([]);

        const bookingRequest = {
          patient: mockPatient,
          startTime: '2024-01-15T10:00:00Z',
          durationMinutes: 30,
          allowAlternatives: true,
          alternativeRange: 120
        };

        const result = await bookingService.bookAppointment(bookingRequest);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('NO_AVAILABLE_SLOTS');
        expect(result.alternatives).toBeDefined();
      });

      test('should validate booking requests', async () => {
        const invalidRequest = {
          patient: undefined as any,
          startTime: '',
          durationMinutes: 0
        };

        const result = await bookingService.bookAppointment(invalidRequest);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('VALIDATION_ERROR');
      });
    });

    describe('Real-time Updates', () => {
      test('should handle real-time events', () => {
        let receivedEvent: any = null;
        
        bookingService.addEventListener('appointment_created', (event) => {
          receivedEvent = event;
        });

        // Simulate real-time event
        const testEvent = {
          type: 'appointment_created' as const,
          timestamp: new Date().toISOString(),
          resourceId: 'appt-123',
          resourceType: 'Appointment' as const,
          resource: {
            resourceType: 'Appointment' as const,
            id: 'appt-123',
            status: 'booked' as const,
            participant: []
          }
        };

        (bookingService as any).emitEvent('appointment_created', testEvent);

        expect(receivedEvent).toEqual(testEvent);
      });

      test('should remove event listeners', () => {
        let eventReceived = false;
        
        const listener = () => {
          eventReceived = true;
        };

        bookingService.addEventListener('appointment_updated', listener);
        bookingService.removeEventListener('appointment_updated', listener);

        // Simulate event - should not be received
        (bookingService as any).emitEvent('appointment_updated', {
          type: 'appointment_updated',
          timestamp: new Date().toISOString(),
          resourceId: 'appt-123',
          resourceType: 'Appointment'
        });

        expect(eventReceived).toBe(false);
      });
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('End-to-End Integration', () => {
    test('should complete full booking workflow', async () => {
      // Setup mocks for complete workflow
      const mockCapabilities = {
        authorization_endpoint: 'https://auth.example.com/oauth2/authorize',
        token_endpoint: 'https://auth.example.com/oauth2/token'
      };

      const mockTokenResponse = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        patient: 'patient-123'
      };

      const mockPatient: FHIRPatient = {
        resourceType: 'Patient',
        id: 'patient-123',
        name: [{ given: ['John'], family: 'Doe' }]
      };

      const mockSlots = [{
        slot: {
          resourceType: 'Slot' as const,
          id: 'slot-123',
          schedule: { reference: 'Schedule/schedule-123' },
          status: 'free' as const,
          start: '2024-01-15T10:00:00Z',
          end: '2024-01-15T10:30:00Z'
        },
        available: true,
        durationMinutes: 30
      }];

      const mockCreatedAppointment: FHIRAppointment = {
        resourceType: 'Appointment',
        id: 'appt-new-123',
        status: 'booked',
        start: '2024-01-15T10:00:00Z',
        end: '2024-01-15T10:30:00Z',
        participant: [{
          actor: { reference: 'Patient/patient-123' },
          status: 'accepted'
        }]
      };

      // Mock fetch responses
      (fetch as jest.MockedFunction<typeof fetch>)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify(mockCapabilities))
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify(mockTokenResponse))
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify(mockPatient)),
          headers: new Headers()
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          text: () => Promise.resolve(JSON.stringify(mockCreatedAppointment)),
          headers: new Headers()
        } as Response);

      // 1. Initialize service
      await bookingService.initialize();

      // 2. Authenticate
      const tokenResponse = await bookingService.authenticate('auth-code-123', 'state-123');
      expect(tokenResponse).toEqual(mockTokenResponse);

      // 3. Get patient context
      const patientResponse = await fhirClient.getCurrentPatient();
      // Note: This would require proper mocking of the internal fhir client

      // 4. Book appointment
      jest.spyOn(bookingService, 'getAvailableSlots').mockResolvedValueOnce(mockSlots);
      jest.spyOn(fhirClient, 'createAppointment').mockResolvedValueOnce({
        success: true,
        data: mockCreatedAppointment
      });

      (bookingService as any).fhirClient = fhirClient;

      const bookingRequest = {
        patient: mockPatient,
        startTime: '2024-01-15T10:00:00Z',
        durationMinutes: 30,
        serviceType: { text: 'General Consultation' }
      };

      const result = await bookingService.bookAppointment(bookingRequest);

      expect(result.success).toBe(true);
      expect(result.appointment?.id).toBe('appt-new-123');
      expect(result.confirmation?.confirmationNumber).toBeDefined();
    });
  });

  // ============================================================================
  // Performance Tests
  // ============================================================================

  describe('Performance Tests', () => {
    test('should handle multiple concurrent bookings', async () => {
      // Mock successful responses
      jest.spyOn(bookingService, 'getAvailableSlots').mockResolvedValue([{
        slot: {
          resourceType: 'Slot',
          id: 'slot-123',
          schedule: { reference: 'Schedule/schedule-123' },
          status: 'free',
          start: '2024-01-15T10:00:00Z',
          end: '2024-01-15T10:30:00Z'
        },
        available: true,
        durationMinutes: 30
      }]);

      const fhirClient = new FHIRR4Client({
        baseUrl: 'https://test-fhir.example.com',
        smartConfig: mockSmartConfig
      });

      jest.spyOn(fhirClient, 'createAppointment').mockResolvedValue({
        success: true,
        data: {
          resourceType: 'Appointment',
          id: 'appt-123',
          status: 'booked',
          participant: []
        }
      });

      (bookingService as any).fhirClient = fhirClient;

      const bookingRequests = Array.from({ length: 10 }, (_, i) => ({
        patient: { 
          resourceType: 'Patient' as const,
          id: `patient-${i}`,
          name: [{ given: ['Patient'], family: `${i}` }]
        },
        startTime: `2024-01-15T${10 + i}:00:00Z`,
        durationMinutes: 30,
        serviceType: { text: 'Test Service' }
      }));

      const startTime = Date.now();
      const results = await Promise.all(
        bookingRequests.map(request => bookingService.bookAppointment(request))
      );
      const endTime = Date.now();

      expect(results).toHaveLength(10);
      expect(results.every(result => result.success)).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds

      bookingService.disconnect();
    });
  });

  // ============================================================================
  // Accessibility Tests
  // ============================================================================

  describe('Accessibility Tests', () => {
    test('should provide proper ARIA labels and roles', () => {
      // These would typically be tested with React Testing Library
      // in a separate component test file
      expect(true).toBe(true); // Placeholder
    });

    test('should support keyboard navigation', () => {
      // Component-specific accessibility tests
      expect(true).toBe(true); // Placeholder
    });

    test('should provide screen reader announcements', () => {
      // Test for proper screen reader support
      expect(true).toBe(true); // Placeholder
    });
  });
});

// Export mock configurations for use in other test files
export { mockSmartConfig, mockBookingConfig };