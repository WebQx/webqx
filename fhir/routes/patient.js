const express = require('express');
const PatientService = require('../services/PatientService');
const { body, param, query, validationResult } = require('express-validator');

const router = express.Router();
const patientService = new PatientService();

/**
 * Error handler helper
 */
const handleError = (res, error, statusCode = 500) => {
    console.error('FHIR Patient API Error:', error);
    
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
 * GET /fhir/Patient
 * Search for patients with optional parameters
 */
router.get('/', [
    query('name').optional().isString().trim(),
    query('gender').optional().isIn(['male', 'female', 'other', 'unknown']),
    query('birthdate').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
    query('active').optional().isBoolean(),
    query('identifier').optional().isString(),
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
        const paramValidation = patientService.validateSearchParams(searchParams);
        
        if (!paramValidation.isValid) {
            return handleError(res, new Error(paramValidation.errors.join(', ')), 400);
        }
        
        const searchResults = await patientService.search(searchParams);
        
        // Create FHIR Bundle response
        const bundle = {
            resourceType: 'Bundle',
            id: `search-${Date.now()}`,
            type: 'searchset',
            total: searchResults.total,
            entry: searchResults.patients.map(patient => ({
                resource: patient.toJSON(),
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
 * GET /fhir/Patient/$count
 * Get total patient count (WebQx extension)
 */
router.get('/$count', async (req, res) => {
    try {
        const count = patientService.getCount();
        
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
 * GET /fhir/Patient/:id/$summary
 * Get patient summary (WebQx extension)
 */
router.get('/:id/$summary', [
    param('id').isString().notEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return handleError(res, new Error('Invalid patient ID'), 400);
        }
        
        const patient = await patientService.read(req.params.id);
        
        if (!patient) {
            return handleError(res, new Error('Patient not found'), 404);
        }
        
        const summary = patient.getSummary();
        sendFHIRResponse(res, summary);
    } catch (error) {
        handleError(res, error);
    }
});

/**
 * GET /fhir/Patient/:id
 * Read a specific patient by ID
 */
router.get('/:id', [
    param('id').isString().notEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return handleError(res, new Error('Invalid patient ID'), 400);
        }
        
        const patient = await patientService.read(req.params.id);
        
        if (!patient) {
            return handleError(res, new Error('Patient not found'), 404);
        }
        
        sendFHIRResponse(res, patient.toJSON());
    } catch (error) {
        handleError(res, error);
    }
});

/**
 * POST /fhir/Patient
 * Create a new patient
 */
router.post('/', [
    body('resourceType').equals('Patient'),
    body('name').isArray({ min: 1 }),
    body('identifier').optional().isArray(),
    body('gender').optional().isIn(['male', 'female', 'other', 'unknown']),
    body('birthDate').optional().matches(/^\d{4}-\d{2}-\d{2}$/)
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return handleError(res, new Error(`Invalid patient data: ${errors.array().map(e => e.msg).join(', ')}`), 400);
        }
        
        const patient = await patientService.create(req.body);
        
        // Set Location header for created resource
        res.set('Location', `${req.protocol}://${req.get('host')}/fhir/Patient/${patient.id}`);
        
        sendFHIRResponse(res, patient.toJSON(), 201);
    } catch (error) {
        handleError(res, error, 400);
    }
});

/**
 * PUT /fhir/Patient/:id
 * Update an existing patient
 */
router.put('/:id', [
    param('id').isString().notEmpty(),
    body('resourceType').equals('Patient'),
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
        
        const patient = await patientService.update(req.params.id, req.body);
        
        sendFHIRResponse(res, patient.toJSON());
    } catch (error) {
        if (error.message.includes('not found')) {
            handleError(res, error, 404);
        } else {
            handleError(res, error, 400);
        }
    }
});

/**
 * DELETE /fhir/Patient/:id
 * Delete a patient
 */
router.delete('/:id', [
    param('id').isString().notEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return handleError(res, new Error('Invalid patient ID'), 400);
        }
        
        const deleted = await patientService.delete(req.params.id);
        
        if (!deleted) {
            return handleError(res, new Error('Patient not found'), 404);
        }
        
        // Return 204 No Content for successful deletion
        res.status(204).send();
    } catch (error) {
        handleError(res, error);
    }
});

/**
 * GET /fhir/Patient/:id/$summary
 * Get patient summary (WebQx extension)
 */
router.get('/:id/$summary', [
    param('id').isString().notEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return handleError(res, new Error('Invalid patient ID'), 400);
        }
        
        const patient = await patientService.read(req.params.id);
        
        if (!patient) {
            return handleError(res, new Error('Patient not found'), 404);
        }
        
        const summary = patient.getSummary();
        sendFHIRResponse(res, summary);
    } catch (error) {
        handleError(res, error);
    }
});

/**
 * GET /fhir/Patient/$count
 * Get total patient count (WebQx extension)
 */
router.get('/$count', async (req, res) => {
    try {
        const count = patientService.getCount();
        
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

module.exports = router;