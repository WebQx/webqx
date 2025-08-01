/**
 * @fileoverview FHIR Telehealth Routes
 * 
 * Express.js routes for telehealth session management with FHIR R4 integration.
 * Provides endpoints for session creation, management, and FHIR resource handling.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const TelehealthService = require('../telehealthService');

/**
 * Initialize telehealth service with configuration
 */
let telehealthService = null;

const initializeTelehealthService = () => {
  if (!telehealthService) {
    const config = {
      fhirServerUrl: process.env.FHIR_SERVER_URL || 'http://localhost:3000/fhir',
      fhirAuthToken: process.env.FHIR_AUTH_TOKEN,
      comlink: {
        apiKey: process.env.COMLINK_API_KEY,
        apiSecret: process.env.COMLINK_API_SECRET,
        baseUrl: process.env.COMLINK_BASE_URL || 'https://api.comlink.dev',
        environment: process.env.COMLINK_ENVIRONMENT || 'sandbox'
      },
      jitsi: {
        domain: process.env.JITSI_DOMAIN || 'meet.jit.si',
        appId: process.env.JITSI_APP_ID,
        jwt: process.env.JITSI_JWT,
        enableAudioOnly: process.env.JITSI_AUDIO_ONLY === 'true',
        enableScreenSharing: process.env.JITSI_SCREEN_SHARING !== 'false'
      },
      preferredProvider: process.env.TELEHEALTH_PREFERRED_PROVIDER || 'auto',
      enableFHIRIntegration: process.env.TELEHEALTH_ENABLE_FHIR !== 'false',
      accessibility: {
        enableCaptions: process.env.TELEHEALTH_ENABLE_CAPTIONS !== 'false',
        enableHighContrast: process.env.TELEHEALTH_HIGH_CONTRAST === 'true',
        enableKeyboardNavigation: process.env.TELEHEALTH_KEYBOARD_NAV !== 'false',
        screenReaderAnnouncements: process.env.TELEHEALTH_SCREEN_READER !== 'false'
      }
    };

    try {
      telehealthService = new TelehealthService.TelehealthService(config);
      console.log('[Telehealth Routes] Telehealth service initialized successfully');
    } catch (error) {
      console.error('[Telehealth Routes] Failed to initialize telehealth service:', error.message);
      // Continue without telehealth service for graceful degradation
    }
  }
  return telehealthService;
};

/**
 * Middleware to ensure telehealth service is available
 */
const ensureTelehealthService = (req, res, next) => {
  const service = initializeTelehealthService();
  if (!service) {
    return res.status(503).json({
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'error',
        code: 'not-supported',
        details: {
          text: 'Telehealth service is not available'
        }
      }]
    });
  }
  req.telehealthService = service;
  next();
};

/**
 * Validation middleware for session launch requests
 */
const validateSessionLaunchRequest = (req, res, next) => {
  const { patientId, providerId } = req.body;
  
  if (!patientId || !providerId) {
    return res.status(400).json({
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'error',
        code: 'required',
        details: {
          text: 'Both patientId and providerId are required'
        },
        location: [!patientId ? 'patientId' : 'providerId']
      }]
    });
  }

  // Validate ID formats (basic validation)
  const idPattern = /^[A-Za-z0-9\-\.]{1,64}$/;
  if (!idPattern.test(patientId) || !idPattern.test(providerId)) {
    return res.status(400).json({
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'error',
        code: 'invalid',
        details: {
          text: 'Invalid ID format. IDs must be alphanumeric with dashes and periods only'
        }
      }]
    });
  }

  next();
};

/**
 * POST /fhir/telehealth/sessions
 * Launch a new telehealth session
 */
