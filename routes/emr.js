/**
 * Electronic Medical Records (EMR) API Routes for Telepsychiatry Platform
 * 
 * Leverages existing FHIR infrastructure for HL7/FHIR-compliant patient records
 * and provides ICD-10/DSM-5 annotation capabilities
 */

const express = require('express');
const { param, body, query, validationResult } = require('express-validator');
const crypto = require('crypto');

const router = express.Router();

// Mock EMR data storage (use FHIR server in production)
const annotationStorage = new Map();

// Middleware to validate session/auth
const requireAuth = (req, res, next) => {
  const sessionId = req.cookies?.sessionId || req.headers['x-session-id'] || req.headers.authorization?.replace('Bearer ', '');
  
  if (!sessionId) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authentication required'
    });
  }
  
  // Mock user for demo - in real implementation, validate with userService
  req.user = { id: 'user-123', role: 'PROVIDER', name: 'Dr. Smith' };
  next();
};

// Helper function to fetch FHIR data (mock implementation)
const fetchFHIRResource = async (resourceType, patientId) => {
  // In real implementation, this would call the FHIR server
  // For demo, return mock FHIR-compliant data
  
  const mockPatient = {
    resourceType: 'Patient',
    id: patientId,
    identifier: [
      {
        system: 'http://hospital.example.org/patient-ids',
        value: patientId
      }
    ],
    name: [
      {
        use: 'official',
        family: 'Doe',
        given: ['John', 'Michael']
      }
    ],
    telecom: [
      {
        system: 'phone',
        value: '+1-555-0123',
        use: 'home'
      },
      {
        system: 'email',
        value: 'john.doe@example.com'
      }
    ],
    gender: 'male',
    birthDate: '1985-03-15',
    address: [
      {
        use: 'home',
        line: ['123 Main Street'],
        city: 'Anytown',
        state: 'CA',
        postalCode: '12345',
        country: 'US'
      }
    ],
    maritalStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus',
          code: 'M',
          display: 'Married'
        }
      ]
    }
  };

  const mockObservations = [
    {
      resourceType: 'Observation',
      id: `obs-${patientId}-1`,
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'vital-signs',
              display: 'Vital Signs'
            }
          ]
        }
      ],
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '85354-9',
            display: 'Blood pressure panel with all children optional'
          }
        ]
      },
      subject: {
        reference: `Patient/${patientId}`
      },
      effectiveDateTime: '2023-12-01T10:30:00Z',
      component: [
        {
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '8480-6',
                display: 'Systolic blood pressure'
              }
            ]
          },
          valueQuantity: {
            value: 120,
            unit: 'mmHg',
            system: 'http://unitsofmeasure.org',
            code: 'mm[Hg]'
          }
        },
        {
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '8462-4',
                display: 'Diastolic blood pressure'
              }
            ]
          },
          valueQuantity: {
            value: 80,
            unit: 'mmHg',
            system: 'http://unitsofmeasure.org',
            code: 'mm[Hg]'
          }
        }
      ]
    },
    {
      resourceType: 'Observation',
      id: `obs-${patientId}-2`,
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'survey',
              display: 'Survey'
            }
          ]
        }
      ],
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '44249-1',
            display: 'PHQ-9 total score'
          }
        ]
      },
      subject: {
        reference: `Patient/${patientId}`
      },
      effectiveDateTime: '2023-12-01T10:00:00Z',
      valueInteger: 12,
      interpretation: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
              code: 'H',
              display: 'High'
            }
          ],
          text: 'Moderate depression'
        }
      ]
    }
  ];

  const mockConditions = [
    {
      resourceType: 'Condition',
      id: `cond-${patientId}-1`,
      clinicalStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
            code: 'active'
          }
        ]
      },
      verificationStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
            code: 'confirmed'
          }
        ]
      },
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/condition-category',
              code: 'encounter-diagnosis',
              display: 'Encounter Diagnosis'
            }
          ]
        }
      ],
      code: {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: '35489007',
            display: 'Depressive disorder'
          },
          {
            system: 'http://hl7.org/fhir/sid/icd-10-cm',
            code: 'F32.9',
            display: 'Major depressive disorder, single episode, unspecified'
          }
        ]
      },
      subject: {
        reference: `Patient/${patientId}`
      },
      onsetDateTime: '2023-10-15T00:00:00Z',
      recordedDate: '2023-10-15T10:30:00Z'
    }
  ];

  const mockMedications = [
    {
      resourceType: 'MedicationRequest',
      id: `med-${patientId}-1`,
      status: 'active',
      intent: 'order',
      medicationCodeableConcept: {
        coding: [
          {
            system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
            code: '1040028',
            display: 'Sertraline 50 MG Oral Tablet'
          }
        ]
      },
      subject: {
        reference: `Patient/${patientId}`
      },
      authoredOn: '2023-10-15T10:30:00Z',
      dosageInstruction: [
        {
          text: 'Take 1 tablet by mouth daily',
          timing: {
            repeat: {
              frequency: 1,
              period: 1,
              periodUnit: 'd'
            }
          },
          route: {
            coding: [
              {
                system: 'http://snomed.info/sct',
                code: '26643006',
                display: 'Oral route'
              }
            ]
          },
          doseAndRate: [
            {
              doseQuantity: {
                value: 1,
                unit: 'tablet',
                system: 'http://terminology.hl7.org/CodeSystem/v3-orderableDrugForm',
                code: 'TAB'
              }
            }
          ]
        }
      ]
    }
  ];

  switch (resourceType) {
    case 'Patient':
      return mockPatient;
    case 'Observation':
      return mockObservations;
    case 'Condition':
      return mockConditions;
    case 'MedicationRequest':
      return mockMedications;
    default:
      return null;
  }
};

