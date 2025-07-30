const express = require('express');
const ObservationService = require('../services/ObservationService');
const { body, param, query, validationResult } = require('express-validator');

const router = express.Router();
const observationService = new ObservationService();

/**
 * Error handler helper
 */
const handleError = (res, error, statusCode = 500) => {
    console.error('FHIR Observation API Error:', error);
    
    const operationOutcome = {
        resourceType: 'OperationOutcome',
        issue: [{
            severity: 'error',
            code: 'processing',
            diagnostics: error.message || 'An error occurred'
        }]
    };
    
    res.status(statusCode).json(operationOutcome);
};

/**
 * Success response helper for FHIR
 */
const sendFHIRResponse = (res, data, statusCode = 200) => {
    res.status(statusCode)
       .set('Content-Type', 'application/fhir+json; charset=utf-8')
       .json(data);
};

/**
 * GET /fhir/Observation
 * Search for observations with optional parameters
 */
router.get('/', [
    query('patient').optional().isString().trim(),
    query('subject').optional().isString().trim(),
    query('code').optional().isString().trim(),
    query('category').optional().isString().trim(),
    query('status').optional().isIn(['registered', 'preliminary', 'final', 'amended', 'corrected', 'cancelled', 'entered-in-error', 'unknown']),
    query('date').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
    query('_offset').optional().isInt({ min: 0 }),
    query('_count').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
    try {
        // Validate query parameters
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return handleError(res, new Error(`Invalid query parameters: ${errors.array().map(e => e.msg).join(', ')}`), 400);
        }
        
        const searchParams = req.query;
        const paramValidation = observationService.validateSearchParams(searchParams);
        
        if (!paramValidation.isValid) {
            return handleError(res, new Error(paramValidation.errors.join(', ')), 400);
        }
        
        const searchResults = await observationService.search(searchParams);
        
        // Create FHIR Bundle response
        const bundle = {
            resourceType: 'Bundle',
            id: `search-${Date.now()}`,
            type: 'searchset',
            total: searchResults.total,
            entry: searchResults.observations.map(observation => ({
                resource: observation.toJSON(),
                search: {
                    mode: 'match'
                }
            }))
        };
        
        // Add pagination links
        if (searchResults.total > (searchResults.offset + searchResults.count)) {
            bundle.link = [
                {
                    relation: 'self',
                    url: `${req.protocol}://${req.get('host')}${req.path}?${new URLSearchParams(req.query)}`
                },
                {
                    relation: 'next',
                    url: `${req.protocol}://${req.get('host')}${req.path}?${new URLSearchParams({
                        ...req.query,
                        _offset: searchResults.offset + searchResults.count
                    })}`
                }
            ];
        }
        
        sendFHIRResponse(res, bundle);
    } catch (error) {
        handleError(res, error);
    }
});

/**
 * GET /fhir/Observation/$count
 * Get total observation count (WebQx extension)
 */
router.get('/$count', async (req, res) => {
    try {
        const count = observationService.getCount();
        
        const response = {
            resourceType: 'Parameters',
            parameter: [{
                name: 'count',
                valueInteger: count
            }]
        };
        
        sendFHIRResponse(res, response);
    } catch (error) {
        handleError(res, error);
    }
});

/**
 * GET /fhir/Observation/:id/$summary
 * Get observation summary (WebQx extension)
 */
router.get('/:id/$summary', [
    param('id').isString().notEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return handleError(res, new Error('Invalid observation ID'), 400);
        }
        
        const observation = await observationService.read(req.params.id);
        
        if (!observation) {
            return handleError(res, new Error('Observation not found'), 404);
        }
        
        const summary = observation.getSummary();
        sendFHIRResponse(res, summary);
    } catch (error) {
        handleError(res, error);
    }
});

/**
 * GET /fhir/Observation/:id
 * Read a specific observation by ID
 */
router.get('/:id', [
    param('id').isString().notEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return handleError(res, new Error('Invalid observation ID'), 400);
        }
        
        const observation = await observationService.read(req.params.id);
        
        if (!observation) {
            return handleError(res, new Error('Observation not found'), 404);
        }
        
        sendFHIRResponse(res, observation.toJSON());
    } catch (error) {
        handleError(res, error);
    }
});

/**
 * POST /fhir/Observation
 * Create a new observation
 */
router.post('/', [
    body('resourceType').equals('Observation'),
    body('status').isIn(['registered', 'preliminary', 'final', 'amended', 'corrected', 'cancelled', 'entered-in-error', 'unknown']),
    body('code').isObject(),
    body('subject').isObject(),
    body('subject.reference').isString().notEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return handleError(res, new Error(`Invalid observation data: ${errors.array().map(e => e.msg).join(', ')}`), 400);
        }
        
        const observation = await observationService.create(req.body);
        
        // Set Location header for created resource
        res.set('Location', `${req.protocol}://${req.get('host')}/fhir/Observation/${observation.id}`);
        
        sendFHIRResponse(res, observation.toJSON(), 201);
    } catch (error) {
        handleError(res, error, 400);
    }
});

/**
 * PUT /fhir/Observation/:id
 * Update an existing observation
 */
router.put('/:id', [
    param('id').isString().notEmpty(),
    body('resourceType').equals('Observation'),
    body('id').custom((value, { req }) => {
        if (value && value !== req.params.id) {
            throw new Error('ID in body must match ID in URL');
        }
        return true;
    })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return handleError(res, new Error(`Invalid update data: ${errors.array().map(e => e.msg).join(', ')}`), 400);
        }
        
        // Ensure ID matches
        req.body.id = req.params.id;
        
        const observation = await observationService.update(req.params.id, req.body);
        
        sendFHIRResponse(res, observation.toJSON());
    } catch (error) {
        if (error.message.includes('not found')) {
            handleError(res, error, 404);
        } else {
            handleError(res, error, 400);
        }
    }
});

/**
 * DELETE /fhir/Observation/:id
 * Delete an observation
 */
router.delete('/:id', [
    param('id').isString().notEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return handleError(res, new Error('Invalid observation ID'), 400);
        }
        
        const deleted = await observationService.delete(req.params.id);
        
        if (!deleted) {
            return handleError(res, new Error('Observation not found'), 404);
        }
        
        // Return 204 No Content for successful deletion
        res.status(204).send();
    } catch (error) {
        handleError(res, error);
    }
});

module.exports = router;