router.post('/sessions', ensureTelehealthService, validateSessionLaunchRequest, async (req, res) => {
  try {
    const {
      patientId,
      providerId,
      appointmentId,
      sessionType = 'consultation',
      specialty,
      preferredProvider,
      options = {}
    } = req.body;

    console.log('[Telehealth Routes] Launching new session', { 
      patientId, 
      providerId, 
      sessionType 
    });

    const sessionRequest = {
      patientId,
      providerId,
      appointmentId,
      sessionType,
      specialty,
      preferredProvider,
      options
    };

    const result = await req.telehealthService.launchSession(sessionRequest);

    if (result.success) {
      // Return FHIR-compliant response
      res.status(201).json({
        resourceType: 'Parameters',
        parameter: [
          {
            name: 'sessionId',
            valueString: result.session.id
          },
          {
            name: 'joinUrl',
            valueUrl: result.joinUrl
          },
          {
            name: 'provider',
            valueString: result.session.provider
          },
          {
            name: 'status',
            valueString: result.session.status
          },
          ...(result.session.appointmentId ? [{
            name: 'appointmentId',
            valueString: result.session.appointmentId
          }] : []),
          ...(result.session.encounterId ? [{
            name: 'encounterId',
            valueString: result.session.encounterId
          }] : [])
        ]
      });
    } else {
      res.status(500).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'exception',
          details: {
            text: result.error?.message || 'Failed to launch session'
          }
        }]
      });
    }

  } catch (error) {
    console.error('[Telehealth Routes] Error launching session:', error);
    res.status(500).json({
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'error',
        code: 'exception',
        details: {
          text: error.message || 'Internal server error'
        }
      }]
    });
  }
});

/**
 * GET /fhir/telehealth/sessions/:sessionId
 * Get session status and information
 */
router.get('/sessions/:sessionId', ensureTelehealthService, (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = req.telehealthService.getSessionStatus(sessionId);

    if (!session) {
      return res.status(404).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'not-found',
          details: {
            text: 'Session not found'
          }
        }]
      });
    }

    // Return session information as FHIR Parameters
    res.json({
      resourceType: 'Parameters',
      parameter: [
        {
          name: 'sessionId',
          valueString: session.id
        },
        {
          name: 'status',
          valueString: session.status
        },
        {
          name: 'provider',
          valueString: session.provider
        },
        {
          name: 'patientId',
          valueString: session.patientId
        },
        {
          name: 'providerId',
          valueString: session.providerId
        },
        ...(session.startTime ? [{
          name: 'startTime',
          valueDateTime: session.startTime.toISOString()
        }] : []),
        ...(session.endTime ? [{
          name: 'endTime',
          valueDateTime: session.endTime.toISOString()
        }] : []),
        ...(session.appointmentId ? [{
          name: 'appointmentId',
          valueString: session.appointmentId
        }] : []),
        ...(session.encounterId ? [{
          name: 'encounterId',
          valueString: session.encounterId
        }] : []),
        ...(session.metadata ? [{
          name: 'metadata',
          part: Object.entries(session.metadata).map(([key, value]) => ({
            name: key,
            valueString: String(value)
          }))
        }] : [])
      ]
    });

  } catch (error) {
    console.error('[Telehealth Routes] Error getting session:', error);
    res.status(500).json({
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'error',
        code: 'exception',
        details: {
          text: error.message || 'Internal server error'
        }
      }]
    });
  }
});

/**
 * POST /fhir/telehealth/sessions/:sessionId/join
 * Join an existing session
 */
router.post('/sessions/:sessionId/join', ensureTelehealthService, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { userType = 'patient' } = req.body;

    if (!['patient', 'provider'].includes(userType)) {
      return res.status(400).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'invalid',
          details: {
            text: 'userType must be either "patient" or "provider"'
          }
        }]
      });
    }

    const result = await req.telehealthService.joinSession(sessionId, userType);

    if (result.success) {
      res.json({
        resourceType: 'Parameters',
        parameter: [
          {
            name: 'joinUrl',
            valueUrl: result.joinUrl
          },
          {
            name: 'sessionId',
            valueString: sessionId
          },
          {
            name: 'userType',
            valueString: userType
          }
        ]
      });
    } else {
      const statusCode = result.error?.code === 'SESSION_JOIN_FAILED' ? 404 : 500;
      res.status(statusCode).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: statusCode === 404 ? 'not-found' : 'exception',
          details: {
            text: result.error?.message || 'Failed to join session'
          }
        }]
      });
    }

  } catch (error) {
    console.error('[Telehealth Routes] Error joining session:', error);
    res.status(500).json({
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'error',
        code: 'exception',
        details: {
          text: error.message || 'Internal server error'
        }
      }]
    });
  }
});

/**
 * DELETE /fhir/telehealth/sessions/:sessionId
 * End a telehealth session
 */
router.delete('/sessions/:sessionId', ensureTelehealthService, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const result = await req.telehealthService.endSession(sessionId);

    if (result.success) {
      res.json({
        resourceType: 'Parameters',
        parameter: [
          {
            name: 'sessionId',
            valueString: sessionId
          },
          {
            name: 'status',
            valueString: 'ended'
          },
          {
            name: 'endTime',
            valueDateTime: new Date().toISOString()
          }
        ]
      });
    } else {
      res.status(500).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'exception',
          details: {
            text: result.error || 'Failed to end session'
          }
        }]
      });
    }

  } catch (error) {
    console.error('[Telehealth Routes] Error ending session:', error);
    res.status(500).json({
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'error',
        code: 'exception',
        details: {
          text: error.message || 'Internal server error'
        }
      }]
    });
  }
});

