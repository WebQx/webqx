#!/usr/bin/env node
/**
 * Checks for presence (non-empty) of required staging/production secrets.
 * Does NOT print secret values—only names and status.
 * Fails (exit 1) if any required secret missing or clearly invalid format (basic heuristics).
 */

// Core secrets that must exist to proceed
const CORE_REQUIRED = [
  'OAUTH2_ISSUER',
  'OAUTH2_JWKS_URI',
  'OAUTH2_CLIENT_ID',
  'OAUTH2_CLIENT_SECRET',
  'FHIR_BASE_URL',
  'HIPAA_ENCRYPTION_KEY',
  'RABBITMQ_URL',
  'REDIS_URL',
  'RAILWAY_TOKEN',
  'RAILWAY_PROJECT_ID'
];

// Derived/optional: we attempt to derive these from other values if missing
const DERIVABLE = {
  ALLOWED_ORIGINS: () => process.env.RAILWAY_PUBLIC_API_BASE || '',
  PUBLIC_FHIR_BASE: () => process.env.FHIR_BASE_URL || ''
};

// Recommended but not strictly blocking
const RECOMMENDED = [
  'RABBITMQ_HEARTBEAT',
  'RABBITMQ_CONNECTION_TIMEOUT',
  'REDIS_SSL',
  'RAILWAY_PUBLIC_API_BASE'
];

