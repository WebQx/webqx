/**
 * Tests for HL7 to FHIR Observation Transformer
 */

import { hl7ToFhirTransformer, convertHL7DateTime, mapCodingSystemToFHIR, mapResultStatusToFHIR, mapAbnormalFlagsToFHIR } from '../hl7-to-fhir-transformer';

// Mock HL7 message structure as it would appear in Mirth Connect
const createMockHL7Message = (overrides: any = {}) => ({
  MSH: {
    'MSH.9': {
      'MSH.9.1': 'ORU'
    },
    ...overrides.MSH
  },
  PID: {
    'PID.3': {
      'PID.3.1': '12345'
    },
    'PID.5': {
      'PID.5.1': 'Doe',
      'PID.5.2': 'John'
    },
    ...overrides.PID
  },
  OBR: {
    'OBR.7': '20250730110000',
    ...overrides.OBR
  },
  OBX: {
    'OBX.2': 'NM',
    'OBX.3': {
      'OBX.3.1': '789-8',
      'OBX.3.2': 'Hemoglobin',
      'OBX.3.3': 'LN'
    },
    'OBX.5': '13.5',
    'OBX.6': 'g/dL',
    'OBX.7': '12.0-16.0',
    'OBX.8': 'N',
    'OBX.11': 'F',
    ...overrides.OBX
  }
});

