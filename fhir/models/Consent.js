const { v4: uuidv4 } = require('uuid');

/**
 * FHIR R4 Consent Resource Model
 * Compliant with FHIR specification: https://hl7.org/fhir/consent.html
 * Used for logging patient consent for telehealth sessions and other healthcare activities.
 */
class Consent {
    constructor(data = {}) {
        this.resourceType = 'Consent';
        this.id = data.id || uuidv4();
        this.meta = data.meta || {
            versionId: '1',
            lastUpdated: new Date().toISOString(),
            profile: ['http://hl7.org/fhir/StructureDefinition/Consent']
        };
        
        // Required elements
        this.status = data.status || 'proposed'; // draft | proposed | active | rejected | inactive | entered-in-error
        this.scope = data.scope || {
            coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/consentscope',
                code: 'treatment',
                display: 'Treatment'
            }]
        };
        this.category = data.category || [{
            coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/consentcategorycodes',
                code: 'INFA',
                display: 'Information Access'
            }]
        }];
        this.patient = data.patient || undefined; // Reference to Patient resource
        this.dateTime = data.dateTime || new Date().toISOString();
        
        // Optional elements for telehealth
        this.performer = data.performer || []; // Who is granting consent
        this.organization = data.organization || []; // Organization managing consent
        this.source = data.source || undefined; // Source of consent (document, recording, etc.)
        this.policy = data.policy || []; // Policies covered by consent
        this.policyRule = data.policyRule || undefined; // Regulation/policy this consent complies with
        this.verification = data.verification || []; // Consent verification
        this.provision = data.provision || {
            type: 'permit', // deny | permit
            period: data.provision?.period || undefined,
            actor: data.provision?.actor || [],
            action: data.provision?.action || [],
            securityLabel: data.provision?.securityLabel || [],
            purpose: data.provision?.purpose || [],
            class: data.provision?.class || [],
            code: data.provision?.code || [],
            dataPeriod: data.provision?.dataPeriod || undefined,
            data: data.provision?.data || [],
            provision: data.provision?.provision || []
        };
        
        // WebQx extensions for enhanced functionality
        this.extension = data.extension || [];
    }

    /**
     * Creates a consent for telehealth session participation
     * @param {Object} options - Consent options
     * @returns {Consent} Consent instance for telehealth
     */
    static createTelehealthConsent(options = {}) {
        const consent = new Consent({
            status: 'active',
            scope: {
                coding: [{
                    system: 'http://terminology.hl7.org/CodeSystem/consentscope',
                    code: 'treatment',
                    display: 'Treatment'
                }]
            },
            category: [{
                coding: [{
                    system: 'http://loinc.org',
                    code: '59284-0',
                    display: 'Patient Consent'
                }]
            }],
            patient: options.patientReference,
            dateTime: new Date().toISOString(),
            performer: options.performer || [],
            organization: options.organization || [],
            policyRule: {
                coding: [{
                    system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
                    code: 'HIPAA-Auth',
                    display: 'HIPAA Authorization'
                }]
            },
            provision: {
                type: 'permit',
                period: options.sessionPeriod || {
                    start: new Date().toISOString(),
                    end: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() // 2 hours default
                },
                purpose: [{
                    system: 'http://terminology.hl7.org/CodeSystem/v3-ActReason',
                    code: 'TREAT',
                    display: 'Treatment'
                }],
                action: [{
                    coding: [{
                        system: 'http://terminology.hl7.org/CodeSystem/consentaction',
                        code: 'access',
                        display: 'Access'
                    }]
                }, {
                    coding: [{
                        system: 'http://terminology.hl7.org/CodeSystem/consentaction',
                        code: 'collect',
                        display: 'Collect'
                    }]
                }],
                securityLabel: [{
                    system: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality',
                    code: 'R',
                    display: 'Restricted'
                }]
            },
            extension: [{
                url: 'http://webqx.health/fhir/StructureDefinition/telehealth-consent',
                extension: [{
                    url: 'sessionId',
                    valueString: options.sessionId
                }, {
                    url: 'consentMethod',
                    valueString: options.consentMethod || 'electronic'
                }, {
                    url: 'ipAddress',
                    valueString: options.ipAddress
                }, {
                    url: 'userAgent',
                    valueString: options.userAgent
                }]
            }]
        });

        return consent;
    }

    /**
     * Validates the Consent resource according to FHIR R4 specification
     * @returns {Object} Validation result with isValid boolean and errors array
     */
    validate() {
        const errors = [];
        
        // Resource type validation
        if (this.resourceType !== 'Consent') {
            errors.push('Invalid resourceType. Must be "Consent"');
        }
        
        // ID validation
        if (!this.id || typeof this.id !== 'string') {
            errors.push('Consent ID is required and must be a string');
        }
        
        // Status validation
        const validStatuses = ['draft', 'proposed', 'active', 'rejected', 'inactive', 'entered-in-error'];
        if (!this.status || !validStatuses.includes(this.status)) {
            errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
        }
        
        // Scope validation
        if (!this.scope || !this.scope.coding || !Array.isArray(this.scope.coding)) {
            errors.push('Scope with coding is required');
        }
        
        // Category validation
        if (!this.category || !Array.isArray(this.category) || this.category.length === 0) {
            errors.push('At least one category is required');
        }
        
        // Patient reference validation
        if (!this.patient || !this.patient.reference) {
            errors.push('Patient reference is required');
        }
        
        // DateTime validation
        if (!this.dateTime || !this.isValidDateTime(this.dateTime)) {
            errors.push('Valid dateTime is required');
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
            return date instanceof Date && !isNaN(date) && dateTimeString === date.toISOString();
        } catch (error) {
            return false;
        }
    }

    /**
     * Checks if consent is currently active and valid
     * @returns {boolean}
     */
    isActive() {
        if (this.status !== 'active') {
            return false;
        }
        
        const now = new Date();
        const provision = this.provision;
        
        if (provision && provision.period) {
            if (provision.period.start && new Date(provision.period.start) > now) {
                return false; // Not yet active
            }
            if (provision.period.end && new Date(provision.period.end) < now) {
                return false; // Expired
            }
        }
        
        return true;
    }

    /**
     * Records consent verification
     * @param {Object} verification - Verification details
     */
    addVerification(verification) {
        if (!this.verification) {
            this.verification = [];
        }
        
        this.verification.push({
            verified: verification.verified || true,
            verifiedWith: verification.verifiedWith || undefined,
            verifiedBy: verification.verifiedBy || undefined,
            verificationDate: verification.verificationDate || new Date().toISOString()
        });
        
        // Update meta information
        this.meta.versionId = String(parseInt(this.meta.versionId) + 1);
        this.meta.lastUpdated = new Date().toISOString();
    }

    /**
     * Converts the Consent resource to a JSON representation
     * @returns {Object} FHIR-compliant Consent resource JSON
     */
    toJSON() {
        const json = {
            resourceType: this.resourceType,
            id: this.id,
            meta: this.meta,
            status: this.status,
            scope: this.scope,
            category: this.category,
            patient: this.patient,
            dateTime: this.dateTime
        };
        
        // Only include non-empty arrays and defined values
        if (this.performer && this.performer.length > 0) json.performer = this.performer;
        if (this.organization && this.organization.length > 0) json.organization = this.organization;
        if (this.source) json.source = this.source;
        if (this.policy && this.policy.length > 0) json.policy = this.policy;
        if (this.policyRule) json.policyRule = this.policyRule;
        if (this.verification && this.verification.length > 0) json.verification = this.verification;
        if (this.provision) json.provision = this.provision;
        if (this.extension && this.extension.length > 0) json.extension = this.extension;
        
        return json;
    }

    /**
     * Updates the consent with new data
     * @param {Object} updateData - Data to update
     * @returns {Consent} Updated consent instance
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
     * Factory method to create a Consent from FHIR JSON
     * @param {Object} fhirJson - FHIR Consent resource JSON
     * @returns {Consent} Consent instance
     */
    static fromFHIR(fhirJson) {
        if (fhirJson.resourceType !== 'Consent') {
            throw new Error('Invalid FHIR resource type. Expected Consent.');
        }
        
        return new Consent(fhirJson);
    }
}

module.exports = Consent;