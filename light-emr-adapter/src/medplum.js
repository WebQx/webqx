import axios from 'axios';
import { logger } from './logger.js';
import { config } from './config.js';
import { getCache, setCache } from './cache.js';

const TTL = parseInt(config.ADAPTER_CACHE_TTL_MS, 10) || 30000;

export async function checkMedplum() {
  if (!config.MEDPLUM_API_URL) return { enabled: false, status: 'disabled' };
  try {
    const cached = getCache('medplum-metadata');
    if (cached) return { enabled: true, status: 'online', latency_ms: cached.latency_ms };
    const start = Date.now();
    const url = config.MEDPLUM_API_URL.replace(/\/$/, '') + '/metadata';
    const resp = await axios.get(url, { timeout: 4000 });
    const latency = Date.now() - start;
    setCache('medplum-metadata', { latency_ms: latency }, TTL);
    return { enabled: true, status: resp.status === 200 ? 'online' : 'degraded', latency_ms: latency };
  } catch (e) {
    logger.warn({ msg: 'Medplum check failed', err: e.message });
    return { enabled: true, status: 'offline', error: e.message };
  }
}

export async function listPatients(limit = 5) {
  if (!config.MEDPLUM_API_URL) return [];
  try {
    const cacheKey = 'medplum-patients';
    const cached = getCache(cacheKey);
    if (cached) return cached;
    // Public FHIR metadata might not allow listing without auth; placeholder safe try
    const url = config.MEDPLUM_API_URL.replace(/\/$/, '') + '/Patient?_count=' + limit;
    const resp = await axios.get(url, { timeout: 4000 });
    const bundle = resp.data;
    const patients = Array.isArray(bundle.entry) ? bundle.entry.map(e => ({
      id: e.resource?.id,
      name: (e.resource?.name?.[0]?.text) || (e.resource?.name?.[0]?.given?.[0] + ' ' + (e.resource?.name?.[0]?.family || '')) || 'Unknown'
    })) : [];
    setCache(cacheKey, patients, TTL);
    return patients;
  } catch (e) {
    logger.warn({ msg: 'Medplum patient list failed', err: e.message });
    return [];
  }
}
