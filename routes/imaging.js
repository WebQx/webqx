/**
 * @fileoverview Enhanced Imaging API Routes
 * 
 * Secure API endpoints for OHIF viewer with performance optimization,
 * monitoring capabilities, and HIPAA-compliant audit logging.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, param, query, validationResult } = require('express-validator');

const router = express.Router();

// Mock data stores (in production, these would be database collections)
const activeViewerSessions = new Map();
const auditLogs = [];
const securityAlerts = [];
const systemMetrics = {
  uptime: Date.now(),
  totalRequests: 0,
  errorCount: 0,
  loadTimes: [],
};

// Rate limiting for API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: 'Too many API requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const viewerLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100, // Limit viewer requests
  message: 'Too many viewer requests, please try again later.',
});

// Apply rate limiting
router.use(apiLimiter);

/**
 * Middleware to verify JWT token and extract user info
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      error: 'Access token required' 
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'webqx-secret', (err, user) => {
    if (err) {
      return res.status(403).json({ 
        success: false, 
        error: 'Invalid or expired token' 
      });
    }
    req.user = user;
    next();
  });
};

/**
 * Middleware to check admin privileges
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      error: 'Admin privileges required' 
    });
  }
  next();
};

/**
 * Middleware to log API requests for audit
 */
const auditLogger = (req, res, next) => {
  const auditEntry = {
    timestamp: new Date(),
    userId: req.user?.id || 'anonymous',
    patientId: req.user?.patientId || req.params.patientId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    sessionId: req.headers['x-session-id'],
  };

  auditLogs.push(auditEntry);
  
  // Keep only last 10000 audit entries
  if (auditLogs.length > 10000) {
    auditLogs.splice(0, auditLogs.length - 10000);
  }

  systemMetrics.totalRequests++;
  next();
};

router.use(authenticateToken);
router.use(auditLogger);

/**
 * Get enhanced study information with caching headers
 */
