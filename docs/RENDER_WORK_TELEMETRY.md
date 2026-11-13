# Bearframe Engine — Android WebView render-work telemetry

Engine-only QA checkpoint. This is not a production frame-rate or performance certificate.

## Live measurements

The offline WebView loads the existing Engine v1-derived `framework/performance.js` budget. After a successful deterministic scene compose plus Canvas draw/skip, the host records elapsed JavaScript work time in a bounded 120-frame sliding window. Failed/blocked paints are excluded. Once every 60 successful presentations it checks loaded image count, visible actor count and visible tiles against the reusable balanced profile.

`BearframeHost.snapshotJson()` reports `renderWork` alongside `scenePaint`, covering sampleCount, averageMs, p95Ms, overBudgetRatio, longFrames, pressure and memoryWarnings. The host also exposes `renderBudget.snapshot()` for installed instrumentation. These diagnostics NEVER alter the canonical game journal.

**Interpretation:** The inherited `renderWork.health.fps` is `1000 / average work milliseconds`, a CPU-work theoretical reciprocal and not actual display, animation or compositor FPS. Use `averageMs`, `p95Ms`, `overBudgetRatio` for cost comparisons instead. Likewise, `scenePaint.averageDrawMs` only covers Canvas API draw execution, not scene composition, GPU presentation, layout, thermal effects or input latency.

## Acceptance

- Node tests verify bounded samples, profile pressure and required host/native integration.
- Android 35 installed-app instrumentation must confirm finite scene-work samples during the live presentation clock while preserving the save journal and successful cache audit.
- A green clean Android build, Rhino tests, unit regressions and two-process emulator are required before merging. This does not close physical testing.

## Still missing on physical Moto G (2025)

Measure sustained 30-minute exploration, menus, combat, real 2,944-asset pack behavior, decoded-image memory/PSS, real compositor frame pacing (p50/p95/p99), gesture latency and thermal throttling. Confirm both landscape orientations and controller/Save behavior. Production signing, update/rollback, and physical Storage Access Framework file import/export remain open.

**Do not equate a clean emulator or low CPU work cost with a production-ready engine.**
