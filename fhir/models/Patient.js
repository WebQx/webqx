const { v4: uuidv4 } = require('uuid');

/**
 * FHIR R4 Patient Resource Model
 * Compliant with FHIR specification: https://hl7.org/fhir/patient.html
 */
class Patient {
    constructor(data = {}) {
        this.resourceType = 'Patient';
        this.id = data.id || uuidv4();
        this.meta = data.meta || {
            versionId: '1',
            lastUpdated: new Date().toISOString(),
            profile: ['http://hl7.org/fhir/StructureDefinition/Patient']
        };
        
        // Required elements
        this.identifier = data.identifier || [];
        this.active = data.active !== undefined ? data.active : true;
        this.name = data.name || [];
        this.telecom = data.telecom || [];
        this.gender = data.gender || undefined;
        this.birthDate = data.birthDate || undefined;
        this.address = data.address || [];
        
        // Optional elements
        this.maritalStatus = data.maritalStatus || undefined;
        this.contact = data.contact || [];
        this.communication = data.communication || [];
        this.generalPractitioner = data.generalPractitioner || [];
        this.managingOrganization = data.managingOrganization || undefined;
        
        // WebQx extensions for enhanced functionality
        this.extension = data.extension || [];
    }

    /**
     * Validates the Patient resource according to FHIR R4 specification
     * @returns {Object} Validation result with isValid boolean and errors array
     */
    validate() {
        const errors = [];
        
        // Resource type validation
        if (this.resourceType !== 'Patient') {
            errors.push('Invalid resourceType. Must be "Patient"');
        }
        
        // ID validation
        if (!this.id || typeof this.id !== 'string') {
            errors.push('Patient ID is required and must be a string');
        }
        
        // Name validation - at least one name should be provided
        if (!Array.isArray(this.name) || this.name.length === 0) {
            errors.push('At least one name is required');
        } else {
            this.name.forEach((name, index) => {
                if (!name.family && (!name.given || name.given.length === 0)) {
                    errors.push(`Name[${index}] must have either family or given name`);
                }
            });
        }
        
        // Gender validation
        if (this.gender && !['male', 'female', 'other', 'unknown'].includes(this.gender)) {
            errors.push('Gender must be one of: male, female, other, unknown');
        }
        
        // Birth date validation
        if (this.birthDate && !this.isValidDate(this.birthDate)) {
            errors.push('Birth date must be a valid date in YYYY-MM-DD format');
        }
        
        // Identifier validation
        if (!Array.isArray(this.identifier)) {
            errors.push('Identifier must be an array');
        } else {
            this.identifier.forEach((identifier, index) => {
                if (!identifier.system && !identifier.value) {
                    errors.push(`Identifier[${index}] must have either system or value`);
                }
            });
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validates date format (YYYY-MM-DD)
     * @param {string} dateString 
     * @returns {boolean}
     */
    isValidDate(dateString) {
        const regex = /^\d{4}-\d{2}-\d{2}$/;
        if (!regex.test(dateString)) return false;
        
        const date = new Date(dateString);
        return date instanceof Date && !isNaN(date) && date.toISOString().slice(0, 10) === dateString;
    }

    /**
     * Converts the Patient resource to a JSON representation
     * @returns {Object} FHIR-compliant Patient resource JSON
     */
    toJSON() {
        const json = {
            resourceType: this.resourceType,
            id: this.id,
            meta: this.meta
        };
        
        // Only include non-empty arrays and defined values
        if (this.identifier.length > 0) json.identifier = this.identifier;
        if (this.active !== undefined) json.active = this.active;
        if (this.name.length > 0) json.name = this.name;
        if (this.telecom.length > 0) json.telecom = this.telecom;
        if (this.gender) json.gender = this.gender;
        if (this.birthDate) json.birthDate = this.birthDate;
        if (this.address.length > 0) json.address = this.address;
        if (this.maritalStatus) json.maritalStatus = this.maritalStatus;
        if (this.contact.length > 0) json.contact = this.contact;
        if (this.communication.length > 0) json.communication = this.communication;
        if (this.generalPractitioner.length > 0) json.generalPractitioner = this.generalPractitioner;
        if (this.managingOrganization) json.managingOrganization = this.managingOrganization;
        if (this.extension.length > 0) json.extension = this.extension;
        
        return json;
    }

    /**
     * Updates the patient with new data
     * @param {Object} updateData - Data to update
     * @returns {Patient} Updated patient instance
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
     * Creates a patient summary for listings
     * @returns {Object} Patient summary
     */
    getSummary() {
        const primaryName = this.name[0] || {};
        const displayName = primaryName.given 
            ? `${primaryName.given.join(' ')} ${primaryName.family || ''}`.trim()
            : primaryName.family || 'Unknown Name';
            
        return {
            id: this.id,
            name: displayName,
            gender: this.gender,
            birthDate: this.birthDate,
            active: this.active,
            lastUpdated: this.meta.lastUpdated
        };
    }

    /**
     * Factory method to create a Patient from FHIR JSON
     * @param {Object} fhirJson - FHIR Patient resource JSON
     * @returns {Patient} Patient instance
     */
    static fromFHIR(fhirJson) {
        if (fhirJson.resourceType !== 'Patient') {
            throw new Error('Invalid FHIR resource type. Expected Patient.');
        }
        
        return new Patient(fhirJson);
    }
}

module.exports = Patient;