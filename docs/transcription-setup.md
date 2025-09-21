# WebQx Medical Transcription (Whisper) – Production Setup

This guide explains how to deploy the Whisper transcription microservice to Railway and integrate it with the WebQx gateway without breaking existing infrastructure.

## Architecture (no conflicts)

- Whisper runs as an isolated FastAPI service (services/transcription/app). It exposes:
  - GET /healthz, GET /health
  - POST /v1/transcribe (multipart/form-data)
  - WS /v1/ws (streaming, final message only)
- The WebQx gateway proxies client traffic to Whisper when TRANSCRIPTION_BASE_URL is set. If it is not set, the gateway will respond 503 (TRANSCRIPTION_UNAVAILABLE). There is no mock fallback in production mode.
- Existing endpoints like /api/whisper/translate (legacy translation) remain untouched and can be deprecated later.

## Deploy Whisper on Railway

Create a new Railway service using `services/transcription/Dockerfile`.

- Healthcheck: GET /healthz
- Recommended plan: CPU (start small), 1 GB RAM; bump if model size increases.

Environment variables:

- MODEL_SIZE=base (or small)
- DEVICE=cpu
- ENABLE_REDACTION=true
- MAX_AUDIO_SECONDS=900
- LOG_LEVEL=info
- JWT_ISSUER=https://<your-auth-issuer>
- JWT_AUDIENCE=webqx-api
- JWKS_URL=https://<your-auth-issuer>/.well-known/jwks.json
- REDIS_URL=redis://<railway-redis>:6379/0
- TRANSCRIPTION_ALLOWED_ORIGINS=https://webqx-production.up.railway.app,https://webqx.github.io

Notes:
- CORS is not strictly required if all browsers call the gateway (recommended). Keep it permissive during bring-up.
- JWKS cache TTL is 5 minutes by default.

## Configure WebQx Gateway (Railway)

In the main WebQx service, set:

- TRANSCRIPTION_BASE_URL=https://<whisper-service>.up.railway.app

The gateway will now proxy:

- POST /api/transcription/v1/transcribe → Whisper /v1/transcribe
- WS   /api/transcription/v1/ws → Whisper /v1/ws

No other changes are required. If TRANSCRIPTION_BASE_URL is unset, clients will receive 503 at /api/transcription/*.

## Nginx and on-prem notes (optional)

If deploying behind your own Nginx (not applicable to Railway default):

- Ensure client_max_body_size supports audio uploads (e.g., 25M+). Default in `nginx-webqx.conf` is 10M; increase if needed.
- Keep proxy_read_timeout ≥ 300s for long transcribes or use streaming.
- WebSockets at /api/transcription/v1/ws work under the main location because upgrade headers are set; no extra block is required.

## Observability and rate limiting

- The service includes basic Redis rate limiting (user + global). Start with 20 req/min per user and 200 req/min global; adjust per load.
- Add platform metrics by scraping Gateway logs or extend the FastAPI app with Prometheus when needed.

## Security & compliance

- Require RS256 JWTs with short lifetimes (≤15 min).
- Enable redaction (regex-based). For higher assurance, replace with NER-based PHI detection later.
- Avoid logging PHI; keep logs to aggregate metrics and request IDs.

## Backward compatibility

- Legacy /api/whisper/translate is independent. Do not remove until clients are migrated.
- UI must call /api/transcription/v1/transcribe. All mock references have been removed.
