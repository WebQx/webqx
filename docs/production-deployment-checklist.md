# WebQX EMR – Production Deployment Checklist

This checklist distills ROADMAP and Railway configuration into a practical, step-by-step runbook for a safe, HIPAA-compliant rollout, now with versioned releases, staging gates, and a rollback path.

## Before you start
- Read docs/ROADMAP.md and docs/railway-production-config.md
- Set up domains and DNS: api.webqx.health, portal.webqx.health, emr.webqx.health, viewer.webqx.health
- Obtain SSL certificates (Railway-managed or external)

## 1) Configure secrets and env (per environment)
- Copy .env.production.example to your secret manager (Railway Variables)
- Generate HIPAA_ENCRYPTION_KEY (64 hex): openssl rand -hex 32
- Provide OAuth2 issuer, JWKS, client id/secret
- Use AMQPS for RabbitMQ and TLS for DB/Redis
- Restrict ALLOWED_ORIGINS to production domains

## 2) Run preflight locally/CI
- node scripts/preflight-check.js --env-file .env.production --online
- Fix any FAIL items before proceeding

## 3) Provision dependencies (Railway order)
1. PostgreSQL
2. Redis
3. RabbitMQ
4. OpenEMR
5. Whisper
6. API Gateway

## 4) Deploy services (staging → production)
- Staging deploy (automated on release publish or manual via workflow):
	- API Gateway deploys by default. OpenEMR deploy is gated and only runs when explicitly enabled (see note below).
	- Pages built with staging runtime config.
- Verify staging (see 5). When approved, promote to production via Deploy workflow (environment protection rules).
	- Production deploy uses the same version tag (vX.Y.Z).
	- Images and Pages are re-published for production.

Note — EMR deploy gate:
- The Deploy workflow has an input “deployEmr” (default false). Set it to true to deploy the EMR container alongside the API.
- You can also enable via an environment secret on the target environment: set DEPLOY_EMR=true (or EMR_ENABLED=true).
- If the flag is false/unset, the EMR step is skipped, improving stability if EMR isn’t ready.

## 5) Post-deploy validation
- Verify /health is 200 for API and OpenEMR
- Validate JWKS fetch and OAuth2 login redirect flow
- Smoke test FHIR proxy: GET /fhir/metadata
- DICOMweb proxy (if enabled): HEAD /dicomweb/studies

## 6) Security review
- Confirm structured JSON logs and metrics endpoint enabled
- Confirm rate limiting active
- Verify audit log file path exists and fills entries on user actions

## 7) Frontend runtime
- Ensure PUBLIC_FHIR_BASE and EMR base URLs are correct
- Build and deploy GitHub Pages portal if applicable

## 8) Monitoring & alerts
- Hook logs to your SIEM
- Add uptime checks to /health and /metrics
- Define on-call alerts for 5xx spikes, auth failures, circuit breaker trips

## 9) Versioning & Rollback
- Semantic Versioning via conventional commits; releases tagged vX.Y.Z with changelog.
- Docker images pushed with tags: latest (on main), sha, and vX.Y.Z; deploys pin to vX.Y.Z for reproducibility.
- Rollback steps:
	1. Run the Rollback workflow (Actions → Rollback Deployment) with environment and version (e.g., v1.2.3).
	2. Workflow redeploys API/EMR using GHCR images ghcr.io/<owner>/webqx-<service>:vX.Y.Z.
	3. Optionally redeploy Pages from the release tag using the Deploy workflow.
	4. Validate health and smoke tests post-rollback.

## 10) Environment protection
- GitHub Environments: staging and production.
- Require reviewers for production deployments.
- Store environment-specific secrets: RAILWAY_TOKEN, RAILWAY_PROJECT_ID, API/EMR health URLs, RAILWAY_PUBLIC_API_BASE, RAILWAY_PUBLIC_EMR_BASE.

## References
- docs/railway-production-config.md (authoritative env list)
- scripts/preflight-check.js (fail-fast validation)