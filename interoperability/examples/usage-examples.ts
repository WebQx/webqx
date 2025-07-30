/**
 * WebQX™ Interoperability Module Usage Examples
 * Demonstrates how to use the various features of the interoperability module
 */

import {
  createFHIRService,
  createOpenEHRService,
  validateFHIRResource,
  validateOpenEHRComposition,
  validateHealthcareIdentifier,
  validateClinicalCoding,
  transformFHIRPatientToOpenEHR,
  transformOpenEHRToFHIRPatient,
  SUPPORTED_STANDARDS,
  FHIRPatient,
  OpenEHRComposition
} from '../index';

/**
 * Example 1: Creating and Using FHIR R4 Service
 */
async function exampleFHIRService() {
  console.log('Example 1: FHIR R4 Service Usage');
  console.log('================================');

  // Create FHIR service with authentication
  const fhirService = createFHIRService({
    baseUrl: 'https://hapi.fhir.org/baseR4',
    authToken: 'your-auth-token-here', // Optional
    timeout: 30000
  });

  try {
    // Get a patient by ID
    const patient = await fhirService.getPatient('example-patient-id');
    console.log('Retrieved patient:', patient.data.name?.[0]?.family);

    // Search for patients
    const searchResults = await fhirService.searchPatients({
      family: 'Smith',
      active: true,
      _count: '10'
    });
    console.log('Found patients:', searchResults.data.total);

    // Create a new patient
    const newPatient: FHIRPatient = {
      resourceType: 'Patient',
      active: true,
      name: [{
        use: 'official',
        family: 'Johnson',
        given: ['Alice']
      }],
      gender: 'female',
      birthDate: '1990-05-15'
    };

    const created = await fhirService.createPatient(newPatient);
    console.log('Created patient with ID:', created.data.id);

  } catch (error) {
    console.log('FHIR operation failed:', error);
  }
}

/**
 * Example 2: Creating and Using openEHR Service
 */
async function exampleOpenEHRService() {
  console.log('\nExample 2: openEHR Service Usage');
  console.log('================================');

  // Create openEHR service with credentials
  const openEHRService = createOpenEHRService({
    baseUrl: 'https://your-openehr-server.com',
    username: 'your-username',
    password: 'your-password',
    timeout: 30000
  });

  try {
    // Get templates
    const templates = await openEHRService.getTemplates();
    console.log('Available templates:', templates.length);

    // Execute an AQL query
    const queryResult = await openEHRService.executeAQL({
      q: 'SELECT c FROM COMPOSITION c WHERE c/name/value = "Patient Demographics"',
      query_parameters: {},
      offset: 0,
      fetch: 10
    });
    console.log('Query result rows:', queryResult.rows?.length || 0);

    // Create a new EHR
    const newEHR = await openEHRService.createEHR();
    console.log('Created EHR:', newEHR);

  } catch (error) {
    console.log('openEHR operation failed:', error);
  }
}

/**
 * Example 3: Data Validation
 */
