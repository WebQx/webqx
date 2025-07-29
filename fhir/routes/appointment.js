const express = require('express');
const AppointmentService = require('../services/AppointmentService');
const { body, param, query, validationResult } = require('express-validator');

const router = express.Router();
const appointmentService = new AppointmentService();

/**
 * Error handler helper
 */
const handleError = (res, error, statusCode = 500) => {
    console.error('FHIR Appointment API Error:', error);
    
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
 * POST /fhir/Appointment/:id (operations like $book)
 * Handle POST operations
 */
router.post('/:id', [
    param('id').isString().notEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return handleError(res, new Error('Invalid request'), 400);
        }
        
        const id = req.params.id;
        
        // Handle operations that start with $
        if (id === '$book') {
            // Validate booking data
            const { patientId, practitionerId, slotId, serviceType, description, priority } = req.body;
            
            if (!patientId || !practitionerId || !slotId) {
                return handleError(res, new Error('patientId, practitionerId, and slotId are required'), 400);
            }
            
            const appointment = await appointmentService.bookAppointment(req.body);
            
            // Set Location header for created resource
            res.set('Location', `${req.protocol}://${req.get('host')}/fhir/Appointment/${appointment.id}`);
            
            return sendFHIRResponse(res, appointment.toJSON(), 201);
        }
        
        // Handle cancellation operations
        if (id.endsWith('/$cancel')) {
            const appointmentId = id.replace('/$cancel', '');
            const appointment = await appointmentService.cancelAppointment(
                appointmentId, 
                req.body.reason
            );
            return sendFHIRResponse(res, appointment.toJSON());
        }
        
        return handleError(res, new Error(`Unknown operation: ${id}`), 400);
        
    } catch (error) {
        if (error.message.includes('not found')) {
            handleError(res, error, 404);
        } else {
            handleError(res, error, 400);
        }
    }
});

// ===== PARAMETRIC OPERATIONS (with :id) =====

/**
 * GET /fhir/Appointment/:id/$summary
 * Get appointment summary
 */
router.get('/:id/$summary', [
    param('id').isString().notEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return handleError(res, new Error('Invalid appointment ID'), 400);
        }
        
        const appointment = await appointmentService.read(req.params.id);
        
        if (!appointment) {
            return handleError(res, new Error('Appointment not found'), 404);
        }
        
        const summary = appointment.getSummary();
        sendFHIRResponse(res, summary);
    } catch (error) {
        handleError(res, error);
    }
});

/**
 * POST /fhir/Appointment/:id/$cancel
 * Cancel an appointment
 */
router.post('/:id/$cancel', [
    param('id').isString().notEmpty(),
    body('reason').optional().isString()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return handleError(res, new Error('Invalid cancellation request'), 400);
        }
        
        const appointment = await appointmentService.cancelAppointment(
            req.params.id, 
            req.body.reason
        );
        
        sendFHIRResponse(res, appointment.toJSON());
    } catch (error) {
        if (error.message.includes('not found')) {
            handleError(res, error, 404);
        } else {
            handleError(res, error, 400);
        }
    }
});

// ===== STANDARD CRUD OPERATIONS =====

/**
 * GET /fhir/Appointment/:id
 * Read a specific appointment by ID
 * Note: This route must check if the ID is an operation first
 */
