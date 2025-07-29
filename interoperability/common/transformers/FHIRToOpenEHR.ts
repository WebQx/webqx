/**
 * FHIR to openEHR Data Transformer
 * Provides utilities for transforming data between FHIR and openEHR standards
 */

import { FHIRPatient } from '../../fhir/r4/resources/Patient';
import { OpenEHRComposition } from '../../openehr/services/OpenEHRService';

export interface TransformationOptions {
  includeMetadata?: boolean;
  preserveOriginalIds?: boolean;
  validateOutput?: boolean;
  templateId?: string;
}

export interface TransformationResult<T> {
  data: T;
  warnings: string[];
  metadata: {
    sourceStandard: string;
    targetStandard: string;
    transformedAt: string;
    originalId?: string;
  };
}

export class FHIRToOpenEHRTransformer {
  /**
   * Transform FHIR Patient to openEHR Person Demographics
   */
  static transformPatientToDemographics(
    patient: FHIRPatient,
    options: TransformationOptions = {}
  ): TransformationResult<Partial<OpenEHRComposition>> {
    const warnings: string[] = [];
    
    // Create basic openEHR composition structure for demographics
    const composition: Partial<OpenEHRComposition> = {
      archetype_node_id: 'openEHR-EHR-COMPOSITION.person.v1',
      name: {
        value: 'Person Demographics',
      },
      composer: {
        name: 'FHIR Transform Service',
      },
      category: {
        value: 'persistent',
        defining_code: {
          terminology_id: {
            value: 'openehr',
          },
          code_string: '431',
        },
      },
      territory: {
        terminology_id: {
          value: 'ISO_3166-1',
        },
        code_string: 'US', // Default - should be derived from data
      },
      language: {
        terminology_id: {
          value: 'ISO_639-1',
        },
        code_string: 'en', // Default - should be derived from data
      },
    };

    // Transform patient data to openEHR content
    const content: any[] = [];

    // Transform demographics
    const demographicsEntry = this.createDemographicsEntry(patient, warnings);
    if (demographicsEntry) {
      content.push(demographicsEntry);
    }

    // Add identifiers if present
    if (patient.identifier && patient.identifier.length > 0) {
      const identifiersEntry = this.createIdentifiersEntry(patient.identifier, warnings);
      if (identifiersEntry) {
        content.push(identifiersEntry);
      }
    }

    composition.content = content;

    return {
      data: composition,
      warnings,
      metadata: {
        sourceStandard: 'FHIR R4',
        targetStandard: 'openEHR',
        transformedAt: new Date().toISOString(),
        originalId: patient.id,
      },
    };
  }

  private static createDemographicsEntry(patient: FHIRPatient, warnings: string[]): any {
    const entry: any = {
      '@type': 'SECTION',
      archetype_node_id: 'openEHR-EHR-SECTION.demographics.v1',
      name: {
        value: 'Demographics',
      },
      items: [],
    };

    // Transform name
    if (patient.name && patient.name.length > 0) {
      const nameItem = {
        '@type': 'ADMIN_ENTRY',
        archetype_node_id: 'openEHR-EHR-ADMIN_ENTRY.person_name.v1',
        name: {
          value: 'Person Name',
        },
        data: {
          '@type': 'ITEM_TREE',
          items: this.transformNames(patient.name, warnings),
        },
      };
      entry.items.push(nameItem);
    }

    // Transform gender
    if (patient.gender) {
      const genderItem = {
        '@type': 'ADMIN_ENTRY',
        archetype_node_id: 'openEHR-EHR-ADMIN_ENTRY.gender.v1',
        name: {
          value: 'Gender',
        },
        data: {
          '@type': 'ITEM_TREE',
          items: [
            {
              '@type': 'ELEMENT',
              name: {
                value: 'Gender',
              },
              value: {
                '@type': 'DV_CODED_TEXT',
                value: this.mapFHIRGenderToOpenEHR(patient.gender),
                defining_code: {
                  terminology_id: {
                    value: 'local',
                  },
                  code_string: patient.gender,
                },
              },
            },
          ],
        },
      };
      entry.items.push(genderItem);
    }

    // Transform birth date
    if (patient.birthDate) {
      const birthDateItem = {
        '@type': 'ADMIN_ENTRY',
        archetype_node_id: 'openEHR-EHR-ADMIN_ENTRY.birth_data.v1',
        name: {
          value: 'Birth Data',
        },
        data: {
          '@type': 'ITEM_TREE',
          items: [
            {
              '@type': 'ELEMENT',
              name: {
                value: 'Date of Birth',
              },
              value: {
                '@type': 'DV_DATE',
                value: patient.birthDate,
              },
            },
          ],
        },
      };
      entry.items.push(birthDateItem);
    }

    return entry.items.length > 0 ? entry : null;
  }

