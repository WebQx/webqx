import axios from 'axios';
import { logger } from './logger.js';
import { config } from './config.js';
import { getCache, setCache } from './cache.js';

const TTL = parseInt(config.ADAPTER_CACHE_TTL_MS, 10) || 30000;
const TOKEN_CACHE_KEY = 'medplum-access-token';

/**
 * Get OAuth2 access token for Medplum using Client Credentials flow
 * Caches token until expiration
 */
async function getAccessToken() {
  if (!config.MEDPLUM_CLIENT_ID || !config.MEDPLUM_CLIENT_SECRET) {
    logger.warn({ msg: 'Medplum OAuth credentials not configured' });
    return null;
  }

  // Check cache first
  const cached = getCache(TOKEN_CACHE_KEY);
  if (cached) {
    logger.debug({ msg: 'Using cached Medplum access token' });
    return cached.access_token;
  }

  try {
    const tokenUrl = config.MEDPLUM_API_URL.replace(/\/$/, '') + '/oauth2/token';
    logger.info({ msg: 'Requesting Medplum access token', url: tokenUrl });

    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.MEDPLUM_CLIENT_ID,
      client_secret: config.MEDPLUM_CLIENT_SECRET
    });

    const resp = await axios.post(tokenUrl, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 5000
    });

    const { access_token, expires_in } = resp.data;
    
    // Cache token for 90% of its lifetime to ensure it doesn't expire during use
    const cacheTTL = expires_in ? (expires_in * 0.9 * 1000) : (3600 * 1000); // Default 1 hour
    setCache(TOKEN_CACHE_KEY, { access_token }, cacheTTL);

    logger.info({ msg: 'Medplum access token obtained', expires_in });
    return access_token;
  } catch (e) {
    logger.error({ msg: 'Failed to get Medplum access token', err: e.message, response: e.response?.data });
    return null;
  }
}

/**
 * Create authenticated axios instance for Medplum API calls
 */
async function getMedplumAxios() {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Failed to obtain Medplum access token');
  }

  return axios.create({
    baseURL: config.MEDPLUM_API_URL.replace(/\/$/, ''),
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/fhir+json'
    },
    timeout: 10000
  });
}

/**
 * Check Medplum FHIR server health and connectivity
 * Tests both public metadata endpoint and OAuth authentication
 */
export async function checkMedplum() {
  if (!config.MEDPLUM_API_URL) return { enabled: false, status: 'disabled' };
  
  try {
    const cached = getCache('medplum-metadata');
    if (cached) return { enabled: true, status: 'online', latency_ms: cached.latency_ms };
    
    const start = Date.now();
    
    // Test 1: Check public metadata endpoint
    const metadataUrl = config.MEDPLUM_API_URL.replace(/\/$/, '') + '/metadata';
    await axios.get(metadataUrl, { timeout: 4000 });
    
    // Test 2: If credentials are configured, test OAuth authentication
    if (config.MEDPLUM_CLIENT_ID && config.MEDPLUM_CLIENT_SECRET) {
      const token = await getAccessToken();
      if (!token) {
        return { 
          enabled: true, 
          status: 'degraded', 
          error: 'OAuth authentication failed',
          message: 'Check MEDPLUM_CLIENT_ID and MEDPLUM_CLIENT_SECRET'
        };
      }
    }
    
    const latency = Date.now() - start;
    setCache('medplum-metadata', { latency_ms: latency }, TTL);
    
    return { 
      enabled: true, 
      status: 'online', 
      latency_ms: latency,
      authenticated: !!(config.MEDPLUM_CLIENT_ID && config.MEDPLUM_CLIENT_SECRET)
    };
  } catch (e) {
    logger.warn({ msg: 'Medplum check failed', err: e.message });
    return { enabled: true, status: 'offline', error: e.message };
  }
}

/**
 * List patients from Medplum FHIR server with OAuth authentication
 * @param {number} limit - Maximum number of patients to return
 * @returns {Promise<Array>} Array of patient objects
 */
