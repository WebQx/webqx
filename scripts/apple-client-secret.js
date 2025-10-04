#!/usr/bin/env node
/*
 * Utility to generate the Apple Sign in client secret (JWT) used for WebQX provider SSO.
 * Values can be supplied via CLI flags or environment variables.
 *
 * Required values (flag or env fallback):
 *   --team-id          (APPLE_TEAM_ID)
 *   --client-id        (APPLE_CLIENT_ID)
 *   --key-id           (APPLE_KEY_ID)
 *   --private-key      (APPLE_PRIVATE_KEY)  // string or use --key-file
 *   --key-file         path to .p8 private key (optional alternative)
 *
 * Optional flags:
 *   --ttl-days <n>     Validity window (default 180, max 180)
 *   --raw              Output JWT only (useful for scripting)
 */

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (!current.startsWith('--')) continue;
    const key = current.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function normaliseKey(value) {
  if (!value) return '';
  const trimmed = String(value).trim();
  return trimmed.replace(/\\n/g, '\n');
}

function readKeyFromFile(filePath) {
  try {
    const resolved = path.resolve(filePath);
    return fs.readFileSync(resolved, 'utf8');
  } catch (err) {
    throw new Error(`Unable to read key file at ${filePath}: ${err.message}`);
  }
}

function printUsage(message) {
  if (message) console.error(`Error: ${message}`);
  console.error(`\nUsage: node scripts/apple-client-secret.js [--team-id <id>] [--client-id <id>] [--key-id <id>] [--private-key <pem>|--key-file <path>] [--ttl-days <180>] [--raw]\n`);
  console.error('Environment fallbacks: APPLE_TEAM_ID, APPLE_CLIENT_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY');
  process.exit(1);
}

(function main() {
  const args = parseArgs(process.argv.slice(2));

  const teamId = args['team-id'] || process.env.APPLE_TEAM_ID;
  const clientId = args['client-id'] || process.env.APPLE_CLIENT_ID;
  const keyId = args['key-id'] || process.env.APPLE_KEY_ID;
  const ttlDaysRaw = args['ttl-days'] || process.env.APPLE_TTL_DAYS;

  let privateKey = args['private-key'] || process.env.APPLE_PRIVATE_KEY;
  if (!privateKey && args['key-file']) {
    privateKey = readKeyFromFile(args['key-file']);
  }

  privateKey = normaliseKey(privateKey);

  if (!teamId) printUsage('Missing Apple Team ID');
  if (!clientId) printUsage('Missing Apple client (services) ID');
  if (!keyId) printUsage('Missing Apple key ID');
  if (!privateKey) printUsage('Missing Apple private key (use --private-key or --key-file)');

  const ttlDays = Math.min(180, Math.max(1, parseInt(ttlDaysRaw || '180', 10)));
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttlDays * 24 * 60 * 60;

  const payload = {
    iss: teamId,
    iat: now,
    exp,
    aud: 'https://appleid.apple.com',
    sub: clientId,
  };

  const header = {
    alg: 'ES256',
    kid: keyId,
  };

  let token;
  try {
    token = jwt.sign(payload, privateKey, {
      algorithm: 'ES256',
      header,
    });
  } catch (err) {
    console.error('Failed to generate Apple client secret:', err.message);
    process.exit(1);
  }

  if (args.raw) {
    process.stdout.write(token);
  } else {
    console.log('Apple client secret generated successfully.');
    console.log(`Team ID:    ${teamId}`);
    console.log(`Client ID:  ${clientId}`);
    console.log(`Key ID:     ${keyId}`);
    console.log(`Expires:    ${new Date(exp * 1000).toISOString()} (in ${ttlDays} day(s))`);
    console.log('\nJWT:\n');
    console.log(token);
  }
})();
