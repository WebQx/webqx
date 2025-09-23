# Release and Deployment Process

This repo uses conventional commits and semantic-release to produce versioned releases with changelogs and environment-gated deployments.

## 1. Everyday development
- Create feature branches from `main`.
- Use conventional commits (feat, fix, chore, docs, refactor, perf, test).
- Open a PR to `main`. CI runs unit tests and (optionally) e2e.

## 2. Merge to main
- Merging to `main` triggers the Release workflow.
- semantic-release analyzes commit messages, updates CHANGELOG.md, tags a release (vX.Y.Z), and publishes a GitHub Release.

## 3. Staging deployment
- The Deploy (Staging & Production) workflow listens to releases or can be run manually.
- It deploys the backend (Railway services) and Pages with the staging environment configuration.
- Health checks run against configured staging URLs.

## 4. Production promotion
- After staging validation, re-run the Deploy workflow with `environment=production`.
- Production deployments require approval (GitHub environment protection).

## 5. Rollback
- Use the Rollback workflow to redeploy a previous tag (vX.Y.Z) to staging or production.
- The workflow checks out the tag and redeploys services and Pages from that snapshot.

## Secrets and environment variables
- Configure per-environment secrets in GitHub Environments:
  - `RAILWAY_TOKEN`, `RAILWAY_PROJECT_ID`
  - `API_HEALTH_URL`, `EMR_HEALTH_URL`
  - `RAILWAY_PUBLIC_API_BASE`, `RAILWAY_PUBLIC_EMR_BASE`

## Notes
- Docker image versioning can be extended to publish `vX.Y.Z` tags to GHCR (build step on release).
- Avoid overlapping deploy workflows—use this documented flow for consistency and auditability.