describe('HL7 to FHIR Transformer', () => {
  // Mock global functions that would be available in Mirth Connect
  beforeAll(() => {
    (global as any).logger = {
      error: jest.fn()
    };
  });

  describe('hl7ToFhirTransformer', () => {
    it('should transform a valid HL7 ORU message to FHIR Observation', () => {
      const mockMsg = createMockHL7Message();
      const result = hl7ToFhirTransformer(mockMsg);
      
      expect(result).toBeDefined();
      const observation = JSON.parse(result);
      
      expect(observation.resourceType).toBe('Observation');
      expect(observation.status).toBe('final');
      expect(observation.category[0].coding[0].code).toBe('laboratory');
      expect(observation.code.coding[0].code).toBe('789-8');
      expect(observation.code.coding[0].display).toBe('Hemoglobin');
      expect(observation.code.coding[0].system).toBe('http://loinc.org');
      expect(observation.subject.reference).toBe('Patient/12345');
      expect(observation.valueQuantity.value).toBe(13.5);
      expect(observation.valueQuantity.unit).toBe('g/dL');
      expect(observation.referenceRange[0].text).toBe('12.0-16.0');
    });

    it('should handle missing MSH segment', () => {
      const result = hl7ToFhirTransformer({});
      const operationOutcome = JSON.parse(result);
      
      expect(operationOutcome.resourceType).toBe('OperationOutcome');
      expect(operationOutcome.issue[0].severity).toBe('error');
    });

    it('should handle non-ORU message types', () => {
      const mockMsg = createMockHL7Message({
        MSH: {
          'MSH.9': {
            'MSH.9.1': 'ADT'
          }
        }
      });
      
      const result = hl7ToFhirTransformer(mockMsg);
      const operationOutcome = JSON.parse(result);
      
      expect(operationOutcome.resourceType).toBe('OperationOutcome');
      expect(operationOutcome.issue[0].details.text).toContain('Unsupported message type: ADT');
    });

    it('should handle missing PID segment', () => {
      const mockMsg = createMockHL7Message();
      delete mockMsg.PID;
      
      const result = hl7ToFhirTransformer(mockMsg);
      const operationOutcome = JSON.parse(result);
      
      expect(operationOutcome.resourceType).toBe('OperationOutcome');
      expect(operationOutcome.issue[0].details.text).toContain('Missing required PID segment');
    });

    it('should handle missing OBX segment', () => {
      const mockMsg = createMockHL7Message();
      delete mockMsg.OBX;
      
      const result = hl7ToFhirTransformer(mockMsg);
      const operationOutcome = JSON.parse(result);
      
      expect(operationOutcome.resourceType).toBe('OperationOutcome');
      expect(operationOutcome.issue[0].details.text).toContain('Missing required OBX segment');
    });

    it('should handle array of OBX segments and create Bundle', () => {
      const mockMsg = createMockHL7Message({
        OBX: [
          {
            'OBX.2': 'NM',
            'OBX.3': {
              'OBX.3.1': '789-8',
              'OBX.3.2': 'Hemoglobin',
              'OBX.3.3': 'LN'
            },
            'OBX.5': '13.5',
            'OBX.6': 'g/dL',
            'OBX.7': '12.0-16.0',
            'OBX.8': 'N',
            'OBX.11': 'F'
          },
          {
            'OBX.2': 'NM',
            'OBX.3': {
              'OBX.3.1': '718-7',
              'OBX.3.2': 'Hemoglobin [Mass/volume] in Blood',
              'OBX.3.3': 'LN'
            },
            'OBX.5': '42.0',
            'OBX.6': '%',
            'OBX.7': '36.0-48.0',
            'OBX.8': 'N',
            'OBX.11': 'F'
          }
        ]
      });
      
      const result = hl7ToFhirTransformer(mockMsg);
      const bundle = JSON.parse(result);
      
      expect(bundle.resourceType).toBe('Bundle');
      expect(bundle.type).toBe('collection');
      expect(bundle.total).toBe(2);
      expect(bundle.entry).toHaveLength(2);
      expect(bundle.entry[0].resource.resourceType).toBe('Observation');
      expect(bundle.entry[1].resource.resourceType).toBe('Observation');
    });

    it('should handle text values (ST value type)', () => {
      const mockMsg = createMockHL7Message({
        OBX: {
          'OBX.2': 'ST',
          'OBX.3': {
            'OBX.3.1': 'MICRO-1',
            'OBX.3.2': 'Culture Result',
            'OBX.3.3': 'L'
          },
          'OBX.5': 'No growth after 48 hours',
          'OBX.11': 'F'
        }
      });
      
      const result = hl7ToFhirTransformer(mockMsg);
      const observation = JSON.parse(result);
      
      expect(observation.valueString).toBe('No growth after 48 hours');
      expect(observation.valueQuantity).toBeUndefined();
    });

    it('should handle coded values (CE value type)', () => {
      const mockMsg = createMockHL7Message({
        OBX: {
          'OBX.2': 'CE',
          'OBX.3': {
            'OBX.3.1': 'GLUCOSE-INTERP',
            'OBX.3.2': 'Glucose Interpretation',
            'OBX.3.3': 'L'
          },
          'OBX.5': 'NORMAL',
          'OBX.11': 'F'
        }
      });
      
      const result = hl7ToFhirTransformer(mockMsg);
      const observation = JSON.parse(result);
      
      expect(observation.valueCodeableConcept).toBeDefined();
      expect(observation.valueCodeableConcept.coding[0].code).toBe('NORMAL');
    });

    it('should parse numeric reference ranges', () => {
      const mockMsg = createMockHL7Message({
        OBX: {
          'OBX.7': '12.0-16.0'
        }
      });
      
      const result = hl7ToFhirTransformer(mockMsg);
      const observation = JSON.parse(result);
      
      expect(observation.referenceRange[0].low.value).toBe(12.0);
      expect(observation.referenceRange[0].high.value).toBe(16.0);
      expect(observation.referenceRange[0].low.unit).toBe('g/dL');
    });

    it('should map abnormal flags to interpretations', () => {
      const mockMsg = createMockHL7Message({
        OBX: {
          'OBX.8': 'H'
        }
      });
      
      const result = hl7ToFhirTransformer(mockMsg);
      const observation = JSON.parse(result);
      
      expect(observation.interpretation[0].coding[0].code).toBe('H');
      expect(observation.interpretation[0].coding[0].display).toBe('High');
    });
  });

  describe('Helper functions', () => {
    describe('convertHL7DateTime', () => {
      it('should convert HL7 datetime to ISO format', () => {
        expect(convertHL7DateTime('20250730120000')).toBe('2025-07-30T12:00:00.000Z');
      });

      it('should handle date only', () => {
        expect(convertHL7DateTime('20250730')).toBe('2025-07-30T00:00:00.000Z');
      });

      it('should handle invalid dates', () => {
        const result = convertHL7DateTime('invalid');
        expect(new Date(result).getTime()).not.toBeNaN();
      });

      it('should handle empty date', () => {
        const result = convertHL7DateTime('');
        expect(new Date(result).getTime()).not.toBeNaN();
      });
    });

    describe('mapCodingSystemToFHIR', () => {
      it('should map LOINC codes', () => {
        expect(mapCodingSystemToFHIR('LN')).toBe('http://loinc.org');
        expect(mapCodingSystemToFHIR('LOINC')).toBe('http://loinc.org');
        expect(mapCodingSystemToFHIR('L')).toBe('http://loinc.org');
      });

      it('should map SNOMED codes', () => {
        expect(mapCodingSystemToFHIR('SNM')).toBe('http://snomed.info/sct');
        expect(mapCodingSystemToFHIR('SNOMED')).toBe('http://snomed.info/sct');
      });

      it('should handle unknown coding systems', () => {
        expect(mapCodingSystemToFHIR('UNKNOWN')).toBe('http://terminology.hl7.org/CodeSystem/v2-0396');
      });
    });

    describe('mapResultStatusToFHIR', () => {
      it('should map common statuses', () => {
        expect(mapResultStatusToFHIR('F')).toBe('final');
        expect(mapResultStatusToFHIR('P')).toBe('preliminary');
        expect(mapResultStatusToFHIR('C')).toBe('corrected');
        expect(mapResultStatusToFHIR('X')).toBe('cancelled');
      });

      it('should default to final for unknown status', () => {
        expect(mapResultStatusToFHIR('UNKNOWN')).toBe('final');
      });
    });

    describe('mapAbnormalFlagsToFHIR', () => {
      it('should map abnormal flags', () => {
        expect(mapAbnormalFlagsToFHIR('H')).toBe('H');
        expect(mapAbnormalFlagsToFHIR('L')).toBe('L');
        expect(mapAbnormalFlagsToFHIR('HH')).toBe('HH');
        expect(mapAbnormalFlagsToFHIR('LL')).toBe('LL');
        expect(mapAbnormalFlagsToFHIR('N')).toBe('N');
        expect(mapAbnormalFlagsToFHIR('A')).toBe('A');
      });

      it('should handle symbols', () => {
        expect(mapAbnormalFlagsToFHIR('>')).toBe('H');
        expect(mapAbnormalFlagsToFHIR('<')).toBe('L');
      });

      it('should default to normal for unknown flags', () => {
        expect(mapAbnormalFlagsToFHIR('UNKNOWN')).toBe('N');
      });
    });
  });

  describe('Integration test with example message', () => {
    it('should transform the example HL7 message from requirements', () => {
      const exampleMsg = {
        MSH: {
          'MSH.9': {
            'MSH.9.1': 'ORU'
          }
        },
        PID: {
          'PID.3': {
            'PID.3.1': '12345'
          },
          'PID.5': {
            'PID.5.1': 'Doe',
            'PID.5.2': 'John'
          }
        },
        OBR: {
          'OBR.7': '20250730110000'
        },
        OBX: {
          'OBX.2': 'NM',
          'OBX.3': {
            'OBX.3.1': '789-8',
            'OBX.3.2': 'Hemoglobin',
            'OBX.3.3': 'LN'
          },
          'OBX.5': '13.5',
          'OBX.6': 'g/dL',
          'OBX.7': '12.0-16.0',
          'OBX.8': 'N',
          'OBX.11': 'F'
        }
      };

      const result = hl7ToFhirTransformer(exampleMsg);
      const observation = JSON.parse(result);

      // Verify against expected FHIR structure from requirements
      expect(observation.resourceType).toBe('Observation');
      expect(observation.status).toBe('final');
      expect(observation.category[0].coding[0].system).toBe('http://terminology.hl7.org/CodeSystem/observation-category');
      expect(observation.category[0].coding[0].code).toBe('laboratory');
      expect(observation.category[0].coding[0].display).toBe('Laboratory');
      expect(observation.code.coding[0].system).toBe('http://loinc.org');
      expect(observation.code.coding[0].code).toBe('789-8');
      expect(observation.code.coding[0].display).toBe('Hemoglobin');
      expect(observation.subject.reference).toBe('Patient/12345');
      expect(observation.effectiveDateTime).toBe('2025-07-30T11:00:00.000Z');
      expect(observation.valueQuantity.value).toBe(13.5);
      expect(observation.valueQuantity.unit).toBe('g/dL');
      expect(observation.valueQuantity.system).toBe('http://unitsofmeasure.org');
    });
  });
});