const ClinicalNote = require('../models/ClinicalNote');

describe('ClinicalNote Model', () => {
  describe('Constructor and Basic Properties', () => {
    it('should create a ClinicalNote with default values', () => {
      const note = new ClinicalNote();
      
      expect(note.resourceType).toBe('DocumentReference');
      expect(note.id).toBeDefined();
      expect(note.status).toBe('current');
      expect(note.type.coding[0].code).toBe('11506-3');
      expect(note.category[0].coding[0].code).toBe('clinical-note');
    });

    it('should create a ClinicalNote with custom data', () => {
      const customData = {
        id: 'test-note-123',
        status: 'superseded',
        subject: { reference: 'Patient/test-patient' },
        description: 'Test clinical note'
      };

      const note = new ClinicalNote(customData);
      
      expect(note.id).toBe('test-note-123');
      expect(note.status).toBe('superseded');
      expect(note.subject.reference).toBe('Patient/test-patient');
      expect(note.description).toBe('Test clinical note');
    });
  });

  describe('Transcription Content Management', () => {
    it('should set transcription content correctly', () => {
      const note = new ClinicalNote();
      const transcriptionText = 'Patient presents with chest pain. Physical examination reveals...';
      const metadata = {
        confidence: 0.95,
        language: 'en',
        processingTime: 1500,
        model: 'whisper-1'
      };

      note.setTranscriptionContent(transcriptionText, metadata);

      expect(note.content).toHaveLength(1);
      expect(note.content[0].attachment.contentType).toBe('text/plain');
      expect(note.content[0].attachment.language).toBe('en');
      expect(note.content[0].attachment.title).toBe('Ambient Clinical Documentation');
      
      // Check if transcription text can be retrieved
      const retrievedText = note.getTranscriptionText();
      expect(retrievedText).toBe(transcriptionText);
    });

    it('should retrieve transcription metadata', () => {
      const note = new ClinicalNote();
      const metadata = {
        confidence: 0.88,
        language: 'es',
        processingTime: 2000,
        model: 'whisper-1',
        segments: [{ start: 0, end: 5, text: 'Hello' }]
      };

      note.setTranscriptionContent('Test text', metadata);
      
      const retrievedMetadata = note.getTranscriptionMetadata();
      expect(retrievedMetadata).toBeDefined();
      expect(retrievedMetadata.confidence).toBe(0.88);
      expect(retrievedMetadata.language).toBe('es');
      expect(retrievedMetadata.segments).toHaveLength(1);
    });
  });

  describe('Structured Content Management', () => {
    it('should add structured clinical content', () => {
      const note = new ClinicalNote();
      const structuredContent = {
        symptoms: ['chest pain', 'shortness of breath'],
        diagnosis: 'Acute myocardial infarction',
        medications: ['aspirin', 'metoprolol']
      };

      note.setStructuredContent(structuredContent);

      expect(note.content).toHaveLength(1);
      expect(note.content[0].attachment.contentType).toBe('application/fhir+json');
      expect(note.content[0].attachment.title).toBe('Structured Clinical Data');
    });
  });

  describe('Validation', () => {
    it('should validate a correct ClinicalNote', () => {
      const note = new ClinicalNote({
        subject: { reference: 'Patient/test-patient' },
        author: [{ reference: 'Practitioner/test-provider' }]
      });
      note.setTranscriptionContent('Valid transcription text');

      const validation = note.validate();
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should fail validation without subject', () => {
      const note = new ClinicalNote();
      note.setTranscriptionContent('Test text');

      const validation = note.validate();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Subject is required and must reference a Patient');
    });

    it('should fail validation without content', () => {
      const note = new ClinicalNote({
        subject: { reference: 'Patient/test-patient' }
      });

      const validation = note.validate();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('At least one content attachment is required');
    });

    it('should fail validation with invalid status', () => {
      const note = new ClinicalNote({
        status: 'invalid-status',
        subject: { reference: 'Patient/test-patient' }
      });
      note.setTranscriptionContent('Test text');

      const validation = note.validate();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Status must be one of: current, superseded, entered-in-error');
    });
  });

  describe('Factory Methods', () => {
    it('should create ClinicalNote from transcription', () => {
      const transcriptionText = 'Patient consultation notes...';
      const options = {
        patientId: 'patient-123',
        authorId: 'provider-456',
        sessionId: 'session-789',
        transcriptionMetadata: {
          confidence: 0.92,
          language: 'en'
        }
      };

      const note = ClinicalNote.fromTranscription(transcriptionText, options);

      expect(note.subject.reference).toBe('Patient/patient-123');
      expect(note.author[0].reference).toBe('Practitioner/provider-456');
      expect(note.getTranscriptionText()).toBe(transcriptionText);
      
      // Check for telehealth extensions
      const sessionExtension = note.extension.find(ext => 
        ext.url.includes('/sessionId')
      );
      expect(sessionExtension).toBeDefined();
      expect(sessionExtension.valueString).toBe('session-789');
    });

    it('should create ClinicalNote from FHIR JSON', () => {
      const fhirJson = {
        resourceType: 'DocumentReference',
        id: 'test-note',
        status: 'current',
        type: {
          coding: [{
            system: 'http://loinc.org',
            code: '11506-3',
            display: 'Provider-unspecified progress note'
          }]
        },
        category: [{
          coding: [{
            system: 'http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category',
            code: 'clinical-note',
            display: 'Clinical Note'
          }]
        }],
        subject: { reference: 'Patient/test-patient' },
        date: '2023-12-01T10:00:00Z',
        content: [{
          attachment: {
            contentType: 'text/plain',
            data: Buffer.from('Test content', 'utf8').toString('base64'),
            title: 'Ambient Clinical Documentation'
          }
        }]
      };

      const note = ClinicalNote.fromFHIR(fhirJson);

      expect(note.id).toBe('test-note');
      expect(note.subject.reference).toBe('Patient/test-patient');
      expect(note.getTranscriptionText()).toBe('Test content');
    });

    it('should throw error for invalid FHIR resource type', () => {
      const invalidFhir = {
        resourceType: 'Patient',
        id: 'test'
      };

      expect(() => {
        ClinicalNote.fromFHIR(invalidFhir);
      }).toThrow('Invalid FHIR resource type. Expected DocumentReference.');
    });
  });

  describe('Telehealth Extensions', () => {
    it('should add telehealth extensions correctly', () => {
      const note = new ClinicalNote();
      
      note.addTelehealthExtension('sessionId', 'session-123');
      note.addTelehealthExtension('customData', { key: 'value' });

      expect(note.extension).toHaveLength(2);
      
      const sessionExt = note.extension.find(ext => ext.url.includes('/sessionId'));
      expect(sessionExt.valueString).toBe('session-123');
      
      const customExt = note.extension.find(ext => ext.url.includes('/customData'));
      expect(customExt.valueString).toBe('{"key":"value"}');
    });
  });

  describe('Summary and JSON Conversion', () => {
    it('should create a proper summary', () => {
      const note = new ClinicalNote({
        subject: { reference: 'Patient/test-patient' }
      });
      // Create a text that's longer than 200 characters
      const longText = 'This is a long transcription text that should be truncated in the summary because it exceeds the character limit and we need to test the preview functionality. This text continues to exceed the two hundred character limit for testing purposes.';
      note.setTranscriptionContent(longText);

      const summary = note.getSummary();

      expect(summary.id).toBe(note.id);
      expect(summary.status).toBe('current');
      expect(summary.subject).toBe('Patient/test-patient');
      expect(summary.preview).toContain('This is a long transcription text');
      expect(summary.preview).toContain('...');
      expect(summary.preview.length).toBeLessThanOrEqual(203); // 200 chars + "..."
    });

    it('should convert to JSON correctly', () => {
      const note = new ClinicalNote({
        subject: { reference: 'Patient/test-patient' },
        description: 'Test note'
      });
      note.setTranscriptionContent('Test transcription');

      const json = note.toJSON();

      expect(json.resourceType).toBe('DocumentReference');
      expect(json.subject.reference).toBe('Patient/test-patient');
      expect(json.description).toBe('Test note');
      expect(json.content).toHaveLength(1);
      expect(json.meta).toBeDefined();
    });
  });

  describe('Update Functionality', () => {
    it('should update clinical note and increment version', () => {
      const note = new ClinicalNote();
      const originalVersion = note.meta.versionId;
      const originalLastUpdated = note.meta.lastUpdated;

      // Wait a bit to ensure different timestamps
      setTimeout(() => {
        note.update({
          description: 'Updated description',
          status: 'superseded'
        });

        expect(note.description).toBe('Updated description');
        expect(note.status).toBe('superseded');
        expect(note.meta.versionId).toBe(String(parseInt(originalVersion) + 1));
        expect(note.meta.lastUpdated).not.toBe(originalLastUpdated);
      }, 10);
    });

    it('should not update protected fields', () => {
      const note = new ClinicalNote({ id: 'original-id' });
      const originalId = note.id;
      const originalResourceType = note.resourceType;

      note.update({
        id: 'new-id',
        resourceType: 'Patient',
        description: 'Updated description'
      });

      expect(note.id).toBe(originalId);
      expect(note.resourceType).toBe(originalResourceType);
      expect(note.description).toBe('Updated description');
    });
  });
});