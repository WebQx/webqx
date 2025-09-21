# WebQX EMR on Railway (Backend) + GitHub Pages (Frontend)

This guide gets the backend live on Railway and the SPA live on GitHub Pages, ready for demo and production.

## 1) Railway backend

Prereqs:
- Railway account
- Project created (CLI can create on first deploy)
- Node 20 runtime (Nixpacks auto-detect)

The repo includes `railway.json` with:
- builder: NIXPACKS
- start: `npm start` → unified gateway (`server.js`)
- health: `GET /health`

Environment variables (set in Railway project):
- NODE_ENV=production
- USE_REMOTE_OPENEMR=true and OPENEMR_REMOTE_URL=https://your-openemr.example (remote FHIR)
- TRANSCRIPTION_BASE_URL=https://your-transcription-service.example

CORS: The gateway allows `https://webqx.github.io` and preflight OPTIONS globally.

## 2) GitHub Pages (frontend SPA)

Secrets (Repo → Settings → Secrets and variables → Actions):
- RAILWAY_PUBLIC_API_BASE: https://<your-railway-app>.up.railway.app
- RAILWAY_PUBLIC_EMR_BASE: optional; defaults from API base
- RAILWAY_TOKEN: Railway deploy token (for backend workflow)
- RAILWAY_HEALTH_URL: optional health URL for post-deploy probe

Workflows:
- `.github/workflows/deploy-pages.yml` builds `dist/` and publishes Pages.
- `.github/workflows/backend-railway-deploy.yml` deploys backend via Railway CLI.

The build injects `runtime-config.js` with the API base and loads `pages-spa-api-proxy.js`,
so SPA calls like `/api/*` and `/fhir/*` are routed to Railway at runtime.

## 3) Deploy

Option A — via CI (recommended):
1. Add the secrets above.
2. Push to `main` → Actions will deploy Railway and Pages.

Option B — locally with CLI:
1. Install CLI: `npm i -g @railway/cli`
2. Export token: `export RAILWAY_TOKEN=...`
3. (Optional) Link to existing project: `railway link` (interactive) or `railway link --id <project-id>`
4. Deploy: `railway up --detach`

## 4) Verify
- Backend health: `GET https://<railway-app>.up.railway.app/health`
- Open SPA: `https://webqx.github.io/EMR/`
  - Medical Transcription → calls `POST /api/transcription/v1/transcribe` → expect 200 with JSON response (requires Authorization if service enforces JWT). If unconfigured, server returns 503.
  - Network: OPTIONS preflight 200; Access-Control-Allow-Origin: https://webqx.github.io

## Notes
- Helmet CSP already permits remote `connectSrc` (https/http), so API calls won’t be blocked.
- The Pages build excludes Ottehr demos and legacy routes are removed.
- The platform gateway binds to the platform-provided `PORT` automatically.