router.get('/:id', [
    param('id').isString().notEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return handleError(res, new Error('Invalid appointment ID'), 400);
        }
        
        const id = req.params.id;
        
        // Handle operations that start with $
        if (id.startsWith('$')) {
            switch (id) {
                case '$count':
                    const count = appointmentService.getCount();
                    const countResponse = {
                        resourceType: 'Parameters',
                        parameter: [{
                            name: 'count',
                            valueInteger: count
                        }]
                    };
                    return sendFHIRResponse(res, countResponse);
                    
                case '$today':
                    const todayAppointments = appointmentService.getTodaysAppointments();
                    const todayBundle = {
                        resourceType: 'Bundle',
                        id: `today-${Date.now()}`,
                        type: 'collection',
                        total: todayAppointments.length,
                        entry: todayAppointments.map(appointment => ({
                            resource: appointment.toJSON()
                        }))
                    };
                    return sendFHIRResponse(res, todayBundle);
                    
                case '$upcoming':
                    const days = parseInt(req.query.days) || 7;
                    const upcomingAppointments = appointmentService.getUpcomingAppointments(days);
                    const upcomingBundle = {
                        resourceType: 'Bundle',
                        id: `upcoming-${Date.now()}`,
                        type: 'collection',
                        total: upcomingAppointments.length,
                        entry: upcomingAppointments.map(appointment => ({
                            resource: appointment.toJSON()
                        }))
                    };
                    return sendFHIRResponse(res, upcomingBundle);
                    
                case '$available-slots':
                    const slots = await appointmentService.getAvailableSlots(req.query);
                    const slotsResponse = {
                        resourceType: 'Parameters',
                        parameter: [
                            {
                                name: 'slots',
                                part: slots.map(slot => ({
                                    name: 'slot',
                                    resource: {
                                        resourceType: 'Slot',
                                        id: slot.id,
                                        status: 'free',
                                        start: slot.start,
                                        end: slot.end,
                                        schedule: {
                                            reference: slot.practitioner
                                        }
                                    }
                                }))
                            }
                        ]
                    };
                    return sendFHIRResponse(res, slotsResponse);
                    
                default:
                    return handleError(res, new Error(`Unknown operation: ${id}`), 400);
            }
        }
        
        // Regular appointment ID lookup
        const appointment = await appointmentService.read(id);
        
        if (!appointment) {
            return handleError(res, new Error('Appointment not found'), 404);
        }
        
        sendFHIRResponse(res, appointment.toJSON());
    } catch (error) {
        handleError(res, error);
    }
});

/**
 * GET /fhir/Appointment
 * Search for appointments with optional parameters
 */
router.get('/', [
    query('patient').optional().isString(),
    query('practitioner').optional().isString(),
    query('status').optional().isIn(['proposed', 'pending', 'booked', 'arrived', 'fulfilled', 'cancelled', 'noshow', 'entered-in-error', 'checked-in', 'waitlist']),
    query('date').optional().isISO8601(),
    query('service-type').optional().isString(),
    query('_offset').optional().isInt({ min: 0 }),
    query('_count').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
    try {
        // Validate query parameters
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return handleError(res, new Error(`Invalid query parameters: ${errors.array().map(e => e.msg).join(', ')}`), 400);
        }
        
        const searchResults = await appointmentService.search(req.query);
        
        // Create FHIR Bundle response
        const bundle = {
            resourceType: 'Bundle',
            id: `search-${Date.now()}`,
            type: 'searchset',
            total: searchResults.total,
            entry: searchResults.appointments.map(appointment => ({
                resource: appointment.toJSON(),
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
 * POST /fhir/Appointment
 * Create a new appointment or handle operations
 */
router.post('/', [
    body('resourceType').optional().equals('Appointment'),
    body('status').optional().isIn(['proposed', 'pending', 'booked', 'arrived', 'fulfilled', 'cancelled', 'noshow', 'entered-in-error', 'checked-in', 'waitlist']),
    body('participant').optional().isArray({ min: 1 }),
    body('start').optional().isISO8601(),
    body('end').optional().isISO8601()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return handleError(res, new Error(`Invalid appointment data: ${errors.array().map(e => e.msg).join(', ')}`), 400);
        }
        
        const appointment = await appointmentService.create(req.body);
        
        // Set Location header for created resource
        res.set('Location', `${req.protocol}://${req.get('host')}/fhir/Appointment/${appointment.id}`);
        
        sendFHIRResponse(res, appointment.toJSON(), 201);
    } catch (error) {
        handleError(res, error, 400);
    }
});

/**
 * PUT /fhir/Appointment/:id
 * Update an existing appointment
 */
router.put('/:id', [
    param('id').isString().notEmpty(),
    body('resourceType').equals('Appointment'),
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
        
        const appointment = await appointmentService.update(req.params.id, req.body);
        
        sendFHIRResponse(res, appointment.toJSON());
    } catch (error) {
        if (error.message.includes('not found')) {
            handleError(res, error, 404);
        } else {
            handleError(res, error, 400);
        }
    }
});

/**
 * DELETE /fhir/Appointment/:id
 * Delete an appointment
 */
router.delete('/:id', [
    param('id').isString().notEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return handleError(res, new Error('Invalid appointment ID'), 400);
        }
        
        const deleted = await appointmentService.delete(req.params.id);
        
        if (!deleted) {
            return handleError(res, new Error('Appointment not found'), 404);
        }
        
        // Return 204 No Content for successful deletion
        res.status(204).send();
    } catch (error) {
        handleError(res, error);
    }
});

module.exports = router;