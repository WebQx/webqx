const express = require('express');
const OpenEHRService = require('../services/OpenEHRService');
const { body, param, query, validationResult } = require('express-validator');

const router = express.Router();
const openEHRService = new OpenEHRService();

/**
 * Error handler helper for openEHR
 */
const handleError = (res, error, statusCode = 500) => {
    console.error('openEHR Composition API Error:', error);
    
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
 * POST /openehr/v1/ehr/:ehr_id/composition
 * Create a new composition
 */
router.post('/:ehr_id/composition', [
    param('ehr_id').isString().notEmpty(),
    body('name').isObject(),
    body('name.value').isString().notEmpty(),
    body('composer').isObject(),
    body('composer.name').isString().notEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return handleError(res, new Error(`Invalid composition data: ${errors.array().map(e => e.msg).join(', ')}`), 400);
        }
        
        // Get template ID from header
        const templateId = req.get('openEHR-TEMPLATE_ID') || 'default.template';
        
        const composition = await openEHRService.createComposition(
            req.params.ehr_id,
            templateId,
            req.body
        );
        
        // Set Location header for created resource
        res.set('Location', `${req.protocol}://${req.get('host')}/openehr/v1/composition/${composition.uid}`);
        
        sendOpenEHRResponse(res, composition.toJSON(), 201);
    } catch (error) {
        if (error.message.includes('EHR not found')) {
            handleError(res, error, 404);
        } else {
            handleError(res, error, 400);
        }
    }
});

/**
 * GET /openehr/v1/composition/:uid
 * Get composition by UID
 */
router.get('/:uid', [
    param('uid').isString().notEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return handleError(res, new Error('Invalid composition UID'), 400);
        }
        
        const composition = await openEHRService.getComposition(req.params.uid);
        
        if (!composition) {
            return handleError(res, new Error('Composition not found'), 404);
        }
        
        sendOpenEHRResponse(res, composition.toJSON());
    } catch (error) {
        handleError(res, error);
    }
});

/**
 * PUT /openehr/v1/ehr/:ehr_id/composition/:uid
 * Update composition
 */
router.put('/:ehr_id/composition/:uid', [
    param('ehr_id').isString().notEmpty(),
    param('uid').isString().notEmpty(),
    body('name').optional().isObject(),
    body('composer').optional().isObject()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return handleError(res, new Error(`Invalid composition data: ${errors.array().map(e => e.msg).join(', ')}`), 400);
        }
        
        // Get template ID from header
        const templateId = req.get('openEHR-TEMPLATE_ID') || 'default.template';
        
        const composition = await openEHRService.updateComposition(
            req.params.ehr_id,
            req.params.uid,
            templateId,
            req.body
        );
        
        sendOpenEHRResponse(res, composition.toJSON());
    } catch (error) {
        if (error.message.includes('not found')) {
            handleError(res, error, 404);
        } else {
            handleError(res, error, 400);
        }
    }
});

/**
 * DELETE /openehr/v1/ehr/:ehr_id/composition/:uid
 * Delete composition
 */
router.delete('/:ehr_id/composition/:uid', [
    param('ehr_id').isString().notEmpty(),
    param('uid').isString().notEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return handleError(res, new Error('Invalid parameters'), 400);
        }
        
        const deleted = await openEHRService.deleteComposition(
            req.params.ehr_id,
            req.params.uid
        );
        
        if (!deleted) {
            return handleError(res, new Error('Composition not found'), 404);
        }
        
        // Return 204 No Content for successful deletion
        res.status(204).send();
    } catch (error) {
        if (error.message.includes('not found')) {
            handleError(res, error, 404);
        } else {
            handleError(res, error, 400);
        }
    }
});

/**
 * GET /openehr/v1/composition
 * Search compositions
 */
router.get('/', [
    query('ehr_id').optional().isString(),
    query('archetype_node_id').optional().isString(),
    query('composer').optional().isString(),
    query('name').optional().isString()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return handleError(res, new Error(`Invalid query parameters: ${errors.array().map(e => e.msg).join(', ')}`), 400);
        }
        
        const searchParams = req.query;
        const paramValidation = openEHRService.validateSearchParams(searchParams);
        
        if (!paramValidation.isValid) {
            return handleError(res, new Error(paramValidation.errors.join(', ')), 400);
        }
        
        const compositions = await openEHRService.searchCompositions(searchParams);
        
        const response = {
            total: compositions.length,
            compositions: compositions.map(comp => comp.toJSON()),
            timestamp: new Date().toISOString()
        };
        
        sendOpenEHRResponse(res, response);
    } catch (error) {
        handleError(res, error);
    }
});

/**
 * GET /openehr/v1/composition/$count
 * Get total composition count (WebQx extension)
 */
router.get('/$count', async (req, res) => {
    try {
        const count = openEHRService.getCompositionCount();
        
        const response = {
            count: count,
            timestamp: new Date().toISOString()
        };
        
        sendOpenEHRResponse(res, response);
    } catch (error) {
        handleError(res, error);
    }
});

/**
 * GET /openehr/v1/composition/:uid/$summary
 * Get composition summary (WebQx extension)
 */
router.get('/:uid/$summary', [
    param('uid').isString().notEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return handleError(res, new Error('Invalid composition UID'), 400);
        }
        
        const composition = await openEHRService.getComposition(req.params.uid);
        
        if (!composition) {
            return handleError(res, new Error('Composition not found'), 404);
        }
        
        const summary = composition.getSummary();
        sendOpenEHRResponse(res, summary);
    } catch (error) {
        handleError(res, error);
    }
});

module.exports = router;