/**
 * GET /fhir/telehealth/sessions
 * List active sessions for a user
 */
router.get('/sessions', ensureTelehealthService, (req, res) => {
  try {
    const { userId, userType = 'patient' } = req.query;

    if (!userId) {
      return res.status(400).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'required',
          details: {
            text: 'userId query parameter is required'
          }
        }]
      });
    }

    if (!['patient', 'provider'].includes(userType)) {
      return res.status(400).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'invalid',
          details: {
            text: 'userType must be either "patient" or "provider"'
          }
        }]
      });
    }

    const sessions = req.telehealthService.getActiveSessions(userId, userType);

    // Return as FHIR Bundle
    res.json({
      resourceType: 'Bundle',
      type: 'searchset',
      total: sessions.length,
      entry: sessions.map(session => ({
        resource: {
          resourceType: 'Parameters',
          parameter: [
            {
              name: 'sessionId',
              valueString: session.id
            },
            {
              name: 'status',
              valueString: session.status
            },
            {
              name: 'provider',
              valueString: session.provider
            },
            {
              name: 'patientId',
              valueString: session.patientId
            },
            {
              name: 'providerId',
              valueString: session.providerId
            },
            ...(session.startTime ? [{
              name: 'startTime',
              valueDateTime: session.startTime.toISOString()
            }] : []),
            ...(session.appointmentId ? [{
              name: 'appointmentId',
              valueString: session.appointmentId
            }] : [])
          ]
        }
      }))
    });

  } catch (error) {
    console.error('[Telehealth Routes] Error listing sessions:', error);
    res.status(500).json({
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'error',
        code: 'exception',
        details: {
          text: error.message || 'Internal server error'
        }
      }]
    });
  }
});

/**
 * GET /fhir/telehealth/providers
 * Get available telehealth providers (Comlink/Jitsi status)
 */
router.get('/providers', ensureTelehealthService, async (req, res) => {
  try {
    const service = req.telehealthService;
    const config = service.getConfig ? service.getConfig() : {};
    
    // Test provider availability
    const providers = [];
    
    // Check Comlink availability
    if (config.comlink?.apiKey) {
      try {
        const available = await service.testComlinkAvailability ? 
          await service.testComlinkAvailability() : false;
        providers.push({
          name: 'comlink',
          display: 'Comlink Video Platform',
          available,
          features: ['recording', 'captions', 'screen-sharing', 'mobile-optimized']
        });
      } catch (error) {
        providers.push({
          name: 'comlink',
          display: 'Comlink Video Platform', 
          available: false,
          error: 'Configuration error'
        });
      }
    }

    // Jitsi is always available as fallback
    providers.push({
      name: 'jitsi',
      display: 'Jitsi Meet (Open Source)',
      available: true,
      features: ['screen-sharing', 'captions', 'mobile-optimized', 'open-source']
    });

    res.json({
      resourceType: 'Parameters',
      parameter: [
        {
          name: 'preferredProvider',
          valueString: config.preferredProvider || 'auto'
        },
        {
          name: 'providers',
          part: providers.map(provider => ({
            name: provider.name,
            part: [
              {
                name: 'display',
                valueString: provider.display
              },
              {
                name: 'available',
                valueBoolean: provider.available
              },
              ...(provider.features ? [{
                name: 'features',
                valueString: provider.features.join(',')
              }] : []),
              ...(provider.error ? [{
                name: 'error',
                valueString: provider.error
              }] : [])
            ]
          }))
        }
      ]
    });

  } catch (error) {
    console.error('[Telehealth Routes] Error getting providers:', error);
    res.status(500).json({
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'error',
        code: 'exception',
        details: {
          text: error.message || 'Internal server error'
        }
      }]
    });
  }
});

/**
 * Error handling middleware
 */
router.use((error, req, res, next) => {
  console.error('[Telehealth Routes] Unhandled error:', error);
  
  res.status(500).json({
    resourceType: 'OperationOutcome',
    issue: [{
      severity: 'error',
      code: 'exception',
      details: {
        text: 'An unexpected error occurred'
      }
    }]
  });
});

module.exports = router;