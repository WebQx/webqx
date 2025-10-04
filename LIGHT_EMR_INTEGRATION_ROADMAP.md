# WebQX Lightweight EMR Integration Roadmap (Production Grade)

## Objective
Introduce a **production-capable lightweight EMR layer** that integrates:
- **Medplum Cloud (FHIR)** for clinical resource storage & interoperability.
- **Nextcloud AIO** for PHI file storage (documents, imaging, patient uploads) via WebDAV + sharing API.
- A new **WebQX Light EMR Adapter** (Node.js service) to present a simplified, stable REST surface (`/emr/*`) for WebQX Patient & Provider portals while remaining compatible with the existing OpenEMR stack.

The goal is not a demo mock—it must support real remote user testing with auditable access, security controls, and scalable deployment patterns.

## Guiding Principles
1. **Security First** – Enforce least-privilege API credentials, audit logs, no plaintext secrets.
2. **Zero Data Duplication (Phase 1–2)** – Act as a pass‑through/cache layer; only store minimal metadata locally (tokens, job states, cache entries, audit events).
3. **Progressive Enhancement** – Do not break existing OpenEMR workflows; portals auto-detect adapter availability.
4. **Strict Observability** – Structured logs, metrics hooks, optional OpenTelemetry later.
5. **Standards Alignment** – FHIR R4 via Medplum; document handling mapped to `DocumentReference` + Nextcloud file metadata.
6. **Failover Logic** – If adapter unreachable, portals revert to existing OpenEMR integration paths.

## Phase Breakdown
| Phase | Scope | Key Endpoints | Success Criteria |
|-------|-------|---------------|------------------|
| 0 | Baseline | N/A | Current portals stable, no regressions |
| 1 | Adapter Skeleton + Health | `GET /emr/status` | <300ms median response; CORS + rate limit active |
| 2 | Patient Read (FHIR Proxy) | `GET /emr/patients`, `GET /emr/patients/:id` | Pagination + search; auth errors surfaced cleanly |
| 3 | Patient Create + Audit | `POST /emr/patients` + audit trail | 100% audit entries persisted; validation hardened |
| 4 | Documents Bridge (Upload/View) | `GET/POST /emr/patients/:id/documents` | File <5MB <5s, linked DocumentReference persisted |
| 5 | Appointments (Read/Write) | `GET/POST /emr/appointments` | Consistent UTC normalization, idempotent create guard |
| 6 | Caching & Resilience | Transparent cache + circuit breaker | Cache hit >60% for repeat list queries |
| 7 | Security Hardening | mTLS optional, JWT mint, role mapping | Security scan passes (no high severity) |
| 8 | Observability & Metrics | `/emr/metrics`, trace hooks | Dashboards show latency, error %, throughput |
| 9 | Extended Sync (Optional) | Background job sync to OpenEMR | Consistent reconciliation jobs documented |

## Adapter High-Level Architecture
```
light-emr-adapter/
  src/
    server.ts                # Express bootstrap
    config.ts                # Env & schema validation (zod or joi)
    logger.ts                # Pino/Winston structured logger
    security/
      rateLimit.ts           # IP + token based throttling
      auth.ts                # Medplum + Nextcloud credential handlers
    medplum/
      fhirClient.ts          # REST wrapper w/ retry + circuit breaker
      patientService.ts
      appointmentService.ts
      documentService.ts
    nextcloud/
      webdavClient.ts        # Signed request + upload/download
      sharingService.ts
    cache/
      memoryCache.ts         # LRU + TTL
    middleware/
      errorHandler.ts
      requestContext.ts
      auditLogger.ts
    routes/
      status.ts
      patients.ts
      documents.ts
      appointments.ts
    audit/
      auditStore.ts          # File/DB (Phase 3: file; Phase 7: pluggable)
  tests/
    integration/
    unit/
  package.json
  Dockerfile
  README.md
  .env.example
```

## Initial API Contract (Strict Versioned Surface)
Base path: `/emr` (prefix behind reverse proxy)

### `GET /emr/status`
- Returns: `{ service:"light-emr-adapter", medplum:{reachable:boolean}, nextcloud:{reachable:boolean}, version, uptime, cache:{patients, documents} }`
- 200 always (degraded flags indicate partial outage)

### `GET /emr/patients?search=smith&page=1&pageSize=25`
- Maps to Medplum `Patient` search (`name`, `identifier`)
- Response shape normalized: `{ data:[{ id, name, gender, birthDate }], page, pageSize, total, source:"medplum" }`

### `POST /emr/patients`
- JSON body (subset): `{ name:[{ given:["John"], family:"Smith" }], gender, birthDate }`
- Validated; forwards to Medplum; audit entry created.

