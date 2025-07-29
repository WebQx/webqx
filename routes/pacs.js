/**
 * PACS Routes
 * 
 * Express routes for PACS functionality including search, upload, and viewer access.
 */

const express = require('express');
const multer = require('multer');
const { body, query, param, validationResult } = require('express-validator');

// Import PACS services (will be implemented after TypeScript compilation)
// const { PACSService } = require('../modules/pacs');
// const { defaultPACSConfiguration } = require('../modules/pacs/config');

const router = express.Router();

// Configure multer for DICOM file uploads
const upload = multer({
  dest: '/tmp/dicom-uploads/',
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // 2GB max file size
    files: 100 // Max 100 files per request
  },
  fileFilter: (req, file, cb) => {
    // Allow DICOM files (may not have specific extensions)
    cb(null, true);
  }
});

// Mock PACS service for initial implementation
const mockPACSService = {
  async searchStudies(request, userId, userRole) {
    return {
      studies: [
        {
          studyInstanceUID: '1.2.3.4.5.6.7.8.9.0.1.2.3.4.5.6',
          patientID: 'PAT12345',
          patientName: 'Doe, John',
          studyDate: '2024-01-15',
          studyTime: '10:30:00',
          studyDescription: 'CT Chest without contrast',
          modality: 'CT',
          accessionNumber: 'ACC001',
          referringPhysician: 'Dr. Smith',
          specialty: 'radiology',
          seriesCount: 3,
          instanceCount: 150,
          status: 'completed',
          createdAt: new Date('2024-01-15T10:30:00Z'),
          updatedAt: new Date('2024-01-15T10:30:00Z')
        }
      ],
      totalCount: 1,
      offset: 0,
      limit: 50,
      searchTime: 125
    };
  },

  async uploadStudy(request, userId, userRole) {
    return {
      success: true,
      studyInstanceUID: '1.2.3.4.5.6.7.8.9.0.1.2.3.4.5.7',
      message: 'Study uploaded successfully',
      uploadedCount: request.files.length,
      failedCount: 0,
      errors: []
    };
  },

  async getViewerUrl(studyInstanceUID, specialty, userId, userRole) {
    return `http://localhost:3001/viewer?studyInstanceUIDs=${studyInstanceUID}&specialty=${specialty}`;
  },

  async transcribeReport(request, userId, userRole) {
    return {
      success: true,
      transcriptionId: `trans_${Date.now()}`,
      transcribedText: request.textContent || 'Mock transcription result',
      confidence: 0.95,
      language: request.language,
      timestamp: new Date(),
      reviewRequired: false
    };
  },

  async getMetrics() {
    return {
      totalStudies: 1250,
      totalSeries: 3750,
      totalInstances: 125000,
      storageUsedGB: 450.5,
      activeUsers: 15,
      averageResponseTimeMs: 250,
      errorRate: 0.5,
      uptime: 86400
    };
  },

  getAuditEvents(filter) {
    return [
      {
        eventType: 'access',
        resourceType: 'study',
        resourceId: '1.2.3.4.5.6.7.8.9.0.1.2.3.4.5.6',
        userId: 'user123',
        userRole: 'radiologist',
        timestamp: new Date(),
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0...',
        success: true,
        details: {}
      }
    ];
  },

  async testConnectivity() {
    return {
      orthanc: true,
      dicoogle: true,
      postdicom: false
    };
  }
};

// Middleware to extract user information from JWT token
const extractUserInfo = (req, res, next) => {
  // Extract user info from existing authentication middleware
  req.userId = req.user?.sub || 'anonymous';
  req.userRole = req.user?.role || 'user';
  next();
};

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation errors',
      errors: errors.array()
    });
  }
  next();
};

/**
 * GET /api/pacs/studies - Search for DICOM studies
 */
