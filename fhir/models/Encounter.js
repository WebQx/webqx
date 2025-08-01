const { v4: uuidv4 } = require('uuid');

/**
 * FHIR R4 Encounter Resource Model
 * Compliant with FHIR specification: https://hl7.org/fhir/encounter.html
 */
class Encounter {
    constructor(data = {}) {
        this.resourceType = 'Encounter';
        this.id = data.id || uuidv4();
        this.meta = data.meta || {
            versionId: '1',
            lastUpdated: new Date().toISOString(),
            profile: ['http://hl7.org/fhir/StructureDefinition/Encounter']
        };
        
        // Required elements
        this.status = data.status || 'planned';
        this.class = data.class || {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
            code: 'VR', // Virtual (telehealth)
            display: 'Virtual'
        };
        
        // Optional elements
        this.identifier = data.identifier || [];
        this.statusHistory = data.statusHistory || [];
        this.classHistory = data.classHistory || [];
        this.type = data.type || [];
        this.serviceType = data.serviceType || undefined;
        this.priority = data.priority || undefined;
        this.subject = data.subject || undefined; // Patient reference
        this.episodeOfCare = data.episodeOfCare || [];
        this.basedOn = data.basedOn || [];
        this.participant = data.participant || [];
        this.appointment = data.appointment || [];
        this.period = data.period || {};
        this.length = data.length || undefined;
        this.reasonCode = data.reasonCode || [];
        this.reasonReference = data.reasonReference || [];
        this.diagnosis = data.diagnosis || [];
        this.account = data.account || [];
        this.hospitalization = data.hospitalization || undefined;
        this.location = data.location || [];
        this.serviceProvider = data.serviceProvider || undefined;
        this.partOf = data.partOf || undefined;
        
        // Extensions for telehealth functionality
        this.extension = data.extension || [];
        this.addTelehealthExtensions();
    }

    /**
     * Add telehealth-specific extensions
     */
    addTelehealthExtensions() {
        // Add telehealth session extension if not already present
        const telehealthExtension = this.extension.find(ext => 
            ext.url === 'http://webqx.org/fhir/StructureDefinition/telehealth-session'
        );
        
        if (!telehealthExtension) {
            this.extension.push({
                url: 'http://webqx.org/fhir/StructureDefinition/telehealth-session',
                extension: [
                    {
                        url: 'sessionStatus',
                        valueString: 'pending'
                    },
                    {
                        url: 'sessionType',
                        valueString: 'video-call'
                    },
                    {
                        url: 'platformProvider',
                        valueString: 'webqx-telehealth'
                    }
                ]
            });
        }
    }

