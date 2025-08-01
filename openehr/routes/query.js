const express = require('express');
const OpenEHRService = require('../services/OpenEHRService');
const { body, validationResult } = require('express-validator');

const router = express.Router();
const openEHRService = new OpenEHRService();

/**
 * Error handler helper for openEHR
 */
const handleError = (res, error, statusCode = 500) => {
    console.error('openEHR AQL API Error:', error);
    
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
 * POST /openehr/v1/query/aql
 * Execute AQL query
 */
router.post('/aql', [
    body('q').isString().notEmpty().withMessage('AQL query (q) is required'),
    body('query_parameters').optional().isObject(),
    body('offset').optional().isInt({ min: 0 }),
    body('fetch').optional().isInt({ min: 1, max: 1000 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return handleError(res, new Error(`Invalid AQL query: ${errors.array().map(e => e.msg).join(', ')}`), 400);
        }
        
        const result = await openEHRService.executeAQL(req.body);
        
        sendOpenEHRResponse(res, result);
    } catch (error) {
        handleError(res, error, 400);
    }
});

/**
 * GET /openehr/v1/query/aql
 * Execute AQL query via GET (with query parameter)
 */
router.get('/aql', async (req, res) => {
    try {
        const { q, query_parameters, offset, fetch } = req.query;
        
        if (!q) {
            return handleError(res, new Error('AQL query parameter (q) is required'), 400);
        }
        
        const queryData = {
            q,
            query_parameters: query_parameters ? JSON.parse(query_parameters) : undefined,
            offset: offset ? parseInt(offset) : undefined,
            fetch: fetch ? parseInt(fetch) : undefined
        };
        
        const result = await openEHRService.executeAQL(queryData);
        
        sendOpenEHRResponse(res, result);
    } catch (error) {
        if (error.message.includes('JSON')) {
            handleError(res, new Error('Invalid JSON in query_parameters'), 400);
        } else {
            handleError(res, error, 400);
        }
    }
});

module.exports = router;