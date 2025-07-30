const Composition = require('../models/Composition');
const EHR = require('../models/EHR');

/**
 * openEHR Mock Service
 * Handles CRUD operations for openEHR resources
 */
class OpenEHRService {
    constructor() {
        // In-memory storage for this implementation
        this.ehrs = new Map();
        this.compositions = new Map();
        this.initializeTestData();
    }

    /**
     * Initialize with test data
     */
    initializeTestData() {
        // Create test EHRs
        const testEHRs = [
            {
                ehr_id: 'ehr-001',
                subject_id: 'patient-001'
            },
            {
                ehr_id: 'ehr-002', 
                subject_id: 'patient-002'
            }
        ];

        testEHRs.forEach(ehrData => {
            const ehr = new EHR(ehrData);
            this.ehrs.set(ehr.ehr_id, ehr);
        });

        // Create test compositions
        const testCompositions = [
            {
                uid: 'comp-001::webqx.health::1',
                archetype_node_id: 'openEHR-EHR-COMPOSITION.encounter.v1',
                name: { value: 'Patient Encounter' },
                composer: { name: 'Dr. Sarah Johnson' },
                context: {
                    start_time: '2025-07-30T08:00:00Z',
                    setting: {
                        value: 'primary medical care',
                        defining_code: {
                            terminology_id: { value: 'openehr' },
                            code_string: '228'
                        }
                    }
                },
                content: [
                    {
                        archetype_node_id: 'openEHR-EHR-OBSERVATION.vital_signs.v1',
                        name: { value: 'Vital Signs' },
                        data: {
                            events: [
                                {
                                    time: '2025-07-30T08:30:00Z',
                                    data: {
                                        items: [
                                            {
                                                name: { value: 'Body temperature' },
                                                value: {
                                                    magnitude: 98.6,
                                                    units: '°F'
                                                }
                                            },
                                            {
                                                name: { value: 'Heart rate' },
                                                value: {
                                                    magnitude: 72,
                                                    units: '/min'
                                                }
                                            }
                                        ]
                                    }
                                }
                            ]
                        }
                    }
                ]
            },
            {
                uid: 'comp-002::webqx.health::1',
                archetype_node_id: 'openEHR-EHR-COMPOSITION.report.v1',
                name: { value: 'Laboratory Report' },
                composer: { name: 'WebQX Central Laboratory' },
                context: {
                    start_time: '2025-07-29T14:00:00Z',
                    setting: {
                        value: 'laboratory',
                        defining_code: {
                            terminology_id: { value: 'openehr' },
                            code_string: '264'
                        }
                    }
                },
                content: [
                    {
                        archetype_node_id: 'openEHR-EHR-OBSERVATION.laboratory_test_result.v1',
                        name: { value: 'Laboratory Test Result' },
                        data: {
                            events: [
                                {
                                    time: '2025-07-29T14:00:00Z',
                                    data: {
                                        items: [
                                            {
                                                name: { value: 'Test name' },
                                                value: { value: 'Hemoglobin A1c' }
                                            },
                                            {
                                                name: { value: 'Result' },
                                                value: {
                                                    magnitude: 5.8,
                                                    units: '%'
                                                }
                                            },
                                            {
                                                name: { value: 'Reference range' },
                                                value: { value: '< 6.0%' }
                                            }
                                        ]
                                    }
                                }
                            ]
                        }
                    }
                ]
            }
        ];

        testCompositions.forEach(compData => {
            const composition = new Composition(compData);
            this.compositions.set(composition.uid, composition);
            
            // Add to appropriate EHR (assuming first composition goes to first EHR, etc.)
            const ehrId = compData.uid.includes('001') ? 'ehr-001' : 'ehr-002';
            const ehr = this.ehrs.get(ehrId);
            if (ehr) {
                ehr.addComposition(composition);
            }
        });
    }

    // EHR Operations
    
    /**
     * Create a new EHR
     */
    async createEHR(ehrData = {}) {
        try {
            const ehr = new EHR(ehrData);
            const validation = ehr.validate();
            
            if (!validation.isValid) {
                throw new Error(`EHR validation failed: ${validation.errors.join(', ')}`);
            }
            
            this.ehrs.set(ehr.ehr_id, ehr);
            return ehr;
        } catch (error) {
            throw new Error(`Failed to create EHR: ${error.message}`);
        }
    }

    /**
     * Get EHR by ID
     */
    async getEHR(ehrId) {
        return this.ehrs.get(ehrId) || null;
    }

    /**
     * Get EHR status
     */
    async getEHRStatus(ehrId) {
        const ehr = this.ehrs.get(ehrId);
        return ehr ? ehr.ehr_status : null;
    }

