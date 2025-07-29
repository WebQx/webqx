/**
 * FHIR ImagingStudy Routes
 * 
 * RESTful API endpoints for FHIR R4 ImagingStudy resources
 * with PACS integration and specialty routing.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const ImagingStudyService = require('../services/ImagingStudyService');

const router = express.Router();
const imagingStudyService = new ImagingStudyService();

/**
 * GET /fhir/ImagingStudy
 * Search for ImagingStudy resources
 */
router.get('/', [
  query('patient').optional().isString(),
  query('started').optional().isISO8601(),
  query('modality').optional().isString(),
  query('status').optional().isIn(['registered', 'available', 'cancelled', 'entered-in-error', 'unknown']),
  query('identifier').optional().isString(),
  query('specialty').optional().isString(),
  query('_count').optional().isInt({ min: 1, max: 100 }),
  query('_offset').optional().isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'invalid',
          diagnostics: 'Invalid search parameters',
          details: { text: errors.array().map(e => e.msg).join(', ') }
        }]
      });
    }

    const searchParams = {
      patient: req.query.patient,
      started: req.query.started,
      modality: req.query.modality,
      status: req.query.status,
      identifier: req.query.identifier,
      specialty: req.query.specialty
    };

    const bundle = await imagingStudyService.searchImagingStudies(searchParams);
    
    res.json(bundle);
  } catch (error) {
    console.error('ImagingStudy search error:', error);
    res.status(500).json({
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'error',
        code: 'exception',
        diagnostics: 'Internal server error during ImagingStudy search'
      }]
    });
  }
});

/**
 * GET /fhir/ImagingStudy/:id
 * Get a specific ImagingStudy by ID
 */
router.get('/:id', [
  param('id').isString().isLength({ min: 1, max: 64 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'invalid',
          diagnostics: 'Invalid resource ID'
        }]
      });
    }

    const imagingStudy = await imagingStudyService.getImagingStudy(req.params.id);
    
    if (!imagingStudy) {
      return res.status(404).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'not-found',
          diagnostics: `ImagingStudy with ID ${req.params.id} not found`
        }]
      });
    }

    res.json(imagingStudy);
  } catch (error) {
    console.error('ImagingStudy get error:', error);
    res.status(500).json({
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'error',
        code: 'exception',
        diagnostics: 'Internal server error during ImagingStudy retrieval'
      }]
    });
  }
});

/**
 * POST /fhir/ImagingStudy/$route
 * Route an ImagingStudy to appropriate specialties
 */
router.post('/:id/$route', [
  param('id').isString().isLength({ min: 1, max: 64 }),
  body('patientContext').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'invalid',
          diagnostics: 'Invalid routing request'
        }]
      });
    }

    const imagingStudy = await imagingStudyService.getImagingStudy(req.params.id);
    
    if (!imagingStudy) {
      return res.status(404).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'not-found',
          diagnostics: `ImagingStudy with ID ${req.params.id} not found`
        }]
      });
    }

    const routingResult = await imagingStudyService.routeImagingStudy(
      imagingStudy,
      req.body.patientContext
    );

    res.json({
      resourceType: 'Parameters',
      parameter: [
        {
          name: 'primarySpecialty',
          valueString: routingResult.primarySpecialty
        },
        {
          name: 'secondarySpecialties',
          valueString: routingResult.secondarySpecialties.join(',')
        },
        {
          name: 'priority',
          valueCode: routingResult.priority
        },
        {
          name: 'routingRule',
          valueString: routingResult.routingRuleApplied
        },
        ...(routingResult.recommendations || []).map(rec => ({
          name: 'recommendation',
          valueString: rec
        }))
      ]
    });
  } catch (error) {
    console.error('ImagingStudy routing error:', error);
    res.status(500).json({
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'error',
        code: 'exception',
        diagnostics: 'Internal server error during ImagingStudy routing'
      }]
    });
  }
});

/**
 * GET /fhir/ImagingStudy/:id/$images
 * Get DICOM images for an ImagingStudy
 */
