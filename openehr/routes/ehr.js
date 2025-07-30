const express = require('express');
const OpenEHRService = require('../services/OpenEHRService');
const { body, param, query, validationResult } = require('express-validator');

const router = express.Router();
const openEHRService = new OpenEHRService();

/**
 * Error handler helper for openEHR
 */
const handleError = (res, error, statusCode = 500) => {
    console.error('openEHR EHR API Error:', error);
    
    const errorResponse = {
        error: {
            message: error.message || 'An error occurred',
            code: statusCode
        },
        timestamp: new Date().toISOString()
    };
    
    res.status(statusCode).json(errorResponse);
};

/**
 * Success response helper for openEHR
 */
const sendOpenEHRResponse = (res, data, statusCode = 200) => {
    res.status(statusCode)
       .set('Content-Type', 'application/json; charset=utf-8')
       .json(data);
};

/**
 * POST /openehr/v1/ehr
 * Create a new EHR
 */
router.post('/', [
    body('ehr_status').optional().isObject(),
    body('subject_id').optional().isString()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return handleError(res, new Error(`Invalid EHR data: ${errors.array().map(e => e.msg).join(', ')}`), 400);
        }
        
        const ehr = await openEHRService.createEHR(req.body);
        
        // Set Location header for created resource
        res.set('Location', `${req.protocol}://${req.get('host')}/openehr/v1/ehr/${ehr.ehr_id}`);
        
        sendOpenEHRResponse(res, ehr.toJSON(), 201);
    } catch (error) {
        handleError(res, error, 400);
    }
});

/**
 * GET /openehr/v1/ehr/:ehr_id
 * Get EHR by ID
 */
router.get('/:ehr_id', [
    param('ehr_id').isString().notEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return handleError(res, new Error('Invalid EHR ID'), 400);
        }
        
        const ehr = await openEHRService.getEHR(req.params.ehr_id);
        
        if (!ehr) {
            return handleError(res, new Error('EHR not found'), 404);
        }
        
        sendOpenEHRResponse(res, ehr.toJSON());
    } catch (error) {
        handleError(res, error);
    }
});

/**
 * GET /openehr/v1/ehr/:ehr_id/ehr_status
 * Get EHR status
 */
router.get('/:ehr_id/ehr_status', [
    param('ehr_id').isString().notEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return handleError(res, new Error('Invalid EHR ID'), 400);
        }
        
        const ehrStatus = await openEHRService.getEHRStatus(req.params.ehr_id);
        
        if (!ehrStatus) {
            return handleError(res, new Error('EHR not found'), 404);
        }
        
        sendOpenEHRResponse(res, ehrStatus);
    } catch (error) {
        handleError(res, error);
    }
});

/**
 * PUT /openehr/v1/ehr/:ehr_id/ehr_status
 * Update EHR status
 */
router.put('/:ehr_id/ehr_status', [
    param('ehr_id').isString().notEmpty(),
    body('subject').optional().isObject(),
    body('is_modifiable').optional().isBoolean(),
    body('is_queryable').optional().isBoolean()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return handleError(res, new Error(`Invalid EHR status data: ${errors.array().map(e => e.msg).join(', ')}`), 400);
        }
        
        const updatedEHR = await openEHRService.updateEHRStatus(req.params.ehr_id, req.body);
        
        sendOpenEHRResponse(res, updatedEHR.ehr_status);
    } catch (error) {
        if (error.message.includes('not found')) {
            handleError(res, error, 404);
        } else {
            handleError(res, error, 400);
        }
    }
});

/**
 * GET /openehr/v1/ehr/$count
 * Get total EHR count (WebQx extension)
 */
router.get('/$count', async (req, res) => {
    try {
        const count = openEHRService.getEHRCount();
        
        const response = {
            count: count,
            timestamp: new Date().toISOString()
        };
        
        sendOpenEHRResponse(res, response);
    } catch (error) {
        handleError(res, error);
    }
});

module.exports = router;