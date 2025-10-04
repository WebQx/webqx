# WebQX™ Healthcare Platform

> Production-aligned, modular healthcare and telehealth platform with FHIR-first design, secure adapter architecture, and global readiness.

**Homepage:** https://webqx.healthcare  
**Primary Deployment (Railway):** https://webqx-production.up.railway.app  
**GitHub Pages (Static Assets / Demo Hub):** https://webqx.github.io/EMR/  
**Demo Script (v0.1.0):** ./DEMO_SCRIPT_v0.1.0.md

---
## 🔗 Public Demo Hub
A lightweight, read-only demonstration of live platform readiness served via GitHub Pages. Recent enhancements add meaningful interactivity even without the adapter fully deployed:

| Page | URL | Purpose |
|------|-----|---------|
| Landing | https://webqx.github.io/EMR/ | Overview + live health & adapter status |
| Patient Demo | https://webqx.github.io/EMR/patient.html | Synthetic fallback patients + search/filter + stats |
| Provider Demo | https://webqx.github.io/EMR/provider.html | Schedule mock + status panels |
| Metrics Snapshot | https://webqx.github.io/EMR/metrics.html | Truncated metrics + parsed latency histogram |
| System Status | https://webqx.github.io/EMR/system.html | Runtime/system snapshot (non-sensitive) |
| Environment | https://webqx.github.io/EMR/env.html | Public-safe config & feature flags |
| Security Headers | https://webqx.github.io/EMR/security.html | Live gateway headers + CSP notes |
| FHIR Probe | https://webqx.github.io/EMR/fhir.html | CapabilityStatement / metadata fetch |
| Telehealth | https://webqx.github.io/EMR/telehealth.html | WebSocket echo + latency + auto‑ping |
| Transcription | https://webqx.github.io/EMR/transcription.html | Placeholder transcript generator |
| Rate Limit Test | https://webqx.github.io/EMR/rate-limit.html | Burst probe to visualize limiter |
| Dependencies | https://webqx.github.io/EMR/dependencies.html | Service graph + deployment state |

> Synthetic data is clearly flagged; no PHI or secrets are exposed.

---
## 🔄 Current Focus (v0.1.0)
Foundational production hardening completed:
- Light EMR Adapter (Medplum + Nextcloud scaffolding) with `/emr/status`, `/emr/patients`, `/metrics`
- Unified health schema across services
- Structured logging (pino) + request correlation IDs
- Prometheus metrics & latency histograms (now parsed client-side in demo)
- Layered rate limiting & WebSocket token guard
- Hardened CORS, minimal CSP, reduced body limits
- Frontend status badges + interactive synthetic dataset fallback

Upcoming (short-term roadmap): deeper FHIR operations, document sync, circuit breakers, authenticated patient data flows.

---
## ✨ Key Capabilities
- Patient & Provider Portals (interactive demo surfaces)
- Telehealth WebSocket channel (latency + auto‑ping demo)
- Light EMR Adapter (extensible dependency abstraction layer)
- Interoperability scaffolding (FHIR, HL7 bridging foundation)
- Observability: metrics, structured logs, unified health endpoints
- Security: CSP, rate limiting, audit-style request logging, tokenized WS

---
## 🏗️ Architecture Overview
```plaintext
[Browser / Portals]
      | (HTTPS)
      v
[API Proxy / Gateway]  <-- WebSocket (telehealth)
      |        \
      |         +--> [Light EMR Adapter] --(FHIR / WebDAV)-> Medplum / Nextcloud
      |         +--> (Future) Other EHR adapters (OpenEMR, Epic, Cerner)
      v
  (Internal service endpoints / metrics / health)
```
Core Services:
- api-proxy-server.js — security, CORS, metrics, WebSocket guard, unified health
- light-emr-adapter — dependency abstraction & patient listing prototype
- portals (patient, provider) — static HTML/JS with adapter status indicators

---
## 📂 Repository Highlights
```
CHANGELOG.md                 Release notes
light-emr-adapter/           Adapter microservice (Express + pino + prom-client)
patient-portal/              Patient UI components
portal/                      React/Vite experimental portal assets
scripts/preflight-check.js   Environment + dependency validation
webqx-emr-system/            Embedded EMR assets / legacy integration
```
Removed in 0.1.0: Large legacy demo & archival directories to reduce noise and attack surface.

