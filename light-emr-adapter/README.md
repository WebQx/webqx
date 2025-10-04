# Light EMR Adapter

Bridges WebQX frontends to external cloud services (Medplum FHIR + Nextcloud WebDAV) via a minimal, production‑ready façade.

## Endpoints
| Method | Path              | Description |
|--------|-------------------|-------------|
| GET    | /health           | Liveness / basic status |
| GET    | /emr/status       | Unified status with dependencies (medplum, nextcloud) |
| GET    | /emr/patients     | Read‑only patient list (limited, cached) |
| GET    | /metrics          | Prometheus metrics |

## Health Schema
```
{
  "status": "online|degraded|offline",
  "service": "light-emr-adapter",
  "version": "0.1.0",
  "timestamp": "ISO8601",
  "uptime_s": "123.4",
  "dependencies": {
    "medplum": { "status": "online|offline|degraded|disabled", "latency_ms": 120 },
    "nextcloud": { "status": "online|offline|degraded|disabled", "latency_ms": 95 }
  }
}
```

## Environment Variables
```
LIGHT_EMR_ADAPTER_ENABLED=true
LIGHT_EMR_ADAPTER_PORT=3100
MEDPLUM_API_URL=https://api.medplum.com
MEDPLUM_CLIENT_ID=
MEDPLUM_CLIENT_SECRET=
NEXTCLOUD_WEBDAV_URL=
NEXTCLOUD_USERNAME=
NEXTCLOUD_PASSWORD=
ADAPTER_CACHE_TTL_MS=30000
ADAPTER_LOG_LEVEL=info
ALLOWED_ORIGINS=https://webqx.github.io,https://webqx-production.up.railway.app
```

## Running Locally
```
cd light-emr-adapter
npm install
npm run dev
curl localhost:3100/health
```

## Metrics
Prometheus scrape: `/metrics` (names prefixed `light_emr_`).

## Security
- CORS restricted via `ALLOWED_ORIGINS`.
- Rate limits per route class.
- Structured logs + audit lines (JSON) to stdout.
- Graceful shutdown on SIGINT/SIGTERM.

## Railway Deployment
Deploy as a second service or merge into existing container. Ensure:
- `RAILWAY_PUBLIC_DOMAIN` set in main project.
- Frontend points to `https://$RAILWAY_PUBLIC_DOMAIN/emr/status`.

## Future Enhancements
- Authenticated FHIR queries with token exchange.
- Document management (Nextcloud folder mapping).
- Circuit breaker & retry backoff.
