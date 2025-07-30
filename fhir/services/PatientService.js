const Patient = require('../models/Patient');

/**
 * FHIR Patient Service
 * Handles CRUD operations for Patient resources with FHIR compliance
 */
class PatientService {
    constructor() {
        // In-memory storage for this implementation
        // In production, this would be connected to a proper database
        this.patients = new Map();
        this.initializeTestPatients();
    }

    /**
     * Initialize with some test patients for demonstration
     */
    initializeTestPatients() {
        const testPatients = [
            {
                id: 'patient-001',
                identifier: [{
                    use: 'usual',
                    type: {
                        coding: [{
                            system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                            code: 'MR',
                            display: 'Medical Record Number'
                        }]
                    },
                    system: 'http://webqx.health/patient-id',
                    value: 'WQX001'
                }],
                active: true,
                name: [{
                    use: 'official',
                    family: 'Doe',
                    given: ['John', 'Michael']
                }],
                telecom: [{
                    system: 'phone',
                    value: '+1-555-0123',
                    use: 'home'
                }, {
                    system: 'email',
                    value: 'john.doe@example.com',
                    use: 'home'
                }],
                gender: 'male',
                birthDate: '1985-03-15',
                address: [{
                    use: 'home',
                    type: 'both',
                    line: ['123 Main Street'],
                    city: 'Anytown',
                    state: 'NY',
                    postalCode: '12345',
                    country: 'US'
                }],
                communication: [{
                    language: {
                        coding: [{
                            system: 'urn:ietf:bcp:47',
                            code: 'en-US',
                            display: 'English (US)'
                        }]
                    },
                    preferred: true
                }]
            },
            {
                id: 'patient-002',
                identifier: [{
                    use: 'usual',
                    type: {
                        coding: [{
                            system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                            code: 'MR',
                            display: 'Medical Record Number'
                        }]
                    },
                    system: 'http://webqx.health/patient-id',
                    value: 'WQX002'
                }],
                active: true,
                name: [{
                    use: 'official',
                    family: 'Smith',
                    given: ['Jane', 'Elizabeth']
                }],
                telecom: [{
                    system: 'phone',
                    value: '+1-555-0456',
                    use: 'mobile'
                }, {
                    system: 'email',
                    value: 'jane.smith@example.com',
                    use: 'work'
                }],
                gender: 'female',
                birthDate: '1990-07-22',
                address: [{
                    use: 'home',
                    type: 'both',
                    line: ['456 Oak Avenue'],
                    city: 'Springfield',
                    state: 'CA',
                    postalCode: '90210',
                    country: 'US'
                }],
                communication: [{
                    language: {
                        coding: [{
                            system: 'urn:ietf:bcp:47',
                            code: 'en-US',
                            display: 'English (US)'
                        }]
                    },
                    preferred: true
                }, {
                    language: {
                        coding: [{
                            system: 'urn:ietf:bcp:47',
                            code: 'es-US',
                            display: 'Spanish (US)'
                        }]
                    },
                    preferred: false
                }]
            }
        ];

        testPatients.forEach(patientData => {
            const patient = new Patient(patientData);
            this.patients.set(patient.id, patient);
        });
    }

    /**
     * Create a new patient
     * @param {Object} patientData - FHIR Patient resource data
     * @returns {Promise<Patient>} Created patient
     */
    async create(patientData) {
        try {
            const patient = new Patient(patientData);
            const validation = patient.validate();
            
            if (!validation.isValid) {
                throw new Error(`Patient validation failed: ${validation.errors.join(', ')}`);
            }
            
            // Check for duplicate identifier
            if (this.findByIdentifier(patient.identifier)) {
                throw new Error('Patient with this identifier already exists');
            }
            
            this.patients.set(patient.id, patient);
            return patient;
        } catch (error) {
            throw new Error(`Failed to create patient: ${error.message}`);
        }
    }

    /**
     * Read a patient by ID
     * @param {string} id - Patient ID
     * @returns {Promise<Patient|null>} Patient or null if not found
     */
    async read(id) {
        return this.patients.get(id) || null;
    }

