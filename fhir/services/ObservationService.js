const Observation = require('../models/Observation');

/**
 * FHIR Observation Service
 * Handles CRUD operations for Observation resources with FHIR compliance
 */
class ObservationService {
    constructor() {
        // In-memory storage for this implementation
        // In production, this would be connected to a proper database
        this.observations = new Map();
        this.initializeTestObservations();
    }

    /**
     * Initialize with some test observations for demonstration
     */
    initializeTestObservations() {
        const testObservations = [
            {
                id: 'observation-001',
                status: 'final',
                category: [{
                    coding: [{
                        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                        code: 'vital-signs',
                        display: 'Vital Signs'
                    }]
                }],
                code: {
                    coding: [{
                        system: 'http://loinc.org',
                        code: '8310-5',
                        display: 'Body temperature'
                    }]
                },
                subject: {
                    reference: 'Patient/patient-001',
                    display: 'John Michael Doe'
                },
                effectiveDateTime: '2025-07-30T08:30:00Z',
                issued: '2025-07-30T08:35:00Z',
                performer: [{
                    reference: 'Practitioner/practitioner-001',
                    display: 'Dr. Sarah Johnson'
                }],
                valueQuantity: {
                    value: 98.6,
                    unit: 'degrees F',
                    system: 'http://unitsofmeasure.org',
                    code: '[degF]'
                },
                interpretation: [{
                    coding: [{
                        system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
                        code: 'N',
                        display: 'Normal'
                    }]
                }],
                referenceRange: [{
                    low: {
                        value: 97.0,
                        unit: 'degrees F',
                        system: 'http://unitsofmeasure.org',
                        code: '[degF]'
                    },
                    high: {
                        value: 99.0,
                        unit: 'degrees F',
                        system: 'http://unitsofmeasure.org',
                        code: '[degF]'
                    },
                    text: 'Normal temperature range'
                }]
            },
            {
                id: 'observation-002',
                status: 'final',
                category: [{
                    coding: [{
                        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                        code: 'vital-signs',
                        display: 'Vital Signs'
                    }]
                }],
                code: {
                    coding: [{
                        system: 'http://loinc.org',
                        code: '8867-4',
                        display: 'Heart rate'
                    }]
                },
                subject: {
                    reference: 'Patient/patient-001',
                    display: 'John Michael Doe'
                },
                effectiveDateTime: '2025-07-30T08:30:00Z',
                issued: '2025-07-30T08:35:00Z',
                performer: [{
                    reference: 'Practitioner/practitioner-001',
                    display: 'Dr. Sarah Johnson'
                }],
                valueQuantity: {
                    value: 72,
                    unit: 'beats per minute',
                    system: 'http://unitsofmeasure.org',
                    code: '/min'
                },
                interpretation: [{
                    coding: [{
                        system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
                        code: 'N',
                        display: 'Normal'
                    }]
                }],
                referenceRange: [{
                    low: {
                        value: 60,
                        unit: 'beats per minute',
                        system: 'http://unitsofmeasure.org',
                        code: '/min'
                    },
                    high: {
                        value: 100,
                        unit: 'beats per minute',
                        system: 'http://unitsofmeasure.org',
                        code: '/min'
                    },
                    text: 'Normal heart rate range'
                }]
            },
            {
                id: 'observation-003',
                status: 'final',
                category: [{
                    coding: [{
                        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                        code: 'laboratory',
                        display: 'Laboratory'
                    }]
                }],
                code: {
                    coding: [{
                        system: 'http://loinc.org',
                        code: '33747-0',
                        display: 'Hemoglobin A1c/Hemoglobin.total in Blood'
                    }]
                },
                subject: {
                    reference: 'Patient/patient-002',
                    display: 'Jane Elizabeth Smith'
                },
                effectiveDateTime: '2025-07-29T14:00:00Z',
                issued: '2025-07-30T09:15:00Z',
                performer: [{
                    reference: 'Organization/lab-001',
                    display: 'WebQX Central Laboratory'
                }],
                valueQuantity: {
                    value: 5.8,
                    unit: '%',
                    system: 'http://unitsofmeasure.org',
                    code: '%'
                },
                interpretation: [{
                    coding: [{
                        system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
                        code: 'N',
                        display: 'Normal'
                    }]
                }],
                referenceRange: [{
                    high: {
                        value: 6.0,
                        unit: '%',
                        system: 'http://unitsofmeasure.org',
                        code: '%'
                    },
                    text: 'Target range for diabetic patients'
                }],
                note: [{
                    text: 'Good glycemic control. Continue current management.'
                }]
            }
        ];

        testObservations.forEach(observationData => {
            const observation = new Observation(observationData);
            this.observations.set(observation.id, observation);
        });
    }