router.get('/studies', [
  query('patientID').optional().isString(),
  query('patientName').optional().isString(),
  query('studyDateFrom').optional().isISO8601(),
  query('studyDateTo').optional().isISO8601(),
  query('modality').optional().isString(),
  query('specialty').optional().isString(),
  query('accessionNumber').optional().isString(),
  query('studyDescription').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 1000 }),
  query('offset').optional().isInt({ min: 0 }),
  handleValidationErrors,
  extractUserInfo
], async (req, res) => {
  try {
    const searchRequest = {
      patientID: req.query.patientID,
      patientName: req.query.patientName,
      studyDate: {},
      modality: req.query.modality ? [req.query.modality] : undefined,
      specialty: req.query.specialty ? [req.query.specialty] : undefined,
      accessionNumber: req.query.accessionNumber,
      studyDescription: req.query.studyDescription,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0
    };

    // Handle date range
    if (req.query.studyDateFrom || req.query.studyDateTo) {
      if (req.query.studyDateFrom) searchRequest.studyDate.from = req.query.studyDateFrom;
      if (req.query.studyDateTo) searchRequest.studyDate.to = req.query.studyDateTo;
    }

    const result = await mockPACSService.searchStudies(searchRequest, req.userId, req.userRole);
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('PACS search error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search studies',
      error: error.message
    });
  }
});

/**
 * POST /api/pacs/studies - Upload DICOM study
 */
router.post('/studies', [
  upload.array('files', 100),
  body('patientID').notEmpty().withMessage('Patient ID is required'),
  body('specialty').notEmpty().withMessage('Specialty is required'),
  body('studyDescription').optional().isString(),
  handleValidationErrors,
  extractUserInfo
], async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    const uploadRequest = {
      files: req.files,
      patientID: req.body.patientID,
      studyDescription: req.body.studyDescription,
      specialty: req.body.specialty,
      metadata: req.body.metadata ? JSON.parse(req.body.metadata) : {}
    };

    const result = await mockPACSService.uploadStudy(uploadRequest, req.userId, req.userRole);
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('PACS upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload study',
      error: error.message
    });
  }
});

/**
 * GET /api/pacs/studies/:studyInstanceUID/viewer - Get viewer URL for study
 */
router.get('/studies/:studyInstanceUID/viewer', [
  param('studyInstanceUID').notEmpty().withMessage('Study Instance UID is required'),
  query('specialty').optional().isString(),
  handleValidationErrors,
  extractUserInfo
], async (req, res) => {
  try {
    const { studyInstanceUID } = req.params;
    const specialty = req.query.specialty || 'radiology';

    const viewerUrl = await mockPACSService.getViewerUrl(studyInstanceUID, specialty, req.userId, req.userRole);
    
    res.json({
      success: true,
      data: {
        studyInstanceUID,
        specialty,
        viewerUrl
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('PACS viewer URL error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate viewer URL',
      error: error.message
    });
  }
});

/**
 * POST /api/pacs/studies/:studyInstanceUID/transcribe - Transcribe study report
 */
router.post('/studies/:studyInstanceUID/transcribe', [
  param('studyInstanceUID').notEmpty().withMessage('Study Instance UID is required'),
  body('language').notEmpty().withMessage('Language is required'),
  body('specialty').notEmpty().withMessage('Specialty is required'),
  body('reportType').isIn(['preliminary', 'final', 'addendum']).withMessage('Invalid report type'),
  body('textContent').optional().isString(),
  handleValidationErrors,
  extractUserInfo
], async (req, res) => {
  try {
    const { studyInstanceUID } = req.params;
    
    const transcriptionRequest = {
      studyInstanceUID,
      textContent: req.body.textContent,
      language: req.body.language,
      specialty: req.body.specialty,
      reportType: req.body.reportType
    };

    const result = await mockPACSService.transcribeReport(transcriptionRequest, req.userId, req.userRole);
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('PACS transcription error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to transcribe report',
      error: error.message
    });
  }
});

/**
 * GET /api/pacs/metrics - Get PACS system metrics
 */
router.get('/metrics', extractUserInfo, async (req, res) => {
  try {
    const metrics = await mockPACSService.getMetrics();
    
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('PACS metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get metrics',
      error: error.message
    });
  }
});

