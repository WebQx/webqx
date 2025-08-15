/**
 * ChatEHR Routes
 * API endpoints for ChatEHR integration with physician and patient portals
 * Includes consultation requests, appointment sync, and secure messaging
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, param, query, validationResult } = require('express-validator');
const ChatEHRService = require('../services/chatEHRService');
const { createDynamicRateLimit } = require('../middleware/dynamicRateLimit');

const router = express.Router();

// Initialize ChatEHR service
const chatEHRService = new ChatEHRService({
    enableAuditLogging: process.env.HIPAA_AUDIT_ENABLED === 'true'
});

// Dynamic rate limiting for ChatEHR endpoints
const chatEHRRateLimit = createDynamicRateLimit({
    configType: 'chatEHR',
    endpointName: 'chatehr',
    // Fallback to static rate limiting if dynamic fails
    fallbackOptions: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // Limit each IP to 100 requests per windowMs
        message: {
            error: 'Too many ChatEHR requests from this IP, please try again later.',
            code: 'RATE_LIMIT_EXCEEDED'
        },
        standardHeaders: true,
        legacyHeaders: false
    }
});

// Apply dynamic rate limiting to all ChatEHR routes
router.use(chatEHRRateLimit);

// Middleware to validate request and handle errors
const validateRequest = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid request data',
                details: errors.array()
            }
        });
    }
    next();
};

// Middleware to ensure user authentication (assumes auth middleware is already applied)
const requireAuth = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: 'Authentication required'
            }
        });
    }
    next();
};

// Middleware for role-based access control
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.roles || !roles.some(role => req.user.roles.includes(role))) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'Insufficient permissions'
                }
            });
        }
        next();
    };
};

/**
 * POST /chatehr/consultations
 * Create a new consultation request
 */
router.post('/consultations',
    requireAuth,
    [
        body('patientId').notEmpty().withMessage('Patient ID is required'),
        body('specialty').notEmpty().withMessage('Specialty is required'),
        body('description').notEmpty().withMessage('Description is required'),
        body('urgency').optional().isIn(['routine', 'urgent', 'emergency']).withMessage('Invalid urgency level'),
        body('physicianId').optional().isString()
    ],
    validateRequest,
    async (req, res) => {
        try {
            const { patientId, physicianId, specialty, urgency, description, metadata } = req.body;

            // Ensure patient can only create requests for themselves (unless admin/physician)
            if (!req.user.roles.includes('physician') && !req.user.roles.includes('admin') && req.user.id !== patientId) {
                return res.status(403).json({
                    success: false,
                    error: {
                        code: 'FORBIDDEN',
                        message: 'Can only create consultation requests for yourself'
                    }
                });
            }

            const request = {
                patientId,
                physicianId,
                specialty,
                urgency: urgency || 'routine',
                description,
                metadata: {
                    createdBy: req.user.id,
                    createdByRole: req.user.roles?.[0] || 'patient',
                    ...metadata
                }
            };

            const result = await chatEHRService.createConsultationRequest(request);

            if (result.success) {
                res.status(201).json(result);
            } else {
                res.status(500).json(result);
            }
        } catch (error) {
            console.error('[ChatEHR Routes] Error creating consultation request:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to create consultation request'
                }
            });
        }
    }
);

/**
 * GET /chatehr/consultations
 * Get consultation requests for the current user
 */
router.get('/consultations',
    requireAuth,
    [
        query('status').optional().isIn(['pending', 'assigned', 'in_progress', 'completed', 'cancelled']),
        query('specialty').optional().isString(),
        query('limit').optional().isInt({ min: 1, max: 100 }),
        query('offset').optional().isInt({ min: 0 })
    ],
    validateRequest,
    async (req, res) => {
        try {
            const userType = req.user.roles.includes('physician') ? 'physician' : 'patient';
            const userId = req.user.id;
            const filters = {
                status: req.query.status,
                specialty: req.query.specialty,
                limit: parseInt(req.query.limit) || 20,
                offset: parseInt(req.query.offset) || 0
            };

            const result = await chatEHRService.getConsultationRequests(userId, userType, filters);

            if (result.success) {
                res.json(result);
            } else {
                res.status(500).json(result);
            }
        } catch (error) {
            console.error('[ChatEHR Routes] Error getting consultation requests:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to get consultation requests'
                }
            });
        }
    }
);