    /**
     * Create a new observation
     * @param {Object} observationData - FHIR Observation resource data
     * @returns {Promise<Observation>} Created observation
     */
    async create(observationData) {
        try {
            const observation = new Observation(observationData);
            const validation = observation.validate();
            
            if (!validation.isValid) {
                throw new Error(`Observation validation failed: ${validation.errors.join(', ')}`);
            }
            
            this.observations.set(observation.id, observation);
            return observation;
        } catch (error) {
            throw new Error(`Failed to create observation: ${error.message}`);
        }
    }

    /**
     * Read an observation by ID
     * @param {string} id - Observation ID
     * @returns {Promise<Observation|null>} Observation or null if not found
     */
    async read(id) {
        return this.observations.get(id) || null;
    }

    /**
     * Update an existing observation
     * @param {string} id - Observation ID
     * @param {Object} updateData - Data to update
     * @returns {Promise<Observation>} Updated observation
     */
    async update(id, updateData) {
        try {
            const existingObservation = this.observations.get(id);
            if (!existingObservation) {
                throw new Error('Observation not found');
            }
            
            const updatedObservation = existingObservation.update(updateData);
            const validation = updatedObservation.validate();
            
            if (!validation.isValid) {
                throw new Error(`Observation validation failed: ${validation.errors.join(', ')}`);
            }
            
            this.observations.set(id, updatedObservation);
            return updatedObservation;
        } catch (error) {
            throw new Error(`Failed to update observation: ${error.message}`);
        }
    }

    /**
     * Delete an observation
     * @param {string} id - Observation ID
     * @returns {Promise<boolean>} True if deleted, false if not found
     */
    async delete(id) {
        return this.observations.delete(id);
    }

    /**
     * Search observations with optional filters
     * @param {Object} params - Search parameters
     * @returns {Promise<Object>} Search results with pagination
     */
    async search(params = {}) {
        let results = Array.from(this.observations.values());
        
        // Filter by patient/subject
        if (params.patient || params.subject) {
            const patientRef = params.patient || params.subject;
            results = results.filter(observation => {
                if (observation.subject && observation.subject.reference) {
                    return observation.subject.reference.includes(patientRef) || 
                           observation.subject.reference === `Patient/${patientRef}`;
                }
                return false;
            });
        }
        
        // Filter by code
        if (params.code) {
            results = results.filter(observation => {
                return observation.code.coding && observation.code.coding.some(coding => 
                    coding.code === params.code || coding.system === params.code
                );
            });
        }
        
        // Filter by category
        if (params.category) {
            results = results.filter(observation => {
                return observation.category && observation.category.some(cat => 
                    cat.coding && cat.coding.some(coding => 
                        coding.code === params.category
                    )
                );
            });
        }
        
        // Filter by status
        if (params.status) {
            results = results.filter(observation => observation.status === params.status);
        }
        
        // Filter by date
        if (params.date) {
            results = results.filter(observation => {
                if (observation.effectiveDateTime) {
                    return observation.effectiveDateTime.startsWith(params.date);
                }
                return false;
            });
        }
        
        // Pagination
        const offset = parseInt(params._offset) || 0;
        const count = parseInt(params._count) || 20;
        
        return {
            total: results.length,
            offset: offset,
            count: Math.min(count, results.length - offset),
            observations: results.slice(offset, offset + count)
        };
    }

    /**
     * Get observation summaries for listing
     * @returns {Promise<Array<Object>>} Array of observation summaries
     */
    async getSummaries() {
        return Array.from(this.observations.values()).map(observation => observation.getSummary());
    }

    /**
     * Get total observation count
     * @returns {number} Total number of observations
     */
    getCount() {
        return this.observations.size;
    }

    /**
     * Validate FHIR search parameters
     * @param {Object} params - Search parameters
     * @returns {Object} Validation result
     */
    validateSearchParams(params) {
        const errors = [];
        const validParams = ['patient', 'subject', 'code', 'category', 'status', 'date', '_offset', '_count'];
        
        Object.keys(params).forEach(param => {
            if (!validParams.includes(param)) {
                errors.push(`Invalid search parameter: ${param}`);
            }
        });
        
        const validStatuses = ['registered', 'preliminary', 'final', 'amended', 'corrected', 'cancelled', 'entered-in-error', 'unknown'];
        if (params.status && !validStatuses.includes(params.status)) {
            errors.push(`Invalid status value. Must be one of: ${validStatuses.join(', ')}`);
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

module.exports = ObservationService;