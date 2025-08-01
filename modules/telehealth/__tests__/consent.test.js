const Consent = require('../../../fhir/models/Consent');

describe('FHIR Consent Model', () => {
    describe('Consent Creation', () => {
        test('should create a valid consent resource', () => {
            const consent = new Consent({
                status: 'active',
                patient: { reference: 'Patient/123' },
                category: [{
                    coding: [{
                        system: 'http://loinc.org',
                        code: '59284-0',
                        display: 'Patient Consent'
                    }]
                }]
            });

            expect(consent.resourceType).toBe('Consent');
            expect(consent.status).toBe('active');
            expect(consent.patient.reference).toBe('Patient/123');
            expect(consent.id).toBeDefined();
            expect(consent.meta.lastUpdated).toBeDefined();
        });

        test('should create telehealth consent with factory method', () => {
            const options = {
                patientReference: { reference: 'Patient/456' },
                sessionId: 'session-123',
                consentMethod: 'electronic',
                ipAddress: '192.168.1.1',
                userAgent: 'Mozilla/5.0...'
            };

            const consent = Consent.createTelehealthConsent(options);

            expect(consent.resourceType).toBe('Consent');
            expect(consent.status).toBe('active');
            expect(consent.patient.reference).toBe('Patient/456');
            expect(consent.provision.type).toBe('permit');
            expect(consent.extension).toHaveLength(1);
            expect(consent.extension[0].url).toBe('http://webqx.health/fhir/StructureDefinition/telehealth-consent');
        });
    });

    describe('Consent Validation', () => {
        test('should validate a correct consent resource', () => {
            const consent = new Consent({
                status: 'active',
                patient: { reference: 'Patient/123' },
                scope: {
                    coding: [{
                        system: 'http://terminology.hl7.org/CodeSystem/consentscope',
                        code: 'treatment'
                    }]
                },
                category: [{
                    coding: [{
                        system: 'http://loinc.org',
                        code: '59284-0'
                    }]
                }]
            });

            const validation = consent.validate();
            expect(validation.isValid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        test('should fail validation for missing required fields', () => {
            const consent = new Consent({
                status: 'invalid-status',
                // Missing patient reference
            });

            const validation = consent.validate();
            expect(validation.isValid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);
            expect(validation.errors).toContain('Status must be one of: draft, proposed, active, rejected, inactive, entered-in-error');
            expect(validation.errors).toContain('Patient reference is required');
        });
    });

    describe('Consent Status', () => {
        test('should check if consent is active', () => {
            const activeConsent = new Consent({
                status: 'active',
                patient: { reference: 'Patient/123' }
            });

            expect(activeConsent.isActive()).toBe(true);
        });

        test('should check if consent is inactive', () => {
            const inactiveConsent = new Consent({
                status: 'inactive',
                patient: { reference: 'Patient/123' }
            });

            expect(inactiveConsent.isActive()).toBe(false);
        });

        test('should check consent with time period', () => {
            const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // Tomorrow
            const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // Yesterday

            const futureConsent = new Consent({
                status: 'active',
                patient: { reference: 'Patient/123' },
                provision: {
                    type: 'permit',
                    period: {
                        start: futureDate
                    }
                }
            });

            const expiredConsent = new Consent({
                status: 'active',
                patient: { reference: 'Patient/123' },
                provision: {
                    type: 'permit',
                    period: {
                        end: pastDate
                    }
                }
            });

            expect(futureConsent.isActive()).toBe(false); // Not yet active
            expect(expiredConsent.isActive()).toBe(false); // Expired
        });
    });

    describe('Consent Verification', () => {
        test('should add verification to consent', () => {
            const consent = new Consent({
                status: 'active',
                patient: { reference: 'Patient/123' }
            });

            consent.addVerification({
                verified: true,
                verifiedWith: { reference: 'Patient/123' },
                verifiedBy: { reference: 'Practitioner/456' }
            });

            expect(consent.verification).toHaveLength(1);
            expect(consent.verification[0].verified).toBe(true);
            expect(consent.verification[0].verificationDate).toBeDefined();
        });
    });

    describe('JSON Serialization', () => {
        test('should serialize to valid FHIR JSON', () => {
            const consent = new Consent({
                status: 'active',
                patient: { reference: 'Patient/123' }
            });

            const json = consent.toJSON();

            expect(json.resourceType).toBe('Consent');
            expect(json.id).toBeDefined();
            expect(json.meta).toBeDefined();
            expect(json.status).toBe('active');
            expect(json.patient.reference).toBe('Patient/123');
        });

        test('should exclude empty arrays from JSON', () => {
            const consent = new Consent({
                status: 'active',
                patient: { reference: 'Patient/123' },
                performer: [] // Empty array
            });

            const json = consent.toJSON();

            expect(json.performer).toBeUndefined(); // Empty arrays should not be included
        });
    });

    describe('Factory Methods', () => {
        test('should create from FHIR JSON', () => {
            const fhirJson = {
                resourceType: 'Consent',
                id: 'test-consent',
                status: 'active',
                patient: { reference: 'Patient/123' },
                scope: {
                    coding: [{
                        system: 'http://terminology.hl7.org/CodeSystem/consentscope',
                        code: 'treatment'
                    }]
                },
                category: [{
                    coding: [{
                        system: 'http://loinc.org',
                        code: '59284-0'
                    }]
                }]
            };

            const consent = Consent.fromFHIR(fhirJson);

            expect(consent.resourceType).toBe('Consent');
            expect(consent.id).toBe('test-consent');
            expect(consent.status).toBe('active');
        });

        test('should reject invalid FHIR JSON', () => {
            const invalidJson = {
                resourceType: 'Patient', // Wrong resource type
                id: 'test-consent'
            };

            expect(() => Consent.fromFHIR(invalidJson)).toThrow('Invalid FHIR resource type. Expected Consent.');
        });
    });
});