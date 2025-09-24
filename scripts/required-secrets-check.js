#!/usr/bin/env node
/**
 * Checks for presence (non-empty) of required staging/production secrets.
 * Does NOT print secret values—only names and status.
 * Fails (exit 1) if any required secret missing or clearly invalid format (basic heuristics).
 */

const REQUIRED = [
  'ALLOWED_ORIGINS',
  'OAUTH2_ISSUER',
  'OAUTH2_JWKS_URI',
  'OAUTH2_CLIENT_ID',
  'OAUTH2_CLIENT_SECRET',
  'FHIR_BASE_URL',
  'PUBLIC_FHIR_BASE',
  'HIPAA_ENCRYPTION_KEY',
  'RABBITMQ_URL',
  'RABBITMQ_HEARTBEAT',
  'RABBITMQ_CONNECTION_TIMEOUT',
  'REDIS_URL',
  // Optional but recommended
  'REDIS_SSL',
  'RAILWAY_TOKEN',
  'RAILWAY_PROJECT_ID',
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

let missing = [];
let invalid = [];

for (const name of REQUIRED) {
  const val = process.env[name];
  if (!val || !val.trim()) {
    missing.push(name);
    continue;
  }
  if (validators[name] && !validators[name](val.trim())) {
    invalid.push(name);
  }
}

console.log('🔎 Required Secrets Validation');
console.log('Total required:', REQUIRED.length);
console.log('Missing:', missing.length ? missing.join(', ') : 'NONE');
console.log('Invalid format:', invalid.length ? invalid.join(', ') : 'NONE');

if (missing.length || invalid.length) {
  console.error('\n❌ Validation failed. Add/Correct the above secrets before deploying staging.');
  process.exit(1);
}

console.log('\n✅ All required secrets present and minimally valid.');