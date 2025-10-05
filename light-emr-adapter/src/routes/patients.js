import express from 'express';
import { 
  listPatients, 
  getPatient, 
  createPatient, 
  updatePatient,
  searchPatients 
} from '../medplum.js';
import { logger } from '../logger.js';

const router = express.Router();

/**
 * GET /emr/patients - List patients
 * Query params:
 *   - limit: max number of patients (default: 5, max: 100)
 */
router.get('/patients', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 5, 100);
    const patients = await listPatients(limit);
    
    res.json({
      status: 'ok',
      count: patients.length,
      patients
    });
  } catch (error) {
    logger.error({ msg: 'Failed to list patients', err: error.message });
    res.status(500).json({
      status: 'error',
      error: 'Failed to retrieve patients',
      message: error.message
    });
  }
});

/**
 * GET /emr/patients/search - Search patients
 * Query params support FHIR search parameters:
 *   - name: patient name (partial match)
 *   - identifier: patient identifier
 *   - birthdate: birth date (YYYY-MM-DD)
 *   - gender: male, female, other, unknown
 *   - _count: max results
 */
router.get('/patients/search', async (req, res) => {
  try {
    const searchParams = {};
    
    // Map common search parameters
    if (req.query.name) searchParams.name = req.query.name;
    if (req.query.identifier) searchParams.identifier = req.query.identifier;
    if (req.query.birthdate) searchParams.birthdate = req.query.birthdate;
    if (req.query.gender) searchParams.gender = req.query.gender;
    if (req.query._count) searchParams._count = Math.min(parseInt(req.query._count, 10), 100);
    
    const patients = await searchPatients(searchParams);
    
    res.json({
      status: 'ok',
      count: patients.length,
      searchParams,
      patients
    });
  } catch (error) {
    logger.error({ msg: 'Failed to search patients', err: error.message });
    res.status(500).json({
      status: 'error',
      error: 'Failed to search patients',
      message: error.message
    });
  }
});

/**
 * GET /emr/patients/:id - Get single patient by ID
 */
router.get('/patients/:id', async (req, res) => {
  try {
    const patient = await getPatient(req.params.id);
    
    if (!patient) {
      return res.status(404).json({
        status: 'error',
        error: 'Patient not found',
        patientId: req.params.id
      });
    }
    
    res.json({
      status: 'ok',
      patient
    });
  } catch (error) {
    logger.error({ msg: 'Failed to get patient', patientId: req.params.id, err: error.message });
    res.status(500).json({
      status: 'error',
      error: 'Failed to retrieve patient',
      message: error.message
    });
  }
});

/**
 * POST /emr/patients - Create new patient
 * Body should contain FHIR Patient resource fields:
 * {
 *   "name": [{ "given": ["John"], "family": "Doe" }],
 *   "gender": "male",
 *   "birthDate": "1990-01-01",
 *   "telecom": [{ "system": "phone", "value": "555-1234" }],
 *   "address": [{ "line": ["123 Main St"], "city": "Boston", "state": "MA", "postalCode": "02101" }]
 * }
 */
router.post('/patients', async (req, res) => {
  try {
    // Basic validation
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        status: 'error',
        error: 'Invalid request body',
        message: 'Request body must be a valid JSON object'
      });
    }

    // Validate required fields
    if (!req.body.name || !Array.isArray(req.body.name) || req.body.name.length === 0) {
      return res.status(400).json({
        status: 'error',
        error: 'Validation failed',
        message: 'Patient name is required'
      });
    }

    const patient = await createPatient(req.body);
    
    if (!patient) {
      return res.status(500).json({
        status: 'error',
        error: 'Failed to create patient',
        message: 'Medplum returned no response'
      });
    }
    
    res.status(201).json({
      status: 'created',
      patient
    });
  } catch (error) {
    logger.error({ msg: 'Failed to create patient', err: error.message });
    res.status(500).json({
      status: 'error',
      error: 'Failed to create patient',
      message: error.message
    });
  }
});

/**
 * PUT /emr/patients/:id - Update existing patient
 * Body should contain FHIR Patient resource fields to update
 */
router.put('/patients/:id', async (req, res) => {
  try {
    // Basic validation
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        status: 'error',
        error: 'Invalid request body',
        message: 'Request body must be a valid JSON object'
      });
    }

    const patient = await updatePatient(req.params.id, req.body);
    
    if (!patient) {
      return res.status(404).json({
        status: 'error',
        error: 'Failed to update patient',
        message: 'Patient not found or update failed',
        patientId: req.params.id
      });
    }
    
    res.json({
      status: 'updated',
      patient
    });
  } catch (error) {
    logger.error({ msg: 'Failed to update patient', patientId: req.params.id, err: error.message });
    res.status(500).json({
      status: 'error',
      error: 'Failed to update patient',
      message: error.message
    });
  }
});

export default router;
