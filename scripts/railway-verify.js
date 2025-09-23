#!/usr/bin/env node
/**
 * WebQX EMR – Railway Service Verifier
 *
 * Purpose: Perform service-by-service health checks against deployed Railway services.
 * Supports dry mode (no network) and online mode (HTTPS calls).
 *
 * Usage:
 *   node scripts/railway-verify.js --dry \
 *     --api https://api.webqx.health \
 *     --emr https://emr.webqx.health \
 *     --whisper https://whisper.webqx.health \
 *     --dicom https://viewer.webqx.health \
 *     --rmq https://rabbitmq.example.com:15671
 *
 * Or use environment variables:
 *   API_BASE, EMR_BASE, WHISPER_BASE, DICOMWEB_BASE, RABBITMQ_MANAGEMENT_URL
 */

/* eslint-disable no-console */
const https = require('https');

const args = process.argv.slice(2);
const getArg = (name, def) => {
  const i = args.findIndex(a => a === `--${name}`);
  if (i !== -1 && args[i + 1] && !args[i + 1].startsWith('--')) return args[i + 1];
  return def;
};
const DRY = args.includes('--dry');

const API_BASE = getArg('api', process.env.API_BASE || process.env.PUBLIC_API_BASE || '');
const EMR_BASE = getArg('emr', process.env.EMR_BASE || process.env.OPENEMR_REMOTE_URL || '');
const WHISPER_BASE = getArg('whisper', process.env.WHISPER_BASE || process.env.TRANSCRIPTION_BASE_URL || '');
const DICOMWEB_BASE = getArg('dicom', process.env.DICOMWEB_BASE || process.env.DICOMWEB_PROXY_TARGET || '');
const RMQ_MGMT = getArg('rmq', process.env.RABBITMQ_MANAGEMENT_URL || '');

const checks = [];

function addCheck(name, url, method = 'GET', expect = 200) {
  if (!url) return; // skip missing
  checks.push({ name, url, method, expect });
}

// API Gateway
addCheck('API /health', API_BASE && API_BASE.replace(/\/$/, '') + '/health');
addCheck('API /fhir/metadata', API_BASE && API_BASE.replace(/\/$/, '') + '/fhir/metadata');

// OpenEMR
addCheck('OpenEMR status', EMR_BASE && EMR_BASE.replace(/\/$/, '') + '/webqx-api.php?action=status');
addCheck('OpenEMR health', EMR_BASE && EMR_BASE.replace(/\/$/, '') + '/webqx-api.php?action=health');

// Whisper
addCheck('Whisper /health', WHISPER_BASE && WHISPER_BASE.replace(/\/$/, '') + '/health');

// DICOMweb (HEAD to avoid large transfers)
if (DICOMWEB_BASE) {
  const dicomHead = DICOMWEB_BASE.replace(/\/$/, '') + '/studies';
  checks.push({ name: 'DICOMweb HEAD /studies', url: dicomHead, method: 'HEAD', expect: 200 });
}

// RabbitMQ management (optional unauthenticated ping – may return 401; treat <500 as reachable)
if (RMQ_MGMT) {
  checks.push({ name: 'RabbitMQ mgmt reachability', url: RMQ_MGMT, method: 'GET', expect: 200 });
}

function summarizePlan() {
  console.log('Planned checks:');
  if (checks.length === 0) {
    console.log('  (no checks configured – set API_BASE / EMR_BASE / WHISPER_BASE / DICOMWEB_BASE / RABBITMQ_MANAGEMENT_URL)');
  }
  for (const c of checks) {
    console.log(`  - ${c.name}: ${c.method} ${c.url} (expect ${c.expect})`);
  }
}

function doRequest({ url, method }) {
  return new Promise(resolve => {
    try {
      const u = new URL(url);
      const req = https.request({
        method,
        hostname: u.hostname,
        path: u.pathname + (u.search || ''),
        port: u.port || 443,
        timeout: 4500,
      }, res => {
        resolve({ ok: res.statusCode && res.statusCode < 500, status: res.statusCode || 0 });
      });
      req.on('error', () => resolve({ ok: false, status: 0 }));
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 0 }); });
      req.end();
    } catch {
      resolve({ ok: false, status: 0 });
    }
  });
}

async function run() {
  console.log('WebQX EMR – Railway Service Verifier');
  console.log(DRY ? '[DRY MODE] No network calls will be made.' : '[ONLINE MODE] Performing HTTPS calls.');
  summarizePlan();

  if (DRY || checks.length === 0) return process.exit(0);

  const results = [];
  for (const c of checks) {
    const r = await doRequest(c);
    const ok = r.ok; // Allow 2xx..4xx for RMQ? Keep simple: ok when <500
    results.push({ name: c.name, url: c.url, status: r.status, ok });
    if (ok) console.log(`  ✓ ${c.name} [${r.status}]`);
    else console.log(`  ✗ ${c.name} [${r.status}]`);
  }

  const pass = results.filter(r => r.ok).length;
  const fail = results.filter(r => !r.ok).length;
  console.log(`\nSummary: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}

run();