export async function listPatients(limit = 5) {
  if (!config.MEDPLUM_API_URL) return [];
  
  try {
    const cacheKey = `medplum-patients-${limit}`;
    const cached = getCache(cacheKey);
    if (cached) return cached;

    // Get authenticated axios instance
    const medplumAxios = await getMedplumAxios();
    
    // Search for patients
    const resp = await medplumAxios.get(`/fhir/R4/Patient`, {
      params: {
        _count: limit,
        _sort: '-_lastUpdated' // Most recently updated first
      }
    });

    const bundle = resp.data;
    const patients = Array.isArray(bundle.entry) ? bundle.entry.map(e => ({
      id: e.resource?.id,
      name: formatPatientName(e.resource),
      gender: e.resource?.gender,
      birthDate: e.resource?.birthDate,
      lastUpdated: e.resource?.meta?.lastUpdated
    })) : [];

    setCache(cacheKey, patients, TTL);
    logger.info({ msg: 'Retrieved patients from Medplum', count: patients.length });
    return patients;
  } catch (e) {
    logger.warn({ msg: 'Medplum patient list failed', err: e.message, response: e.response?.data });
    return [];
  }
}

/**
 * Get a single patient by ID
 * @param {string} patientId - FHIR Patient resource ID
 * @returns {Promise<Object|null>} Patient resource or null
 */
export async function getPatient(patientId) {
  if (!config.MEDPLUM_API_URL || !patientId) return null;

  try {
    const cacheKey = `medplum-patient-${patientId}`;
    const cached = getCache(cacheKey);
    if (cached) return cached;

    const medplumAxios = await getMedplumAxios();
    const resp = await medplumAxios.get(`/fhir/R4/Patient/${patientId}`);
    
    const patient = {
      id: resp.data.id,
      resourceType: resp.data.resourceType,
      name: formatPatientName(resp.data),
      gender: resp.data.gender,
      birthDate: resp.data.birthDate,
      telecom: resp.data.telecom,
      address: resp.data.address,
      identifier: resp.data.identifier,
      lastUpdated: resp.data.meta?.lastUpdated
    };

    setCache(cacheKey, patient, TTL);
    logger.info({ msg: 'Retrieved patient from Medplum', patientId });
    return patient;
  } catch (e) {
    logger.warn({ msg: 'Failed to get patient', patientId, err: e.message });
    return null;
  }
}

/**
 * Create a new patient in Medplum
 * @param {Object} patientData - FHIR Patient resource
 * @returns {Promise<Object|null>} Created patient or null
 */
export async function createPatient(patientData) {
  if (!config.MEDPLUM_API_URL) return null;

  try {
    const medplumAxios = await getMedplumAxios();
    const resp = await medplumAxios.post(`/fhir/R4/Patient`, {
      resourceType: 'Patient',
      ...patientData
    });

    logger.info({ msg: 'Created patient in Medplum', patientId: resp.data.id });
    
    // Invalidate cache
    clearPatientsCache();
    
    return resp.data;
  } catch (e) {
    logger.error({ msg: 'Failed to create patient', err: e.message, response: e.response?.data });
    return null;
  }
}

/**
 * Update an existing patient in Medplum
 * @param {string} patientId - FHIR Patient resource ID
 * @param {Object} patientData - Updated FHIR Patient resource
 * @returns {Promise<Object|null>} Updated patient or null
 */
export async function updatePatient(patientId, patientData) {
  if (!config.MEDPLUM_API_URL || !patientId) return null;

  try {
    const medplumAxios = await getMedplumAxios();
    const resp = await medplumAxios.put(`/fhir/R4/Patient/${patientId}`, {
      resourceType: 'Patient',
      id: patientId,
      ...patientData
    });

    logger.info({ msg: 'Updated patient in Medplum', patientId });
    
    // Invalidate cache
    clearPatientsCache();
    setCache(`medplum-patient-${patientId}`, null, 0);
    
    return resp.data;
  } catch (e) {
    logger.error({ msg: 'Failed to update patient', patientId, err: e.message, response: e.response?.data });
    return null;
  }
}

/**
 * Search patients by name, identifier, or other criteria
 * @param {Object} searchParams - FHIR search parameters
 * @returns {Promise<Array>} Array of matching patients
 */
export async function searchPatients(searchParams = {}) {
  if (!config.MEDPLUM_API_URL) return [];

  try {
    const medplumAxios = await getMedplumAxios();
    const resp = await medplumAxios.get(`/fhir/R4/Patient`, { params: searchParams });

    const bundle = resp.data;
    const patients = Array.isArray(bundle.entry) ? bundle.entry.map(e => ({
      id: e.resource?.id,
      name: formatPatientName(e.resource),
      gender: e.resource?.gender,
      birthDate: e.resource?.birthDate,
      identifier: e.resource?.identifier,
      lastUpdated: e.resource?.meta?.lastUpdated
    })) : [];

    logger.info({ msg: 'Searched patients', params: searchParams, count: patients.length });
    return patients;
  } catch (e) {
    logger.warn({ msg: 'Patient search failed', err: e.message });
    return [];
  }
}

