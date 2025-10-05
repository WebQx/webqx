# Deployment Readiness Update (Public Demo Hub)

Date: 2025-10-05
Target Version: v0.1.0 demo hardening

## ✅ What Was Added (Public Demo Experience)
- Standalone demo pages (patient, provider, telehealth, transcription) decoupled from legacy hub
- Build hash + timestamp injected into each footer (`build-info.js`) for freshness verification
- Latency histogram parsed and rendered as ASCII bars (Prometheus histogram buckets)
- /health vs /emr/status diff logic (not yet visually placed — add `<pre id="healthAdapterDiff">` to surface)
- Patient data source badge (api vs synthetic) clarifying fallback state

## 🔐 Safety / Data
- All patient data synthetic when adapter/patient list empty
- No PHI or secrets present in pages; only public-safe headers, health metadata, latency metrics

## 📁 Pages Directory Strategy
The GitHub Pages configuration should use Branch: `main` Folder: `docs`.
This makes files under `docs/` available at the site root path, e.g.:
```
https://<org>.github.io/EMR/patient.html     -> docs/patient.html
https://<org>.github.io/EMR/provider.html    -> docs/provider.html
```
(If you instead choose root `/`, you must move or duplicate the HTML pages & assets out of `docs/`.)

## 🌐 Primary Demo URLs (Expected After Pages Config)
| Feature | URL (after enabling Pages on /docs) |
|---------|-------------------------------------|
| Landing / Index | https://webqx.github.io/EMR/ |
| Patient Demo | https://webqx.github.io/EMR/patient.html |
| Provider Demo | https://webqx.github.io/EMR/provider.html |
| Telehealth WS | https://webqx.github.io/EMR/telehealth.html |
| Transcription Placeholder | https://webqx.github.io/EMR/transcription.html |
| Metrics Snapshot | https://webqx.github.io/EMR/metrics.html |
| Environment | https://webqx.github.io/EMR/env.html |
| System Status | https://webqx.github.io/EMR/system.html |
| Security Headers | https://webqx.github.io/EMR/security.html |
| FHIR Probe | https://webqx.github.io/EMR/fhir.html |
| Rate Limit Probe | https://webqx.github.io/EMR/rate-limit.html |
| Dependencies | https://webqx.github.io/EMR/dependencies.html |

## 🔄 Verification Steps (Manual)
1. Enable Pages: Settings → Pages → Source: `main` → `/docs` → Save.
2. Wait 1–3 minutes.
3. Run:
   ```bash
   curl -I https://webqx.github.io/EMR/patient.html
   curl -s https://webqx.github.io/EMR/patient.html | grep -i "Patient Demo" || echo MISSING
   ```
4. Open patient page; confirm footer includes: `commit <short_hash>` + UTC timestamp.
5. Click Patients → verify badge shows `api` if adapter returns list; otherwise `synthetic`.

## 🛠 Optional UI Placement (Future Quick Patch)
Add these blocks to any page to surface new logic immediately:
```html
<pre id="healthAdapterDiff" style="font-size:.55rem;background:#0e1419;border:1px solid #1f232c;padding:.6rem .7rem;margin-top:1rem;border-radius:6px;max-height:200px;overflow:auto"></pre>
<pre id="histogramOut" style="font-size:.55rem;background:#0e1419;border:1px solid #1f232c;padding:.6rem .7rem;margin-top:.75rem;border-radius:6px;max-height:200px;overflow:auto"></pre>
```
Trigger metrics load (if not already) with a button wired to `loadMetrics()`.

## 🚨 Rollback Simplicity
All demo enhancements are additive. To revert to pre-standalone state:
```
git revert 1e73382..HEAD
```
(Generates revert commits without force-push.)

## 🧪 Health / Smoke Checklist
| Check | Command | Expected |
|-------|---------|----------|
| Gateway health | `curl -s https://webqx-production.up.railway.app/health` | JSON `status` key |
| Adapter status | `curl -s https://webqx-production.up.railway.app/emr/status` | JSON adapter field |
| Metrics slice | `curl -s https://webqx-production.up.railway.app/metrics | head` | Prometheus text |
| Pages patient | `curl -I https://webqx.github.io/EMR/patient.html` | 200 OK |

## 📌 Next Recommended Micro Enhancements
- Insert diff & histogram panels visually
- Consolidated footer component / style normalization
- README “Freshness Verification” snippet (commit + timestamp grep)
- Basic jest run before next tag

---
**Status:** Ready for GitHub Pages enablement.