    /**
     * Update EHR status
     */
    async updateEHRStatus(ehrId, statusData) {
        const ehr = this.ehrs.get(ehrId);
        if (!ehr) {
            throw new Error('EHR not found');
        }
        
        return ehr.updateStatus(statusData);
    }

    // Composition Operations

    /**
     * Create a new composition
     */
    async createComposition(ehrId, templateId, compositionData) {
        try {
            const ehr = this.ehrs.get(ehrId);
            if (!ehr) {
                throw new Error('EHR not found');
            }

            const composition = new Composition({
                ...compositionData,
                _template_id: templateId
            });
            
            const validation = composition.validate();
            if (!validation.isValid) {
                throw new Error(`Composition validation failed: ${validation.errors.join(', ')}`);
            }
            
            this.compositions.set(composition.uid, composition);
            ehr.addComposition(composition);
            
            return composition;
        } catch (error) {
            throw new Error(`Failed to create composition: ${error.message}`);
        }
    }

    /**
     * Get composition by UID
     */
    async getComposition(uid) {
        return this.compositions.get(uid) || null;
    }

    /**
     * Update composition
     */
    async updateComposition(ehrId, compositionUid, templateId, updateData) {
        try {
            const ehr = this.ehrs.get(ehrId);
            if (!ehr) {
                throw new Error('EHR not found');
            }

            const composition = this.compositions.get(compositionUid);
            if (!composition) {
                throw new Error('Composition not found');
            }

            const updatedComposition = composition.update({
                ...updateData,
                _template_id: templateId
            });
            
            const validation = updatedComposition.validate();
            if (!validation.isValid) {
                throw new Error(`Composition validation failed: ${validation.errors.join(', ')}`);
            }
            
            // Update in storage with new UID
            this.compositions.delete(compositionUid);
            this.compositions.set(updatedComposition.uid, updatedComposition);
            
            return updatedComposition;
        } catch (error) {
            throw new Error(`Failed to update composition: ${error.message}`);
        }
    }

    /**
     * Delete composition
     */
    async deleteComposition(ehrId, compositionUid) {
        const ehr = this.ehrs.get(ehrId);
        if (!ehr) {
            throw new Error('EHR not found');
        }

        const deleted = this.compositions.delete(compositionUid);
        if (deleted) {
            ehr.removeComposition(compositionUid);
        }
        
        return deleted;
    }

    /**
     * Search compositions
     */
    async searchCompositions(params = {}) {
        let results = Array.from(this.compositions.values());
        
        // Filter by EHR ID
        if (params.ehr_id) {
            const ehr = this.ehrs.get(params.ehr_id);
            if (ehr) {
                const ehrCompositionUids = ehr.compositions.map(c => c.uid);
                results = results.filter(comp => ehrCompositionUids.includes(comp.uid));
            } else {
                results = [];
            }
        }
        
        // Filter by archetype
        if (params.archetype_node_id) {
            results = results.filter(comp => 
                comp.archetype_node_id === params.archetype_node_id
            );
        }
        
        // Filter by composer
        if (params.composer) {
            results = results.filter(comp => 
                comp.composer.name.toLowerCase().includes(params.composer.toLowerCase())
            );
        }
        
        return results;
    }

    /**
     * Execute AQL query (simplified)
     */
    async executeAQL(aqlQuery) {
        // This is a simplified implementation for demo purposes
        // In a real system, this would parse and execute actual AQL
        
        const query = aqlQuery.q || aqlQuery.aql;
        let results = [];
        
        // Simple pattern matching for demo
        if (query.toLowerCase().includes('composition')) {
            results = Array.from(this.compositions.values()).map(comp => [comp.toJSON()]);
        } else if (query.toLowerCase().includes('ehr')) {
            results = Array.from(this.ehrs.values()).map(ehr => [ehr.toJSON()]);
        }
        
        return {
            meta: {
                href: '/rest/v1/query/aql',
                type: 'RESULTSET',
                schema_version: '1.0.0',
                created: new Date().toISOString(),
                generator: 'WebQX openEHR Mock Service',
                executed_aql: query
            },
            q: query,
            columns: [
                { name: 'result', path: '/' }
            ],
            rows: results
        };
    }

    /**
     * Get counts
     */
    getEHRCount() {
        return this.ehrs.size;
    }

    getCompositionCount() {
        return this.compositions.size;
    }

    /**
     * Validate search parameters
     */
    validateSearchParams(params) {
        const errors = [];
        const validParams = ['ehr_id', 'archetype_node_id', 'composer', 'name', '_offset', '_count'];
        
        Object.keys(params).forEach(param => {
            if (!validParams.includes(param)) {
                errors.push(`Invalid search parameter: ${param}`);
            }
        });
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

module.exports = OpenEHRService;