function exampleValidation() {
  console.log('\nExample 3: Data Validation');
  console.log('==========================');

  // Validate FHIR Patient
  const patient: FHIRPatient = {
    resourceType: 'Patient',
    active: true,
    name: [{
      family: 'Doe',
      given: ['John']
    }],
    gender: 'male',
    birthDate: '1985-03-15'
  };

  const fhirValidation = validateFHIRResource(patient);
  console.log('FHIR Patient validation:', {
    isValid: fhirValidation.isValid,
    errors: fhirValidation.errors.length,
    warnings: fhirValidation.warnings.length
  });

  // Validate openEHR Composition
  const composition: OpenEHRComposition = {
    archetype_node_id: 'openEHR-EHR-COMPOSITION.encounter.v1',
    name: { value: 'Patient Encounter' },
    composer: { name: 'Dr. Smith' },
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

  const openEHRValidation = validateOpenEHRComposition(composition);
  console.log('openEHR Composition validation:', {
    isValid: openEHRValidation.isValid,
    errors: openEHRValidation.errors.length,
    warnings: openEHRValidation.warnings.length
  });

  // Validate healthcare identifiers
  const mrnValidation = validateHealthcareIdentifier('MRN123456', 'mrn');
  console.log('Medical Record Number validation:', mrnValidation.isValid);

  const ssnValidation = validateHealthcareIdentifier('123-45-6789', 'ssn');
  console.log('Social Security Number validation:', ssnValidation.isValid);

  // Validate clinical coding
  const snomedValidation = validateClinicalCoding('38341003', 'http://snomed.info/sct');
  console.log('SNOMED CT code validation:', snomedValidation.isValid);

  const icd10Validation = validateClinicalCoding('Z00.00', 'http://hl7.org/fhir/sid/icd-10');
  console.log('ICD-10 code validation:', icd10Validation.isValid);
}

/**
 * Example 4: Data Transformation
 */
function exampleTransformation() {
  console.log('\nExample 4: Data Transformation');
  console.log('==============================');

  // Sample FHIR Patient
  const fhirPatient: FHIRPatient = {
    resourceType: 'Patient',
    id: 'patient-123',
    active: true,
    identifier: [{
      use: 'usual',
      system: 'http://hospital.example.org/mrn',
      value: 'MRN123456'
    }],
    name: [{
      use: 'official',
      family: 'Smith',
      given: ['John', 'William']
    }],
    gender: 'male',
    birthDate: '1985-03-15',
    telecom: [{
      system: 'email',
      value: 'john.smith@example.com',
      use: 'home'
    }]
  };

  // Transform FHIR Patient to openEHR Demographics
  const transformResult = transformFHIRPatientToOpenEHR(fhirPatient, {
    includeMetadata: true,
    preserveOriginalIds: true,
    validateOutput: true
  });

  console.log('FHIR to openEHR transformation:', {
    sourceStandard: transformResult.metadata.sourceStandard,
    targetStandard: transformResult.metadata.targetStandard,
    originalId: transformResult.metadata.originalId,
    warnings: transformResult.warnings.length,
    hasContent: transformResult.data.content ? transformResult.data.content.length > 0 : false
  });

  // Transform back from openEHR to FHIR
  if (transformResult.data.content) {
    const reverseTransform = transformOpenEHRToFHIRPatient(transformResult.data as OpenEHRComposition, {
      includeMetadata: true,
      preserveOriginalIds: true
    });

    console.log('openEHR to FHIR transformation:', {
      sourceStandard: reverseTransform.metadata.sourceStandard,
      targetStandard: reverseTransform.metadata.targetStandard,
      hasNames: reverseTransform.data.name ? reverseTransform.data.name.length > 0 : false,
      hasIdentifiers: reverseTransform.data.identifier ? reverseTransform.data.identifier.length > 0 : false
    });
  }
}

/**
 * Example 5: Configuration and Standards Information
 */
function exampleConfiguration() {
  console.log('\nExample 5: Configuration and Standards');
  console.log('=====================================');

  console.log('Supported Standards:', SUPPORTED_STANDARDS);

  // Check if a specific standard version is supported
  const supportsFHIRR5 = SUPPORTED_STANDARDS.FHIR.versions.includes('R5');
  console.log('Supports FHIR R5:', supportsFHIRR5);

  const supportsOpenEHR104 = SUPPORTED_STANDARDS.OPENEHR.versions.includes('1.0.4');
  console.log('Supports openEHR 1.0.4:', supportsOpenEHR104);

  // Get current versions
  console.log('Current FHIR version:', SUPPORTED_STANDARDS.FHIR.current);
  console.log('Current openEHR version:', SUPPORTED_STANDARDS.OPENEHR.current);
  console.log('Current HL7 v2 version:', SUPPORTED_STANDARDS.HL7V2.current);
}

/**
 * Main function to run all examples
 */
async function runAllExamples() {
  console.log('🌐 WebQX™ Interoperability Module Examples');
  console.log('===========================================\n');

  try {
    await exampleFHIRService();
    await exampleOpenEHRService();
    exampleValidation();
    exampleTransformation();
    exampleConfiguration();

    console.log('\n✨ All examples completed successfully!');
    console.log('📚 For more information, see the interoperability module documentation.');

  } catch (error) {
    console.error('❌ Error running examples:', error);
  }
}

// Export functions for use in other files
export {
  exampleFHIRService,
  exampleOpenEHRService,
  exampleValidation,
  exampleTransformation,
  exampleConfiguration,
  runAllExamples
};

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples();
}