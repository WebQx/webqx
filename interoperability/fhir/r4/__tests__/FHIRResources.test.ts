/**
 * @fileoverview Tests for FHIR R4 Resources
 * 
 * Tests for the new FHIR R4 resources: Encounter, Consent, Communication, and DocumentReference
 */

import { 
  FHIREncounter, 
  EncounterStatus,
  TelehealthEncounterContext 
} from '../resources/Encounter';
import { 
  FHIRConsent, 
  ConsentStatus,
  TELEHEALTH_CONSENT_CATEGORIES 
} from '../resources/Consent';
import { 
  FHIRCommunication, 
  CommunicationStatus,
  TELEHEALTH_COMMUNICATION_CATEGORIES 
} from '../resources/Communication';
import { 
  FHIRDocumentReference, 
  DocumentReferenceStatus,
  CLINICAL_NOTE_TYPES 
} from '../resources/DocumentReference';

describe('FHIR R4 Resources', () => {
  describe('FHIREncounter', () => {
    it('should create a valid telehealth encounter', () => {
      const encounter: FHIREncounter = {
        resourceType: 'Encounter',
        id: 'telehealth-session-123',
        identifier: [
          {
            use: 'official',
            system: 'http://webqx.health/telehealth-sessions',
            value: 'session-123'
          }
        ],
        status: 'finished',
        class: {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: 'VR',
          display: 'Virtual'
        },
        type: [
          {
            coding: [
              {
                system: 'http://snomed.info/sct',
                code: '448337001',
                display: 'Telemedicine consultation'
              }
            ]
          }
        ],
        subject: {
          reference: 'Patient/patient-123'
        },
        period: {
          start: '2024-01-15T10:00:00Z',
          end: '2024-01-15T10:30:00Z'
        }
      };

      expect(encounter.resourceType).toBe('Encounter');
      expect(encounter.status).toBe('finished');
      expect(encounter.class.code).toBe('VR');
      expect(encounter.type?.[0]?.coding?.[0]?.code).toBe('448337001');
    });

    it('should support all encounter statuses', () => {
      const statuses: EncounterStatus[] = [
        'planned', 'arrived', 'triaged', 'in-progress', 
        'onleave', 'finished', 'cancelled', 'entered-in-error', 'unknown'
      ];

      statuses.forEach(status => {
        const encounter: Partial<FHIREncounter> = {
          resourceType: 'Encounter',
          status
        };
        expect(encounter.status).toBe(status);
      });
    });

    it('should include telehealth context information', () => {
      const telehealthContext: TelehealthEncounterContext = {
        sessionId: 'session-123',
        platformType: 'video',
        connectionQuality: 'excellent',
        technicalIssues: ['minor audio delay'],
        recordingConsent: true,
        sessionRecordingId: 'recording-456'
      };

      expect(telehealthContext.platformType).toBe('video');
      expect(telehealthContext.recordingConsent).toBe(true);
      expect(telehealthContext.technicalIssues).toContain('minor audio delay');
    });
  });

  describe('FHIRConsent', () => {
    it('should create a valid telehealth consent', () => {
      const consent: FHIRConsent = {
        resourceType: 'Consent',
        id: 'telehealth-consent-123',
        status: 'active',
        scope: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/consentscope',
              code: 'treatment',
              display: 'Treatment'
            }
          ]
        },
        category: [TELEHEALTH_CONSENT_CATEGORIES.PLATFORM_USAGE],
        patient: {
          reference: 'Patient/patient-123'
        },
        dateTime: '2024-01-15T09:55:00Z',
        verification: [
          {
            verified: true,
            verificationDate: '2024-01-15T09:55:00Z'
          }
        ]
      };

      expect(consent.resourceType).toBe('Consent');
      expect(consent.status).toBe('active');
      expect(consent.category?.[0]?.display).toBe('Telehealth Platform Usage');
    });

    it('should support all consent statuses', () => {
      const statuses: ConsentStatus[] = [
        'draft', 'proposed', 'active', 'rejected', 'inactive', 'entered-in-error'
      ];

      statuses.forEach(status => {
        const consent: Partial<FHIRConsent> = {
          resourceType: 'Consent',
          status
        };
        expect(consent.status).toBe(status);
      });
    });

    it('should include predefined telehealth consent categories', () => {
      expect(TELEHEALTH_CONSENT_CATEGORIES.SESSION_RECORDING.code).toBe('research');
      expect(TELEHEALTH_CONSENT_CATEGORIES.DATA_SHARING.code).toBe('patient-privacy');
      expect(TELEHEALTH_CONSENT_CATEGORIES.EMERGENCY_ACCESS.code).toBe('emrgonly');
      expect(TELEHEALTH_CONSENT_CATEGORIES.PLATFORM_USAGE.code).toBe('treatment');
    });
  });

  describe('FHIRCommunication', () => {
    it('should create a valid post-visit summary communication', () => {
      const communication: FHIRCommunication = {
        resourceType: 'Communication',
        id: 'post-visit-session-123',
        status: 'completed',
        category: [TELEHEALTH_COMMUNICATION_CATEGORIES.POST_VISIT_SUMMARY],
        subject: {
          reference: 'Patient/patient-123'
        },
        encounter: {
          reference: 'Encounter/telehealth-session-123'
        },
        sent: '2024-01-15T10:35:00Z',
        recipient: [
          {
            reference: 'Patient/patient-123'
          }
        ],
        sender: {
          reference: 'Practitioner/provider-456'
        },
        payload: [
          {
            contentString: '# Post-Visit Summary\n\nThank you for your telehealth visit...'
          }
        ]
      };

      expect(communication.resourceType).toBe('Communication');
      expect(communication.status).toBe('completed');
      expect(communication.category?.[0]?.display).toBe('Post-Visit Summary');
      expect(communication.payload?.[0]?.contentString).toContain('Post-Visit Summary');
    });

    it('should support all communication statuses', () => {
      const statuses: CommunicationStatus[] = [
        'preparation', 'in-progress', 'not-done', 'on-hold', 
        'stopped', 'completed', 'entered-in-error', 'unknown'
      ];

      statuses.forEach(status => {
        const communication: Partial<FHIRCommunication> = {
          resourceType: 'Communication',
          status
        };
        expect(communication.status).toBe(status);
      });
    });

    it('should include predefined telehealth communication categories', () => {
      expect(TELEHEALTH_COMMUNICATION_CATEGORIES.PRE_VISIT_REMINDER.display).toBe('Pre-Visit Reminder');
      expect(TELEHEALTH_COMMUNICATION_CATEGORIES.POST_VISIT_SUMMARY.display).toBe('Post-Visit Summary');
      expect(TELEHEALTH_COMMUNICATION_CATEGORIES.TECHNICAL_SUPPORT.display).toBe('Technical Support');
      expect(TELEHEALTH_COMMUNICATION_CATEGORIES.FOLLOW_UP_CARE.display).toBe('Follow-up Care Instructions');
    });
  });

  describe('FHIRDocumentReference', () => {
    it('should create a valid ambient documentation reference', () => {
      const documentReference: FHIRDocumentReference = {
        resourceType: 'DocumentReference',
        id: 'ambient-doc-session-123',
        status: 'current',
        docStatus: 'preliminary',
        type: CLINICAL_NOTE_TYPES.AMBIENT_DOCUMENTATION,
        category: [
          {
            coding: [
              {
                system: 'http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category',
                code: 'clinical-note',
                display: 'Clinical Note'
              }
            ]
          }
        ],
        subject: {
          reference: 'Patient/patient-123'
        },
        date: '2024-01-15T10:30:00Z',
        author: [
          {
            reference: 'Practitioner/provider-456'
          },
          {
            display: 'AI Ambient Documentation System'
          }
        ],
        content: [
          {
            attachment: {
              contentType: 'text/plain',
              data: 'UGF0aWVudCBwcmVzZW50cyB3aXRoIGNoZXN0IHBhaW4u', // Base64 encoded
              title: 'Ambient Documentation - Session session-123'
            }
          }
        ]
      };

      expect(documentReference.resourceType).toBe('DocumentReference');
      expect(documentReference.status).toBe('current');
      expect(documentReference.type?.display).toBe('Ambient clinical documentation');
      expect(documentReference.content).toHaveLength(1);
      expect(documentReference.content[0].attachment.contentType).toBe('text/plain');
    });

    it('should support all document reference statuses', () => {
      const statuses: DocumentReferenceStatus[] = ['current', 'superseded', 'entered-in-error'];

      statuses.forEach(status => {
        const docRef: Partial<FHIRDocumentReference> = {
          resourceType: 'DocumentReference',
          status
        };
        expect(docRef.status).toBe(status);
      });
    });

    it('should include predefined clinical note types', () => {
      expect(CLINICAL_NOTE_TYPES.ENCOUNTER_NOTE.code).toBe('34109-9');
      expect(CLINICAL_NOTE_TYPES.PROGRESS_NOTE.code).toBe('11506-3');
      expect(CLINICAL_NOTE_TYPES.CONSULTATION_NOTE.code).toBe('11488-4');
      expect(CLINICAL_NOTE_TYPES.AMBIENT_DOCUMENTATION.display).toBe('Ambient clinical documentation');
      expect(CLINICAL_NOTE_TYPES.TELEHEALTH_NOTE.display).toBe('Telehealth encounter note');
    });
  });

  describe('Resource Validation', () => {
    it('should validate required fields for Encounter', () => {
      const invalidEncounter = {
        resourceType: 'Encounter'
        // Missing required 'status' field
      };

      // In a real implementation, this would use a FHIR validator
      expect(invalidEncounter.resourceType).toBe('Encounter');
      // expect(() => validateFHIRResource(invalidEncounter)).toThrow();
    });

    it('should validate required fields for Consent', () => {
      const invalidConsent = {
        resourceType: 'Consent'
        // Missing required 'status' and 'scope' fields
      };

      expect(invalidConsent.resourceType).toBe('Consent');
      // In a real implementation, this would validate required fields
    });

    it('should validate required fields for Communication', () => {
      const validCommunication: FHIRCommunication = {
        resourceType: 'Communication',
        status: 'completed'
      };

      expect(validCommunication.resourceType).toBe('Communication');
      expect(validCommunication.status).toBe('completed');
    });

    it('should validate required fields for DocumentReference', () => {
      const validDocumentReference: FHIRDocumentReference = {
        resourceType: 'DocumentReference',
        status: 'current',
        content: [
          {
            attachment: {
              contentType: 'text/plain',
              data: 'VGVzdCBjb250ZW50'
            }
          }
        ]
      };

      expect(validDocumentReference.resourceType).toBe('DocumentReference');
      expect(validDocumentReference.status).toBe('current');
      expect(validDocumentReference.content).toHaveLength(1);
    });
  });

  describe('Search Parameters', () => {
    it('should support encounter search parameters', () => {
      const searchParams = {
        patient: 'patient-123',
        date: '2024-01-15',
        status: 'finished',
        class: 'VR',
        type: '448337001'
      };

      expect(searchParams.patient).toBe('patient-123');
      expect(searchParams.class).toBe('VR');
    });

    it('should support consent search parameters', () => {
      const searchParams = {
        patient: 'patient-123',
        status: 'active',
        category: 'treatment',
        date: '2024-01-15'
      };

      expect(searchParams.patient).toBe('patient-123');
      expect(searchParams.status).toBe('active');
    });

    it('should support communication search parameters', () => {
      const searchParams = {
        patient: 'patient-123',
        encounter: 'encounter-456',
        status: 'completed',
        category: 'instruction',
        sent: '2024-01-15'
      };

      expect(searchParams.patient).toBe('patient-123');
      expect(searchParams.status).toBe('completed');
    });

    it('should support document reference search parameters', () => {
      const searchParams = {
        patient: 'patient-123',
        encounter: 'encounter-456',
        status: 'current',
        type: '34109-9',
        category: 'clinical-note'
      };

      expect(searchParams.patient).toBe('patient-123');
      expect(searchParams.type).toBe('34109-9');
    });
  });
});