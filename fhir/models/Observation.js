const { v4: uuidv4 } = require('uuid');

/**
 * FHIR R4 Observation Resource Model
 * Compliant with FHIR specification: https://hl7.org/fhir/observation.html
 */
class Observation {
    constructor(data = {}) {
        this.resourceType = 'Observation';
        this.id = data.id || uuidv4();
        this.meta = data.meta || {
            versionId: '1',
            lastUpdated: new Date().toISOString(),
            profile: ['http://hl7.org/fhir/StructureDefinition/Observation']
        };
        
        // Required elements
        this.status = data.status || 'final'; // final | preliminary | cancelled | entered-in-error
        this.category = data.category || [];
        this.code = data.code || {};
        this.subject = data.subject || {};
        
        // Optional elements
        this.encounter = data.encounter || undefined;
        this.effectiveDateTime = data.effectiveDateTime || undefined;
        this.effectivePeriod = data.effectivePeriod || undefined;
        this.issued = data.issued || undefined;
        this.performer = data.performer || [];
        this.valueQuantity = data.valueQuantity || undefined;
        this.valueCodeableConcept = data.valueCodeableConcept || undefined;
        this.valueString = data.valueString || undefined;
        this.valueBoolean = data.valueBoolean || undefined;
        this.valueInteger = data.valueInteger || undefined;
        this.valueRange = data.valueRange || undefined;
        this.valueRatio = data.valueRatio || undefined;
        this.valueSampledData = data.valueSampledData || undefined;
        this.valueTime = data.valueTime || undefined;
        this.valueDateTime = data.valueDateTime || undefined;
        this.valuePeriod = data.valuePeriod || undefined;
        this.dataAbsentReason = data.dataAbsentReason || undefined;
        this.interpretation = data.interpretation || [];
        this.note = data.note || [];
        this.bodySite = data.bodySite || undefined;
        this.method = data.method || undefined;
        this.specimen = data.specimen || undefined;
        this.device = data.device || undefined;
        this.referenceRange = data.referenceRange || [];
        this.hasMember = data.hasMember || [];
        this.derivedFrom = data.derivedFrom || [];
        this.component = data.component || [];
        
        // WebQx extensions for enhanced functionality
        this.extension = data.extension || [];
    }

