const PatientService = require('../services/PatientService');
const Patient = require('../models/Patient');

describe('FHIR Patient Service', () => {
    let patientService;

    beforeEach(() => {
        patientService = new PatientService();
    });

    describe('Patient CRUD Operations', () => {
        test('creates a new patient successfully', async () => {
            const patientData = {
                name: [{
                    family: 'TestPatient',
                    given: ['Test', 'User']
                }],
                gender: 'male',
                birthDate: '1990-01-01'
            };

            const patient = await patientService.create(patientData);
            
            expect(patient).toBeInstanceOf(Patient);
            expect(patient.name[0].family).toBe('TestPatient');
            expect(patient.gender).toBe('male');
            expect(patient.id).toBeDefined();
        });

        test('fails to create patient with invalid data', async () => {
            const invalidData = {
                name: [], // Empty name array
                gender: 'invalid'
            };

            await expect(patientService.create(invalidData))
                .rejects.toThrow('Patient validation failed');
        });

        test('reads existing patient by ID', async () => {
            const patient = await patientService.read('patient-001');
            
            expect(patient).toBeDefined();
            expect(patient.id).toBe('patient-001');
            expect(patient.name[0].family).toBe('Doe');
        });

        test('returns null for non-existent patient', async () => {
            const patient = await patientService.read('non-existent-id');
            
            expect(patient).toBeNull();
        });

        test('updates existing patient', async () => {
            const updateData = {
                gender: 'other',
                telecom: [{
                    system: 'email',
                    value: 'updated@example.com'
                }]
            };

            const updatedPatient = await patientService.update('patient-001', updateData);
            
            expect(updatedPatient.gender).toBe('other');
            expect(updatedPatient.telecom[0].value).toBe('updated@example.com');
            expect(updatedPatient.name[0].family).toBe('Doe'); // Original data preserved
        });

        test('fails to update non-existent patient', async () => {
            const updateData = { gender: 'other' };

            await expect(patientService.update('non-existent-id', updateData))
                .rejects.toThrow('Patient not found');
        });

        test('deletes existing patient', async () => {
            const deleted = await patientService.delete('patient-001');
            
            expect(deleted).toBe(true);
            
            const patient = await patientService.read('patient-001');
            expect(patient).toBeNull();
        });

        test('returns false when deleting non-existent patient', async () => {
            const deleted = await patientService.delete('non-existent-id');
            
            expect(deleted).toBe(false);
        });
    });

    describe('Patient Search', () => {
        test('searches patients by name', async () => {
            const results = await patientService.search({ name: 'Doe' });
            
            expect(results.total).toBeGreaterThan(0);
            expect(results.patients).toBeDefined();
            expect(results.patients[0].name[0].family).toBe('Doe');
        });

        test('searches patients by gender', async () => {
            const results = await patientService.search({ gender: 'female' });
            
            expect(results.total).toBeGreaterThan(0);
            expect(results.patients.every(p => p.gender === 'female')).toBe(true);
        });

        test('searches patients by birth date', async () => {
            const results = await patientService.search({ birthdate: '1990-07-22' });
            
            expect(results.total).toBeGreaterThan(0);
            expect(results.patients[0].birthDate).toBe('1990-07-22');
        });

        test('searches patients by active status', async () => {
            const results = await patientService.search({ active: 'true' });
            
            expect(results.total).toBeGreaterThan(0);
            expect(results.patients.every(p => p.active === true)).toBe(true);
        });

        test('searches patients by identifier', async () => {
            const results = await patientService.search({ identifier: 'WQX001' });
            
            expect(results.total).toBe(1);
            expect(results.patients[0].identifier[0].value).toBe('WQX001');
        });

        test('handles pagination correctly', async () => {
            const results = await patientService.search({ _offset: 0, _count: 1 });
            
            expect(results.total).toBeGreaterThan(1);
            expect(results.patients).toHaveLength(1);
            expect(results.offset).toBe(0);
            expect(results.count).toBe(1);
        });

        test('returns empty results for no matches', async () => {
            const results = await patientService.search({ name: 'NonExistentName' });
            
            expect(results.total).toBe(0);
            expect(results.patients).toHaveLength(0);
        });
    });

    describe('Patient Validation', () => {
        test('validates search parameters correctly', () => {
            const validParams = {
                name: 'test',
                gender: 'male',
                _offset: '0',
                _count: '10'
            };

            const validation = patientService.validateSearchParams(validParams);
            
            expect(validation.isValid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        test('rejects invalid search parameters', () => {
            const invalidParams = {
                invalidParam: 'test',
                gender: 'invalid',
                _offset: '-1',
                _count: '200'
            };

            const validation = patientService.validateSearchParams(invalidParams);
            
            expect(validation.isValid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);
        });
    });

    describe('Patient Utilities', () => {
        test('gets patient summaries', async () => {
            const summaries = await patientService.getSummaries();
            
            expect(Array.isArray(summaries)).toBe(true);
            expect(summaries.length).toBeGreaterThan(0);
            expect(summaries[0]).toHaveProperty('id');
            expect(summaries[0]).toHaveProperty('name');
            expect(summaries[0]).toHaveProperty('gender');
        });

        test('gets patient count', () => {
            const count = patientService.getCount();
            
            expect(typeof count).toBe('number');
            expect(count).toBeGreaterThan(0);
        });

        test('finds patient by identifier', () => {
            const identifiers = [{
                system: 'http://webqx.health/patient-id',
                value: 'WQX001'
            }];

            const patient = patientService.findByIdentifier(identifiers);
            
            expect(patient).toBeDefined();
            expect(patient.identifier[0].value).toBe('WQX001');
        });

        test('returns null for non-matching identifier', () => {
            const identifiers = [{
                system: 'http://example.com',
                value: 'NON-EXISTENT'
            }];

            const patient = patientService.findByIdentifier(identifiers);
            
            expect(patient).toBeNull();
        });
    });

    describe('Error Handling', () => {
        test('handles duplicate identifier creation', async () => {
            const duplicateData = {
                name: [{ family: 'Duplicate' }],
                identifier: [{
                    system: 'http://webqx.health/patient-id',
                    value: 'WQX001' // Already exists
                }]
            };

            await expect(patientService.create(duplicateData))
                .rejects.toThrow('Patient with this identifier already exists');
        });

        test('handles update with invalid data', async () => {
            const invalidUpdate = {
                gender: 'invalid-gender'
            };

            await expect(patientService.update('patient-002', invalidUpdate))
                .rejects.toThrow('Patient validation failed');
        });
    });
});