### `GET /emr/appointments?date=2025-10-04`
- Maps to Medplum `Appointment?date=` search; normalizes times to ISO UTC strings.

### `POST /emr/appointments`
- Creates Appointment resource; idempotency key via `X-Idempotency-Key` header.

### `GET /emr/patients/:id/documents`
- Returns merged: Medplum DocumentReference metadata + Nextcloud file attributes.

### `POST /emr/patients/:id/documents`
- Multipart form: `file` + optional `description`.
- Flow: Upload to Nextcloud → create Medplum `Binary` + `DocumentReference` → link returned.

## Security & Compliance
| Control | Implementation (Phase) |
|---------|------------------------|
| Rate Limiting | IP + token (1) |
| Input Validation | Zod/Joi schemas (2) |
| Audit Logging | File-based JSON lines -> pluggable (3→7) |
| Circuit Breaker | Medplum client wrapper (6) |
| Cache Poison Guard | Key hashing + TTL bounds (6) |
| JWT Issuance (optional) | HMAC short-lived tokens (7) |
| mTLS Support | Nginx termination + upstream cert pin (7) |
| PHI Transport Security | HTTPS only, HSTS (1) |

## Environment Variables (.env.example Additions)
```
LIGHT_ADAPTER_PORT=8090
LIGHT_ADAPTER_LOG_LEVEL=info
LIGHT_ADAPTER_ALLOWED_ORIGINS=https://webqx.github.io,https://yourdomain.com
MEDPLUM_CLIENT_ID=your_medplum_client_id
MEDPLUM_CLIENT_SECRET=your_medplum_client_secret
MEDPLUM_BASE_URL=https://api.medplum.com
NEXTCLOUD_BASE_URL=https://nextcloud.yourdomain.com
NEXTCLOUD_USERNAME=svc_emr
NEXTCLOUD_APP_PASSWORD=your_nextcloud_app_password
NEXTCLOUD_ROOT_PATH=/EMR
CACHE_PATIENT_TTL_MS=60000
CACHE_APPOINTMENT_TTL_MS=30000
CACHE_DOCUMENT_TTL_MS=600000
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=120
AUDIT_LOG_PATH=./logs/audit.log
ENABLE_PATIENT_CREATE=true
ENABLE_APPOINTMENT_CREATE=true
ENABLE_DOCUMENT_UPLOAD=true
```

## Deployment (Initial Production Testing)
1. Build container:
   - `docker build -t webqx/light-emr-adapter:0.1.0 .`
2. Run with env file (Docker Swarm / Compose / K8s optional later)
3. Reverse proxy (Nginx) snippet:
```
location /emr/ {
  proxy_pass http://localhost:8090/;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  add_header Access-Control-Allow-Origin "https://webqx.github.io" always;
  add_header Access-Control-Allow-Credentials "true";
}
```
4. Health monitoring: probe `/emr/status` every 30s; alert if `medplum.reachable=false` > 2 mins.

## Frontend Integration Plan
- Add detection script: fetch `/emr/status` → if ok, show "Light EMR Connected" badge.
- Patient search panel: call `/emr/patients` (feature flag `USE_LIGHT_EMR=true`).
- Fallback: on 5xx or network error, revert to existing OpenEMR flows.

## Testing Strategy
| Layer | Tool | Notes |
|-------|------|-------|
| Unit | Vitest/Jest | Services & validators |
| Integration | Supertest | Medplum mock via nock |
| Performance | k6/Gatling (later) | Baseline P95 latency |
| Security | ZAP / npm audit | Automated pipeline step |

## KPIs for Phase Exit
- Phase 1: Status uptime 99% over 48h test window
- Phase 2: Patient search median < 400ms (no cache), < 150ms (cache)
- Phase 4: Document upload success > 98% (<=5MB)
- Phase 6: Cache hit ratio > 60% for patient list repeat queries
- Phase 7: All endpoints pass OWASP top 10 scan (no high findings)

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Medplum rate limiting | local cache + backoff + 429 handling |
| Nextcloud latency spikes | async document indexing & progressive UI feedback |
| Credential leakage | Use secrets manager in production; never bake secrets into image |
| Audit log growth | Rotation policy (size/time), external sink (Phase 7) |
| Partial outages | Degraded status flags + automatic fallback |

## Next Steps (Actionable)
1. Scaffold `light-emr-adapter` service with secure baseline.
2. Implement `/emr/status` + config validation + logging.
3. Wire Medplum client (read-only) + circuit breaker shell.
4. Add patient list endpoint + caching.
5. Inject frontend badge & feature flag.
6. Harden CORS + rate limiting.
7. Expand per phase above.

---
**Status:** Approved for implementation (pending creation of adapter service directory)
