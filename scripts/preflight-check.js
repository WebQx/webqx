#!/usr/bin/env node
/**
 * WebQX EMR – Production Preflight Validator
 *
 * Purpose: Fail-fast validation of required production environment configuration
 * before deploying the WebQX EMR platform. Designed to run locally or in CI.
 *
 * Usage:
 *   node scripts/preflight-check.js [--env-file .env.production] [--online]
 *
 * - Reads env from process.env and optionally an env file (dotenv).
 * - Validates presence, formats, and security posture of critical settings.
 * - Optional --online flag performs lightweight network checks (JWKS reachability).
 */

/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

// Parse CLI args
const args = process.argv.slice(2);
const envFileArgIndex = args.findIndex(a => a === '--env-file');
const envFile = envFileArgIndex !== -1 ? args[envFileArgIndex + 1] : (process.env.DOTENV_PATH || '.env.production');
const onlineChecks = args.includes('--online');

// Load dotenv if an env file exists
try {
  const resolved = path.resolve(envFile);
  if (fs.existsSync(resolved)) {
    require('dotenv').config({ path: resolved });
    logInfo(`Loaded env from ${resolved}`);
  } else {
    logWarn(`Env file not found at ${resolved}; proceeding with process.env only.`);
  }
} catch (e) {
  // continue without dotenv
}

