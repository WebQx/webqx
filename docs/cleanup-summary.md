# Repository Cleanup Summary — Ottehr removal (per ROADMAP)

Date: 2025-09-21
Owner: WebQX Platform

Purpose: Align the repository with the ROADMAP.md by removing off-scope Ottehr artifacts and legacy demo pages. This reduces maintenance surface and avoids confusion, focusing the codebase on OpenEMR, Django Ops, RabbitMQ, Whisper, and compliance pillars.

Removed (source/services/tests):
- patient-portal/components/OttehrOrderManager.tsx
- services/ottehrService.ts
- services/ottehrService.js
- services/__tests__/ottehrService.test.ts

Removed (demos, archived):
- archive/demos/ottehr-demo.html
- archive/demos/ottehr-keycloak-demo.html

Removed (docs):
- docs/OTTEHR_INTEGRATION_GUIDE.md
- docs/KEYCLOAK_INTEGRATION_SUMMARY.md

Env cleanup:
- .env.example: Removed OTTEHR_* variables; generic Keycloak client id and scope (webqx-portal, openid profile email)

Additional tightening (non-functional demos de-emphasized):
- scripts/build-pages.js: exclude demo/ and demo mocks from production Pages build; simplify injections
- scripts/assemble-dist.js: stop copying demo directory
- provider/index.html, portal components: links updated to production routes (index.html#labs, #appt, telehealth/)
- Service worker: removed references to demo-only assets (telehealth-demo.html, api-mock.js, github-pages-integration-patch.js)

Notes:
- No active routes referenced /api/ottehr/* in server; core/server.js already had Ottehr markers removed.
- auth/webqx-login-manager.ts was sanitized to use generic role names (admin, pharmacy, delivery, user) and a generic provider fallback.

Next steps (optional):
- Replace placeholder role strings with generic ones (admin, pharmacy, delivery) across auth/ and docs
- Verify builds: npm run build:pages; commit and push to trigger Pages CI
- Set Railway secrets and deploy OpenEMR; wire RAILWAY_PUBLIC_EMR_BASE for runtime-config
