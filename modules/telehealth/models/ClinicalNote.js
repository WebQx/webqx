const { v4: uuidv4 } = require('uuid');

/**
 * FHIR R4 DocumentReference Resource Model for Clinical Notes
 * Compliant with FHIR specification: https://hl7.org/fhir/documentreference.html
 * Used for storing ambient documentation from telehealth sessions
 */
class ClinicalNote {
    constructor(data = {}) {
        this.resourceType = 'DocumentReference';
        this.id = data.id || uuidv4();
        this.meta = data.meta || {
            versionId: '1',
            lastUpdated: new Date().toISOString(),
            profile: ['http://hl7.org/fhir/StructureDefinition/DocumentReference']
        };
        
        // Required elements
        this.status = data.status || 'current';
        this.type = data.type || {
            coding: [{
                system: 'http://loinc.org',
                code: '11506-3',
                display: 'Provider-unspecified progress note'
            }]
        };
        this.category = data.category || [{
            coding: [{
                system: 'http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category',
                code: 'clinical-note',
                display: 'Clinical Note'
            }]
        }];
        this.subject = data.subject || undefined; // Reference to Patient
        this.date = data.date || new Date().toISOString();
        this.author = data.author || []; // Reference to Practitioner
        this.content = data.content || [];
        
        // Optional elements
        this.identifier = data.identifier || [];
        this.docStatus = data.docStatus || 'final';
        this.description = data.description || undefined;
        this.securityLabel = data.securityLabel || [];
        this.context = data.context || undefined;
        
        // WebQx extensions for telehealth
        this.extension = data.extension || [];
        
        // Add telehealth-specific extensions
        if (data.sessionId) {
            this.addTelehealthExtension('sessionId', data.sessionId);
        }
        if (data.transcriptionMetadata) {
            this.addTelehealthExtension('transcriptionMetadata', data.transcriptionMetadata);
        }
    }

    /**
     * Adds a telehealth-specific extension
     * @param {string} type - Extension type
     * @param {any} value - Extension value
     */
    addTelehealthExtension(type, value) {
        const baseUrl = 'http://webqx.health/fhir/extensions/telehealth';
        this.extension.push({
            url: `${baseUrl}/${type}`,
            valueString: typeof value === 'string' ? value : JSON.stringify(value)
        });
    }

    /**
     * Sets the clinical note content from transcription
     * @param {string} transcriptionText - Text from Whisper transcription
     * @param {Object} metadata - Transcription metadata (language, confidence, etc.)
     */
    setTranscriptionContent(transcriptionText, metadata = {}) {
        this.content = [{
            attachment: {
                contentType: 'text/plain',
                language: metadata.language || 'en',
                data: Buffer.from(transcriptionText, 'utf8').toString('base64'),
                title: 'Ambient Clinical Documentation',
                creation: new Date().toISOString()
            }
        }];
        
        // Add structured transcription metadata
        if (metadata) {
            this.addTelehealthExtension('transcriptionMetadata', {
                confidence: metadata.confidence,
                language: metadata.language,
                processingTime: metadata.processingTime,
                whisperModel: metadata.model,
                segments: metadata.segments || []
            });
        }
    }

    /**
     * Sets structured clinical content (diagnosis, plan, etc.)
     * @param {Object} structuredContent - Structured clinical data
     */
    setStructuredContent(structuredContent) {
        // Add structured content as additional attachment
        this.content.push({
            attachment: {
                contentType: 'application/fhir+json',
                data: Buffer.from(JSON.stringify(structuredContent), 'utf8').toString('base64'),
                title: 'Structured Clinical Data',
                creation: new Date().toISOString()
            }
        });
    }

