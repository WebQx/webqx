const FhirKitClient = require('fhir-kit-client');
const axios = require('axios');
const auditLogger = require('../security/auditLogger');
const encryption = require('../security/encryption');

/**
 * HIPAA-Compliant FHIR Integration Service
 * Implements HL7 FHIR R4 standards for healthcare interoperability
 */

class FHIRService {
  constructor() {
    this.fhirServerUrl = process.env.FHIR_SERVER_URL || 'http://localhost:8080/fhir';
    this.fhirClient = new FhirKitClient({
      baseUrl: this.fhirServerUrl,
      customHeaders: {
        'User-Agent': 'WebQX-Healthcare-Platform/1.0.0',
        'Accept': 'application/fhir+json'
      }
    });
    
    this.supportedResources = [
      'Patient',
      'Practitioner',
      'Organization',
      'Encounter',
      'Observation',
      'DiagnosticReport',
      'MedicationRequest',
      'MedicationStatement',
      'AllergyIntolerance',
      'Condition',
      'Procedure',
      'Immunization',
      'CarePlan',
      'Goal'
    ];
  }

  /**
   * Create or update a FHIR Patient resource
   * @param {Object} patientData - Patient information
   * @param {Object} user - Requesting user
   * @returns {Object} FHIR Patient resource
   */
  async createPatient(patientData, user) {
    try {
      // Log PHI access
      await auditLogger.logPHIAccess({
        userId: user.id,
        userRole: user.role,
        action: 'CREATE',
        patientId: patientData.id || 'new-patient',
        dataType: 'PATIENT_RECORD',
        accessReason: 'Patient registration',
        ipAddress: user.ipAddress,
        userAgent: user.userAgent,
        requestId: user.requestId
      });

      // Create FHIR Patient resource
      const fhirPatient = {
        resourceType: 'Patient',
        identifier: [
          {
            use: 'usual',
            type: {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                  code: 'MR',
                  display: 'Medical Record Number'
                }
              ]
            },
            value: patientData.medicalRecordNumber || this.generateMRN()
          }
        ],
        active: true,
        name: [
          {
            use: 'official',
            family: patientData.lastName,
            given: [patientData.firstName],
            prefix: patientData.prefix ? [patientData.prefix] : undefined
          }
        ],
        telecom: [
          {
            system: 'phone',
            value: patientData.phone,
            use: 'home'
          },
          {
            system: 'email',
            value: patientData.email,
            use: 'home'
          }
        ],
        gender: patientData.gender?.toLowerCase(),
        birthDate: patientData.birthDate,
        address: patientData.address ? [
          {
            use: 'home',
            type: 'both',
            line: [patientData.address.street],
            city: patientData.address.city,
            state: patientData.address.state,
            postalCode: patientData.address.zipCode,
            country: patientData.address.country || 'US'
          }
        ] : undefined,
        contact: patientData.emergencyContact ? [
          {
            relationship: [
              {
                coding: [
                  {
                    system: 'http://terminology.hl7.org/CodeSystem/v2-0131',
                    code: 'EP',
                    display: 'Emergency contact person'
                  }
                ]
              }
            ],
            name: {
              family: patientData.emergencyContact.lastName,
              given: [patientData.emergencyContact.firstName]
            },
            telecom: [
              {
                system: 'phone',
                value: patientData.emergencyContact.phone
              }
            ]
          }
        ] : undefined,
        communication: patientData.preferredLanguage ? [
          {
            language: {
              coding: [
                {
                  system: 'urn:ietf:bcp:47',
                  code: patientData.preferredLanguage,
                  display: this.getLanguageDisplay(patientData.preferredLanguage)
                }
              ]
            },
            preferred: true
          }
        ] : undefined
      };

      // Create patient in FHIR server
      const response = await this.fhirClient.create({
        resourceType: 'Patient',
        body: fhirPatient
      });