/**
 * GET /emr/records/:patientId
 * Fetches HL7/FHIR-compliant patient records
 */
router.get('/records/:patientId',
  requireAuth,
  [
    param('patientId')
      .notEmpty()
      .isAlphanumeric()
      .withMessage('Valid patient ID is required'),
    query('resourceType')
      .optional()
      .isIn(['Patient', 'Observation', 'Condition', 'MedicationRequest', 'Encounter', 'DiagnosticReport'])
      .withMessage('Invalid resource type'),
    query('category')
      .optional()
      .isString()
      .withMessage('Category must be a string'),
    query('dateFrom')
      .optional()
      .isISO8601()
      .withMessage('Date from must be in ISO 8601 format'),
    query('dateTo')
      .optional()
      .isISO8601()
      .withMessage('Date to must be in ISO 8601 format'),
    query('includeAnnotations')
      .optional()
      .isBoolean()
      .withMessage('Include annotations must be a boolean')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
          details: errors.array()
        });
      }

      const { patientId } = req.params;
      const { resourceType, category, dateFrom, dateTo, includeAnnotations = true } = req.query;

      // Fetch FHIR resources
      const records = {
        patient: await fetchFHIRResource('Patient', patientId),
        observations: resourceType === 'Observation' || !resourceType ? await fetchFHIRResource('Observation', patientId) : [],
        conditions: resourceType === 'Condition' || !resourceType ? await fetchFHIRResource('Condition', patientId) : [],
        medications: resourceType === 'MedicationRequest' || !resourceType ? await fetchFHIRResource('MedicationRequest', patientId) : []
      };

      // Filter by date range if specified
      if (dateFrom || dateTo) {
        const filterByDate = (resource) => {
          const effectiveDate = resource.effectiveDateTime || resource.onsetDateTime || resource.authoredOn || resource.recordedDate;
          if (!effectiveDate) return true;
          
          const resourceDate = new Date(effectiveDate);
          if (dateFrom && resourceDate < new Date(dateFrom)) return false;
          if (dateTo && resourceDate > new Date(dateTo)) return false;
          return true;
        };

        records.observations = records.observations.filter(filterByDate);
        records.conditions = records.conditions.filter(filterByDate);
        records.medications = records.medications.filter(filterByDate);
      }

      // Include annotations if requested
      let annotations = [];
      if (includeAnnotations) {
        annotations = Array.from(annotationStorage.values()).filter(
          annotation => annotation.patientId === patientId
        );
      }

      // Build FHIR Bundle response
      const bundle = {
        resourceType: 'Bundle',
        id: `bundle-${patientId}-${Date.now()}`,
        type: 'searchset',
        timestamp: new Date().toISOString(),
        total: 0,
        entry: []
      };

      // Add resources to bundle
      if (records.patient) {
        bundle.entry.push({
          fullUrl: `Patient/${patientId}`,
          resource: records.patient
        });
        bundle.total++;
      }

      [...records.observations, ...records.conditions, ...records.medications].forEach(resource => {
        if (resource) {
          bundle.entry.push({
            fullUrl: `${resource.resourceType}/${resource.id}`,
            resource: resource
          });
          bundle.total++;
        }
      });

      // Add summary information
      const summary = {
        patientId,
        totalRecords: bundle.total,
        recordTypes: {
          observations: records.observations.length,
          conditions: records.conditions.length,
          medications: records.medications.length
        },
        dateRange: {
          from: dateFrom || null,
          to: dateTo || null
        },
        annotations: annotations.length,
        generatedAt: new Date().toISOString()
      };

      res.json({
        bundle,
        summary,
        annotations: includeAnnotations ? annotations : undefined,
        fhirVersion: '4.0.1',
        compliance: 'HL7 FHIR R4'
      });

    } catch (error) {
      console.error('[EMR API] Fetch records error:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch patient records'
      });
    }
  }
);

