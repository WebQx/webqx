/**
 * Test suite for the interoperability module
 */

import { 
  FHIRR4Service,
  OpenEHRService,
  CrossStandardValidator,
  FHIRToOpenEHRTransformer,
  SUPPORTED_STANDARDS,
  createFHIRService,
  createOpenEHRService
} from '../index';

describe('Interoperability Module', () => {
  describe('Exports', () => {
    test('should export FHIR R4 service', () => {
      expect(FHIRR4Service).toBeDefined();
      expect(typeof FHIRR4Service).toBe('function');
    });

    test('should export openEHR service', () => {
      expect(OpenEHRService).toBeDefined();
      expect(typeof OpenEHRService).toBe('function');
    });

    test('should export cross-standard validator', () => {
      expect(CrossStandardValidator).toBeDefined();
      expect(typeof CrossStandardValidator).toBe('function');
    });

    test('should export transformers', () => {
      expect(FHIRToOpenEHRTransformer).toBeDefined();
      expect(typeof FHIRToOpenEHRTransformer).toBe('function');
    });

    test('should export supported standards configuration', () => {
      expect(SUPPORTED_STANDARDS).toBeDefined();
      expect(SUPPORTED_STANDARDS.FHIR).toBeDefined();
      expect(SUPPORTED_STANDARDS.OPENEHR).toBeDefined();
      expect(SUPPORTED_STANDARDS.HL7V2).toBeDefined();
    });
  });

  describe('Factory Functions', () => {
    test('should create FHIR service with minimal config', () => {
      const service = createFHIRService({
        baseUrl: 'https://test-fhir.example.com/fhir'
      });
      
      expect(service).toBeInstanceOf(FHIRR4Service);
    });

    test('should create FHIR service with auth token', () => {
      const service = createFHIRService({
        baseUrl: 'https://test-fhir.example.com/fhir',
        authToken: 'test-token-123'
      });
      
      expect(service).toBeInstanceOf(FHIRR4Service);
    });

    test('should create openEHR service with username/password', () => {
      const service = createOpenEHRService({
        baseUrl: 'https://test-openehr.example.com',
        username: 'testuser',
        password: 'testpass'
      });
      
      expect(service).toBeInstanceOf(OpenEHRService);
    });

    test('should create openEHR service with API key', () => {
      const service = createOpenEHRService({
        baseUrl: 'https://test-openehr.example.com',
        apiKey: 'test-api-key-123'
      });
      
      expect(service).toBeInstanceOf(OpenEHRService);
    });
  });

  describe('Configuration', () => {
    test('should have correct FHIR configuration', () => {
      expect(SUPPORTED_STANDARDS.FHIR.current).toBe('R4');
      expect(SUPPORTED_STANDARDS.FHIR.versions).toContain('R4');
      expect(SUPPORTED_STANDARDS.FHIR.versions).toContain('R5');
    });

    test('should have correct openEHR configuration', () => {
      expect(SUPPORTED_STANDARDS.OPENEHR.current).toBe('1.0.4');
      expect(SUPPORTED_STANDARDS.OPENEHR.versions).toContain('1.0.2');
      expect(SUPPORTED_STANDARDS.OPENEHR.versions).toContain('1.0.3');
      expect(SUPPORTED_STANDARDS.OPENEHR.versions).toContain('1.0.4');
    });

    test('should have correct HL7 v2 configuration', () => {
      expect(SUPPORTED_STANDARDS.HL7V2.current).toBe('2.8');
      expect(SUPPORTED_STANDARDS.HL7V2.versions).toContain('2.5');
      expect(SUPPORTED_STANDARDS.HL7V2.versions).toContain('2.6');
      expect(SUPPORTED_STANDARDS.HL7V2.versions).toContain('2.7');
      expect(SUPPORTED_STANDARDS.HL7V2.versions).toContain('2.8');
    });
  });
});

