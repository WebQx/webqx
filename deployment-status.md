# Deployment Report — 2025-09-21

- Trigger: chore(deploy): update DEPLOY_STATUS.md and trigger Pages build (c4182ee)
- Range: ef7fe89..c4182ee
- Workflows:
  - Deploy to GitHub Pages — SUCCESS ➜ https://github.com/WebQx/EMR/actions/runs/17899780491
  - Backend Deploy (Railway) — Triggered (monitor in Actions)
- Artifact: dist/ generated locally via `npm run build:pages` (SPA + static)
- Runtime config: config/pages-runtime.json used, emitted runtime-config.js
- Pages URL: https://webqx.github.io/EMR/

Notes:
- Jest tests currently failing locally due to @jest/transform resolution under Node 22; deployment does not depend on tests.
- dist/ is gitignored; Pages build happens in CI using the same script.
