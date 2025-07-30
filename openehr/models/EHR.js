const { v4: uuidv4 } = require('uuid');

/**
 * openEHR EHR Model
 * Represents an Electronic Health Record
 */
class EHR {
    constructor(data = {}) {
        this.ehr_id = data.ehr_id || uuidv4();
        this.system_id = data.system_id || 'webqx.health';
        this.created_time = data.created_time || new Date().toISOString();
        
        // EHR Status
        this.ehr_status = data.ehr_status || {
            archetype_node_id: 'openEHR-EHR-EHR_STATUS.generic.v1',
            name: { value: 'EHR Status' },
            uid: `${uuidv4()}::${this.system_id}::1`,
            subject: {
                external_ref: {
                    id: { value: data.subject_id || uuidv4() },
                    namespace: 'DEMOGRAPHIC',
                    type: 'PERSON'
                }
            },
            is_modifiable: true,
            is_queryable: true
        };
        
        // Metadata
        this.time_created = this.created_time;
        this.compositions = [];
    }

    /**
     * Validates the EHR according to openEHR specification
     */
    validate() {
        const errors = [];
        
        // EHR ID validation
        if (!this.ehr_id || typeof this.ehr_id !== 'string') {
            errors.push('EHR ID is required and must be a string');
        }
        
        // System ID validation
        if (!this.system_id || typeof this.system_id !== 'string') {
            errors.push('System ID is required and must be a string');
        }
        
        // EHR Status validation
        if (!this.ehr_status || !this.ehr_status.subject) {
            errors.push('EHR Status with subject is required');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Adds a composition to this EHR
     */
    addComposition(composition) {
        this.compositions.push({
            uid: composition.uid,
            archetype_node_id: composition.archetype_node_id,
            name: composition.name.value,
            created: composition.created
        });
    }

    /**
     * Removes a composition from this EHR
     */
    removeComposition(compositionUid) {
        this.compositions = this.compositions.filter(c => c.uid !== compositionUid);
    }

    /**
     * Updates the EHR status
     */
    updateStatus(statusData) {
        this.ehr_status = {
            ...this.ehr_status,
            ...statusData,
            uid: this.ehr_status.uid // Preserve original UID
        };
        return this;
    }

    /**
     * Converts to JSON representation
     */
    toJSON() {
        return {
            ehr_id: this.ehr_id,
            system_id: this.system_id,
            ehr_status: this.ehr_status,
            time_created: this.time_created,
            compositions: this.compositions
        };
    }

    /**
     * Creates a summary for listings
     */
    getSummary() {
        return {
            ehr_id: this.ehr_id,
            system_id: this.system_id,
            subject_id: this.ehr_status.subject?.external_ref?.id?.value,
            time_created: this.time_created,
            composition_count: this.compositions.length,
            is_queryable: this.ehr_status.is_queryable,
            is_modifiable: this.ehr_status.is_modifiable
        };
    }

    /**
     * Factory method to create from openEHR JSON
     */
    static fromOpenEHR(openEHRJson) {
        return new EHR(openEHRJson);
    }
}

module.exports = EHR;