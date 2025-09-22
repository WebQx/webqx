# WebQX™ Healthcare Platform

[!IMPORTANT]
Read the Authoritative Roadmap first: docs/ROADMAP.md. All changes must align with RabbitMQ messaging, Whisper transcription, OpenEMR rebrand, multilingual templates, compliance (GDPR/HIPAA/ISO 27701), Django ops, and Railway deployment strategy.

> Cloud-based, FHIR-compliant, global healthcare ecosystem with OpenEMR integration

> Latest Enhancements (2025-09): Added security middleware stack, circuit breaker for remote OpenEMR/FHIR proxy, internal metrics & audit endpoints. All mock/demo endpoints removed from production build.

> Operational Hardening (2025-09-18): Port reservation & retry (prevents EADDRINUSE), dual user lookup (email + UUID) fixing inactive profile issue, deferred OpenEMR/FHIR proxy mounting (eliminates early 404/metadata race), structured platform gateway logging helper, dev diagnostics endpoint `/internal/users` (non-production), graceful retry for child service startup.

![WebQX CI & Deployment](https://github.com/${GITHUB_REPOSITORY:-webqx/webqx}/actions/workflows/deploy.yml/badge.svg)

## 🌍 Live Demo
**GitHub Pages:** https://webqx.github.io/EMR/  
**OpenEMR Instance:** https://fuzzy-goldfish-7vx645x7wgvv3rjxg-8085.app.github.dev

---

## ✨ Features

### 🏥 **OpenEMR 7.0.3 Integration**
- Fully branded WebQX EMR system
- Complete patient management
- Clinical workflows and documentation
- HIPAA compliant with audit trails

### 👤 **Patient Portal**
- Secure patient access to medical records
- Appointment scheduling and management
- Prescription tracking and refills
- Lab results and imaging access

### 👨‍⚕️ **Provider Portal**
- Complete clinical workflow management
- EHR integration with OpenEMR
- Clinical decision support tools
- Documentation and billing integration

### ⚙️ **Admin Console**
- System administration and configuration
- User management and role-based access
- Integration monitoring and maintenance
- Compliance reporting and audit logs

### 🌐 **Global Telehealth**
- 24/7 emergency consultations
- Scheduled virtual appointments
- Crisis intervention and support
- Multi-language support
- Care Navigation (D3.js/Neo4j)

### Provider Panel
- EHR Dashboard (React + GraphQL)
- Prescription Management (RxNorm + SmartRx)
- Secure Messaging (Matrix channels)
- Clinical Alerts/Decision Support (OpenCDS/Drools)
- CME Tracker (Open Badges)
- Medical Transcription (Whisper-based; production microservice)

### Admin Console
- Access Control (Keycloak/Firebase)
- Localization (i18next + Whisper)
- UI Theming (Tailwind/CSS-in-JS)
- Analytics (Grafana/Metabase)
- AI Tuning (YAML configs)
- Integration Engine (HL7/FHIR + OHIF PACS)
- Billing Logic (JSON rules)
- Compliance Modules (PostgreSQL + Vault)

### Telehealth
- Video Consultations (HIPAA-compliant)
- Real-Time Chat (encrypted)
- Remote Monitoring (IoT)
- Electronic Prescriptions
- Appointment Scheduling

---

---

## 🛡️ Service Resilience (Circuit Breaker)

Remote OpenEMR/FHIR proxy protected by a lightweight circuit breaker:
* Tracks failures within 60s window.
* Opens circuit after `OPENEMR_CIRCUIT_THRESHOLD` failures (default 5).
* While open, `/api/openemr/*` & `/fhir/*` return `503 { "error": "OPENEMR_CIRCUIT_OPEN" }`.
* Automatically probes remote health every few seconds; closes on success or cooldown expiry.

Env Vars:
```
OPENEMR_CIRCUIT_THRESHOLD=5
OPENEMR_CIRCUIT_COOLDOWN_MS=15000
```

---

## 📊 Internal Observability (Dev Only)

| Endpoint | Description |
|----------|-------------|
| `/internal/metrics` | Per-route aggregated count / avg / p95 (in-memory) |
| `/internal/audit` | Recent request audit trail (last 50 entries) |

Do NOT expose publicly without auth. Future: secure with JWT scope + IP allowlist.

---

## ⚙️ Feature Flags & Key Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `USE_REMOTE_OPENEMR` | false | Proxy to hosted OpenEMR instead of local integration layer |
| `OPENEMR_REMOTE_URL` | (empty) | Base URL for remote OpenEMR when remote mode enabled |
| `OPENEMR_CIRCUIT_THRESHOLD` | 5 | Failures per 60s before circuit opens |
| `OPENEMR_CIRCUIT_COOLDOWN_MS` | 15000 | Circuit open duration before probe re-checks |
| `TRANSCRIPTION_BASE_URL` | (empty) | Base URL of the Whisper microservice; when unset, gateway returns 503 for transcription API |

Full list: see `.env.example`.

---

## 🚀 Quick Start (Healthcare Platform Gateway)

Quick start:
```bash
export USE_REMOTE_OPENEMR=true
export OPENEMR_REMOTE_URL="https://your-remote-openemr.example"
export TRANSCRIPTION_BASE_URL="https://your-transcription-service.example"
node server.js
```

---

## 🧑‍⚕️ MUP Access Program

Free/sponsored access for clinics serving Medically Underserved Populations.

**Eligibility:**
- Rural/tribal health centers
- Refugee/humanitarian clinics
- Disability/elder care facilities
- Low-income urban clinics

📥 [Apply for Equity Access](https://webqx.healthcare/equity-access)

---

## 🧱 Architecture Overview

```plaintext
[PWA Client] → [API Gateway] → [Microservices] → [PostgreSQL / FHIR DB]
```
- Authentication: OAuth2/Keycloak
- Adapter Plugins: OpenEMR, Epic, Cerner, etc.
- API Gateway: FHIR endpoints
- Session Control: Stateless tokens, audit trails
- Frontend: React dashboard
- Multilingual: i18n-ready UI

---

## 📁 Directory Structure

```plaintext
webqx-ehr/
├── modules/                  # Specialty modules & transcription
├── sso/                     # SSO (OAuth2/SAML)
├── ehr-integrations/        # EHR integrations
├── auth/                    # Authentication & access control
├── interoperability/        # HL7 FHIR, openEHR
├── messaging/               # Matrix messaging
└── docs/                    # Legal, contribution, IP
```

---

## 🏥 Interoperability

- Seamless EHR data exchange (OpenEMR, Epic, Cerner)
- HL7/FHIR via Mirth Connect
- Multilingual support

---

## 🧬 Supported Specialties

Primary Care, Radiology, Cardiology, Pediatrics, Oncology, Psychiatry, Endocrinology, Orthopedics, Neurology, Gastroenterology, Pulmonology, Dermatology, OBGYN

---

## 🛡️ Security & Compliance

- TLS encryption
- Audit-ready backend
- NDA & IP templates
- BAA readiness (HIPAA)

**Regulatory Coverage:**
| Country          | Protocols                 |
|------------------|--------------------------|
| 🇺🇸 US            | HIPAA, HITECH            |
| 🇪🇺 EU            | GDPR, ePrivacy           |
| 🇨🇦 Canada        | PIPEDA, PHIPA            |
| 🇮🇳 India         | DISHA, NDHM              |
| 🇧🇷 Brazil        | LGPD                     |
| 🇿🇦 South Africa  | POPIA                    |
| 🇵🇰 Pakistan      | PHIM, HIPC               |
| 🇦🇪 UAE           | DHA, DoH Data Law        |
| 🇸🇦 Saudi Arabia  | NHIC, PDPL               |

---

## 🧪 Lab Results Integration

- HL7 v2 → FHIR R4 via Mirth Connect
- Real-time lab results, filtering, sorting
- Security: TLS, HIPAA, audit logging

---

## 🩺 ChatEHR Integration

- Real-time messaging, appointment sync, dashboards
- Security: AES-256-GCM, audit logging, RBAC

---

## 🚀 Deployment

- Railway (recommended): Zero-config container deployment, health monitoring
- Docker Compose: Local multi-service orchestration
- Local: Mock FHIR/openEHR servers for dev

---

## 🤝 Contribution Guide

- Fork, suggest specialty workflows
- Sign IP Addendum/NDA before PR
- Use feature branches, submit YAML logic + compliance notes

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) and [`specialties.yaml`](./admin-console/ai-tuning/specialties.yaml)

---

## 📜 License

Apache 2.0 — Contributor IP addendums for legal clarity and scalability  
See [`LICENSE.md`](./LICENSE.md), [`nda-template.md`](./legal/nda-template.md), [`ip-addendum.md`](./legal/ip-addendum.md)

---

## 🆕 2025 Landing Page Refresh

On 2025-09-14 the root landing page was redesigned for a simpler, modern experience:

- Replaced long-form marketing layout with concise hero + value props
- Added accessibility improvements (landmarks, aria labels, focus rings, reduced motion-friendly minimalism)
- Direct module launch cards (Patient / Provider / Telehealth / Admin) with existing auth + status integration
- Live snapshot + community stats placeholders fed by `webqx-remote-config.js` + `integrations/github-pages-integration-patch.js`
- Preserved old page as `index.legacy.html` for rollback and reference

No build or script changes required—new page reuses `assets/webqx-styles.css` glass / gradient utilities and layers minimal inline styles.

To revert: rename `index.legacy.html` back to `index.html` or selectively merge sections.

### 2025-09-16 Minimal Role-Based Landing Update

The marketing-style landing has now been replaced with a minimal access gateway (`index.html`) focused purely on role entry:

* Four role tiles (Patient / Provider / Admin / Telehealth)
* Inline demo credentials with copy-to-clipboard buttons
* Dynamic backend environment tag (Railway aware via `webqx-remote-config.js`)
* No emojis, low cognitive load, theme tokens applied
* Dark-mode toggle with persistence (`localStorage: wqx-theme`)

Previous feature-rich landing retained via git history (no separate legacy file for this second iteration).

## 🎨 Theme System

New calming healthcare theme introduced:

* Source: `assets/webqx-emr-theme.css`
* Auto attach: `assets/webqx-theme-init.js`
* Shared tokens: spacing, radii, colors (light/dark), shadows, buttons, nav
* Accessible focus ring (`--wqx-focus`), reduced motion friendly
* Portals updated (patient, provider, admin) with consistent top bar + dark toggle

## 🤖 Provider Assistant Scaffold

Directory: `services/provider-assistant/`

FastAPI microservice placeholder (not yet wired into gateway):

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Liveness |
| `POST /v1/assist/summary` | Draft chart summary (mock) |
| `POST /v1/assist/plan` | Draft assessment/plan snippet |
| `POST /v1/assist/triage` | Naive urgency classification |

Authentication stub currently accepts any token; integrate RS256 JWT + JWKS soon.

## 🧪 End-to-End Test (Playwright)

Added basic e2e coverage for landing role tiles & copy action:

File: `tests/e2e/role-access.spec.ts`

Run after installing dev deps:
```
npm install
npx playwright install --with-deps  # optional for browsers
npm run test:e2e
```

CI integration pending; can be added as a separate GitHub Actions job.

---

## ⚠️ PostCSS in Production Builds

The portal uses Vite + PostCSS. In environments that only install production dependencies (e.g., Railway, Docker with `npm ci --only=production`), PostCSS plugins referenced by `portal/postcss.config.js` must be available at runtime. To prevent build failures like:

```
Loading PostCSS Plugin failed: Cannot find module 'autoprefixer'
```

we keep `autoprefixer` and `postcss` in the root `dependencies` rather than `devDependencies`.

Files involved:
- `portal/postcss.config.js`
- `portal/vite.config.ts`
- `package.json` (root)

If you add more PostCSS plugins, ensure they are placed in `dependencies` as well.

---

## 🔐 Django Authentication Integration (Phase 1)

The platform now supports using the Django backend as the primary Identity Provider (IdP) for the PHP/OpenEMR EMR stack.

Phase 1 Summary:
- Added `django-auth` service to `webqx-emr-system/docker-compose.yml` (exposed on host port 8090, internal 8000)
- Reverse proxy `/auth/` path through Apache inside `webqx-emr` → Django (see `docker/apache/webqx-site.conf`)
- Implemented HS256 JWT validation in PHP (`api/auth/jwt_validator.php`) and session bridge (`api/auth/session_bridge.php`)
- Auto-inclusion in `api/webqx-api.php` to hydrate OpenEMR session context from JWT claims

Environment Variables (examples):
```
DJANGO_SECRET_KEY=webqx_shared_dev_secret_change_me
DJANGO_JWT_SHARED_SECRET=webqx_shared_dev_secret_change_me
DJANGO_JWT_ISSUER=webqx.healthcare
DJANGO_JWT_AUDIENCE=webqx.emr
```

Local Test Flow:
1. Start stack: `docker compose up -d --build` inside `webqx-emr-system`.
2. Obtain JWT from Django (e.g., `POST /auth/api/token/` with user credentials).
3. Call EMR API with `Authorization: Bearer <token>` header.
4. Session bridge populates `$_SESSION` keys and grants access.

Next Phases (Optional):
- RS256 keypair + JWKS endpoint
- Token revocation via blacklist introspection
- Role synchronization & provisioning mapping into OpenEMR-specific tables
- Refresh token rotation in HttpOnly cookie path

Security Notes:
- Do not reuse `DJANGO_SECRET_KEY` in production as a JWT shared secret—switch to asymmetric signing.
- Restrict `/auth/` proxy paths if exposing public internet; add rate limiting & WAF as applicable.

---

## � Django Authentication Integration (Phase 2: RS256 + JWKS)

Phase 2 upgrades the authentication layer from symmetric HS256 to asymmetric RS256 with a published JWKS for secure verification across microservices, frontends, and the EMR bridge.

### Why RS256?
* Key separation: Private key stays only in the Django auth service; public key distributed via JWKS
* Safer rotation: Issue new key (kid v2) while still serving old until expiry
* Multi-service trust: Each microservice validates tokens without sharing a secret

### Endpoints (Short Alias Paths)
```
POST /auth/api/token/          # obtain access + refresh (email + password)
POST /auth/api/token/refresh/  # refresh access token
GET  /auth/.well-known/jwks.json  # JWKS (RSA public keys)
```

Backward compatible originals remain under `/api/v1/auth/...`.

### Token Claims (Added)
| Claim | Purpose |
|-------|---------|
| `role` | Simplified RBAC role (patient, provider, admin, staff, researcher, pharmacy) |
| `specialties` | Optional array of provider specialty strings |
| `email` | User primary email |
| `name` | Display name (first + last) |

### Environment Variables (Core)
| Variable | Service | Description |
|----------|---------|-------------|
| `JWT_PRIVATE_KEY_PATH` | django-auth | Path to RSA private key (PEM) |
| `JWT_PUBLIC_KEY_PATH`  | django-auth | Path to RSA public key (PEM) |
| `JWT_ALGORITHM`        | django-auth | Should be `RS256` |
| `JWT_ISSUER` / `JWT_AUDIENCE` | django-auth + verifiers | Issuer / audience consistency |
| `JWT_JWKS_URL` or `JWKS_URL` | microservices | Points to `https://<host>/auth/.well-known/jwks.json` |

### Microservice Configuration
Prefer the alias JWKS endpoint:
```
JWKS_URL=https://auth.example.com/auth/.well-known/jwks.json
```
If older path already deployed:
```
JWKS_URL=https://auth.example.com/api/v1/auth/.well-known/jwks.json  # still supported
```

---

## 🌐 GitHub Pages Runtime Behavior

When hosted on GitHub Pages, the unified SPA includes a small client-side redirect to the live Railway UI for a friendlier experience. You can disable this for testing or deep-linking by defining a global flag before the SPA scripts load:

```html
<script>window.WEBQX_DISABLE_REDIRECT = true;</script>
```

You can also configure the SPA at runtime to point API and EMR calls to a specific backend by defining these globals (normally injected by the Pages build as `runtime-config.js`):

```html
<script>
	window.WEBQX_PROD_API = 'https://webqx-production.up.railway.app';
	window.WEBQX_PROD_EMR = 'https://webqx-production.up.railway.app'; // optional; defaults based on API
	window.WEBQX_FORCE_ENV = 'remote'; // enables API proxy rewrite on non-GitHub Pages hosts
</script>
```

The SPA includes a safe client-side API proxy (`pages-spa-api-proxy.js`) that rewrites relative calls like `/health`, `/api/*`, and `/fhir/*` to `WEBQX_PROD_API` on GitHub Pages (or whenever `WEBQX_FORCE_ENV==='remote'`).

### Frontend Helper Usage
File: `assets/webqx-token-auth.js`
```
import { login, refresh, getAccessToken, clearTokens } from './assets/webqx-token-auth.js';

// Auto mode uses relative /auth/* when served behind same domain
await login({ email: 'demo@webqx.health', password: 'demo123', baseUrl: 'auto' });
const token = getAccessToken();

// Later, to refresh:
await refresh();
```

Handles storage of both `access` and `refresh` tokens (localStorage keys: `webqx_access_token`, `webqx_refresh_token`).

### Frontend Auth Quickstart

Minimal sequence to integrate authenticated API calls with automatic refresh:
```
<script src="/assets/webqx-token-auth.js"></script>
<script>
	async function init(){
		// 1. Perform login (auto resolves to same-origin /auth/* endpoints)
		await WebQXAuth.login({ baseUrl: 'auto', email: 'demo@webqx.health', password: 'demo123' });

		// 2. Start background refresh (checks every 60s; refresh ~30s before expiry)
		WebQXAuth.initAutoRefresh({ baseUrl: 'auto', intervalSec: 60 });

		// 3. Use ensureFreshAccessToken before critical calls
		async function callProtected(){
			const token = await WebQXAuth.ensureFreshAccessToken('auto');
			const r = await fetch('/api/v1/secure/resource', { headers: { Authorization: 'Bearer '+token }});
			console.log(await r.json());
		}
		callProtected();
	}
	init();
</script>
```

Helper API surface:
| Function | Purpose |
|----------|---------|
| `login({baseUrl,email,password})` | Acquire access + refresh tokens |
| `refresh(baseUrl)` | Manually exchange refresh token |
| `getToken()` | Return current access token (may be expired) |
| `getClaims()` | Decoded claims (role, specialties, etc.) |
| `ensureFreshAccessToken(baseUrl)` | Returns valid (refreshing if near/after expiry) or null |
| `initAutoRefresh({ baseUrl, intervalSec })` | Starts periodic silent refresh loop |
| `logout()` | Clears tokens & cancels auto refresh |

Access token is proactively refreshed if within 30s of expiry. If refresh fails (revoked/expired), tokens are cleared to enforce re-authentication.

### Rotating Keys
1. Generate new keypair → save as `private-v2.pem` / `public-v2.pem`
2. Serve both keys in JWKS (update view to emit two entries with different `kid` values)
3. Switch `JWT_ACTIVE_KID` (if implemented) or start signing with new key
4. After old tokens expire, remove v1 key from JWKS

### Verifying Tokens (Node Example)
```
import jwksClient from 'jwks-rsa';
import jwt from 'jsonwebtoken';

const client = jwksClient({ jwksUri: process.env.JWT_JWKS_URL });
function getKey(header, cb){
	client.getSigningKey(header.kid, (err, key) => {
		if (err) return cb(err);
		cb(null, key.getPublicKey());
	});
}
jwt.verify(token, getKey, { algorithms: ['RS256'], issuer: 'webqx.healthcare' }, (err, decoded) => {
	// decoded.role, decoded.specialties
});
```

### EMR Bridge Update
`webqx-emr-system/api/auth/jwt_validator.php` continues to support the original `/api/v1/auth/.well-known/jwks.json`. To standardize, set:
```
DJANGO_JWKS_URL="${DJANGO_BASE_URL}/auth/.well-known/jwks.json"
```
If unset it falls back to the legacy path.

### Migration Checklist
| Step | Action | Status |
|------|--------|--------|
| 1 | Generate RSA keypair (private.pem/public.pem) | ✅ |
| 2 | Expose JWKS endpoint | ✅ |
| 3 | Add short alias endpoints | ✅ |
| 4 | Inject role & specialties claims | ✅ |
| 5 | Update frontend helper (email + refresh) | ✅ |
| 6 | Update microservice env docs to /auth/.well-known/jwks.json | ⏳ |
| 7 | Rotate legacy HS256 out (when safe) | ⏳ |

### Next Hardening Ideas
* Refresh token rotation & reuse detection
* Token introspection caching layer
* MFA claim embedding (amr) post-successful OTP
* Per-service audience values for finer scoping
* System-to-system client credentials grant (separate key set)

---

## �🚀 CI / CD & Deployment

Automated GitHub Actions workflow (`.github/workflows/deploy.yml`) performs:

- Install & run Jest tests
- Build & push Docker images to GHCR:
	- `ghcr.io/<org>/webqx-emr`
	- `ghcr.io/<org>/webqx-auth`
- Build & publish static site (landing + assets) to GitHub Pages

Artifacts:
- Test report uploaded (if produced)
- Pages artifact (dist/) deployed to environment `github-pages`

No secrets required for GHCR push (uses built-in `GITHUB_TOKEN`). Add optional secrets if you introduce external registries:
```
REGISTRY_USERNAME
REGISTRY_PASSWORD
```

To disable image publishing temporarily, comment out the `build-docker` job or set a conditional on commit message.

---

Contact: [info@webqx.healthcare](https://github.com/webqx-health)  
_“Care equity begins with code equity.”_

---

## 🔐 In-Memory Node Auth Test Server (Developer Console)

Alongside the Django auth integration, the repo now includes a lightweight, fully self-contained Node.js authentication server at `django-auth-backend/auth-server.js` (name retained for compatibility) providing a fast sandbox for local RBAC + MFA testing without bringing up the full Django stack.

### Why It Exists
| Goal | Benefit |
|------|---------|
| Rapid UX iteration | Instant restart, no migrations |
| Frontend contract testing | Stable JSON shapes & JWT claims |
| RBAC / permissions demos | In-memory role map with dashboards |
| MFA enable & verify flow | QR provisioning + TOTP check |
| Failure & rate-limit handling | Surfaced attempt counters + lockouts |
| Raw request crafting | Built‑in panel to exercise any endpoint |

### Feature Snapshot
* HS256 JWT issuance (access + refresh) with configurable expiry window
* Role-based dashboards: Patient / Nurse / Physician / Physician Assistant / Billing / Administrator
* MFA setup (TOTP secret + QR) and verification with backup codes
* Account lockout after 5 failed password attempts (15 min default)
* Rate limit headers surfaced (per 15‑minute window)
* Security event & login history dashboard (recent events / attempts)
* Debounced JSON persistence (`data/users.json`) so users survive restarts
* Raw HTTP panel (choose method, path, headers JSON, body JSON) auto-injects bearer token when present
* Logout + token reveal & clipboard helpers
* Attempts remaining + lockout countdown metadata on failed login responses

### Quick Start (Standalone)
```bash
node django-auth-backend/auth-server.js
# Open http://localhost:3001/
```

Health check:
```
curl -s http://localhost:3001/health/ | jq
```

### Registration & Login API (Simplified)
| Endpoint | Verb | Purpose |
|----------|------|---------|
| `/api/v1/auth/register/` | POST | Create user (password >= 12 chars; HIPAA consent required for PATIENT) |
| `/api/v1/auth/token/` | POST | Login (returns access + refresh) |
| `/api/v1/auth/profile/` | GET | Authenticated user profile |
| `/api/v1/auth/mfa/setup/` | GET | Begin MFA (returns QR + secret) |
| `/api/v1/auth/mfa/setup/` | POST | Verify 6‑digit token + receive backup codes |
| `/api/v1/auth/security/dashboard/` | GET | Security & login events |
| `/api/v1/dashboard/` | GET | Aggregate dashboard (role aware) |

Failed login response example:
```json
{
	"success": false,
	"message": "Invalid email or password",
	"attempts_remaining": 3,
	"lockout_until": null
}
```

### Persistence
* Stored at: `django-auth-backend/data/users.json`
* Debounced (400ms) after mutations: registration, failed attempt increment, successful login, MFA enable
* Safe to delete for a clean slate

### MFA Flow
1. Register & login.
2. Click "MFA Setup" (GET) → QR + secret displayed
3. Scan into authenticator app (e.g., Authy, Google Authenticator)
4. Enter 6‑digit code in console → POST verify → backup codes displayed
5. Future enhancement (planned): enforce second factor on login if `mfa_enabled`

### Raw HTTP Panel
Lets you quickly test evolving endpoints (e.g., adding a new `/api/v1/auth/roles/` route) without leaving the browser or crafting curl manually. Automatically includes bearer token unless overridden by custom header JSON.

### Environment Variables (Node Auth Server)
| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Listen port |
| `JWT_SECRET` | webqx-django-style-jwt-secret-2024 | HS256 signing secret (dev only) |
| `WEBQX_DATA_DIR` | `django-auth-backend/data` | Persistence directory |

### Dev Notes
* Not for production use—shared secret JWT, in-memory sessions, and no external store
* Designed to mimic Django validation patterns (field error arrays) for seamless gateway swap