      // Log successful creation
      await auditLogger.logUserAction({
        userId: user.id,
        userRole: user.role,
        action: 'FHIR_PATIENT_CREATE',
        resource: 'fhir_patient',
        resourceId: response.id,
        outcome: 'SUCCESS',
        ipAddress: user.ipAddress,
        requestId: user.requestId,
        details: {
          fhirId: response.id,
          medicalRecordNumber: fhirPatient.identifier[0].value
        }
      });

      return response;
      
    } catch (error) {
      console.error('FHIR Patient creation error:', error);
      
      await auditLogger.logUserAction({
        userId: user.id,
        userRole: user.role,
        action: 'FHIR_PATIENT_CREATE',
        resource: 'fhir_patient',
        outcome: 'ERROR',
        ipAddress: user.ipAddress,
        requestId: user.requestId,
        details: { error: error.message }
      });

      throw new Error('Failed to create patient record');
    }
  }

  /**
   * Retrieve patient by ID
   * @param {string} patientId - FHIR Patient ID
   * @param {Object} user - Requesting user
   * @returns {Object} FHIR Patient resource
   */
  async getPatient(patientId, user) {
    try {
      // Log PHI access
      await auditLogger.logPHIAccess({
        userId: user.id,
        userRole: user.role,
        action: 'READ',
        patientId,
        dataType: 'PATIENT_RECORD',
        accessReason: 'Patient information retrieval',
        ipAddress: user.ipAddress,
        userAgent: user.userAgent,
        requestId: user.requestId
      });

      const patient = await this.fhirClient.read({
        resourceType: 'Patient',
        id: patientId
      });

      return patient;
      
    } catch (error) {
      console.error('FHIR Patient retrieval error:', error);
      throw new Error('Failed to retrieve patient record');
    }
  }

  /**
   * Search patients by criteria
   * @param {Object} searchParams - Search parameters
   * @param {Object} user - Requesting user
   * @returns {Object} FHIR Bundle with search results
   */
  async searchPatients(searchParams, user) {
    try {
      // Log search action
      await auditLogger.logUserAction({
        userId: user.id,
        userRole: user.role,
        action: 'FHIR_PATIENT_SEARCH',
        resource: 'fhir_patient',
        outcome: 'SUCCESS',
        ipAddress: user.ipAddress,
        requestId: user.requestId,
        details: { searchParams }
      });

      const searchResults = await this.fhirClient.search({
        resourceType: 'Patient',
        searchParams
      });

      return searchResults;
      
    } catch (error) {
      console.error('FHIR Patient search error:', error);
      throw new Error('Failed to search patient records');
    }
  }

  /**
   * Create medication request (prescription)
   * @param {Object} medicationData - Medication request data
   * @param {Object} user - Requesting user
   * @returns {Object} FHIR MedicationRequest resource
   */
  async createMedicationRequest(medicationData, user) {
    try {
      // Log PHI access for prescription creation
      await auditLogger.logPHIAccess({
        userId: user.id,
        userRole: user.role,
        action: 'WRITE',
        patientId: medicationData.patientId,
        dataType: 'PRESCRIPTION',
        accessReason: 'Prescription creation',
        ipAddress: user.ipAddress,
        userAgent: user.userAgent,
        requestId: user.requestId
      });

      const fhirMedicationRequest = {
        resourceType: 'MedicationRequest',
        status: 'active',
        intent: 'order',
        medicationCodeableConcept: {
          coding: [
            {
              system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
              code: medicationData.rxnormCode,
              display: medicationData.medicationName
            }
          ]
        },
        subject: {
          reference: `Patient/${medicationData.patientId}`
        },
        requester: {
          reference: `Practitioner/${user.practitionerId || user.id}`
        },
        dosageInstruction: [
          {
            text: medicationData.dosageInstructions,
            timing: {
              repeat: {
                frequency: medicationData.frequency,
                period: medicationData.period,
                periodUnit: medicationData.periodUnit || 'd'
              }
            },
            route: {
              coding: [
                {
                  system: 'http://snomed.info/sct',
                  code: medicationData.routeCode || '26643006',
                  display: medicationData.route || 'Oral'
                }
              ]
            },
            doseAndRate: [
              {
                doseQuantity: {
                  value: medicationData.dose,
                  unit: medicationData.doseUnit,
                  system: 'http://unitsofmeasure.org',
                  code: medicationData.doseUnitCode
                }
              }
            ]
          }
        ],
        dispenseRequest: {
          numberOfRepeatsAllowed: medicationData.refills || 0,
          quantity: {
            value: medicationData.quantity,
            unit: medicationData.quantityUnit || 'TAB'
          }
        },
        note: medicationData.notes ? [
          {
            text: medicationData.notes
          }
        ] : undefined
      };

      const response = await this.fhirClient.create({
        resourceType: 'MedicationRequest',
        body: fhirMedicationRequest
      });

      return response;
      
    } catch (error) {
      console.error('FHIR MedicationRequest creation error:', error);
      throw new Error('Failed to create medication request');
    }
  }

  /**
   * Create observation (lab results, vital signs)
   * @param {Object} observationData - Observation data
   * @param {Object} user - Requesting user
   * @returns {Object} FHIR Observation resource
   */
  async createObservation(observationData, user) {
    try {
      // Log PHI access for observation creation
      await auditLogger.logPHIAccess({
        userId: user.id,
        userRole: user.role,
        action: 'WRITE',
        patientId: observationData.patientId,
        dataType: 'LAB_RESULT',
        accessReason: 'Observation recording',
        ipAddress: user.ipAddress,
        userAgent: user.userAgent,
        requestId: user.requestId
      });

      const fhirObservation = {
        resourceType: 'Observation',
        status: 'final',
        category: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: observationData.category || 'vital-signs',
                display: observationData.categoryDisplay || 'Vital Signs'
              }
            ]
          }
        ],
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: observationData.loincCode,
              display: observationData.observationName
            }
          ]
        },
        subject: {
          reference: `Patient/${observationData.patientId}`
        },
        effectiveDateTime: observationData.effectiveDateTime || new Date().toISOString(),
        valueQuantity: observationData.value ? {
          value: observationData.value,
          unit: observationData.unit,
          system: 'http://unitsofmeasure.org',
          code: observationData.unitCode
        } : undefined,
        valueString: observationData.valueString,
        performer: [
          {
            reference: `Practitioner/${user.practitionerId || user.id}`
          }
        ],
        note: observationData.notes ? [
          {
            text: observationData.notes
          }
        ] : undefined
      };

      const response = await this.fhirClient.create({
        resourceType: 'Observation',
        body: fhirObservation
      });

      return response;
      
    } catch (error) {
      console.error('FHIR Observation creation error:', error);
      throw new Error('Failed to create observation');
    }
  }

  /**
   * Generate medical record number
   * @returns {string} Medical record number
   */
  generateMRN() {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `WQX${timestamp.slice(-6)}${random}`;
  }

  /**
   * Get language display name
   * @param {string} languageCode - Language code
   * @returns {string} Language display name
   */
  getLanguageDisplay(languageCode) {
    const languages = {
      'en': 'English',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'pt': 'Portuguese',
      'zh': 'Chinese',
      'ar': 'Arabic',
      'hi': 'Hindi',
      'ja': 'Japanese'
    };
    
    return languages[languageCode] || languageCode;
  }

  /**
   * Validate FHIR resource
   * @param {Object} resource - FHIR resource
   * @returns {Object} Validation result
   */
  async validateResource(resource) {
    try {
      const response = await this.fhirClient.validate({
        resourceType: resource.resourceType,
        body: resource
      });
      
      return {
        valid: true,
        issues: response.issue || []
      };
      
    } catch (error) {
      return {
        valid: false,
        issues: [{ severity: 'error', diagnostics: error.message }]
      };
    }
  }
}

module.exports = new FHIRService();