    /**
     * Update an existing patient
     * @param {string} id - Patient ID
     * @param {Object} updateData - Data to update
     * @returns {Promise<Patient>} Updated patient
     */
    async update(id, updateData) {
        try {
            const existingPatient = this.patients.get(id);
            if (!existingPatient) {
                throw new Error('Patient not found');
            }
            
            const updatedPatient = existingPatient.update(updateData);
            const validation = updatedPatient.validate();
            
            if (!validation.isValid) {
                throw new Error(`Patient validation failed: ${validation.errors.join(', ')}`);
            }
            
            this.patients.set(id, updatedPatient);
            return updatedPatient;
        } catch (error) {
            throw new Error(`Failed to update patient: ${error.message}`);
        }
    }

    /**
     * Delete a patient
     * @param {string} id - Patient ID
     * @returns {Promise<boolean>} True if deleted, false if not found
     */
    async delete(id) {
        return this.patients.delete(id);
    }

    /**
     * Search patients with optional filters
     * @param {Object} params - Search parameters
     * @returns {Promise<Array<Patient>>} Array of matching patients
     */
    async search(params = {}) {
        let results = Array.from(this.patients.values());
        
        // Filter by name
        if (params.name) {
            const searchName = params.name.toLowerCase();
            results = results.filter(patient => {
                return patient.name.some(name => {
                    const fullName = `${(name.given || []).join(' ')} ${name.family || ''}`.toLowerCase();
                    return fullName.includes(searchName);
                });
            });
        }
        
        // Filter by gender
        if (params.gender) {
            results = results.filter(patient => patient.gender === params.gender);
        }
        
        // Filter by birth date
        if (params.birthdate) {
            results = results.filter(patient => patient.birthDate === params.birthdate);
        }
        
        // Filter by active status
        if (params.active !== undefined) {
            const isActive = params.active === 'true';
            results = results.filter(patient => patient.active === isActive);
        }
        
        // Filter by identifier
        if (params.identifier) {
            results = results.filter(patient => 
                patient.identifier.some(id => 
                    id.value === params.identifier || 
                    id.system === params.identifier
                )
            );
        }
        
        // Pagination
        const offset = parseInt(params._offset) || 0;
        const count = parseInt(params._count) || 20;
        
        return {
            total: results.length,
            offset,
            count: Math.min(count, results.length - offset),
            patients: results.slice(offset, offset + count)
        };
    }

    /**
     * Get patient summaries for listing
     * @returns {Promise<Array<Object>>} Array of patient summaries
     */
    async getSummaries() {
        return Array.from(this.patients.values()).map(patient => patient.getSummary());
    }

    /**
     * Find patient by identifier
     * @param {Array} identifiers - Array of identifiers to search
     * @returns {Patient|null} Found patient or null
     */
    findByIdentifier(identifiers) {
        if (!Array.isArray(identifiers) || identifiers.length === 0) {
            return null;
        }
        
        for (const patient of this.patients.values()) {
            for (const patientId of patient.identifier) {
                for (const searchId of identifiers) {
                    if (patientId.value === searchId.value && patientId.system === searchId.system) {
                        return patient;
                    }
                }
            }
        }
        
        return null;
    }

    /**
     * Get total patient count
     * @returns {number} Total number of patients
     */
    getCount() {
        return this.patients.size;
    }

    /**
     * Validate FHIR search parameters
     * @param {Object} params - Search parameters
     * @returns {Object} Validation result
     */
    validateSearchParams(params) {
        const errors = [];
        const validParams = ['name', 'gender', 'birthdate', 'active', 'identifier', '_offset', '_count'];
        
        Object.keys(params).forEach(param => {
            if (!validParams.includes(param)) {
                errors.push(`Invalid search parameter: ${param}`);
            }
        });
        
        if (params.gender && !['male', 'female', 'other', 'unknown'].includes(params.gender)) {
            errors.push('Invalid gender value');
        }
        
        if (params._offset && (isNaN(params._offset) || parseInt(params._offset) < 0)) {
            errors.push('Invalid _offset value');
        }
        
        if (params._count && (isNaN(params._count) || parseInt(params._count) < 1 || parseInt(params._count) > 100)) {
            errors.push('Invalid _count value (must be 1-100)');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

module.exports = PatientService;