  private static createIdentifiersEntry(identifiers: any[], warnings: string[]): any {
    const entry: any = {
      '@type': 'ADMIN_ENTRY',
      archetype_node_id: 'openEHR-EHR-ADMIN_ENTRY.person_identifier.v1',
      name: {
        value: 'Person Identifiers',
      },
      data: {
        '@type': 'ITEM_TREE',
        items: [],
      },
    };

    identifiers.forEach((identifier, index) => {
      if (identifier.value) {
        const identifierElement = {
          '@type': 'CLUSTER',
          archetype_node_id: 'openEHR-EHR-CLUSTER.person_identifier.v1',
          name: {
            value: `Identifier ${index + 1}`,
          },
          items: [
            {
              '@type': 'ELEMENT',
              name: {
                value: 'Identifier',
              },
              value: {
                '@type': 'DV_TEXT',
                value: identifier.value,
              },
            },
          ],
        };

        if (identifier.system) {
          identifierElement.items.push({
            '@type': 'ELEMENT',
            name: {
              value: 'Identifier Type',
            },
            value: {
              '@type': 'DV_TEXT',
              value: identifier.system,
            },
          });
        }

        entry.data.items.push(identifierElement);
      }
    });

    return entry.data.items.length > 0 ? entry : null;
  }

  private static transformNames(names: any[], warnings: string[]): any[] {
    const nameElements: any[] = [];

    names.forEach((name, index) => {
      if (name.family || (name.given && name.given.length > 0)) {
        const nameCluster: any = {
          '@type': 'CLUSTER',
          archetype_node_id: 'openEHR-EHR-CLUSTER.person_name.v1',
          name: {
            value: `Name ${index + 1}`,
          },
          items: [],
        };

        if (name.family) {
          nameCluster.items.push({
            '@type': 'ELEMENT',
            name: {
              value: 'Family Name',
            },
            value: {
              '@type': 'DV_TEXT',
              value: name.family,
            },
          });
        }

        if (name.given && name.given.length > 0) {
          name.given.forEach((givenName: string, givenIndex: number) => {
            nameCluster.items.push({
              '@type': 'ELEMENT',
              name: {
                value: givenIndex === 0 ? 'Given Name' : `Given Name ${givenIndex + 1}`,
              },
              value: {
                '@type': 'DV_TEXT',
                value: givenName,
              },
            });
          });
        }

        if (name.use) {
          nameCluster.items.push({
            '@type': 'ELEMENT',
            name: {
              value: 'Name Use',
            },
            value: {
              '@type': 'DV_CODED_TEXT',
              value: this.mapFHIRNameUseToOpenEHR(name.use),
              defining_code: {
                terminology_id: {
                  value: 'local',
                },
                code_string: name.use,
              },
            },
          });
        }

        nameElements.push(nameCluster);
      }
    });

    return nameElements;
  }

  private static mapFHIRGenderToOpenEHR(fhirGender: string): string {
    const mappings: Record<string, string> = {
      male: 'Male',
      female: 'Female',
      other: 'Other',
      unknown: 'Unknown',
    };
    return mappings[fhirGender] || 'Unknown';
  }

  private static mapFHIRNameUseToOpenEHR(fhirUse: string): string {
    const mappings: Record<string, string> = {
      usual: 'Usual',
      official: 'Official',
      temp: 'Temporary',
      nickname: 'Nickname',
      anonymous: 'Anonymous',
      old: 'Previous',
      maiden: 'Maiden',
    };
    return mappings[fhirUse] || 'Usual';
  }
}

