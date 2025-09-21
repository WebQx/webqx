# WebQx EMR — Authoritative Roadmap (READ FIRST)

This document is the single source of truth for scope and priorities. Copilot and contributors must read and adhere to this roadmap BEFORE proposing or making changes.

## Vision
WebQx EMR is a fully rebranded, production-grade healthcare platform built on the latest OpenEMR core, deployed via Railway with Django for secure, HIPAA/GDPR-compliant backend operations.

It features a role-based login system that directs users to tailored experiences:
- Physicians: Provider Panel enriched with OpenAI-powered Telehealth Bot Assistant and Whisper-driven medical transcription.
- Patients: Multilingual Patient Portal combining personalized health records with an AI Health Literacy Assistant.
- Admins: Admin Console for user management, audit logs, compliance workflows, and multilingual identity flows.

The platform uses RabbitMQ for real-time messaging across modules, OpenAI for intelligent automation, and Django to anchor a privacy-first architecture. Goal: scalable, accessible, ethically grounded digital care.

---

## Core Pillars

1) OpenEMR (Rebranded)
- Keep WebQx branding across every page, URL, and login screen
- Maintain compatibility with upstream OpenEMR upgrades
- FHIR R4 endpoints reachable through the API Gateway (proxied securely)

2) Telehealth + Whisper
- Whisper microservice for ambient/structured medical transcription
- Telehealth Physician Bot (OpenAI) integrated with session context
- Audio streaming/recording and consent handling

3) Messaging (RabbitMQ)
- Real-time events between modules (telehealth, portal, admin)
- Durable queues for clinical events (encounters, orders, results)
- Observability for message flow; dead-letter queues

4) Multilingual Templates
- Follow OpenEMR’s multilingual patterns (i18n, locale switching)
- Shared templates and glossaries for clinical flows
- Accessibility first: WCAG 2.2 AA target

5) Compliance (GDPR, HIPAA, ISO 27701-ready)
- Audit trails (access logs, data lineage)
- Data minimization and purpose limitation
- DSAR workflows and export helpers
- Role-based data scoping; pseudonymization where applicable

6) Ops & Deployment
- Django-based ops backend for secure admin operations and audits
- Railway deploy: API Gateway (Node), OpenEMR (PHP/Apache), Whisper svc, RabbitMQ, DBs
- GitHub Pages for the SPA and static content

---

## Architecture (Current + Target)

- Frontend
  - GitHub Pages SPA with runtime-config pointing to Railway backends
  - Patient, Provider, Admin sections; unified top bar and theme

- API Gateway (Node)
  - Security middleware, circuit breaker for remote EMR/FHIR
  - Proxies for OpenEMR and services; observability endpoints

- OpenEMR Service (PHP/Apache)
  - Fully rebranded, lives as its own Railway service
  - MySQL/MariaDB schema with initialization scripts in repo

- Whisper Service
  - Containerized service with health checks and auth

- RabbitMQ
  - Managed service or self-hosted on Railway; events design in docs

- Django Ops
  - Secure ops console for audits, user ops, admin flows

---

## Milestones

M1 — Stabilize Build/Deploy (Short term)
- [x] GitHub Pages deploy
- [x] Railway API deploy
- [ ] Railway EMR deploy (secrets + health check wired)
- [ ] Set `RAILWAY_PUBLIC_EMR_BASE` and ensure SPA integrations

M2 — Telehealth + Whisper
- [ ] Whisper microservice packaged with auth
- [ ] Telehealth physician assistant service endpoints
- [ ] Audio capture, streaming, and consent UI

M3 — Messaging Backbone
- [ ] RabbitMQ service provisioning
- [ ] Event schemas and module adapters
- [ ] Dead-letter and monitoring dashboards

M4 — Multilingual & Accessibility
- [ ] i18n baseline with locale switcher across portals
- [ ] Template parity with OpenEMR patterns
- [ ] WCAG 2.2 AA auditing

M5 — Compliance & Django Ops
- [ ] Audit trail ingestion and visualization
- [ ] DSAR/export flows and RBAC scopes
- [ ] Django ops backend deployed (Railway)

---

## Principles (Must Not Break)

- Security-first: no plaintext secrets, no debug endpoints in prod
- Privacy-preserving defaults; only collect what’s needed
- Maintainability: consistent structure; avoid ad-hoc duplication
- Observability: structured logs, health checks, and metrics for all services
- Backward compatibility for public URLs unless a redirect plan exists

---

## Repo Conventions (for Copilot & Contributors)

- Always check this roadmap before editing core flows.
- Pages SPA uses `config/pages-runtime.json` or CI secrets to set API/EMR bases.
- New services must include: Dockerfile, health endpoint, and minimal README.
- Use GitHub Actions for deploys; do not commit `dist/`.
- For OpenEMR, avoid editing upstream code unless needed for branding or integration; keep patches modular.

---

## Open Questions & Follow-ups

- Finalize Railway env/secret layouts for EMR, Whisper, RabbitMQ
- Decide on managed RabbitMQ vs containerized
- OpenAI model + safety policy guardrails for clinical features

---

Last updated: 2025-09-21