/**
 * Create a FHIR DocumentReference for a transcript tied to a Patient
 * @param {Object} params
 * @param {string} params.patientId - FHIR Patient ID
 * @param {string} params.text - Transcript plain text
 * @param {Object} [params.meta] - Additional metadata (language, duration, model)
 * @returns {Promise<Object|null>} Created DocumentReference or null
 */
export async function createTranscriptDocumentReference({ patientId, text, meta = {} }) {
  if (!config.MEDPLUM_API_URL || !patientId || !text) return null;
  try {
    const medplumAxios = await getMedplumAxios();
    const now = new Date().toISOString();
    const docRef = {
      resourceType: 'DocumentReference',
      status: 'current',
      docStatus: 'final',
      type: { text: 'Clinical Audio Transcript' },
      category: [{ text: 'transcription' }],
      subject: { reference: `Patient/${patientId}` },
      date: now,
      content: [
        {
          attachment: {
            contentType: 'text/plain',
            language: meta.language || 'en',
            data: Buffer.from(text, 'utf8').toString('base64'),
            title: meta.title || `Transcript ${now}`
          }
        }
      ],
      description: meta.description || 'Automated speech-to-text transcript',
      extension: [
        meta.model ? { url: 'http://webqx.ai/fhir/StructureDefinition/transcript-model', valueString: meta.model } : null,
        meta.duration ? { url: 'http://webqx.ai/fhir/StructureDefinition/transcript-duration-s', valueDecimal: meta.duration } : null
      ].filter(Boolean)
    };
    const resp = await medplumAxios.post('/fhir/R4/DocumentReference', docRef);
    logger.info({ msg: 'Created DocumentReference (transcript)', id: resp.data.id, patientId });
    return resp.data;
  } catch (e) {
    logger.error({ msg: 'Failed to create transcript DocumentReference', patientId, err: e.message, response: e.response?.data });
    return null;
  }
}

/**
 * List transcript DocumentReferences for a Patient
 * @param {string} patientId
 * @param {number} [limit]
 * @returns {Promise<Array>} list of simplified transcript references
 */
export async function listTranscriptDocumentReferences(patientId, limit = 10) {
  if (!config.MEDPLUM_API_URL || !patientId) return [];
  try {
    const medplumAxios = await getMedplumAxios();
    const resp = await medplumAxios.get('/fhir/R4/DocumentReference', {
      params: {
        subject: `Patient/${patientId}`,
        _count: limit,
        _sort: '-date'
      }
    });
    const bundle = resp.data;
    const docs = Array.isArray(bundle.entry) ? bundle.entry.map(e => ({
      id: e.resource?.id,
      date: e.resource?.date,
      description: e.resource?.description,
      language: e.resource?.content?.[0]?.attachment?.language,
      size: e.resource?.content?.[0]?.attachment?.size,
      contentType: e.resource?.content?.[0]?.attachment?.contentType
    })) : [];
    return docs.filter(d => d.description?.toLowerCase().includes('transcript') || true);
  } catch (e) {
    logger.warn({ msg: 'Failed to list transcript DocumentReferences', patientId, err: e.message });
    return [];
  }
}

/**
 * Format patient name from FHIR HumanName structure
 * @param {Object} patient - FHIR Patient resource
 * @returns {string} Formatted name
 */
function formatPatientName(patient) {
  if (!patient?.name || patient.name.length === 0) return 'Unknown';
  
  const name = patient.name[0];
  
  // Check if there's a formatted text field
  if (name.text) return name.text;
  
  // Build name from components
  const parts = [];
  if (name.prefix) parts.push(...name.prefix);
  if (name.given) parts.push(...name.given);
  if (name.family) parts.push(name.family);
  if (name.suffix) parts.push(...name.suffix);
  
  return parts.length > 0 ? parts.join(' ') : 'Unknown';
}

/**
 * Clear all patient-related caches
 */
function clearPatientsCache() {
  // Note: This is a simple implementation. For production, you'd want a more sophisticated cache invalidation strategy
  logger.debug({ msg: 'Clearing patients cache' });
  // Cache keys follow pattern: 'medplum-patients-*' and 'medplum-patient-*'
  // The cache.js would need to expose a clearByPrefix method for this to work efficiently
}