/**
 * GET /api/pacs/audit - Get audit events
 */
router.get('/audit', [
  query('eventType').optional().isString(),
  query('userId').optional().isString(),
  query('fromDate').optional().isISO8601(),
  query('toDate').optional().isISO8601(),
  handleValidationErrors,
  extractUserInfo
], async (req, res) => {
  try {
    const filter = {};
    if (req.query.eventType) filter.eventType = req.query.eventType;
    if (req.query.userId) filter.userId = req.query.userId;
    if (req.query.fromDate) filter.fromDate = new Date(req.query.fromDate);
    if (req.query.toDate) filter.toDate = new Date(req.query.toDate);

    const events = mockPACSService.getAuditEvents(filter);
    
    res.json({
      success: true,
      data: {
        events,
        totalCount: events.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('PACS audit error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get audit events',
      error: error.message
    });
  }
});

/**
 * GET /api/pacs/health - Test PACS connectivity
 */
router.get('/health', async (req, res) => {
  try {
    const connectivity = await mockPACSService.testConnectivity();
    
    res.json({
      success: true,
      data: {
        connectivity,
        status: 'healthy',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('PACS health check error:', error);
    res.status(500).json({
      success: false,
      message: 'PACS health check failed',
      error: error.message
    });
  }
});

/**
 * DICOM Web Services (WADO-RS, QIDO-RS, STOW-RS)
 */

// QIDO-RS: Search for studies
router.get('/rs/studies', [
  query('PatientID').optional().isString(),
  query('PatientName').optional().isString(),
  query('StudyDate').optional().isString(),
  query('AccessionNumber').optional().isString(),
  query('StudyDescription').optional().isString(),
  query('Modality').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 1000 }),
  query('offset').optional().isInt({ min: 0 }),
  extractUserInfo
], async (req, res) => {
  try {
    // Convert QIDO-RS parameters to internal format
    const searchParams = {};
    Object.keys(req.query).forEach(key => {
      searchParams[key] = req.query[key];
    });

    // Mock DICOM JSON response
    const studies = [
      {
        "0020000D": { "Value": ["1.2.3.4.5.6.7.8.9.0.1.2.3.4.5.6"] },
        "00100020": { "Value": ["PAT12345"] },
        "00100010": { "Value": ["Doe^John"] },
        "00080020": { "Value": ["20240115"] },
        "00080030": { "Value": ["103000"] },
        "00081030": { "Value": ["CT Chest without contrast"] },
        "00080060": { "Value": ["CT"] },
        "00080050": { "Value": ["ACC001"] },
        "00201206": { "Value": [3] },
        "00201208": { "Value": [150] }
      }
    ];

    res.setHeader('Content-Type', 'application/dicom+json');
    res.json(studies);

  } catch (error) {
    console.error('QIDO-RS search error:', error);
    res.status(500).json({
      "00080001": { "Value": ["QIDO_RS_ERROR"] },
      "00080005": { "Value": ["ISO_IR 100"] }
    });
  }
});

// WADO-RS: Retrieve study
router.get('/rs/studies/:studyInstanceUID', [
  param('studyInstanceUID').notEmpty(),
  extractUserInfo
], async (req, res) => {
  try {
    const { studyInstanceUID } = req.params;
    const accept = req.headers.accept || 'application/dicom';

    if (accept.includes('application/dicom+json')) {
      // Return study metadata as DICOM JSON
      res.setHeader('Content-Type', 'application/dicom+json');
      res.json([{
        "0020000D": { "Value": [studyInstanceUID] },
        "00100020": { "Value": ["PAT12345"] },
        "00100010": { "Value": ["Doe^John"] }
      }]);
    } else {
      // Return multipart DICOM data (mock)
      res.setHeader('Content-Type', 'multipart/related; type="application/dicom"');
      res.send('Mock DICOM data');
    }

  } catch (error) {
    console.error('WADO-RS retrieve error:', error);
    res.status(500).send('WADO-RS retrieval failed');
  }
});

module.exports = router;