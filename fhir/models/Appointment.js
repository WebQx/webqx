const { v4: uuidv4 } = require('uuid');

/**
 * FHIR R4 Appointment Resource Model
 * Compliant with FHIR specification: https://hl7.org/fhir/appointment.html
 */
class Appointment {
    constructor(data = {}) {
        this.resourceType = 'Appointment';
        this.id = data.id || uuidv4();
        this.meta = data.meta || {
            versionId: '1',
            lastUpdated: new Date().toISOString(),
            profile: ['http://hl7.org/fhir/StructureDefinition/Appointment']
        };
        
        // Required elements
        this.status = data.status || 'proposed';
        this.participant = data.participant || [];
        
        // Optional elements
        this.identifier = data.identifier || [];
        this.serviceCategory = data.serviceCategory || [];
        this.serviceType = data.serviceType || [];
        this.specialty = data.specialty || [];
        this.appointmentType = data.appointmentType || undefined;
        this.reasonCode = data.reasonCode || [];
        this.reasonReference = data.reasonReference || [];
        this.priority = data.priority || undefined;
        this.description = data.description || undefined;
        this.supportingInformation = data.supportingInformation || [];
        this.start = data.start || undefined;
        this.end = data.end || undefined;
        this.minutesDuration = data.minutesDuration || undefined;
        this.slot = data.slot || [];
        this.created = data.created || new Date().toISOString();
        this.comment = data.comment || undefined;
        this.patientInstruction = data.patientInstruction || undefined;
        this.basedOn = data.basedOn || [];
        this.cancelationReason = data.cancelationReason || undefined;
        
        // WebQx extensions for enhanced functionality
        this.extension = data.extension || [];
    }