    /**
     * Validates the Observation resource according to FHIR R4 specification
     * @returns {Object} Validation result with isValid boolean and errors array
     */
    validate() {
        const errors = [];
        
        // Resource type validation
        if (this.resourceType !== 'Observation') {
            errors.push('Invalid resourceType. Must be "Observation"');
        }
        
        // ID validation
        if (!this.id || typeof this.id !== 'string') {
            errors.push('Observation ID is required and must be a string');
        }
        
        // Status validation
        const validStatuses = ['registered', 'preliminary', 'final', 'amended', 'corrected', 'cancelled', 'entered-in-error', 'unknown'];
        if (!this.status || !validStatuses.includes(this.status)) {
            errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
        }
        
        // Code validation - must be present
        if (!this.code || !this.code.coding || !Array.isArray(this.code.coding) || this.code.coding.length === 0) {
            errors.push('Observation code is required and must contain at least one coding');
        }
        
        // Subject validation - must be present
        if (!this.subject || !this.subject.reference) {
            errors.push('Subject is required and must contain a reference');
        }
        
        // Value validation - at least one value or dataAbsentReason
        const hasValue = this.valueQuantity || this.valueCodeableConcept || this.valueString || 
                         this.valueBoolean !== undefined || this.valueInteger !== undefined || 
                         this.valueRange || this.valueRatio || this.valueSampledData || 
                         this.valueTime || this.valueDateTime || this.valuePeriod || 
                         (this.component && this.component.length > 0);
        
        if (!hasValue && !this.dataAbsentReason) {
            errors.push('Observation must have either a value or dataAbsentReason');
        }
        
        // Effective date validation
        if (this.effectiveDateTime && !this.isValidDateTime(this.effectiveDateTime)) {
            errors.push('effectiveDateTime must be a valid ISO 8601 datetime');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validates datetime format (ISO 8601)
     * @param {string} dateTimeString 
     * @returns {boolean}
     */
    isValidDateTime(dateTimeString) {
        try {
            const date = new Date(dateTimeString);
            return date instanceof Date && !isNaN(date) && date.toISOString() === dateTimeString;
        } catch {
            return false;
        }
    }

    /**
     * Converts the Observation resource to a JSON representation
     * @returns {Object} FHIR-compliant Observation resource JSON
     */
    toJSON() {
        const json = {
            resourceType: this.resourceType,
            id: this.id,
            meta: this.meta,
            status: this.status,
            code: this.code,
            subject: this.subject
        };
        
        // Only include non-empty arrays and defined values
        if (this.category.length > 0) json.category = this.category;
        if (this.encounter) json.encounter = this.encounter;
        if (this.effectiveDateTime) json.effectiveDateTime = this.effectiveDateTime;
        if (this.effectivePeriod) json.effectivePeriod = this.effectivePeriod;
        if (this.issued) json.issued = this.issued;
        if (this.performer.length > 0) json.performer = this.performer;
        if (this.valueQuantity) json.valueQuantity = this.valueQuantity;
        if (this.valueCodeableConcept) json.valueCodeableConcept = this.valueCodeableConcept;
        if (this.valueString) json.valueString = this.valueString;
        if (this.valueBoolean !== undefined) json.valueBoolean = this.valueBoolean;
        if (this.valueInteger !== undefined) json.valueInteger = this.valueInteger;
        if (this.valueRange) json.valueRange = this.valueRange;
        if (this.valueRatio) json.valueRatio = this.valueRatio;
        if (this.valueSampledData) json.valueSampledData = this.valueSampledData;
        if (this.valueTime) json.valueTime = this.valueTime;
        if (this.valueDateTime) json.valueDateTime = this.valueDateTime;
        if (this.valuePeriod) json.valuePeriod = this.valuePeriod;
        if (this.dataAbsentReason) json.dataAbsentReason = this.dataAbsentReason;
        if (this.interpretation.length > 0) json.interpretation = this.interpretation;
        if (this.note.length > 0) json.note = this.note;
        if (this.bodySite) json.bodySite = this.bodySite;
        if (this.method) json.method = this.method;
        if (this.specimen) json.specimen = this.specimen;
        if (this.device) json.device = this.device;
        if (this.referenceRange.length > 0) json.referenceRange = this.referenceRange;
        if (this.hasMember.length > 0) json.hasMember = this.hasMember;
        if (this.derivedFrom.length > 0) json.derivedFrom = this.derivedFrom;
        if (this.component.length > 0) json.component = this.component;
        if (this.extension.length > 0) json.extension = this.extension;
        
        return json;
    }

    /**
     * Updates the observation with new data
     * @param {Object} updateData - Data to update
     * @returns {Observation} Updated observation instance
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
     * Creates an observation summary for listings
     * @returns {Object} Observation summary
     */
    getSummary() {
        const codeDisplay = this.code.coding && this.code.coding[0] ? 
            this.code.coding[0].display || this.code.coding[0].code : 
            'Unknown observation';
            
        let valueDisplay = 'No value';
        if (this.valueQuantity) {
            valueDisplay = `${this.valueQuantity.value} ${this.valueQuantity.unit || ''}`;
        } else if (this.valueString) {
            valueDisplay = this.valueString;
        } else if (this.valueBoolean !== undefined) {
            valueDisplay = this.valueBoolean.toString();
        } else if (this.valueCodeableConcept) {
            valueDisplay = this.valueCodeableConcept.coding && this.valueCodeableConcept.coding[0] ?
                this.valueCodeableConcept.coding[0].display || this.valueCodeableConcept.coding[0].code :
                'Coded value';
        }
            
        return {
            id: this.id,
            code: codeDisplay,
            value: valueDisplay,
            status: this.status,
            effectiveDateTime: this.effectiveDateTime,
            subject: this.subject.reference,
            lastUpdated: this.meta.lastUpdated
        };
    }

    /**
     * Factory method to create an Observation from FHIR JSON
     * @param {Object} fhirJson - FHIR Observation resource JSON
     * @returns {Observation} Observation instance
     */
    static fromFHIR(fhirJson) {
        if (fhirJson.resourceType !== 'Observation') {
            throw new Error('Invalid FHIR resource type. Expected Observation.');
        }
        
        return new Observation(fhirJson);
    }
}

module.exports = Observation;