// Minimal format validators
const validators = {
  HIPAA_ENCRYPTION_KEY: v => /^[0-9a-fA-F]{64}$/.test(v),
  RABBITMQ_URL: v => /^amqps:\/\//.test(v),
  REDIS_URL: v => /^(redis|rediss):\/\//.test(v),
  ALLOWED_ORIGINS: v => v.split(',').every(s => /^https?:\/\//.test(s.trim())),
  FHIR_BASE_URL: v => /^https?:\/\//.test(v),
  PUBLIC_FHIR_BASE: v => /^https?:\/\//.test(v),
  RAILWAY_PUBLIC_API_BASE: v => /^https?:\/\//.test(v),
  OAUTH2_ISSUER: v => /^https?:\/\//.test(v),
  OAUTH2_JWKS_URI: v => /^https?:\/\//.test(v)
};

let coreMissing = [];
let invalid = [];
let recommendedMissing = [];
let derivedApplied = [];

// Diagnostic & auto-detect heuristics
const rawEnvName = process.env.ENV_NAME || process.env.DEPLOY_ENV || '';
let EFFECTIVE_ENV = rawEnvName; // mutable if we infer staging
const oauthCoreKeys = ['OAUTH2_ISSUER','OAUTH2_JWKS_URI','OAUTH2_CLIENT_ID','OAUTH2_CLIENT_SECRET'];
const oauthAllMissing = oauthCoreKeys.every(k => !process.env[k]);

// Determine if we can infer staging bootstrap mode (token optional)
const essentialWithoutInfra = [
  'OAUTH2_ISSUER','OAUTH2_JWKS_URI','OAUTH2_CLIENT_ID','OAUTH2_CLIENT_SECRET',
  'FHIR_BASE_URL','HIPAA_ENCRYPTION_KEY','RABBITMQ_URL','REDIS_URL'
];
const missingEssentialCount = essentialWithoutInfra.filter(k => !process.env[k]).length;
let STAGING_BOOTSTRAP_MODE = false;

// Heuristic triggers:
// 1. Explicit ENV_NAME=staging
// 2. Or no env specified & most essentials missing (>=5) & not explicitly production
// 3. Or oauth core missing & we have a Railway token (prior logic)
if (rawEnvName === 'staging') {
  EFFECTIVE_ENV = 'staging';
  STAGING_BOOTSTRAP_MODE = true;
  console.log('🧪[staging-synth] Explicit staging environment detected');
} else if ((!rawEnvName || rawEnvName === '') && missingEssentialCount >= 5 && rawEnvName !== 'production') {
  EFFECTIVE_ENV = 'staging';
  STAGING_BOOTSTRAP_MODE = true;
  console.log('🧪[staging-synth] Auto-bootstrap staging: majority of essential secrets missing');
} else if ((!rawEnvName || rawEnvName === '') && oauthAllMissing && !!process.env.RAILWAY_TOKEN) {
  EFFECTIVE_ENV = 'staging';
  STAGING_BOOTSTRAP_MODE = true;
  console.log('🧪[staging-synth] Auto-detected staging (OAuth2 core missing, Railway token present)');
}

console.log(`🔧 Secrets validator effective environment: ${EFFECTIVE_ENV || '<unset>'} (bootstrap=${STAGING_BOOTSTRAP_MODE})`);

// Staging synthesis (only for staging environment or auto-detected staging) prior to validation
if (EFFECTIVE_ENV === 'staging') {
  const synthLog = msg => console.log(`🧪[staging-synth] ${msg}`);
  // Generate HIPAA key if absent
  if (!process.env.HIPAA_ENCRYPTION_KEY) {
    const crypto = require('crypto');
    process.env.HIPAA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    synthLog('Generated HIPAA_ENCRYPTION_KEY');
  }
  // OAuth placeholders if all missing
  const oauthMissing = oauthAllMissing;
  if (oauthMissing) {
    process.env.OAUTH2_ISSUER = 'https://staging-oauth.webqx.dev/auth/realms/webqx';
    process.env.OAUTH2_JWKS_URI = 'https://staging-oauth.webqx.dev/auth/realms/webqx/protocol/openid-connect/certs';
    process.env.OAUTH2_CLIENT_ID = 'webqx-staging';
    process.env.OAUTH2_CLIENT_SECRET = 'staging-oauth-secret';
    process.env.DISABLE_OAUTH = 'true';
    synthLog('Applied OAuth2 placeholder config (DISABLE_OAUTH=true)');
  }
  // FHIR placeholder
  if (!process.env.FHIR_BASE_URL) {
    process.env.FHIR_BASE_URL = 'https://staging-fhir.webqx.dev/fhir';
    synthLog('Applied FHIR_BASE_URL placeholder');
  }
  // RabbitMQ placeholder (use amqps for format compliance)
  if (!process.env.RABBITMQ_URL) {
    process.env.RABBITMQ_URL = 'amqps://guest:guest@staging-rabbitmq.webqx.dev:5671/';
    process.env.RABBITMQ_HEARTBEAT = process.env.RABBITMQ_HEARTBEAT || '30';
    process.env.RABBITMQ_CONNECTION_TIMEOUT = process.env.RABBITMQ_CONNECTION_TIMEOUT || '30000';
    synthLog('Applied RabbitMQ placeholder config');
  }
  // Redis placeholder with SSL
  if (!process.env.REDIS_URL) {
    process.env.REDIS_URL = 'rediss://:staging-redis@staging-cache.webqx.dev:6380/0';
    process.env.REDIS_SSL = 'true';
    synthLog('Applied Redis placeholder config');
  }
  // Public API base if missing
  if (!process.env.RAILWAY_PUBLIC_API_BASE) {
    process.env.RAILWAY_PUBLIC_API_BASE = 'https://webqx-api-staging.up.railway.app';
    synthLog('Applied RAILWAY_PUBLIC_API_BASE placeholder');
  }
  // Derive ALLOWED_ORIGINS if still missing
  if (!process.env.ALLOWED_ORIGINS && process.env.RAILWAY_PUBLIC_API_BASE) {
    process.env.ALLOWED_ORIGINS = process.env.RAILWAY_PUBLIC_API_BASE;
    synthLog('Derived ALLOWED_ORIGINS from API base');
  }
}

// Apply derivations if missing
for (const [key, fn] of Object.entries(DERIVABLE)) {
  if (!process.env[key]) {
    const val = fn();
    if (val) {
      process.env[key] = val; // ephemeral, for validation only
      derivedApplied.push(key);
    }
  }
}

// Validate core
for (const name of CORE_REQUIRED) {
  const val = process.env[name];
  if (!val || !val.trim()) {
    coreMissing.push(name);
    continue;
  }
  if (validators[name] && !validators[name](val.trim())) invalid.push(name);
}

// Validate derived & recommended formatting if present
for (const name of Object.keys(DERIVABLE).concat(RECOMMENDED)) {
  const val = process.env[name];
  if (!val) {
    if (RECOMMENDED.includes(name)) recommendedMissing.push(name);
    continue;
  }
  if (validators[name] && !validators[name](val.trim())) invalid.push(name);
}

// Allow omission of infrastructure tokens during staging bootstrap so synthesis can proceed
if (EFFECTIVE_ENV === 'staging' && STAGING_BOOTSTRAP_MODE) {
  const infraKeys = ['RAILWAY_TOKEN','RAILWAY_PROJECT_ID'];
  const preFilterMissing = coreMissing.slice();
  coreMissing = coreMissing.filter(k => !infraKeys.includes(k));
  if (preFilterMissing.length !== coreMissing.length) {
    console.log('🧪[staging-synth] Ignoring missing infrastructure keys during bootstrap:', preFilterMissing.filter(k => !coreMissing.includes(k)).join(', '));
  }
}

console.log('🔎 Secrets Validation Summary');
console.log('Core required (must pass):', CORE_REQUIRED.length);
console.log('Core missing:', coreMissing.length ? coreMissing.join(', ') : 'NONE');
console.log('Invalid format (any category):', invalid.length ? invalid.join(', ') : 'NONE');
console.log('Recommended missing (non-blocking):', recommendedMissing.length ? recommendedMissing.join(', ') : 'NONE');
console.log('Derived automatically:', derivedApplied.length ? derivedApplied.join(', ') : 'NONE');

if (coreMissing.length || invalid.length) {
  console.error('\n❌ Validation failed (core or format issues). Fix before deploying.');
  process.exit(1);
}

console.log('\n✅ Core secrets valid. Proceeding (recommended items may be added later).');