    /**
     * Validates the Appointment resource according to FHIR R4 specification
     * @returns {Object} Validation result with isValid boolean and errors array
     */
    validate() {
        const errors = [];
        
        // Resource type validation
        if (this.resourceType !== 'Appointment') {
            errors.push('Invalid resourceType. Must be "Appointment"');
        }
        
        // ID validation
        if (!this.id || typeof this.id !== 'string') {
            errors.push('Appointment ID is required and must be a string');
        }
        
        // Status validation
        const validStatuses = ['proposed', 'pending', 'booked', 'arrived', 'fulfilled', 'cancelled', 'noshow', 'entered-in-error', 'checked-in', 'waitlist'];
        if (!this.status || !validStatuses.includes(this.status)) {
            errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
        }
        
        // Participant validation
        if (!Array.isArray(this.participant) || this.participant.length === 0) {
            errors.push('At least one participant is required');
        } else {
            this.participant.forEach((participant, index) => {
                if (!participant.actor && !participant.type) {
                    errors.push(`Participant[${index}] must have either actor or type`);
                }
                if (participant.status && !['accepted', 'declined', 'tentative', 'needs-action'].includes(participant.status)) {
                    errors.push(`Participant[${index}] status must be one of: accepted, declined, tentative, needs-action`);
                }
            });
        }
        
        // Date validation
        if (this.start && !this.isValidDateTime(this.start)) {
            errors.push('Start time must be a valid ISO 8601 datetime');
        }
        
        if (this.end && !this.isValidDateTime(this.end)) {
            errors.push('End time must be a valid ISO 8601 datetime');
        }
        
        // Start/End time logic validation
        if (this.start && this.end) {
            const startTime = new Date(this.start);
            const endTime = new Date(this.end);
            if (startTime >= endTime) {
                errors.push('End time must be after start time');
            }
        }
        
        // Duration validation
        if (this.minutesDuration !== undefined && (isNaN(this.minutesDuration) || this.minutesDuration <= 0)) {
            errors.push('Minutes duration must be a positive number');
        }
        
        // Priority validation
        if (this.priority !== undefined && (isNaN(this.priority) || this.priority < 0)) {
            errors.push('Priority must be a non-negative number');
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
     * Converts the Appointment resource to a JSON representation
     * @returns {Object} FHIR-compliant Appointment resource JSON
     */
    toJSON() {
        const json = {
            resourceType: this.resourceType,
            id: this.id,
            meta: this.meta,
            status: this.status,
            participant: this.participant
        };
        
        // Only include non-empty arrays and defined values
        if (this.identifier.length > 0) json.identifier = this.identifier;
        if (this.serviceCategory.length > 0) json.serviceCategory = this.serviceCategory;
        if (this.serviceType.length > 0) json.serviceType = this.serviceType;
        if (this.specialty.length > 0) json.specialty = this.specialty;
        if (this.appointmentType) json.appointmentType = this.appointmentType;
        if (this.reasonCode.length > 0) json.reasonCode = this.reasonCode;
        if (this.reasonReference.length > 0) json.reasonReference = this.reasonReference;
        if (this.priority !== undefined) json.priority = this.priority;
        if (this.description) json.description = this.description;
        if (this.supportingInformation.length > 0) json.supportingInformation = this.supportingInformation;
        if (this.start) json.start = this.start;
        if (this.end) json.end = this.end;
        if (this.minutesDuration !== undefined) json.minutesDuration = this.minutesDuration;
        if (this.slot.length > 0) json.slot = this.slot;
        if (this.created) json.created = this.created;
        if (this.comment) json.comment = this.comment;
        if (this.patientInstruction) json.patientInstruction = this.patientInstruction;
        if (this.basedOn.length > 0) json.basedOn = this.basedOn;
        if (this.cancelationReason) json.cancelationReason = this.cancelationReason;
        if (this.extension.length > 0) json.extension = this.extension;
        
        return json;
    }

    /**
     * Updates the appointment with new data
     * @param {Object} updateData - Data to update
     * @returns {Appointment} Updated appointment instance
     */
    update(updateData) {
        // Update meta information
        this.meta.versionId = String(parseInt(this.meta.versionId) + 1);
        this.meta.lastUpdated = new Date().toISOString();
        
        // Update fields
        Object.keys(updateData).forEach(key => {
            if (key !== 'id' && key !== 'resourceType' && key !== 'meta' && key !== 'created') {
                this[key] = updateData[key];
            }
        });
        
        return this;
    }

    /**
     * Creates an appointment summary for listings
     * @returns {Object} Appointment summary
     */
    getSummary() {
        const patientParticipant = this.participant.find(p => 
            p.actor && p.actor.reference && p.actor.reference.startsWith('Patient/')
        );
        
        const practitionerParticipant = this.participant.find(p => 
            p.actor && p.actor.reference && p.actor.reference.startsWith('Practitioner/')
        );
        
        return {
            id: this.id,
            status: this.status,
            start: this.start,
            end: this.end,
            duration: this.minutesDuration,
            description: this.description,
            patient: patientParticipant?.actor?.display || patientParticipant?.actor?.reference,
            practitioner: practitionerParticipant?.actor?.display || practitionerParticipant?.actor?.reference,
            serviceType: this.serviceType[0]?.text || this.serviceType[0]?.coding?.[0]?.display,
            lastUpdated: this.meta.lastUpdated
        };
    }

    /**
     * Checks if appointment is in the future
     * @returns {boolean}
     */
    isFuture() {
        if (!this.start) return false;
        return new Date(this.start) > new Date();
    }

    /**
     * Checks if appointment is today
     * @returns {boolean}
     */
    isToday() {
        if (!this.start) return false;
        const today = new Date().toDateString();
        const appointmentDate = new Date(this.start).toDateString();
        return today === appointmentDate;
    }

    /**
     * Calculates appointment duration in minutes
     * @returns {number|null} Duration in minutes or null if cannot calculate
     */
    calculateDuration() {
        if (this.minutesDuration !== undefined) {
            return this.minutesDuration;
        }
        
        if (this.start && this.end) {
            const startTime = new Date(this.start);
            const endTime = new Date(this.end);
            return Math.round((endTime - startTime) / (1000 * 60));
        }
        
        return null;
    }

    /**
     * Updates appointment status
     * @param {string} newStatus - New status
     * @param {string} reason - Reason for status change
     * @returns {Appointment} Updated appointment
     */
    updateStatus(newStatus, reason = undefined) {
        const validStatuses = ['proposed', 'pending', 'booked', 'arrived', 'fulfilled', 'cancelled', 'noshow', 'entered-in-error', 'checked-in', 'waitlist'];
        
        if (!validStatuses.includes(newStatus)) {
            throw new Error(`Invalid status: ${newStatus}`);
        }
        
        this.status = newStatus;
        
        if (newStatus === 'cancelled' && reason) {
            this.cancelationReason = {
                coding: [{
                    system: 'http://terminology.hl7.org/CodeSystem/appointment-cancellation-reason',
                    code: 'other',
                    display: reason
                }]
            };
        }
        
        // Update meta
        this.meta.versionId = String(parseInt(this.meta.versionId) + 1);
        this.meta.lastUpdated = new Date().toISOString();
        
        return this;
    }

    /**
     * Factory method to create an Appointment from FHIR JSON
     * @param {Object} fhirJson - FHIR Appointment resource JSON
     * @returns {Appointment} Appointment instance
     */
    static fromFHIR(fhirJson) {
        if (fhirJson.resourceType !== 'Appointment') {
            throw new Error('Invalid FHIR resource type. Expected Appointment.');
        }
        
        return new Appointment(fhirJson);
    }

    /**
     * Creates a basic appointment structure
     * @param {Object} params - Basic appointment parameters
     * @returns {Appointment} New appointment instance
     */
    static createBasic({ patientId, practitionerId, start, end, serviceType, description }) {
        const appointment = new Appointment({
            status: 'proposed',
            start,
            end,
            description,
            serviceType: serviceType ? [{
                text: serviceType
            }] : [],
            participant: []
        });
        
        if (patientId) {
            appointment.participant.push({
                actor: {
                    reference: `Patient/${patientId}`,
                    display: 'Patient'
                },
                required: 'required',
                status: 'needs-action'
            });
        }
        
        if (practitionerId) {
            appointment.participant.push({
                actor: {
                    reference: `Practitioner/${practitionerId}`,
                    display: 'Healthcare Provider'
                },
                required: 'required',
                status: 'accepted'
            });
        }
        
        return appointment;
    }
}

module.exports = Appointment;