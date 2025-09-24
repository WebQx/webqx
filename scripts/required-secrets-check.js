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