---
## 🚀 Quick Start (Local)
```bash
# 1. Clone
git clone https://github.com/WebQx/EMR.git && cd EMR

# 2. Copy environment template
cp .env.example .env.development
# (Edit required Medplum / Nextcloud / adapter vars if using online mode)

# 3. Run preflight validation
node scripts/preflight-check.js --env-file .env.development

# 4. Start proxy (example)
node api-proxy-server.js

# 5. Start adapter (separate terminal)
cd light-emr-adapter && npm install && npm start

# 6. Visit endpoints
curl http://localhost:3000/health
curl http://localhost:4001/emr/status
curl http://localhost:4001/metrics
```
Optional online verification (requires publicly reachable domain & correct vars):
```bash
node scripts/preflight-check.js --env-file .env.production --online
```

---
## 🔐 Security Hardening (Implemented)
- Content Security Policy (strict minimal baseline)
- Tight CORS: origin allowlist via environment
- Layered rate limits (status vs patient vs default paths)
- Request size limits to reduce abuse surface
- WebSocket: token enforcement + message size cap
- Audit-style structured logs (JSON) with requestId correlation
- Graceful shutdown capturing SIGINT/SIGTERM

Planned:
- JWT-based auth enforcement for adapter endpoints
- mTLS / signed service-to-service calls (if multi-region)
- Circuit breaker & retry policies (adapter dependencies)

---
## 📊 Observability
Endpoints:
- `/health` and `/emr/status` — unified JSON schema: per dependency status, latency ms, timestamp
- `/metrics` — Prometheus exposition with HTTP latency histogram (client-side parsed in demo)
Logging Fields (example):
```json
{
  "time":"2025-10-04T10:21:54.123Z",
  "level":30,
  "requestId":"f5c7a5d9",
  "method":"GET",
  "path":"/emr/status",
  "status":200,
  "latency_ms":12
}
```
Suggested dashboards: error rate, p95 latency (adapter & proxy), dependency health flaps, rate limit triggers.

---
## 🔧 Environment Variables (Excerpt)
| Variable | Purpose |
|----------|---------|
| `LIGHT_EMR_ADAPTER_ENABLED` | Toggle adapter integration in proxy layer |
| `LIGHT_EMR_ADAPTER_PORT` | Port for adapter service (default 4001) |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowlist |
| `MEDPLUM_API_URL` | Base URL for Medplum FHIR API (https required) |
| `NEXTCLOUD_WEBDAV_URL` | Nextcloud WebDAV endpoint (https) |
| `RAILWAY_PUBLIC_DOMAIN` | Public base domain for deployed environment |
| `ADAPTER_CACHE_TTL_MS` | Milliseconds to cache patient listing |
| `ADAPTER_LOG_LEVEL` | pino log level (info, debug, warn) |

See `.env.example` for full list and comments.

---
## 🧪 Health & Validation
Preflight script checks:
- Required env presence & format
- HTTPS enforcement for external dependencies
- Adapter enablement consistency
- Optional network reachability (online mode): Medplum, Nextcloud, adapter

---
## 🛣️ Roadmap (High-Level)
| Phase | Focus | Highlights |
|-------|-------|-----------|
| 1 | Foundation (DONE) | Adapter scaffold, logging, metrics, security, cleanup |
| 2 | FHIR Depth | Authenticated Patient retrieval, error taxonomy, paging |
| 3 | Documents Sync | Nextcloud file metadata, secure retrieval, integrity hashes |
| 4 | Resilience | Circuit breakers, retry/backoff, dependency SLO alerts |
| 5 | Auth Expansion | Fine-grained RBAC, audit stream shipping, JWT service mesh |
| 6 | Scaling | Horizontal adapter pooling, cache invalidation, global POP strategy |

---
## 🤝 Contributing
1. Fork & create feature branch
2. Run preflight & add/update tests where applicable
3. Follow structured commit messages (conventional commits recommended)
4. Exclude personal PHI / sensitive data in fixtures

Security reports: security@webqx.healthcare

---
## 📄 License
Apache 2.0 — see `LICENSE.md`.

---
## 📬 Contact & Support
- General: info@webqx.healthcare
- Status Page (planned): https://status.webqx.healthcare
- Equity Access Program: https://webqx.healthcare/equity-access

_"Care equity begins with code equity."_

