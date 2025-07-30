const { v4: uuidv4 } = require('uuid');

/**
 * openEHR Composition Model
 * Compliant with openEHR specification
 */
class Composition {
    constructor(data = {}) {
        this.uid = data.uid || this.generateUID();
        this.archetype_node_id = data.archetype_node_id || 'openEHR-EHR-COMPOSITION.encounter.v1';
        this.name = data.name || { value: 'Composition' };
        
        // Required metadata
        this.composer = data.composer || {
            name: 'Unknown Composer'
        };
        
        this.category = data.category || {
            value: 'event',
            defining_code: {
                terminology_id: { value: 'openehr' },
                code_string: '433'
            }
        };
        
        this.territory = data.territory || {
            terminology_id: { value: 'ISO_3166-1' },
            code_string: 'US'
        };
        
        this.language = data.language || {
            terminology_id: { value: 'ISO_639-1' },
            code_string: 'en'
        };
        
        // Optional elements
        this.context = data.context || undefined;
        this.content = data.content || [];
        
        // Metadata
        this.created = data.created || new Date().toISOString();
        this.modified = data.modified || this.created;
        this.version = data.version || 1;
    }

    /**
     * Generates a unique identifier for the composition
     * Format: {uuid}::{namespace}::{version}
     */
    generateUID() {
        const uuid = uuidv4();
        const namespace = 'webqx.health';
        const version = 1;
        return `${uuid}::${namespace}::${version}`;
    }

    /**
     * Validates the composition according to openEHR specification
     */
    validate() {
        const errors = [];
        
        // UID validation
        if (!this.uid || typeof this.uid !== 'string') {
            errors.push('UID is required and must be a string');
        }
        
        // Archetype node ID validation
        if (!this.archetype_node_id || typeof this.archetype_node_id !== 'string') {
            errors.push('Archetype node ID is required');
        }
        
        // Name validation
        if (!this.name || !this.name.value) {
            errors.push('Name with value is required');
        }
        
        // Composer validation
        if (!this.composer || !this.composer.name) {
            errors.push('Composer with name is required');
        }
        
        // Category validation
        if (!this.category || !this.category.value || !this.category.defining_code) {
            errors.push('Category with value and defining_code is required');
        }
        
        // Territory validation
        if (!this.territory || !this.territory.code_string) {
            errors.push('Territory with code_string is required');
        }
        
        // Language validation
        if (!this.language || !this.language.code_string) {
            errors.push('Language with code_string is required');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Updates the composition with new data
     */
    update(updateData) {
        // Update version and timestamp
        this.version = this.version + 1;
        this.modified = new Date().toISOString();
        
        // Update UID with new version
        const uidParts = this.uid.split('::');
        if (uidParts.length === 3) {
            uidParts[2] = this.version.toString();
            this.uid = uidParts.join('::');
        }
        
        // Update fields
        Object.keys(updateData).forEach(key => {
            if (key !== 'uid' && key !== 'created' && key !== 'version') {
                this[key] = updateData[key];
            }
        });
        
        return this;
    }

    /**
     * Converts to JSON representation
     */
    toJSON() {
        return {
            uid: this.uid,
            archetype_node_id: this.archetype_node_id,
            name: this.name,
            composer: this.composer,
            category: this.category,
            territory: this.territory,
            language: this.language,
            context: this.context,
            content: this.content,
            _metadata: {
                created: this.created,
                modified: this.modified,
                version: this.version
            }
        };
    }

    /**
     * Creates a summary for listings
     */
    getSummary() {
        return {
            uid: this.uid,
            name: this.name.value,
            archetype_node_id: this.archetype_node_id,
            composer: this.composer.name,
            created: this.created,
            modified: this.modified,
            version: this.version,
            content_count: this.content.length
        };
    }

    /**
     * Factory method to create from openEHR JSON
     */
    static fromOpenEHR(openEHRJson) {
        return new Composition(openEHRJson);
    }
}

module.exports = Composition;