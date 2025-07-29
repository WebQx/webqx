# Interoperability Examples

This directory contains comprehensive examples demonstrating how to use the WebQX™ Interoperability Module.

## Available Examples

### usage-examples.ts
Complete TypeScript examples showing:
- **FHIR R4 Service Usage**: Creating services, retrieving patients, searching, and creating new resources
- **openEHR Service Usage**: Working with compositions, templates, AQL queries, and EHR management
- **Data Validation**: Validating FHIR resources, openEHR compositions, healthcare identifiers, and clinical codes
- **Data Transformation**: Converting between FHIR and openEHR formats
- **Configuration**: Working with supported standards and version information

## Running the Examples

### From TypeScript (Development)
```bash
# Install dependencies if needed
npm install

# Run the examples with ts-node
npx ts-node interoperability/examples/usage-examples.ts
```

### Import in Your Code
```typescript
import {
  exampleFHIRService,
  exampleOpenEHRService,
  exampleValidation,
  exampleTransformation,
  runAllExamples
} from './interoperability/examples/usage-examples';

// Run specific examples
await exampleFHIRService();
exampleValidation();

// Or run all examples
await runAllExamples();
```

## Example Code Snippets

### Quick FHIR Service Setup
```typescript
import { createFHIRService } from '../index';

const fhirService = createFHIRService({
  baseUrl: 'https://your-fhir-server.com/fhir',
  authToken: 'your-token', // Optional
  timeout: 30000
});

// Get a patient
const patient = await fhirService.getPatient('patient-id');
```

### Quick openEHR Service Setup
```typescript
import { createOpenEHRService } from '../index';

const openEHRService = createOpenEHRService({
  baseUrl: 'https://your-openehr-server.com',
  username: 'your-username',
  password: 'your-password'
});

// Execute AQL query
const results = await openEHRService.executeAQL({
  q: 'SELECT c FROM COMPOSITION c'
});
```

### Quick Validation
```typescript
import { validateFHIRResource, validateClinicalCoding } from '../index';

// Validate a FHIR resource
const validation = validateFHIRResource(yourFHIRResource);
if (!validation.isValid) {
  console.log('Errors:', validation.errors);
}

// Validate clinical codes
const codeValidation = validateClinicalCoding('12345678', 'http://snomed.info/sct');
```

### Quick Transformation
```typescript
import { transformFHIRPatientToOpenEHR } from '../index';

const openEHRData = transformFHIRPatientToOpenEHR(fhirPatient, {
  includeMetadata: true,
  preserveOriginalIds: true
});

console.log('Transformed to:', openEHRData.metadata.targetStandard);
```

## Additional Resources

- [Main Interoperability README](../README.md) - Complete module documentation
- [FHIR R4 README](../fhir/r4/README.md) - FHIR-specific documentation
- [openEHR README](../openehr/README.md) - openEHR-specific documentation
- [Example FHIR Patient](../fhir/r4/examples/patient-example.json) - Sample FHIR resource
- [Example openEHR Composition](../openehr/examples/person-demographics-composition.json) - Sample openEHR composition

## Contributing Examples

When adding new examples:

1. **Follow the existing pattern** in `usage-examples.ts`
2. **Include error handling** to demonstrate best practices
3. **Add TypeScript types** for better developer experience
4. **Document any prerequisites** (server setup, authentication, etc.)
5. **Test your examples** before committing
6. **Update this README** to include your new examples

## Common Use Cases

### Healthcare Integration Project
```typescript
// 1. Set up services for both standards
const fhir = createFHIRService({ baseUrl: 'https://fhir.example.com/fhir' });
const openEHR = createOpenEHRService({ baseUrl: 'https://openehr.example.com' });

// 2. Retrieve data from FHIR
const patient = await fhir.getPatient('patient-123');

// 3. Transform to openEHR format
const demographics = transformFHIRPatientToOpenEHR(patient.data);

// 4. Store in openEHR system
await openEHR.createComposition('ehr-456', 'demographics-template', demographics.data);
```

### Data Validation Pipeline
```typescript
// Validate all incoming data
const fhirValidation = validateFHIRResource(incomingData);
if (!fhirValidation.isValid) {
  throw new Error(`Invalid FHIR data: ${fhirValidation.errors.map(e => e.message).join(', ')}`);
}

// Validate clinical codes
for (const coding of extractClinicalCodes(incomingData)) {
  const codeValidation = validateClinicalCoding(coding.code, coding.system);
  if (!codeValidation.isValid) {
    console.warn(`Invalid clinical code: ${coding.code}`);
  }
}
```

### Multi-Standard Data Exchange
```typescript
// Receive FHIR data
const fhirPatient = await fhir.getPatient('123');

// Convert to openEHR
const openEHRDemographics = transformFHIRPatientToOpenEHR(fhirPatient.data);

// Validate the transformation
const validation = validateOpenEHRComposition(openEHRDemographics.data);
if (validation.isValid) {
  await openEHR.createComposition('ehr-456', 'template-id', openEHRDemographics.data);
}
```