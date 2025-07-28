const Patient = require('../models/Patient');

describe('FHIR Patient Model', () => {
    describe('Patient Creation', () => {
        test('creates a valid patient with minimal data', () => {
            const patientData = {
                name: [{
                    family: 'Doe',
                    given: ['John']
                }]
            };

            const patient = new Patient(patientData);
            
            expect(patient.resourceType).toBe('Patient');
            expect(patient.id).toBeDefined();
            expect(patient.name).toEqual(patientData.name);
            expect(patient.active).toBe(true);
            expect(patient.meta).toBeDefined();
            expect(patient.meta.lastUpdated).toBeDefined();
        });

        test('creates patient with full data', () => {
            const patientData = {
                id: 'test-patient-001',
                identifier: [{
                    system: 'http://webqx.health/patient-id',
                    value: 'WQX001'
                }],
                active: true,
                name: [{
                    use: 'official',
                    family: 'Smith',
                    given: ['Jane', 'Elizabeth']
                }],
                telecom: [{
                    system: 'email',
                    value: 'jane.smith@example.com'
                }],
                gender: 'female',
                birthDate: '1990-05-15',
                address: [{
                    line: ['123 Main St'],
                    city: 'Anytown',
                    state: 'NY',
                    postalCode: '12345'
                }]
            };

            const patient = new Patient(patientData);
            
            expect(patient.id).toBe('test-patient-001');
            expect(patient.gender).toBe('female');
            expect(patient.birthDate).toBe('1990-05-15');
            expect(patient.identifier).toEqual(patientData.identifier);
        });

        test('generates UUID when no ID provided', () => {
            const patient = new Patient();
            
            expect(patient.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
        });
    });

    describe('Patient Validation', () => {
        test('validates a correct patient', () => {
            const patient = new Patient({
                name: [{
                    family: 'Doe',
                    given: ['John']
                }],
                gender: 'male',
                birthDate: '1985-01-01'
            });

            const validation = patient.validate();
            
            expect(validation.isValid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        test('fails validation with missing name', () => {
            const patient = new Patient({
                gender: 'male'
            });

            const validation = patient.validate();
            
            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain('At least one name is required');
        });

        test('fails validation with invalid gender', () => {
            const patient = new Patient({
                name: [{ family: 'Doe' }],
                gender: 'invalid'
            });

            const validation = patient.validate();
            
            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain('Gender must be one of: male, female, other, unknown');
        });

        test('fails validation with invalid birth date', () => {
            const patient = new Patient({
                name: [{ family: 'Doe' }],
                birthDate: 'invalid-date'
            });

            const validation = patient.validate();
            
            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain('Birth date must be a valid date in YYYY-MM-DD format');
        });

        test('validates name structure', () => {
            const patient = new Patient({
                name: [{}] // Empty name object
            });

            const validation = patient.validate();
            
            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain('Name[0] must have either family or given name');
        });
    });

    describe('Patient Methods', () => {
        test('converts to JSON correctly', () => {
            const patientData = {
                name: [{
                    family: 'Doe',
                    given: ['John']
                }],
                gender: 'male',
                birthDate: '1985-01-01'
            };

            const patient = new Patient(patientData);
            const json = patient.toJSON();
            
            expect(json.resourceType).toBe('Patient');
            expect(json.name).toEqual(patientData.name);
            expect(json.gender).toBe('male');
            expect(json.birthDate).toBe('1985-01-01');
            expect(json.id).toBeDefined();
            expect(json.meta).toBeDefined();
        });

        test('omits empty arrays from JSON', () => {
            const patient = new Patient({
                name: [{ family: 'Doe' }]
            });

            const json = patient.toJSON();
            
            expect(json.identifier).toBeUndefined();
            expect(json.telecom).toBeUndefined();
            expect(json.address).toBeUndefined();
            expect(json.name).toBeDefined();
        });

        test('updates patient correctly', () => {
            const patient = new Patient({
                name: [{ family: 'Doe' }],
                gender: 'male'
            });

            const originalVersion = patient.meta.versionId;
            
            patient.update({
                gender: 'other',
                birthDate: '1990-01-01'
            });
            
            expect(patient.gender).toBe('other');
            expect(patient.birthDate).toBe('1990-01-01');
            expect(patient.meta.versionId).toBe(String(parseInt(originalVersion) + 1));
            expect(patient.name).toEqual([{ family: 'Doe' }]); // Original data preserved
        });

        test('creates summary correctly', () => {
            const patient = new Patient({
                name: [{
                    given: ['John'],
                    family: 'Doe'
                }],
                gender: 'male',
                birthDate: '1985-01-01'
            });

            const summary = patient.getSummary();
            
            expect(summary.id).toBe(patient.id);
            expect(summary.name).toBe('John Doe');
            expect(summary.gender).toBe('male');
            expect(summary.birthDate).toBe('1985-01-01');
            expect(summary.active).toBe(true);
            expect(summary.lastUpdated).toBeDefined();
        });

        test('handles name display correctly', () => {
            const patientWithGiven = new Patient({
                name: [{ given: ['Jane', 'Elizabeth'] }]
            });
            
            const patientWithFamily = new Patient({
                name: [{ family: 'Smith' }]
            });
            
            const patientEmpty = new Patient({
                name: [{}]
            });
            
            expect(patientWithGiven.getSummary().name).toBe('Jane Elizabeth');
            expect(patientWithFamily.getSummary().name).toBe('Smith');
            expect(patientEmpty.getSummary().name).toBe('Unknown Name');
        });
    });

    describe('Static Methods', () => {
        test('creates patient from FHIR JSON', () => {
            const fhirJson = {
                resourceType: 'Patient',
                id: 'test-123',
                name: [{ family: 'Test' }]
            };

            const patient = Patient.fromFHIR(fhirJson);
            
            expect(patient).toBeInstanceOf(Patient);
            expect(patient.id).toBe('test-123');
            expect(patient.name).toEqual([{ family: 'Test' }]);
        });

        test('throws error for invalid resource type', () => {
            const invalidJson = {
                resourceType: 'Observation',
                id: 'test-123'
            };

            expect(() => {
                Patient.fromFHIR(invalidJson);
            }).toThrow('Invalid FHIR resource type. Expected Patient.');
        });
    });

    describe('Date Validation', () => {
        test('validates correct date formats', () => {
            const patient = new Patient();
            
            expect(patient.isValidDate('2023-12-31')).toBe(true);
            expect(patient.isValidDate('1900-01-01')).toBe(true);
            expect(patient.isValidDate('2000-02-29')).toBe(true); // Leap year
        });

        test('rejects invalid date formats', () => {
            const patient = new Patient();
            
            expect(patient.isValidDate('23-12-31')).toBe(false);
            expect(patient.isValidDate('2023-13-01')).toBe(false);
            expect(patient.isValidDate('2023-02-30')).toBe(false);
            expect(patient.isValidDate('not-a-date')).toBe(false);
            expect(patient.isValidDate('')).toBe(false);
        });
    });
});