router.get('/studies/:studyId', [
  param('studyId').isUUID().withMessage('Invalid study ID format'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { studyId } = req.params;
    const userId = req.user.id;
    const patientId = req.user.patientId;

    // Verify patient access to study
    if (!await verifyStudyAccess(studyId, patientId)) {
      const alert = {
        id: generateId(),
        type: 'unauthorized_access',
        severity: 'high',
        timestamp: new Date(),
        details: {
          patientId,
          studyId,
          ipAddress: req.ip,
          description: `Unauthorized access attempt to study ${studyId}`
        },
        resolved: false
      };
      securityAlerts.push(alert);

      return res.status(403).json({
        success: false,
        error: 'Access denied to requested study'
      });
    }

    // Mock study data (in production, fetch from imaging database)
    const study = {
      id: studyId,
      patientId,
      studyDate: '2024-01-15',
      modality: 'CT',
      description: 'Chest CT with contrast',
      seriesCount: 3,
      instanceCount: 150,
      status: 'available',
      sensitivity: 'normal',
      viewerUrl: `/ohif/viewer`,
      thumbnailUrl: `/api/imaging/studies/${studyId}/thumbnail`,
    };

    // Set caching headers for performance
    res.set({
      'Cache-Control': 'private, max-age=300', // 5 minutes cache
      'ETag': generateETag(study),
      'Last-Modified': new Date(study.studyDate).toUTCString()
    });

    res.json({
      success: true,
      data: study
    });

  } catch (error) {
    systemMetrics.errorCount++;
    console.error('Error fetching study:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get study metadata for OHIF viewer
 */
router.get('/studies/:studyId/metadata', [
  param('studyId').isUUID().withMessage('Invalid study ID format'),
], async (req, res) => {
  try {
    const { studyId } = req.params;
    const patientId = req.user.patientId;

    if (!await verifyStudyAccess(studyId, patientId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Mock DICOM metadata (in production, fetch from PACS)
    const metadata = {
      studyInstanceUID: `1.2.3.4.5.${studyId}`,
      seriesInstanceUIDs: [
        `1.2.3.4.5.${studyId}.1`,
        `1.2.3.4.5.${studyId}.2`,
        `1.2.3.4.5.${studyId}.3`
      ],
      patientId,
      studyDate: '20240115',
      studyTime: '143000',
      modality: 'CT',
      studyDescription: 'Chest CT with contrast',
      seriesCount: 3,
      instanceCount: 150,
      studySize: 52428800 // 50MB
    };

    res.json({
      success: true,
      data: metadata
    });

  } catch (error) {
    systemMetrics.errorCount++;
    console.error('Error fetching study metadata:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get related studies for prefetching
 */
router.get('/patients/:patientId/studies', [
  param('patientId').isUUID().withMessage('Invalid patient ID format'),
  query('exclude').optional().isUUID(),
  query('limit').optional().isInt({ min: 1, max: 20 }).toInt(),
], async (req, res) => {
  try {
    const { patientId } = req.params;
    const { exclude, limit = 5 } = req.query;

    // Verify patient access
    if (req.user.patientId !== patientId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Mock related studies (in production, query imaging database)
    const studies = [
      {
        id: 'study-001',
        studyDate: '2024-01-10',
        modality: 'CT',
        description: 'Abdomen CT',
      },
      {
        id: 'study-002',
        studyDate: '2024-01-05',
        modality: 'MR',
        description: 'Brain MRI',
      },
      {
        id: 'study-003',
        studyDate: '2023-12-20',
        modality: 'XR',
        description: 'Chest X-ray',
      }
    ].filter(study => study.id !== exclude).slice(0, limit);

    res.json({
      success: true,
      data: studies
    });

  } catch (error) {
    systemMetrics.errorCount++;
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get study thumbnails for quick preview
 */
router.get('/studies/:studyId/thumbnails', [
  param('studyId').isUUID().withMessage('Invalid study ID format'),
], async (req, res) => {
  try {
    const { studyId } = req.params;
    const patientId = req.user.patientId;

    if (!await verifyStudyAccess(studyId, patientId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Mock thumbnail URLs (in production, generate from DICOM)
    const thumbnails = [
      `/api/imaging/studies/${studyId}/series/1/thumbnail`,
      `/api/imaging/studies/${studyId}/series/2/thumbnail`,
      `/api/imaging/studies/${studyId}/series/3/thumbnail`
    ];

    res.json({
      success: true,
      data: { thumbnails }
    });

  } catch (error) {
    systemMetrics.errorCount++;
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Submit release request for restricted studies
 */
router.post('/release-requests', [
  body('studyId').isUUID().withMessage('Invalid study ID'),
  body('requestReason').isLength({ min: 10, max: 500 }).withMessage('Reason must be 10-500 characters'),
  body('urgency').isIn(['routine', 'urgent', 'emergency']).withMessage('Invalid urgency level'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { studyId, requestReason, urgency } = req.body;
    const patientId = req.user.patientId;

    // Create release request
    const releaseRequest = {
      id: generateId(),
      studyId,
      patientId,
      requestReason,
      urgency,
      timestamp: new Date(),
      status: 'pending',
      requestedBy: req.user.id
    };

    // In production, save to database and notify medical staff
    console.log('Release request submitted:', releaseRequest);

    res.json({
      success: true,
      message: 'Release request submitted successfully',
      data: { requestId: releaseRequest.id }
    });

  } catch (error) {
    systemMetrics.errorCount++;
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Log audit events from OHIF viewer
 */
router.post('/audit', [
  body('sessionId').isString().withMessage('Session ID required'),
  body('event.eventType').isIn(['viewer_open', 'study_load', 'tool_use', 'viewer_close', 'error']),
  body('event.timestamp').isISO8601().withMessage('Invalid timestamp'),
], async (req, res) => {
  try {
    const { sessionId, patientId, studyId, event } = req.body;

    const auditEntry = {
      id: generateId(),
      sessionId,
      patientId: patientId || req.user.patientId,
      studyId,
      userId: req.user.id,
      event,
      timestamp: new Date(),
      ip: req.ip,
      userAgent: req.get('User-Agent')
    };

    auditLogs.push(auditEntry);

    // Check for security violations
    if (event.eventType === 'error' || event.details?.error) {
      const alert = {
        id: generateId(),
        type: 'suspicious_activity',
        severity: 'medium',
        timestamp: new Date(),
        details: {
          sessionId,
          patientId: auditEntry.patientId,
          description: `Viewer error: ${event.details?.error || 'Unknown error'}`,
          ipAddress: req.ip
        },
        resolved: false
      };
      securityAlerts.push(alert);
    }

    res.json({
      success: true,
      message: 'Audit event logged'
    });

  } catch (error) {
    systemMetrics.errorCount++;
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Admin-only monitoring endpoints
router.use('/monitoring', requireAdmin);

/**
 * Get system health metrics
 */
router.get('/monitoring/system-health', (req, res) => {
  const uptime = (Date.now() - systemMetrics.uptime) / 1000; // seconds
  const errorRate = systemMetrics.totalRequests > 0 
    ? systemMetrics.errorCount / systemMetrics.totalRequests 
    : 0;
  const averageLoadTime = systemMetrics.loadTimes.length > 0
    ? systemMetrics.loadTimes.reduce((a, b) => a + b, 0) / systemMetrics.loadTimes.length
    : 0;

  const health = {
    status: errorRate > 0.1 ? 'error' : errorRate > 0.05 ? 'warning' : 'healthy',
    uptime,
    activeSessionsCount: activeViewerSessions.size,
    errorRate,
    averageLoadTime,
    cacheHitRate: 0.85, // Mock value
    lastUpdated: new Date()
  };

  res.json({
    success: true,
    data: health
  });
});

/**
 * Get active viewer sessions
 */
router.get('/monitoring/active-sessions', (req, res) => {
  const sessions = Array.from(activeViewerSessions.values()).map(session => ({
    ...session,
    auditTrail: session.auditTrail.slice(-5) // Only last 5 events for performance
  }));

  res.json({
    success: true,
    data: sessions
  });
});

/**
 * Get security alerts
 */
router.get('/monitoring/security-alerts', [
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
], (req, res) => {
  const { limit = 50 } = req.query;
  
  const alerts = securityAlerts
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit);

  res.json({
    success: true,
    data: alerts
  });
});

/**
 * Resolve security alert
 */
router.post('/monitoring/security-alerts/:alertId/resolve', [
  param('alertId').isString().withMessage('Invalid alert ID'),
], (req, res) => {
  const { alertId } = req.params;
  
  const alertIndex = securityAlerts.findIndex(alert => alert.id === alertId);
  if (alertIndex === -1) {
    return res.status(404).json({
      success: false,
      error: 'Alert not found'
    });
  }

  securityAlerts[alertIndex].resolved = true;
  securityAlerts[alertIndex].resolvedBy = req.user.id;
  securityAlerts[alertIndex].resolvedAt = new Date();

  res.json({
    success: true,
    message: 'Alert resolved successfully'
  });
});

/**
 * Force close viewer session
 */
router.post('/monitoring/sessions/:sessionId/close', [
  param('sessionId').isString().withMessage('Invalid session ID'),
], (req, res) => {
  const { sessionId } = req.params;
  
  if (!activeViewerSessions.has(sessionId)) {
    return res.status(404).json({
      success: false,
      error: 'Session not found'
    });
  }

  activeViewerSessions.delete(sessionId);

  // Log admin action
  auditLogs.push({
    id: generateId(),
    sessionId,
    userId: req.user.id,
    event: {
      eventType: 'viewer_close',
      timestamp: new Date(),
      details: {
        action: 'admin_forced_close',
        adminUserId: req.user.id
      }
    },
    timestamp: new Date(),
    ip: req.ip
  });

  res.json({
    success: true,
    message: 'Session closed successfully'
  });
});

// DICOM-WEB compatible endpoints
router.use('/dicom-web', viewerLimiter);

/**
 * DICOM-WEB QIDO-RS Study search
 */
router.get('/dicom-web/studies/:studyInstanceUID', [
  param('studyInstanceUID').isString().withMessage('Invalid study instance UID'),
], async (req, res) => {
  try {
    const { studyInstanceUID } = req.params;
    
    // Mock DICOM-WEB response (in production, proxy to PACS)
    const dicomData = [{
      "0008,0005": { "vr": "CS", "Value": ["ISO_IR 100"] },
      "0008,0020": { "vr": "DA", "Value": ["20240115"] },
      "0008,0030": { "vr": "TM", "Value": ["143000"] },
      "0008,0050": { "vr": "SH", "Value": ["STUDY001"] },
      "0008,1030": { "vr": "LO", "Value": ["Chest CT with contrast"] },
      "0010,0010": { "vr": "PN", "Value": [{ "Alphabetic": "Anonymous" }] },
      "0010,0020": { "vr": "LO", "Value": [req.user.patientId] },
      "0020,000D": { "vr": "UI", "Value": [studyInstanceUID] },
      "0020,0010": { "vr": "SH", "Value": ["12345"] }
    }];

    res.json(dicomData);

  } catch (error) {
    systemMetrics.errorCount++;
    res.status(500).json({
      success: false,
      error: 'DICOM-WEB query failed'
    });
  }
});

/**
 * DICOM-WEB QIDO-RS Series search
 */
router.get('/dicom-web/studies/:studyInstanceUID/series', [
  param('studyInstanceUID').isString().withMessage('Invalid study instance UID'),
], async (req, res) => {
  try {
    const { studyInstanceUID } = req.params;
    
    // Mock series data
    const seriesData = [
      {
        "0008,0060": { "vr": "CS", "Value": ["CT"] },
        "0008,103E": { "vr": "LO", "Value": ["Axial CT"] },
        "0020,000E": { "vr": "UI", "Value": [`${studyInstanceUID}.1`] },
        "0020,0011": { "vr": "IS", "Value": ["1"] },
        "0020,1209": { "vr": "IS", "Value": ["50"] }
      },
      {
        "0008,0060": { "vr": "CS", "Value": ["CT"] },
        "0008,103E": { "vr": "LO", "Value": ["Coronal CT"] },
        "0020,000E": { "vr": "UI", "Value": [`${studyInstanceUID}.2`] },
        "0020,0011": { "vr": "IS", "Value": ["2"] },
        "0020,1209": { "vr": "IS", "Value": ["50"] }
      }
    ];

    res.json(seriesData);

  } catch (error) {
    systemMetrics.errorCount++;
    res.status(500).json({
      success: false,
      error: 'DICOM-WEB series query failed'
    });
  }
});

// Helper functions
async function verifyStudyAccess(studyId, patientId) {
  // In production, check database for patient-study relationship
  return true; // Mock: allow access
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateETag(data) {
  return `"${Buffer.from(JSON.stringify(data)).toString('base64').slice(0, 16)}"`;
}

module.exports = router;