/**
 * PUT /chatehr/consultations/:consultationId
 * Update consultation request status (physician only)
 */
router.put('/consultations/:consultationId',
    requireAuth,
    requireRole(['physician', 'admin']),
    [
        param('consultationId').isUUID().withMessage('Invalid consultation ID'),
        body('status').notEmpty().isIn(['pending', 'assigned', 'in_progress', 'completed', 'cancelled']).withMessage('Invalid status'),
        body('physicianId').optional().isString(),
        body('notes').optional().isString()
    ],
    validateRequest,
    async (req, res) => {
        try {
            const { consultationId } = req.params;
            const { status, physicianId, notes } = req.body;

            const metadata = {
                updatedBy: req.user.id,
                updatedByRole: req.user.roles?.[0],
                notes,
                timestamp: new Date().toISOString()
            };

            const result = await chatEHRService.updateConsultationRequest(
                consultationId,
                status,
                physicianId,
                metadata
            );

            if (result.success) {
                res.json(result);
            } else {
                res.status(500).json(result);
            }
        } catch (error) {
            console.error('[ChatEHR Routes] Error updating consultation request:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to update consultation request'
                }
            });
        }
    }
);

/**
 * GET /chatehr/appointments
 * Sync appointments from ChatEHR
 */
router.get('/appointments',
    requireAuth,
    [
        query('startDate').optional().isISO8601().withMessage('Invalid start date'),
        query('endDate').optional().isISO8601().withMessage('Invalid end date')
    ],
    validateRequest,
    async (req, res) => {
        try {
            const userType = req.user.roles.includes('physician') ? 'physician' : 'patient';
            const userId = req.user.id;
            const dateRange = {
                startDate: req.query.startDate,
                endDate: req.query.endDate
            };

            const result = await chatEHRService.syncAppointments(userId, userType, dateRange);

            if (result.success) {
                res.json(result);
            } else {
                res.status(500).json(result);
            }
        } catch (error) {
            console.error('[ChatEHR Routes] Error syncing appointments:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to sync appointments'
                }
            });
        }
    }
);

/**
 * POST /chatehr/messages
 * Send secure message through ChatEHR
 */
router.post('/messages',
    requireAuth,
    [
        body('toId').notEmpty().withMessage('Recipient ID is required'),
        body('content').notEmpty().withMessage('Message content is required'),
        body('consultationId').isUUID().withMessage('Valid consultation ID is required'),
        body('type').optional().isIn(['text', 'attachment', 'system']).withMessage('Invalid message type')
    ],
    validateRequest,
    async (req, res) => {
        try {
            const { toId, content, consultationId, type, metadata } = req.body;

            const message = {
                fromId: req.user.id,
                toId,
                content,
                consultationId,
                type: type || 'text',
                metadata: {
                    senderRole: req.user.roles?.[0] || 'patient',
                    senderName: req.user.name || 'Unknown User',
                    ...metadata
                }
            };

            const result = await chatEHRService.sendSecureMessage(message);

            if (result.success) {
                res.status(201).json(result);
            } else {
                res.status(500).json(result);
            }
        } catch (error) {
            console.error('[ChatEHR Routes] Error sending secure message:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to send secure message'
                }
            });
        }
    }
);

/**
 * GET /chatehr/messages/:consultationId
 * Get secure messages for a consultation
 */
router.get('/messages/:consultationId',
    requireAuth,
    [
        param('consultationId').isUUID().withMessage('Invalid consultation ID'),
        query('limit').optional().isInt({ min: 1, max: 100 }),
        query('offset').optional().isInt({ min: 0 })
    ],
    validateRequest,
    async (req, res) => {
        try {
            const { consultationId } = req.params;
            const pagination = {
                limit: parseInt(req.query.limit) || 50,
                offset: parseInt(req.query.offset) || 0
            };

            const result = await chatEHRService.getSecureMessages(consultationId, req.user.id, pagination);

            if (result.success) {
                res.json(result);
            } else {
                res.status(500).json(result);
            }
        } catch (error) {
            console.error('[ChatEHR Routes] Error getting secure messages:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to get secure messages'
                }
            });
        }
    }
);

