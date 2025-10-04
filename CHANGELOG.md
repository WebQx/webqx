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