export class OpenEHRToFHIRTransformer {
  /**
   * Transform openEHR Demographics to FHIR Patient
   */
  static transformDemographicsToPatient(
    composition: OpenEHRComposition,
    options: TransformationOptions = {}
  ): TransformationResult<Partial<FHIRPatient>> {
    const warnings: string[] = [];
    
    const patient: Partial<FHIRPatient> = {
      resourceType: 'Patient',
      active: true,
    };

    // Extract demographics from openEHR composition
    if (composition.content) {
      this.extractPatientDataFromContent(composition.content, patient, warnings);
    }

    return {
      data: patient,
      warnings,
      metadata: {
        sourceStandard: 'openEHR',
        targetStandard: 'FHIR R4',
        transformedAt: new Date().toISOString(),
        originalId: composition.uid,
      },
    };
  }

  private static extractPatientDataFromContent(content: any[], patient: Partial<FHIRPatient>, warnings: string[]): void {
    content.forEach((item) => {
      if (item.archetype_node_id) {
        switch (item.archetype_node_id) {
          case 'openEHR-EHR-ADMIN_ENTRY.person_name.v1':
            this.extractNames(item, patient, warnings);
            break;
          case 'openEHR-EHR-ADMIN_ENTRY.gender.v1':
            this.extractGender(item, patient, warnings);
            break;
          case 'openEHR-EHR-ADMIN_ENTRY.birth_data.v1':
            this.extractBirthDate(item, patient, warnings);
            break;
          case 'openEHR-EHR-ADMIN_ENTRY.person_identifier.v1':
            this.extractIdentifiers(item, patient, warnings);
            break;
        }
      }

      // Recursively process nested items
      if (item.items) {
        this.extractPatientDataFromContent(item.items, patient, warnings);
      }
    });
  }

  private static extractNames(item: any, patient: Partial<FHIRPatient>, warnings: string[]): void {
    // Implementation for extracting names from openEHR to FHIR
    // This is a simplified version - real implementation would be more complex
    if (item.data && item.data.items) {
      const name: any = {};
      
      item.data.items.forEach((element: any) => {
        if (element.name && element.value) {
          switch (element.name.value) {
            case 'Family Name':
              name.family = element.value.value;
              break;
            case 'Given Name':
              if (!name.given) name.given = [];
              name.given.push(element.value.value);
              break;
          }
        }
      });

      if (name.family || name.given) {
        if (!patient.name) patient.name = [];
        patient.name.push(name);
      }
    }
  }

  private static extractGender(item: any, patient: Partial<FHIRPatient>, warnings: string[]): void {
    // Extract gender from openEHR item
    if (item.data && item.data.items) {
      const genderElement = item.data.items.find((el: any) => 
        el.name && el.name.value === 'Gender'
      );
      
      if (genderElement && genderElement.value && genderElement.value.defining_code) {
        const genderCode = genderElement.value.defining_code.code_string;
        patient.gender = this.mapOpenEHRGenderToFHIR(genderCode);
      }
    }
  }

  private static extractBirthDate(item: any, patient: Partial<FHIRPatient>, warnings: string[]): void {
    // Extract birth date from openEHR item
    if (item.data && item.data.items) {
      const birthDateElement = item.data.items.find((el: any) => 
        el.name && el.name.value === 'Date of Birth'
      );
      
      if (birthDateElement && birthDateElement.value && birthDateElement.value.value) {
        patient.birthDate = birthDateElement.value.value;
      }
    }
  }

  private static extractIdentifiers(item: any, patient: Partial<FHIRPatient>, warnings: string[]): void {
    // Extract identifiers from openEHR item
    if (item.data && item.data.items) {
      item.data.items.forEach((cluster: any) => {
        const identifier: any = {};
        
        if (cluster.items) {
          cluster.items.forEach((element: any) => {
            if (element.name && element.value) {
              switch (element.name.value) {
                case 'Identifier':
                  identifier.value = element.value.value;
                  break;
                case 'Identifier Type':
                  identifier.system = element.value.value;
                  break;
              }
            }
          });
        }

        if (identifier.value) {
          if (!patient.identifier) patient.identifier = [];
          patient.identifier.push(identifier);
        }
      });
    }
  }

  private static mapOpenEHRGenderToFHIR(openEHRGender: string): 'male' | 'female' | 'other' | 'unknown' {
    const lowerGender = openEHRGender.toLowerCase();
    if (lowerGender.includes('male') && !lowerGender.includes('female')) return 'male';
    if (lowerGender.includes('female')) return 'female';
    if (lowerGender.includes('other')) return 'other';
    return 'unknown';
  }
}