/**
 * GET /chatehr/health
 * Health check endpoint for ChatEHR service
 */
router.get('/health',
    async (req, res) => {
        try {
            const result = await chatEHRService.healthCheck();
            
            if (result.success) {
                res.json({
                    success: true,
                    status: 'healthy',
                    service: 'ChatEHR',
                    timestamp: new Date().toISOString(),
                    ...result.data
                });
            } else {
                res.status(503).json({
                    success: false,
                    status: 'unhealthy',
                    service: 'ChatEHR',
                    error: result.error,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (error) {
            console.error('[ChatEHR Routes] Health check error:', error);
            res.status(503).json({
                success: false,
                status: 'unhealthy',
                service: 'ChatEHR',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }
);

/**
 * GET /chatehr/rate-limit-stats
 * Get dynamic rate limiting statistics for monitoring
 */
router.get('/rate-limit-stats',
    requireAuth,
    requireRole(['admin', 'system']),
    async (req, res) => {
        try {
            const stats = chatEHRRateLimit.getStats();
            const allStats = chatEHRRateLimit.getAllStats();
            
            res.json({
                success: true,
                data: {
                    endpoint: stats,
                    global: allStats,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('[ChatEHR Routes] Error getting rate limit stats:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to get rate limit statistics'
                }
            });
        }
    }
);

/**
 * POST /chatehr/rate-limit-config
 * Update dynamic rate limiting configuration (admin only)
 */
router.post('/rate-limit-config',
    requireAuth,
    requireRole(['admin']),
    [
        body('lowTrafficThreshold').optional().isInt({ min: 1 }),
        body('highTrafficThreshold').optional().isInt({ min: 1 }),
        body('minRateLimit').optional().isInt({ min: 1 }),
        body('maxRateLimit').optional().isInt({ min: 1 }),
        body('adjustmentSensitivity').optional().isFloat({ min: 0, max: 1 })
    ],
    validateRequest,
    async (req, res) => {
        try {
            const newConfig = req.body;
            chatEHRRateLimit.updateConfig(newConfig);
            
            res.json({
                success: true,
                message: 'Rate limiting configuration updated',
                data: {
                    updatedConfig: newConfig,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('[ChatEHR Routes] Error updating rate limit config:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to update rate limit configuration'
                }
            });
        }
    }
);

/**
 * GET /chatehr/specialties
 * Get available medical specialties for consultation requests
 */
router.get('/specialties',
    requireAuth,
    async (req, res) => {
        try {
            // This would typically come from ChatEHR API, but we'll provide a static list
            const specialties = [
                { code: 'cardiology', name: 'Cardiology', description: 'Heart and cardiovascular conditions' },
                { code: 'dermatology', name: 'Dermatology', description: 'Skin, hair, and nail conditions' },
                { code: 'endocrinology', name: 'Endocrinology', description: 'Hormonal and metabolic disorders' },
                { code: 'gastroenterology', name: 'Gastroenterology', description: 'Digestive system disorders' },
                { code: 'neurology', name: 'Neurology', description: 'Nervous system conditions' },
                { code: 'oncology', name: 'Oncology', description: 'Cancer treatment and care' },
                { code: 'orthopedics', name: 'Orthopedics', description: 'Bone, joint, and muscle conditions' },
                { code: 'pediatrics', name: 'Pediatrics', description: 'Child and adolescent care' },
                { code: 'psychiatry', name: 'Psychiatry', description: 'Mental health conditions' },
                { code: 'pulmonology', name: 'Pulmonology', description: 'Lung and respiratory conditions' },
                { code: 'radiology', name: 'Radiology', description: 'Medical imaging and diagnostics' },
                { code: 'primary_care', name: 'Primary Care', description: 'General medical care' }
            ];

            res.json({
                success: true,
                data: specialties,
                metadata: {
                    count: specialties.length,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('[ChatEHR Routes] Error getting specialties:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to get specialties'
                }
            });
        }
    }
);

module.exports = router;