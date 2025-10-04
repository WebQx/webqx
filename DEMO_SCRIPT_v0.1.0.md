# WebQX v0.1.0 Demo Script

> Purpose: Provide a concise, repeatable walkthrough demonstrating platform readiness, security posture, interoperability scaffolding, and future extensibility using ONLY v0.1.0 capabilities + synthetic placeholders (no PHI).

## 0. Prep Checklist (1 minute before demo)
| Item | Action | OK? |
|------|--------|-----|
| Railway Deployment | Open https://webqx-production.up.railway.app/health in a tab |  |
| GitHub Pages Hub | Open https://webqx.github.io/EMR/ in a tab |  |
| Clear Cache (optional) | Hard refresh hub page to show skeleton/loading |  |
| Bandwidth | (Optional) DevTools -> Throttle "Fast 3G" for performance narrative |  |
| Talking Points | Security, Synthetic Data, Extensibility |  |

## 1. Opening (30–45 sec)
1. Display Hub: https://webqx.github.io/EMR/
2. Say: "This is the public, zero-PHI showcase of the WebQX healthcare platform v0.1.0. All data is synthetic or structural metadata."
3. Click Refresh on "Gateway Health" and open the overlay (Open). Highlight unified health JSON + dependency structure.
4. Transition: "We establish trust first: health, adapter fallback, and rate limiting are already live."

## 2. Adapter & Patients (45–60 sec)
1. Open Patients overlay.
2. Click Fetch (if not already loaded). Explain fallback: "Adapter not deployed? We degrade gracefully with clearly marked synthetic dataset—no broken UI."
3. (If using patient.html) Show search filtering.
4. Talking point: Caching layer + future real Medplum connection (roadmap mention).

## 3. Metrics & Observability (45 sec)
1. Navigate to Metrics page.
2. Click Refresh.
3. Show truncated Prometheus output + parsed latency histogram placeholder.
4. Say: "Metrics exported in industry-standard format—drop into Grafana instantly; histogram powering SLO dashboards next phase."

## 4. Real-Time / Telehealth (60 sec)
1. Open Telehealth page.
2. Note status badge then enable auto‑ping.
3. Show latency updates (avg stabilizing) and send a custom message.
4. Narrative: "WebSocket channel already isolated at gateway, optional token gating, ready for session signaling + transcription overlay."

## 5. Security & Headers (30 sec)
1. Open Security page.
2. Fetch headers; call out CSP, HSTS (if present), defensive defaults.
3. Emphasize layered rate limits + body size and future JWT/mTLS roadmap.

## 6. Environment & System Insight (30 sec)
1. System page → show runtime snapshot.
2. Environment page → highlight only non-sensitive flags displayed.
3. Talking point: "Operational transparency without secret leakage."

## 7. FHIR & Interop Placeholder (30–45 sec)
1. FHIR page: Run capability probe.
2. Explain fallback if upstream is unreachable: "Consistent UI even during partial outages."
3. Roadmap: HL7 transformer + authenticated resource explorer coming in Phase 2.

## 8. Rate Limiting Behavior (30 sec)
1. Open Rate Limit page.
2. Run burst test; show sequential timings.
3. Messaging: "Protects platform from abusive polling; tunable per route class."

## 9. Dependencies View (30 sec)
1. Dependencies page: Quickly narrate gateway vs adapter vs optional providers.
2. Roadmap layering: queue, tracing (OpenTelemetry), document sync.

## 10. Wrap (30 sec)
1. Return to Hub overlay (Health) for visual anchor.
2. Summarize pillars: "Secure boundary, structured observability, graceful degradation, synthetic-safe demo, modular expansion path."
3. Call to action: adoption pilot / integration sandbox access.

---
## Key Talking Points Cheat Sheet
| Theme | Bullet | Phrase |
|-------|--------|--------|
| Trust | Health + fallback | "No broken panels—degrade, don’t fail" |
| Safety | Synthetic only | "Synthetic-first until credentials provisioned" |
| Observability | Prometheus + structured logs | "Day-1 production introspection" |
| Extensibility | Adapter layer | "Interchangeable EHR connectors" |
| Real-Time | WebSocket baseline | "Low-latency channel ready for clinical streaming" |
| Security | CSP + rate limits | "Principle of least privilege from the edge" |
| Roadmap | FHIR depth, documents, resilience | "Each phase adds depth without rewrites" |

---
## Objection Handling
| Objection | Response |
|-----------|----------|
| "Why no real patients?" | Compliance-first: synthetic until BAA + credential injection; adapter contract already proven. |
| "Can it scale?" | Stateless gateway, horizontal adapter pattern; metrics & future tracing ready for autoscaling decisions. |
| "Where’s auth?" | Optional SSO hooks downgraded to warnings for public demo; JWT + RBAC enforcement queued in Phase 2/3. |
| "What about documents?" | Nextcloud WebDAV integration scaffolded; synchronization API surfaces next iteration. |
| "Offline / resilience?" | Fallback endpoints and structured health mapping baseline for future circuit breakers. |

---
## Phase Roadmap Snapshot (Condensed)
1. v0.1.0 (Now): Health, metrics, WS channel, synthetic dataset, security baseline.
2. v0.2.x: FHIR resource explorer, authenticated adapter, encounter timeline, basic orders.
3. v0.3.x: Document sync, circuit breakers, tracing (OTel), audit enrichment.
4. v0.4.x: Real-time transcription overlay, presence, care team tasks board.

---
## Improvement Backlog (Outside Scope of Live Script)
- FHIR resource viewer (type + id fetch UI)
- Encounter timeline visualization
- Appointment scheduling mock + slot holds
- ASCII / spark charts for latency & risk distribution
- Guided multi-step tour overlay system
- HL7 → FHIR transformer UI
- PHI redaction toggle demonstration

---
## Demo Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Upstream adapter offline | Fallback JSON clearly labeled “synthetic” |
| Slow network | Pre-open health endpoint; rely on cached DNS + CDN for static assets |
| WebSocket blocked | Show metrics & rate limit flows; skip telehealth step gracefully |
| Metrics endpoint lag | Display truncated early lines first while parsing rest client-side |

---
## Script Timing Summary
| Segment | Target Time |
|---------|-------------|
| Opening | 0:45 |
| Patients | 0:55 |
| Metrics | 0:45 |
| Telehealth | 1:00 |
| Security + Env/System | 1:00 |
| FHIR + Rate Limit + Dependencies | 1:45 |
| Wrap | 0:30 |
| TOTAL | ~6:40 (can compress to ~4:30) |

---
## One-Line Value Statement
"WebQX delivers a production-aligned, security-forward EMR integration layer with real-time channels and observability from day one—without exposing a single PHI record in the demo phase."

---
## Optional Short Pitch Variant (60s)
"This is WebQX v0.1.0: live gateway health & metrics, synthetic-safe patient fallback, real-time WebSocket channel, security headers enforced, and Prometheus observability built-in. We’ve proven the adapter contract; next steps are authenticated FHIR depth, document sync, and tracing. Everything here degrades gracefully—no broken glass."

---
*End of Script.*
