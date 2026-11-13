# Bearframe Engine — Landscape UI and Canvas Performance Acceptance

Status: engine-only PR #22 checkpoint; NOT production ready.
Production movement remains FOUR cardinal directions. Existing saves, the original Rhino launcher, the offline WebView boundary, and native 32×32 tiles are unchanged.

## UI acceptance

- The JRPG command menu pages five entries at a time, leaving room for controls at least 44 logical stage pixels high.
- Check actual post-transform touch targets on the Moto G (2025): logical stage dimensions alone do not guarantee physical finger-target dimensions.
- Visible pagination has an aria-live page count; stale, hidden, disabled and detached controls remain noninteractive.
- Battle confirm, previous/next, Options, equipment, and close buttons must be legible and reachable without scrolling.

## Read-only Canvas optimisation

The canonical world always composes a deterministic scene. The presentation painter can omit only an identical GPU canvas draw, comparing ordered clear colours, atlas IDs, source/destination rectangles, logical/canvas dimensions, immutable loaded atlas object identity, dimensions, readiness and source URL. All packaged atlas images are assumed immutable after decode.

Atlas eviction, trim, draw errors, canvas context loss/restoration, deterministic pixel audits, and explicit invalidation force repaint. It never dispatches gameplay commands or writes the save journal.

BearframeHost.snapshotJson() exposes scenePaint counters: paints, skipped, invalidations, failures, skipRatio, averageDrawMs, maxDrawMs and drawsOver16ms. These are WebView draw timings, NOT measured compositor FPS, full-frame input latency or actual Moto G performance.

## Automated gates

1. Node regression tests verify identical scene reuse, animated art, camera shifts, pixel command mutation, resizing, atlas swaps, preflight failures, and memory recovery.
2. Installed Android 35 presentation-clock instrumentation calls BearframeHost.renderCacheAudit(), verifies that two identical deterministic frames produce one cache skip and no additional draw, and verifies that the durable RPG revision is unchanged.
3. Clean Android build, Rhino checks, full emulator two-process save suite, and post-merge CI must all be green at the release commit.

## Remaining physical-device gates

- Run on Moto G (2025) with all owner game art and four-direction controls in both landscape rotations. Test thumb reach, actual button bounds, insets and controller focus.
- Measure steady idle, busy maps, long-scrolling scenes, battle/menu frame delivery, memory/PSS and thermal drift. A 16ms redraw request is NOT evidence of 60fps.
- Run at least 30 minutes of movement, combat, inventory paging, process background/restore, native low-memory trim, audio-focus changes and save verification.
- Verify original audio media, four-facing canonical character art, SAF file import/export, signed upgrade/rollback without save loss.

Do NOT close engine Issue #1 or claim engine-v1 release-ready until those remaining requirements have tested evidence.
