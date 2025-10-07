## <small>0.4.1 (2025-10-07)</small>

* fix(db): parse Railway MYSQL_URL connection strings and sanitize database names ([9bca1d7](https://github.com/WebQx/EMR/commit/9bca1d7))

## 0.4.0 (2025-10-07)

* feat(portal): route production login and root to new provider entry ([aebc849](https://github.com/WebQx/EMR/commit/aebc849))

## 0.3.0 (2025-10-07)

* feat(portal): serve provider portal directly at /portal with nested path support ([059c6dd](https://github.com/WebQx/EMR/commit/059c6dd))
* chore(adapter): add adapter package-lock to keep dependency tree consistent ([23a0a2b](https://github.com/WebQx/EMR/commit/23a0a2b))

## 0.2.0 (2025-10-07)

* chore: refine secrets validation (core vs recommended, derivations for origins & fhir base) ([c377903](https://github.com/WebQx/EMR/commit/c377903))
* chore(demo): add build hash stamping to standalone pages ([8769e6d](https://github.com/WebQx/EMR/commit/8769e6d))
* chore(deps): sync lockfile after adding conventional-changelog-conventionalcommits ([a4d1466](https://github.com/WebQx/EMR/commit/a4d1466))
* chore(preflight): downgrade third-party provider auth checks to warnings ([1220e5a](https://github.com/WebQx/EMR/commit/1220e5a))
* chore(release): add CHANGELOG for v0.1.0 ([87b0953](https://github.com/WebQx/EMR/commit/87b0953))
* chore(release): add conventional-changelog-conventionalcommits devDependency ([5ebe620](https://github.com/WebQx/EMR/commit/5ebe620))
* feat: add DISABLE_OAUTH config support for staging mode ([26a88f2](https://github.com/WebQx/EMR/commit/26a88f2))
* feat: add light-emr-adapter, unified health/metrics, security hardening, Railway domain integration ([c0e1c8f](https://github.com/WebQx/EMR/commit/c0e1c8f))
* feat: Complete Medplum OAuth2 + OpenAI Whisper + Nextcloud integration ([834eb38](https://github.com/WebQx/EMR/commit/834eb38))
* feat: enhanced staging bootstrap synthesis with auto-detection and infra key tolerance ([ad23590](https://github.com/WebQx/EMR/commit/ad23590))
* feat: transcript persistence (DocumentReference), portal save-to-patient, patient chart transcriptio ([319de0a](https://github.com/WebQx/EMR/commit/319de0a))
* feat(demo-auth): add client-side login, dashboard, and auth guard for patient/provider pages ([cae6a7d](https://github.com/WebQx/EMR/commit/cae6a7d))
* feat(demo-metrics): add ASCII bar histogram for latency buckets ([471d42e](https://github.com/WebQx/EMR/commit/471d42e))
* feat(demo-observability): add /health vs /emr/status diff rendering ([0f90989](https://github.com/WebQx/EMR/commit/0f90989))
* feat(demo-patient): add patient data source badge (api vs synthetic) ([b1cdbeb](https://github.com/WebQx/EMR/commit/b1cdbeb))
* feat(demo-standalone): rebuild patient/provider/telehealth/transcription pages with embedded login o ([1e73382](https://github.com/WebQx/EMR/commit/1e73382))
* feat(demo): add health diff + latency histogram; improve telehealth audit log IDs ([2dcef91](https://github.com/WebQx/EMR/commit/2dcef91))
* feat(demo): add hub overlay modal + compact previews to reduce layout shift ([78aafbe](https://github.com/WebQx/EMR/commit/78aafbe))
* feat(demo): add interactive telehealth WebRTC loopback and streaming transcription simulation ([05d9eeb](https://github.com/WebQx/EMR/commit/05d9eeb))
* feat(demo): add synthetic patients, search/filter, provider schedule mock, latency histogram parse ([cc755c6](https://github.com/WebQx/EMR/commit/cc755c6))
* feat(demo): patient table + detail panel, enriched synthetic data, interactive provider schedule boo ([288671a](https://github.com/WebQx/EMR/commit/288671a))
* feat(demo): unified nav, WS latency auto-ping, histogram bars prep, README interactive updates ([2cf506c](https://github.com/WebQx/EMR/commit/2cf506c))
* feat(docs): unify standalone demo footers and cleanup patient header ([d3a9c49](https://github.com/WebQx/EMR/commit/d3a9c49))
* feat(portal): add interactive telehealth, patients, transcription cards and collapsible status/dev p ([9a69558](https://github.com/WebQx/EMR/commit/9a69558))
* feat(portal): inline patient chart panel with demographics & transcripts + auto transcript patient l ([6094e7a](https://github.com/WebQx/EMR/commit/6094e7a))
* feat(portals): add role-guarded patient portal, provider panel, and admin console entry + README lin ([495fddd](https://github.com/WebQx/EMR/commit/495fddd))
* feat(proxy): add fallback /emr/status and /emr/patients when adapter absent ([cdfda89](https://github.com/WebQx/EMR/commit/cdfda89))
* feat(telehealth): session ACL, incremental history sync, portal invite & creation UI enhancements ([83ef1b9](https://github.com/WebQx/EMR/commit/83ef1b9))
* feat(usability): add patient chart, telehealth session pages, portal linking and transcript history ([b83ba83](https://github.com/WebQx/EMR/commit/b83ba83))
* fix: auto-add https:// protocol to RAILWAY_PUBLIC_API_BASE and ALLOWED_ORIGINS for validation ([783eed1](https://github.com/WebQx/EMR/commit/783eed1))
* fix: staging synthesis now respects RAILWAY_TOKEN presence - real infra vs local testing ([5a36ea1](https://github.com/WebQx/EMR/commit/5a36ea1))
* fix(auth): restore production backend authentication for Railway provider login ([04c86eb](https://github.com/WebQx/EMR/commit/04c86eb))
* fix(auth): sync credentials across auth.js and inline-auth.js, fix logout redirects to index.html ([e2e8ddf](https://github.com/WebQx/EMR/commit/e2e8ddf))
* fix(auth): write to both session keys on login to prevent redirect loops ([47eee4b](https://github.com/WebQx/EMR/commit/47eee4b))
* fix(portal): add auth headers to patient & transcription fetches ([b9a0256](https://github.com/WebQx/EMR/commit/b9a0256))
* fix(transcription): correct simulateStreaming API to match callback-based usage ([a4a2c02](https://github.com/WebQx/EMR/commit/a4a2c02))
* Fix: Install light-emr-adapter dependencies on Railway ([80470aa](https://github.com/WebQx/EMR/commit/80470aa))
* Fix: Redirect to actual WebQX EMR production portals ([72b66a6](https://github.com/WebQx/EMR/commit/72b66a6))
* Checkpoint from VS Code for coding agent session ([3a11ce1](https://github.com/WebQx/EMR/commit/3a11ce1))
* Checkpoint from VS Code for coding agent session ([48a8d60](https://github.com/WebQx/EMR/commit/48a8d60))
* Fix provider login redirect to existing pages ([3c1f844](https://github.com/WebQx/EMR/commit/3c1f844))
* HONEST DASHBOARD: Shows REAL system status, NO FAKE FEATURES ([b68bb6e](https://github.com/WebQx/EMR/commit/b68bb6e))
* test(auth,telehealth): enable ESM transforms, mock azure config, guard cookies ([6b47ca5](https://github.com/WebQx/EMR/commit/6b47ca5))
* PRODUCTION: Real API-only portal, NO MORE DEMOS ([417cef6](https://github.com/WebQx/EMR/commit/417cef6))
* docs: document token-light staging and Railway bypass mode ([c45eb03](https://github.com/WebQx/EMR/commit/c45eb03))
* docs(demo): add deployment readiness update and README freshness/badge sections ([7567b50](https://github.com/WebQx/EMR/commit/7567b50))
* docs(demo): add full module demo pages (security, env, fhir, transcription, dependencies) and expand ([9e95f1b](https://github.com/WebQx/EMR/commit/9e95f1b))
* docs(demo): add public GitHub Pages v0.1.0 demo hub (health, adapter, patients, metrics) ([0826481](https://github.com/WebQx/EMR/commit/0826481))
* docs(demo): add v0.1.0 demo script and link from README ([a978af0](https://github.com/WebQx/EMR/commit/a978af0))
* docs(demo): correct GitHub Pages base URL to /EMR and add redirect note ([6fc36fc](https://github.com/WebQx/EMR/commit/6fc36fc))
* docs(readme): overhaul root README with architecture, security, observability, roadmap, homepage ([8168eb8](https://github.com/WebQx/EMR/commit/8168eb8))
* ci: add explicit Railway authentication step ([966f4bf](https://github.com/WebQx/EMR/commit/966f4bf))
* ci: add staging fallback secret synthesis (HIPAA key, OAuth2 placeholders, FHIR/messaging stubs) ([4bb4669](https://github.com/WebQx/EMR/commit/4bb4669))
* ci: auto-populate recommended secret defaults (heartbeat, timeouts, redis ssl, origins, fhir base) ([322c9f2](https://github.com/WebQx/EMR/commit/322c9f2))
* ci: enhance Railway auth diagnostics (token sanitation + multiple flags + length check) ([c854626](https://github.com/WebQx/EMR/commit/c854626))
* ci: fallback to GHCR_PAT + GHCR_USERNAME when GHCR push denied; prefer GITHUB_TOKEN first ([e5cb0d4](https://github.com/WebQx/EMR/commit/e5cb0d4))
* ci: fix deploy workflow (Railway service name secrets, cleanup preflight) and add secrets preflight  ([2338041](https://github.com/WebQx/EMR/commit/2338041))
* ci: lowercase GHCR namespace and sanitize version for image refs across workflows ([8291be0](https://github.com/WebQx/EMR/commit/8291be0))
* ci: parameterize Railway variables step with RAILWAY_API_SERVICE fallback ([c5c9bf3](https://github.com/WebQx/EMR/commit/c5c9bf3))
* ci: robust multi-strategy Railway auth with token fallback ([ba0037d](https://github.com/WebQx/EMR/commit/ba0037d))
* ci: use GHCR_USERNAME when provided for GHCR login; fallback to actor ([7b3701c](https://github.com/WebQx/EMR/commit/7b3701c))
* ci(staging): add MINIMAL_STAGING mode & simplify token requirements ([a32187e](https://github.com/WebQx/EMR/commit/a32187e))
* ci(staging): auto-skip all Railway steps when token absent ([45c328a](https://github.com/WebQx/EMR/commit/45c328a))
* deploy: sanitize version input/refs/tags for image tags in staging/prod workflow ([750f198](https://github.com/WebQx/EMR/commit/750f198))

# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2025-10-04

### Added
- Light EMR Adapter microservice (`light-emr-adapter`) exposing `/emr/status`, `/emr/patients`, and `/metrics` with:
  - Zod-based environment validation
  - Pino structured logging + request ID correlation
  - Prometheus metrics (default + HTTP latency histogram)
  - Layered route-specific rate limiting
  - In-memory TTL cache for patient list
  - Unified health schema (Medplum + Nextcloud dependency status/latency)
  - Graceful shutdown (SIGINT/SIGTERM) with log flush
- Extended `api-proxy-server.js` with:
  - Unified `/health` schema to match adapter
  - Structured logging (pino + requestId)
  - Prometheus metrics endpoint & latency instrumentation
  - WebSocket auth/token guard and message size constraints
  - Layered rate limiting profiles (default/auth/patients)
  - Minimal CSP and tightened CORS/body size limits
- Preflight validation script enhancements (`scripts/preflight-check.js`):
  - Validates Medplum + Nextcloud URLs and adapter enablement
  - Optional online reachability mode (`--online`) probing Railway public domain + adapter status
- Frontend status badges (patient & provider portals) polling `/emr/status` for live adapter health.
- `LIGHT_EMR_INTEGRATION_ROADMAP.md` outlining phased production integration plan (status → patient listing → deeper FHIR + document sync).

### Security / Hardening
- Reintroduced and scoped Content Security Policy.
- Stricter CORS with environment-driven allowed origins.
- Body size limits reduced for attack surface minimization.
- Layered rate limiting reducing brute force & enumeration risk.
- WebSocket token guard for telehealth channel access.

### Observability
- Standardized structured JSON logs across proxy & adapter.
- Prometheus metrics endpoint with histograms for latency SLOs.
- Unified health JSON enabling consistent external monitoring.
- Audit-style request logging (method, path, status, latency, requestId).

### Removed / Cleaned
- Large set of legacy demo, mock, and archival documents & test harnesses to reduce repository noise and attack surface.
- Deprecated infrastructure templates (Terraform/CloudFormation/Serverless) pending future IaC reintroduction with minimal surface.
- Legacy WordPress plugin code and unused telehealth demo pages.

### Documentation
- Added adapter `README.md` with environment variable descriptions and health schema example.
- Updated `.env.example` with Medplum / Nextcloud / adapter + `RAILWAY_PUBLIC_DOMAIN` variables.

### Notes
- Medplum and Nextcloud integrations are currently shallow (reachability + metadata probe / WebDAV PROPFIND). Deep authenticated operations slated for future milestone (see roadmap).
- Circuit breaker logic and advanced caching not yet implemented.
- CI/release automation (semantic-release) dependencies present but not configured in a pipeline.

---

## Release Strategy
This 0.1.0 marks the transition from prototype/demos to a production-aligned core with security, observability, and integration scaffolding. Future minor releases will focus on deepening FHIR operations, document sync, authentication hardening, and resilience (circuit breakers / backoff / retries).