    /**
     * Validates the Encounter resource according to FHIR R4 specification
     * @returns {Object} Validation result with isValid boolean and errors array
     */
    validate() {
        const errors = [];
        
        // Resource type validation
        if (this.resourceType !== 'Encounter') {
            errors.push('Invalid resourceType. Must be "Encounter"');
        }
        
        // ID validation
        if (!this.id || typeof this.id !== 'string') {
            errors.push('Encounter ID is required and must be a string');
        }
        
        // Status validation
        const validStatuses = ['planned', 'arrived', 'triaged', 'in-progress', 'onleave', 'finished', 'cancelled', 'entered-in-error', 'unknown'];
        if (!this.status || !validStatuses.includes(this.status)) {
            errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
        }
        
        // Class validation
        if (!this.class || !this.class.system || !this.class.code) {
            errors.push('Encounter class is required with system and code');
        }
        
        // Subject validation (patient reference)
        if (this.subject && (!this.subject.reference || !this.subject.reference.startsWith('Patient/'))) {
            errors.push('Subject must be a valid Patient reference');
        }
        
        // Period validation
        if (this.period) {
            if (this.period.start && !this.isValidDateTime(this.period.start)) {
                errors.push('Period start must be a valid ISO 8601 datetime');
            }
            if (this.period.end && !this.isValidDateTime(this.period.end)) {
                errors.push('Period end must be a valid ISO 8601 datetime');
            }
            if (this.period.start && this.period.end) {
                if (new Date(this.period.start) >= new Date(this.period.end)) {
                    errors.push('Period end must be after period start');
                }
            }
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
        try {
            const date = new Date(dateTimeString);
            return date instanceof Date && !isNaN(date) && dateTimeString.includes('T');
        } catch {
            return false;
        }
    }

    /**
     * Start the encounter (change status to in-progress)
     * @returns {Encounter} Updated encounter
     */
    start() {
        this.status = 'in-progress';
        this.period.start = new Date().toISOString();
        
        // Update telehealth session status
        const telehealthExt = this.extension.find(ext => 
            ext.url === 'http://webqx.org/fhir/StructureDefinition/telehealth-session'
        );
        if (telehealthExt) {
            const sessionStatus = telehealthExt.extension.find(ext => ext.url === 'sessionStatus');
            if (sessionStatus) {
                sessionStatus.valueString = 'active';
            }
        }
        
        this.updateMeta();
        return this;
    }

    /**
     * End the encounter (change status to finished)
     * @returns {Encounter} Updated encounter
     */
    end() {
        this.status = 'finished';
        this.period.end = new Date().toISOString();
        
        // Update telehealth session status
        const telehealthExt = this.extension.find(ext => 
            ext.url === 'http://webqx.org/fhir/StructureDefinition/telehealth-session'
        );
        if (telehealthExt) {
            const sessionStatus = telehealthExt.extension.find(ext => ext.url === 'sessionStatus');
            if (sessionStatus) {
                sessionStatus.valueString = 'completed';
            }
        }
        
        this.updateMeta();
        return this;
    }

    /**
     * Cancel the encounter
     * @param {string} reason - Cancellation reason
     * @returns {Encounter} Updated encounter
     */
    cancel(reason = undefined) {
        this.status = 'cancelled';
        
        if (reason) {
            this.statusHistory.push({
                status: 'cancelled',
                period: {
                    start: new Date().toISOString()
                },
                reason: {
                    text: reason
                }
            });
        }
        
        // Update telehealth session status
        const telehealthExt = this.extension.find(ext => 
            ext.url === 'http://webqx.org/fhir/StructureDefinition/telehealth-session'
        );
        if (telehealthExt) {
            const sessionStatus = telehealthExt.extension.find(ext => ext.url === 'sessionStatus');
            if (sessionStatus) {
                sessionStatus.valueString = 'cancelled';
            }
        }
        
        this.updateMeta();
        return this;
    }

    /**
     * Add a participant to the encounter
     * @param {Object} participant - Participant data
     * @returns {Encounter} Updated encounter
     */
    addParticipant(participant) {
        if (!participant.individual || !participant.individual.reference) {
            throw new Error('Participant must have an individual reference');
        }
        
        this.participant.push({
            type: participant.type || [{
                coding: [{
                    system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
                    code: 'PPRF',
                    display: 'primary performer'
                }]
            }],
            period: participant.period || {
                start: new Date().toISOString()
            },
            individual: participant.individual
        });
        
        this.updateMeta();
        return this;
    }

    /**
     * Set telehealth session URL
     * @param {string} sessionUrl - Telehealth session URL
     * @returns {Encounter} Updated encounter
     */
    setTelehealthUrl(sessionUrl) {
        const telehealthExt = this.extension.find(ext => 
            ext.url === 'http://webqx.org/fhir/StructureDefinition/telehealth-session'
        );
        
        if (telehealthExt) {
            // Remove existing session URL if present
            telehealthExt.extension = telehealthExt.extension.filter(ext => ext.url !== 'sessionUrl');
            
            // Add new session URL
            telehealthExt.extension.push({
                url: 'sessionUrl',
                valueUrl: sessionUrl
            });
        }
        
        this.updateMeta();
        return this;
    }

    /**
     * Get telehealth session information
     * @returns {Object|null} Telehealth session data
     */
    getTelehealthSession() {
        const telehealthExt = this.extension.find(ext => 
            ext.url === 'http://webqx.org/fhir/StructureDefinition/telehealth-session'
        );
        
        if (!telehealthExt) return null;
        
        const session = {};
        telehealthExt.extension.forEach(ext => {
            switch (ext.url) {
                case 'sessionStatus':
                    session.status = ext.valueString;
                    break;
                case 'sessionType':
                    session.type = ext.valueString;
                    break;
                case 'sessionUrl':
                    session.url = ext.valueUrl;
                    break;
                case 'platformProvider':
                    session.platform = ext.valueString;
                    break;
            }
        });
        
        return session;
    }

    /**
     * Update meta information
     */
    updateMeta() {
        this.meta.versionId = String(parseInt(this.meta.versionId) + 1);
        this.meta.lastUpdated = new Date().toISOString();
    }

    /**
     * Convert to JSON representation
     * @returns {Object} FHIR-compliant Encounter resource JSON
     */
    toJSON() {
        const json = {
            resourceType: this.resourceType,
            id: this.id,
            meta: this.meta,
            status: this.status,
            class: this.class
        };
        
        // Include optional elements if present
        if (this.identifier.length > 0) json.identifier = this.identifier;
        if (this.statusHistory.length > 0) json.statusHistory = this.statusHistory;
        if (this.classHistory.length > 0) json.classHistory = this.classHistory;
        if (this.type.length > 0) json.type = this.type;
        if (this.serviceType) json.serviceType = this.serviceType;
        if (this.priority) json.priority = this.priority;
        if (this.subject) json.subject = this.subject;
        if (this.episodeOfCare.length > 0) json.episodeOfCare = this.episodeOfCare;
        if (this.basedOn.length > 0) json.basedOn = this.basedOn;
        if (this.participant.length > 0) json.participant = this.participant;
        if (this.appointment.length > 0) json.appointment = this.appointment;
        if (Object.keys(this.period).length > 0) json.period = this.period;
        if (this.length) json.length = this.length;
        if (this.reasonCode.length > 0) json.reasonCode = this.reasonCode;
        if (this.reasonReference.length > 0) json.reasonReference = this.reasonReference;
        if (this.diagnosis.length > 0) json.diagnosis = this.diagnosis;
        if (this.account.length > 0) json.account = this.account;
        if (this.hospitalization) json.hospitalization = this.hospitalization;
        if (this.location.length > 0) json.location = this.location;
        if (this.serviceProvider) json.serviceProvider = this.serviceProvider;
        if (this.partOf) json.partOf = this.partOf;
        if (this.extension.length > 0) json.extension = this.extension;
        
        return json;
    }

    /**
     * Factory method to create Encounter from FHIR JSON
     * @param {Object} fhirJson - FHIR Encounter resource JSON
     * @returns {Encounter} Encounter instance
     */
    static fromFHIR(fhirJson) {
        if (fhirJson.resourceType !== 'Encounter') {
            throw new Error('Invalid FHIR resource type. Expected Encounter.');
        }
        
        return new Encounter(fhirJson);
    }

    /**
     * Create telehealth encounter
     * @param {Object} params - Telehealth encounter parameters
     * @returns {Encounter} New telehealth encounter
     */
    static createTelehealth({ patientId, practitionerId, appointmentId, reasonCode, serviceType }) {
        const encounter = new Encounter({
            status: 'planned',
            class: {
                system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
                code: 'VR',
                display: 'Virtual'
            },
            subject: patientId ? {
                reference: `Patient/${patientId}`,
                display: 'Patient'
            } : undefined,
            participant: [],
            appointment: appointmentId ? [{
                reference: `Appointment/${appointmentId}`
            }] : [],
            type: [{
                coding: [{
                    system: 'http://snomed.info/sct',
                    code: '185317003',
                    display: 'Telehealth consultation'
                }]
            }],
            serviceType: serviceType || {
                coding: [{
                    system: 'http://terminology.hl7.org/CodeSystem/service-type',
                    code: '124',
                    display: 'General Practice'
                }]
            },
            reasonCode: reasonCode ? [reasonCode] : []
        });
        
        // Add practitioner as participant
        if (practitionerId) {
            encounter.addParticipant({
                type: [{
                    coding: [{
                        system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
                        code: 'PPRF',
                        display: 'primary performer'
                    }]
                }],
                individual: {
                    reference: `Practitioner/${practitionerId}`,
                    display: 'Healthcare Provider'
                }
            });
        }
        
        return encounter;
    }
}

module.exports = Encounter;