/**
 * POST /emr/tag
 * Adds ICD-10 or DSM-5 annotations to patient records
 */
router.post('/tag',
  requireAuth,
  [
    body('patientId')
      .notEmpty()
      .isAlphanumeric()
      .withMessage('Valid patient ID is required'),
    body('resourceId')
      .notEmpty()
      .isString()
      .withMessage('Resource ID is required'),
    body('resourceType')
      .isIn(['Condition', 'Observation', 'Encounter', 'DiagnosticReport'])
      .withMessage('Valid resource type is required'),
    body('codingSystem')
      .isIn(['ICD-10-CM', 'DSM-5', 'SNOMED-CT', 'LOINC'])
      .withMessage('Valid coding system is required'),
    body('code')
      .notEmpty()
      .isString()
      .withMessage('Code is required'),
    body('display')
      .notEmpty()
      .isString()
      .withMessage('Display name is required'),
    body('category')
      .optional()
      .isIn(['diagnosis', 'symptom', 'assessment', 'treatment', 'outcome'])
      .withMessage('Invalid category'),
    body('severity')
      .optional()
      .isIn(['mild', 'moderate', 'severe', 'critical'])
      .withMessage('Invalid severity level'),
    body('confidence')
      .optional()
      .isFloat({ min: 0, max: 1 })
      .withMessage('Confidence must be between 0 and 1'),
    body('notes')
      .optional()
      .isString()
      .isLength({ max: 1000 })
      .withMessage('Notes must be less than 1000 characters')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid annotation data',
          details: errors.array()
        });
      }

      const {
        patientId,
        resourceId,
        resourceType,
        codingSystem,
        code,
        display,
        category = 'diagnosis',
        severity,
        confidence = 1.0,
        notes
      } = req.body;

      // Validate coding system and code format
      const codeValidators = {
        'ICD-10-CM': /^[A-Z]\d{2}(\.\d{1,3})?$/,
        'DSM-5': /^\d{3}\.\d{2}$/,
        'SNOMED-CT': /^\d+$/,
        'LOINC': /^\d{4,5}-\d$/
      };

      if (codeValidators[codingSystem] && !codeValidators[codingSystem].test(code)) {
        return res.status(400).json({
          error: 'INVALID_CODE_FORMAT',
          message: `Invalid ${codingSystem} code format: ${code}`
        });
      }

      const annotationId = `annotation_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
      const timestamp = new Date().toISOString();

      const annotation = {
        id: annotationId,
        patientId,
        resourceId,
        resourceType,
        coding: {
          system: {
            'ICD-10-CM': 'http://hl7.org/fhir/sid/icd-10-cm',
            'DSM-5': 'http://www.apa.org/dsm5',
            'SNOMED-CT': 'http://snomed.info/sct',
            'LOINC': 'http://loinc.org'
          }[codingSystem],
          code,
          display
        },
        category,
        severity,
        confidence,
        notes,
        annotatedBy: {
          providerId: req.user.id,
          providerName: req.user.name,
          timestamp
        },
        status: 'active',
        version: '1.0'
      };

      // Store annotation
      annotationStorage.set(annotationId, annotation);

      // In real implementation, you might also update the FHIR resource
      // to include the new coding or create a separate Observation

      res.status(201).json({
        annotationId,
        status: 'created',
        annotation: {
          id: annotation.id,
          patientId: annotation.patientId,
          resourceId: annotation.resourceId,
          coding: annotation.coding,
          category: annotation.category,
          severity: annotation.severity,
          confidence: annotation.confidence,
          timestamp: annotation.annotatedBy.timestamp
        },
        message: 'Annotation added successfully'
      });

    } catch (error) {
      console.error('[EMR API] Add annotation error:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to add annotation'
      });
    }
  }
);

/**
 * GET /emr/annotations/:patientId
 * Retrieves all annotations for a patient
 */
router.get('/annotations/:patientId',
  requireAuth,
  [
    param('patientId')
      .notEmpty()
      .isAlphanumeric()
      .withMessage('Valid patient ID is required'),
    query('codingSystem')
      .optional()
      .isIn(['ICD-10-CM', 'DSM-5', 'SNOMED-CT', 'LOINC'])
      .withMessage('Invalid coding system'),
    query('category')
      .optional()
      .isIn(['diagnosis', 'symptom', 'assessment', 'treatment', 'outcome'])
      .withMessage('Invalid category'),
    query('resourceType')
      .optional()
      .isIn(['Condition', 'Observation', 'Encounter', 'DiagnosticReport'])
      .withMessage('Invalid resource type')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: errors.array()
        });
      }

      const { patientId } = req.params;
      const { codingSystem, category, resourceType } = req.query;

      // Filter annotations
      let annotations = Array.from(annotationStorage.values()).filter(
        annotation => annotation.patientId === patientId
      );

      if (codingSystem) {
        const systemUrl = {
          'ICD-10-CM': 'http://hl7.org/fhir/sid/icd-10-cm',
          'DSM-5': 'http://www.apa.org/dsm5',
          'SNOMED-CT': 'http://snomed.info/sct',
          'LOINC': 'http://loinc.org'
        }[codingSystem];
        
        annotations = annotations.filter(
          annotation => annotation.coding.system === systemUrl
        );
      }

      if (category) {
        annotations = annotations.filter(
          annotation => annotation.category === category
        );
      }

      if (resourceType) {
        annotations = annotations.filter(
          annotation => annotation.resourceType === resourceType
        );
      }

      // Sort by timestamp (most recent first)
      annotations.sort((a, b) => 
        new Date(b.annotatedBy.timestamp) - new Date(a.annotatedBy.timestamp)
      );

      // Generate summary statistics
      const summary = {
        total: annotations.length,
        byCodingSystem: {},
        byCategory: {},
        byResourceType: {},
        confidenceStats: {
          average: annotations.length > 0 ? annotations.reduce((sum, a) => sum + a.confidence, 0) / annotations.length : 0,
          high: annotations.filter(a => a.confidence >= 0.8).length,
          medium: annotations.filter(a => a.confidence >= 0.6 && a.confidence < 0.8).length,
          low: annotations.filter(a => a.confidence < 0.6).length
        }
      };

      // Calculate statistics
      annotations.forEach(annotation => {
        const system = Object.keys({
          'http://hl7.org/fhir/sid/icd-10-cm': 'ICD-10-CM',
          'http://www.apa.org/dsm5': 'DSM-5',
          'http://snomed.info/sct': 'SNOMED-CT',
          'http://loinc.org': 'LOINC'
        }).find(key => key === annotation.coding.system) || 'Unknown';
        
        const systemName = {
          'http://hl7.org/fhir/sid/icd-10-cm': 'ICD-10-CM',
          'http://www.apa.org/dsm5': 'DSM-5',
          'http://snomed.info/sct': 'SNOMED-CT',
          'http://loinc.org': 'LOINC'
        }[system] || 'Unknown';

        summary.byCodingSystem[systemName] = (summary.byCodingSystem[systemName] || 0) + 1;
        summary.byCategory[annotation.category] = (summary.byCategory[annotation.category] || 0) + 1;
        summary.byResourceType[annotation.resourceType] = (summary.byResourceType[annotation.resourceType] || 0) + 1;
      });

      res.json({
        patientId,
        annotations: annotations.map(annotation => ({
          id: annotation.id,
          resourceId: annotation.resourceId,
          resourceType: annotation.resourceType,
          coding: annotation.coding,
          category: annotation.category,
          severity: annotation.severity,
          confidence: annotation.confidence,
          notes: annotation.notes,
          annotatedBy: annotation.annotatedBy,
          status: annotation.status
        })),
        summary,
        generatedAt: new Date().toISOString()
      });

    } catch (error) {
      console.error('[EMR API] Get annotations error:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to retrieve annotations'
      });
    }
  }
);

module.exports = router;