// ANSI helpers
const C = {
  reset: '\u001b[0m',
  red: '\u001b[31m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  blue: '\u001b[34m',
  bold: '\u001b[1m',
};
function logInfo(msg) { console.log(`${C.blue}[INFO]${C.reset} ${msg}`); }
function logWarn(msg) { console.warn(`${C.yellow}[WARN]${C.reset} ${msg}`); }
function logError(msg) { console.error(`${C.red}[ERROR]${C.reset} ${msg}`); }
function logSuccess(msg) { console.log(`${C.green}[OK]${C.reset} ${msg}`); }

// Simple validators
const isTrue = v => v === true || v === 'true';
const isInteger = v => /^-?\d+$/.test(String(v || ''));
const isPositiveInt = v => isInteger(v) && Number(v) > 0;
const isHex = v => /^[0-9a-fA-F]+$/.test(String(v || ''));
const isURL = v => {
  try { new URL(String(v)); return true; } catch { return false; }
};

// Record findings
const findings = [];
function check(name, ok, advice) {
  findings.push({ name, ok, advice });
  if (ok) logSuccess(name); else logError(`${name}${advice ? ` – ${advice}` : ''}`);
}

// Contract: Minimal required vars drawn from docs/railway-production-config.md
console.log(`${C.bold}WebQX EMR – Production Preflight${C.reset}`);
console.log('Validating critical configuration...');

// 1) Runtime
check('NODE_ENV=production', process.env.NODE_ENV === 'production', 'Set NODE_ENV=production');
check('PORT set', isPositiveInt(process.env.PORT || 3000), 'PORT must be a positive integer');

// 2) CORS & Security
const origins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
check('ALLOWED_ORIGINS set', origins.length > 0, 'Set ALLOWED_ORIGINS to production domains');
if (origins.length > 0) {
  const bad = origins.filter(o => !/^https:\/\//.test(o));
  check('ALLOWED_ORIGINS use HTTPS', bad.length === 0, `Origins must be https:// only. Offenders: ${bad.join(' ')}`);
}
check('API_RATE_LIMIT_MAX sane', isPositiveInt(process.env.API_RATE_LIMIT_MAX || '1000'), 'Provide positive API_RATE_LIMIT_MAX');
check('API_RATE_LIMIT_WINDOW_MS sane', isPositiveInt(process.env.API_RATE_LIMIT_WINDOW_MS || '900000'), 'Provide positive API_RATE_LIMIT_WINDOW_MS');

// 3) Health checks
check('HEALTH_CHECK_ENABLED', isTrue(process.env.HEALTH_CHECK_ENABLED || 'true'), 'Set HEALTH_CHECK_ENABLED=true');
check('HEALTH_CHECK_TIMEOUT <= 10000', isPositiveInt(process.env.HEALTH_CHECK_TIMEOUT || '5000') && Number(process.env.HEALTH_CHECK_TIMEOUT || '5000') <= 10000, 'HEALTH_CHECK_TIMEOUT must be <= 10000 ms');

// 4) OAuth2
check('OAUTH2_ISSUER URL', isURL(process.env.OAUTH2_ISSUER), 'Configure OAUTH2_ISSUER');
check('OAUTH2_CLIENT_ID set', !!process.env.OAUTH2_CLIENT_ID, 'Set OAUTH2_CLIENT_ID');
check('OAUTH2_CLIENT_SECRET set', !!process.env.OAUTH2_CLIENT_SECRET, 'Set OAUTH2_CLIENT_SECRET');
check('OAUTH2_JWKS_URI URL', isURL(process.env.OAUTH2_JWKS_URI), 'Configure OAUTH2_JWKS_URI');
if (onlineChecks && isURL(process.env.OAUTH2_JWKS_URI)) {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), 4000);
  findings.push({ name: 'JWKS reachability (online)', ok: false, advice: 'pending' });
  // Lazy import to avoid requiring fetch polyfills in older Node versions
  const httpsGet = () => new Promise(resolve => {
    try {
      const url = new URL(process.env.OAUTH2_JWKS_URI);
      const https = require('https');
      const req = https.request({ method: 'GET', hostname: url.hostname, path: url.pathname + (url.search || ''), port: url.port || 443, timeout: 3500 }, res => {
        resolve(res.statusCode && res.statusCode < 500);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.end();
    } catch {
      resolve(false);
    }
  });
  // Fire and record later (we'll await at the end)
  global.__jwksPromise = httpsGet().then(ok => {
    const idx = findings.findIndex(f => f.name === 'JWKS reachability (online)');
    if (idx !== -1) findings[idx] = { name: 'JWKS reachability (online)', ok, advice: ok ? undefined : 'Cannot reach JWKS URL' };
    if (!ok) logError('JWKS reachability (online) – Cannot reach JWKS URL'); else logSuccess('JWKS reachability (online)');
  });
}

// 5) OpenEMR & FHIR
if (isTrue(process.env.USE_REMOTE_OPENEMR || 'true')) {
  check('OPENEMR_REMOTE_URL https', isURL(process.env.OPENEMR_REMOTE_URL) && /^https:\/\//.test(process.env.OPENEMR_REMOTE_URL), 'Set https OPENEMR_REMOTE_URL');
  check('OPENEMR_CLIENT_ID set', !!process.env.OPENEMR_CLIENT_ID, 'Set OPENEMR_CLIENT_ID');
  check('OPENEMR_CLIENT_SECRET set', !!process.env.OPENEMR_CLIENT_SECRET, 'Set OPENEMR_CLIENT_SECRET');
}
check('FHIR_BASE_URL https', isURL(process.env.FHIR_BASE_URL) && /^https:\/\//.test(process.env.FHIR_BASE_URL), 'Set https FHIR_BASE_URL');
check('PUBLIC_FHIR_BASE https', isURL(process.env.PUBLIC_FHIR_BASE) && /^https:\/\//.test(process.env.PUBLIC_FHIR_BASE), 'Set https PUBLIC_FHIR_BASE');

// 6) HIPAA configuration
const key = process.env.HIPAA_ENCRYPTION_KEY || '';
check('HIPAA_ENCRYPTION_KEY length=64', key.length === 64, 'Provide a 64-character hex key');
check('HIPAA_ENCRYPTION_KEY hex', isHex(key), 'Key must be hex');
check('HIPAA_AUDIT_ENABLED=true', isTrue(process.env.HIPAA_AUDIT_ENABLED || 'true'), 'Set HIPAA_AUDIT_ENABLED=true');
check('HIPAA_COMPLIANT_MODE=true', isTrue(process.env.HIPAA_COMPLIANT_MODE || 'true'), 'Set HIPAA_COMPLIANT_MODE=true');
check('HIPAA_RETENTION_DAYS>=2555', isPositiveInt(process.env.HIPAA_RETENTION_DAYS || '2555') && Number(process.env.HIPAA_RETENTION_DAYS || '2555') >= 2555, 'Set HIPAA_RETENTION_DAYS to >= 2555');
check('AUDIT_LOG_PATH set', !!process.env.AUDIT_LOG_PATH, 'Set AUDIT_LOG_PATH');

// 7) RabbitMQ
const rmq = process.env.RABBITMQ_URL || '';
check('RABBITMQ_URL amqps://', /^amqps:\/\//.test(rmq) && isURL(rmq.replace('amqps', 'https')), 'Use AMQPS with credentials and vhost');
check('RABBITMQ_HEARTBEAT set', isPositiveInt(process.env.RABBITMQ_HEARTBEAT || '60'), 'Set RABBITMQ_HEARTBEAT');
check('RABBITMQ_CONNECTION_TIMEOUT set', isPositiveInt(process.env.RABBITMQ_CONNECTION_TIMEOUT || '10000'), 'Set RABBITMQ_CONNECTION_TIMEOUT');

// 8) OpenAI / Whisper (optional but if set, validate)
if (process.env.CHATEHR_API_KEY) {
  check('CHATEHR_API_URL url', isURL(process.env.CHATEHR_API_URL || ''), 'Set CHATEHR_API_URL');
}
if (process.env.WHISPER_API_KEY) {
  check('TRANSCRIPTION_BASE_URL url', isURL(process.env.TRANSCRIPTION_BASE_URL || ''), 'Set TRANSCRIPTION_BASE_URL');
}

// 9) Database (Django Ops) and Redis
if (process.env.DATABASE_URL) {
  check('DATABASE_URL url', isURL(process.env.DATABASE_URL), 'Set DATABASE_URL');
  const sslMode = (process.env.DATABASE_SSL_MODE || '').toLowerCase();
  check('DATABASE_SSL_MODE=require', sslMode === 'require', 'Set DATABASE_SSL_MODE=require');
}
if (process.env.REDIS_URL) {
  const isRediss = /^rediss:\/\//.test(process.env.REDIS_URL);
  check('REDIS SSL (rediss:// or REDIS_SSL=true)', isRediss || isTrue(process.env.REDIS_SSL || 'false'), 'Use rediss:// or set REDIS_SSL=true');
}

// 10) DICOMweb/PACS (optional)
if (process.env.DICOMWEB_PROXY_TARGET) {
  check('DICOMWEB_PROXY_TARGET https', isURL(process.env.DICOMWEB_PROXY_TARGET) && /^https:\/\//.test(process.env.DICOMWEB_PROXY_TARGET), 'Set https DICOMWEB_PROXY_TARGET');
}

// 11) Observability
check('STRUCTURED_LOGGING true', isTrue(process.env.STRUCTURED_LOGGING || 'true'), 'Set STRUCTURED_LOGGING=true');
check('METRICS_ENABLED true', isTrue(process.env.METRICS_ENABLED || 'true'), 'Set METRICS_ENABLED=true');

// Summarize and exit appropriately
async function finalize() {
  if (global.__jwksPromise) await global.__jwksPromise;

  const failures = findings.filter(f => !f.ok);
  const passes = findings.filter(f => f.ok);
  console.log('\n' + C.bold + 'Preflight Summary' + C.reset);
  console.log(`  ${C.green}${passes.length} PASS${C.reset}, ${C.red}${failures.length} FAIL${C.reset}`);

  if (failures.length) {
    console.log('\n' + C.red + 'Blocking issues:' + C.reset);
    failures.forEach(f => console.log(`  - ${f.name}${f.advice ? `: ${f.advice}` : ''}`));
    console.log('\nTips:');
    console.log('  - Review docs/railway-production-config.md');
    console.log('  - Provide a 64-char hex HIPAA_ENCRYPTION_KEY (openssl rand -hex 32)');
    console.log('  - Ensure OAuth2 issuer/JWKS are correct and reachable');
    process.exitCode = 1;
  } else {
    console.log('\n' + C.green + 'All critical production checks passed.' + C.reset);
  }
}

finalize();