    /**
     * Validates the ClinicalNote resource according to FHIR R4 specification
     * @returns {Object} Validation result with isValid boolean and errors array
     */
    validate() {
        const errors = [];
        
        // Resource type validation
        if (this.resourceType !== 'DocumentReference') {
            errors.push('Invalid resourceType. Must be "DocumentReference"');
        }
        
        // ID validation
        if (!this.id || typeof this.id !== 'string') {
            errors.push('DocumentReference ID is required and must be a string');
        }
        
        // Status validation
        const validStatuses = ['current', 'superseded', 'entered-in-error'];
        if (!validStatuses.includes(this.status)) {
            errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
        }
        
        // Subject validation (must reference a Patient)
        if (!this.subject || !this.subject.reference) {
            errors.push('Subject is required and must reference a Patient');
        }
        
        // Content validation
        if (!Array.isArray(this.content) || this.content.length === 0) {
            errors.push('At least one content attachment is required');
        } else {
            this.content.forEach((content, index) => {
                if (!content.attachment) {
                    errors.push(`Content[${index}] must have an attachment`);
                } else if (!content.attachment.contentType) {
                    errors.push(`Content[${index}] attachment must have a contentType`);
                }
            });
        }
        
        // Date validation
        if (this.date && !this.isValidDateTime(this.date)) {
            errors.push('Date must be a valid ISO 8601 datetime');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validates ISO 8601 datetime format
     * @param {string} dateTimeString 
     * @returns {boolean}
     */
    isValidDateTime(dateTimeString) {
        const date = new Date(dateTimeString);
        return date instanceof Date && !isNaN(date);
    }

    /**
     * Converts the ClinicalNote resource to a JSON representation
     * @returns {Object} FHIR-compliant DocumentReference resource JSON
     */
    toJSON() {
        const json = {
            resourceType: this.resourceType,
            id: this.id,
            meta: this.meta,
            status: this.status,
            type: this.type,
            category: this.category,
            subject: this.subject,
            date: this.date,
            content: this.content
        };
        
        // Only include non-empty arrays and defined values
        if (this.identifier.length > 0) json.identifier = this.identifier;
        if (this.docStatus) json.docStatus = this.docStatus;
        if (this.description) json.description = this.description;
        if (this.author.length > 0) json.author = this.author;
        if (this.securityLabel.length > 0) json.securityLabel = this.securityLabel;
        if (this.context) json.context = this.context;
        if (this.extension.length > 0) json.extension = this.extension;
        
        return json;
    }

    /**
     * Gets the primary transcription text content
     * @returns {string|null} Decoded transcription text
     */
    getTranscriptionText() {
        const textContent = this.content.find(c => 
            c.attachment?.contentType === 'text/plain' && 
            c.attachment?.title === 'Ambient Clinical Documentation'
        );
        
        if (textContent?.attachment?.data) {
            return Buffer.from(textContent.attachment.data, 'base64').toString('utf8');
        }
        
        return null;
    }

    /**
     * Gets transcription metadata from extensions
     * @returns {Object|null} Transcription metadata
     */
    getTranscriptionMetadata() {
        const metadataExtension = this.extension.find(ext => 
            ext.url.includes('/transcriptionMetadata')
        );
        
        if (metadataExtension?.valueString) {
            try {
                return JSON.parse(metadataExtension.valueString);
            } catch (e) {
                return null;
            }
        }
        
        return null;
    }

    /**
     * Updates the clinical note with new data
     * @param {Object} updateData - Data to update
     * @returns {ClinicalNote} Updated clinical note instance
     */
    update(updateData) {
        // Update meta information
        this.meta.versionId = String(parseInt(this.meta.versionId) + 1);
        this.meta.lastUpdated = new Date().toISOString();
        
        // Update fields
        Object.keys(updateData).forEach(key => {
            if (key !== 'id' && key !== 'resourceType' && key !== 'meta') {
                this[key] = updateData[key];
            }
        });
        
        return this;
    }

    /**
     * Creates a clinical note summary for listings
     * @returns {Object} Clinical note summary
     */
    getSummary() {
        const transcriptionText = this.getTranscriptionText();
        const preview = transcriptionText 
            ? (transcriptionText.length > 200 ? transcriptionText.substring(0, 200) + '...' : transcriptionText)
            : 'No transcription available';
            
        return {
            id: this.id,
            status: this.status,
            type: this.type.coding?.[0]?.display || 'Clinical Note',
            subject: this.subject?.reference,
            date: this.date,
            preview,
            lastUpdated: this.meta.lastUpdated
        };
    }

    /**
     * Factory method to create a ClinicalNote from FHIR JSON
     * @param {Object} fhirJson - FHIR DocumentReference resource JSON
     * @returns {ClinicalNote} ClinicalNote instance
     */
    static fromFHIR(fhirJson) {
        if (fhirJson.resourceType !== 'DocumentReference') {
            throw new Error('Invalid FHIR resource type. Expected DocumentReference.');
        }
        
        return new ClinicalNote(fhirJson);
    }

    /**
     * Factory method to create a ClinicalNote from Whisper transcription
     * @param {string} transcriptionText - Transcribed text
     * @param {Object} options - Configuration options
     * @returns {ClinicalNote} ClinicalNote instance
     */
    static fromTranscription(transcriptionText, options = {}) {
        const clinicalNote = new ClinicalNote({
            subject: { reference: `Patient/${options.patientId}` },
            author: options.authorId ? [{ reference: `Practitioner/${options.authorId}` }] : [],
            description: options.description || 'Ambient clinical documentation from telehealth session',
            sessionId: options.sessionId
        });
        
        clinicalNote.setTranscriptionContent(transcriptionText, options.transcriptionMetadata);
        
        return clinicalNote;
    }
}

module.exports = ClinicalNote;