describe('FHIR R4 Service', () => {
  let service: FHIRR4Service;

  beforeEach(() => {
    service = createFHIRService({
      baseUrl: 'https://test-fhir.example.com/fhir'
    });
  });

  test('should be instantiable', () => {
    expect(service).toBeInstanceOf(FHIRR4Service);
  });

  test('should have patient service methods', () => {
    expect(typeof service.getPatient).toBe('function');
    expect(typeof service.searchPatients).toBe('function');
    expect(typeof service.createPatient).toBe('function');
    expect(typeof service.updatePatient).toBe('function');
  });

  test('should have generic resource methods', () => {
    expect(typeof service.getResource).toBe('function');
    expect(typeof service.searchResources).toBe('function');
    expect(typeof service.createResource).toBe('function');
    expect(typeof service.updateResource).toBe('function');
    expect(typeof service.deleteResource).toBe('function');
  });

  test('should have batch operation support', () => {
    expect(typeof service.executeBatch).toBe('function');
  });

  test('should have capability statement support', () => {
    expect(typeof service.getCapabilityStatement).toBe('function');
  });
});

describe('openEHR Service', () => {
  let service: OpenEHRService;

  beforeEach(() => {
    service = createOpenEHRService({
      baseUrl: 'https://test-openehr.example.com',
      username: 'test',
      password: 'test'
    });
  });

  test('should be instantiable', () => {
    expect(service).toBeInstanceOf(OpenEHRService);
  });

  test('should have composition methods', () => {
    expect(typeof service.getComposition).toBe('function');
    expect(typeof service.createComposition).toBe('function');
    expect(typeof service.updateComposition).toBe('function');
    expect(typeof service.deleteComposition).toBe('function');
  });

  test('should have AQL query support', () => {
    expect(typeof service.executeAQL).toBe('function');
    expect(typeof service.getStoredQueries).toBe('function');
    expect(typeof service.executeStoredQuery).toBe('function');
  });

  test('should have template support', () => {
    expect(typeof service.getTemplates).toBe('function');
    expect(typeof service.getTemplate).toBe('function');
    expect(typeof service.uploadTemplate).toBe('function');
  });

  test('should have EHR management', () => {
    expect(typeof service.getEHR).toBe('function');
    expect(typeof service.createEHR).toBe('function');
    expect(typeof service.getEHRStatus).toBe('function');
  });
});

describe('Cross-Standard Validator', () => {
  test('should validate FHIR resources', () => {
    const validResource = {
      resourceType: 'Patient',
      id: 'test-123'
    };

    const result = CrossStandardValidator.validateFHIRResource(validResource);
    expect(result).toBeDefined();
    expect(typeof result.isValid).toBe('boolean');
    expect(Array.isArray(result.errors)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  test('should validate openEHR compositions', () => {
    const validComposition = {
      archetype_node_id: 'openEHR-EHR-COMPOSITION.encounter.v1',
      name: { value: 'Test Composition' },
      composer: { name: 'Test Composer' },
      category: {
        value: 'event',
        defining_code: {
          terminology_id: { value: 'openehr' },
          code_string: '433'
        }
      },
      territory: {
        terminology_id: { value: 'ISO_3166-1' },
        code_string: 'US'
      },
      language: {
        terminology_id: { value: 'ISO_639-1' },
        code_string: 'en'
      }
    };

    const result = CrossStandardValidator.validateOpenEHRComposition(validComposition);
    expect(result).toBeDefined();
    expect(typeof result.isValid).toBe('boolean');
    expect(Array.isArray(result.errors)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  test('should validate healthcare identifiers', () => {
    const result = CrossStandardValidator.validateHealthcareIdentifier('123456789', 'mrn');
    expect(result).toBeDefined();
    expect(typeof result.isValid).toBe('boolean');
  });

  test('should validate clinical coding', () => {
    const result = CrossStandardValidator.validateClinicalCoding('12345678', 'http://snomed.info/sct');
    expect(result).toBeDefined();
    expect(typeof result.isValid).toBe('boolean');
  });
});

describe('Data Transformers', () => {
  test('should transform FHIR Patient to openEHR', () => {
    const fhirPatient = {
      resourceType: 'Patient' as const,
      id: 'test-patient',
      name: [{
        use: 'official' as const,
        family: 'Doe',
        given: ['John']
      }],
      gender: 'male' as const,
      birthDate: '1990-01-01'
    };

    const result = FHIRToOpenEHRTransformer.transformPatientToDemographics(fhirPatient);
    
    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.metadata).toBeDefined();
    expect(result.metadata.sourceStandard).toBe('FHIR R4');
    expect(result.metadata.targetStandard).toBe('openEHR');
    expect(Array.isArray(result.warnings)).toBe(true);
  });
});