router.get('/:id/$images', [
  param('id').isString().isLength({ min: 1, max: 64 }),
  query('series').optional().isString(),
  query('instance').optional().isString(),
  query('thumbnail').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'invalid',
          diagnostics: 'Invalid image request parameters'
        }]
      });
    }

    const imagingStudy = await imagingStudyService.getImagingStudy(req.params.id);
    
    if (!imagingStudy) {
      return res.status(404).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'not-found',
          diagnostics: `ImagingStudy with ID ${req.params.id} not found`
        }]
      });
    }

    // Mock DICOM images for demo
    const mockImages = [
      {
        studyInstanceUID: req.params.id,
        seriesInstanceUID: '1.2.3.4.5.1',
        sopInstanceUID: '1.2.3.4.5.1.1',
        imageUrl: `/mock-dicom/${req.params.id}/image1.dcm`,
        metadata: {
          patientID: 'PAT123',
          patientName: 'John Doe',
          studyDate: '20240115',
          studyTime: '100000',
          modality: 'CT',
          bodyPart: 'CHEST'
        }
      }
    ];

    res.json({
      resourceType: 'Bundle',
      type: 'collection',
      total: mockImages.length,
      entry: mockImages.map(img => ({
        resource: {
          resourceType: 'Binary',
          id: img.sopInstanceUID,
          contentType: req.query.thumbnail === 'true' ? 'image/jpeg' : 'application/dicom',
          url: img.imageUrl,
          extension: [
            {
              url: 'http://webqx.health/fhir/extension/study-uid',
              valueString: img.studyInstanceUID
            },
            {
              url: 'http://webqx.health/fhir/extension/series-uid',
              valueString: img.seriesInstanceUID
            }
          ]
        }
      }))
    });
  } catch (error) {
    console.error('ImagingStudy images error:', error);
    res.status(500).json({
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'error',
        code: 'exception',
        diagnostics: 'Internal server error during image retrieval'
      }]
    });
  }
});

/**
 * GET /fhir/ImagingStudy/$specialties
 * Get available specialty routing configurations
 */
router.get('/$specialties', async (req, res) => {
  try {
    // Mock specialty configurations
    const specialties = [
      {
        name: 'radiology',
        displayName: 'Radiology',
        description: 'Diagnostic imaging and image-guided procedures',
        supportedModalities: ['CT', 'MRI', 'XR', 'US', 'PET', 'SPECT', 'CR', 'DR', 'MG'],
        supportedBodyParts: ['*'],
        isActive: true
      },
      {
        name: 'cardiology',
        displayName: 'Cardiology',
        description: 'Heart and cardiovascular system',
        supportedModalities: ['CT', 'MRI', 'US', 'XR'],
        supportedBodyParts: ['CHEST', 'HEART'],
        isActive: true
      },
      {
        name: 'orthopedics',
        displayName: 'Orthopedics',
        description: 'Musculoskeletal system',
        supportedModalities: ['XR', 'CT', 'MRI', 'CR', 'DR'],
        supportedBodyParts: ['EXTREMITY', 'SPINE', 'PELVIS'],
        isActive: true
      }
    ];

    const routingRules = [
      {
        id: 'cardiac-imaging',
        name: 'Cardiac Imaging to Cardiology',
        specialty: 'cardiology',
        priority: 10,
        isActive: true
      },
      {
        id: 'orthopedic-xray',
        name: 'Orthopedic X-Ray to Orthopedics',
        specialty: 'orthopedics',
        priority: 9,
        isActive: true
      }
    ];

    res.json({
      resourceType: 'Parameters',
      parameter: [
        {
          name: 'specialties',
          part: specialties.map(spec => ({
            name: spec.name,
            valueString: spec.displayName,
            extension: [
              {
                url: 'http://webqx.health/fhir/extension/specialty-description',
                valueString: spec.description
              },
              {
                url: 'http://webqx.health/fhir/extension/supported-modalities',
                valueString: spec.supportedModalities.join(',')
              },
              {
                url: 'http://webqx.health/fhir/extension/supported-body-parts',
                valueString: spec.supportedBodyParts.join(',')
              }
            ]
          }))
        },
        {
          name: 'routingRules',
          part: routingRules.map(rule => ({
            name: rule.id,
            valueString: rule.name,
            extension: [
              {
                url: 'http://webqx.health/fhir/extension/rule-specialty',
                valueString: rule.specialty
              },
              {
                url: 'http://webqx.health/fhir/extension/rule-priority',
                valueInteger: rule.priority
              }
            ]
          }))
        }
      ]
    });
  } catch (error) {
    console.error('Specialties configuration error:', error);
    res.status(500).json({
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'error',
        code: 'exception',
        diagnostics: 'Internal server error during specialties retrieval'
      }]
    });
  }
});

module.exports = router;