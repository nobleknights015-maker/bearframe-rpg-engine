# Engine-only v2 world/UI consolidation — November 10, 2026 (Central)

**Status: development; engine v1 release gate OPEN.**

This checkpoint is based on the independent portable engine; it does not
merge projects with Plushbound, resume Sounding Ridge campaign development,
change the original Rhino launcher or import a game save without consent.

## Implemented

- Connected the opt-in v2 world session to the existing
  `framework/session.js` scene composer and packaged PNG Canvas renderer.
  The rendered canvas derives only from the canonical v2 view; no secondary
  simulation state, clock or save namespace was introduced.
- Added a dedicated, responsive v2 world D-pad and synthetic WebView panel for
  world events, physical shared inventory, equipment slots, deterministic
  party rounds, XP growth and skill unlocks.
- Added a shared party roster status panel showing HP/MP, combat attributes,
  effects and progression directly from the cloned world/battle view.
- Paused scene-dependent touch actions when the required offline atlases are
  not ready; Android native memory-trim recovery reloads and redraws without
  committing simulation commands.
- The legacy v1 world now focuses/scrolls toward an event choice or combat
  control when an interaction blocks D-pad movement. No auto-choice is made.
- Tests cover v2 scene packet/pixel changes, failed-save rollback, same
  serialized state after process restart, native trim, and a synthetic
  progression + second-actor recruitment/gear-transfer route.
- Latest optional asset-cache safeguards reject invalid capacity budgets.

## Evidence and constraints

- [Canvas restart emulator CI 42940715109](https://github.com/nobleknights015-maker/bearframe-rpg-engine/actions/runs/42940715109): passed the actual installed Android 35 pixel-change/force-stop canvas stage.
- [Mobile action-focus emulator CI 42940942358](https://github.com/nobleknights015-maker/bearframe-rpg-engine/actions/runs/42940942358): passed installed Android 35 world event/combat route.
- Earlier native trim and recruitment test attempts identified **test harness mistakes** (numeric JS hash formatting and one extra post-battle movement), corrected by commits `59212be` and `b841e41`. Their initial failing CI runs are not evidence of product acceptance.
- Current head requires a *fresh full Android emulator run*. A green build where the KVM/emulator stages were **skipped** is insufficient. The marker `[emulator]` on the checkpoint commit explicitly requests that acceptance path.

## Still open (no unsupported completion claims)

- Physical Moto G 2025 touch/D-pad/controller ergonomics, actual hardware
  graphics, rotation and background recovery; an emulator pass cannot verify
  the user's earlier device-specific control complaint.
- Production-grade party screen composition, engine/API stability freeze,
  save schema migration, signed upgrade/rollback, real Android SAF picker
  behavior, original/provenance-tracked media, audio output/focus and
  memory/thermal/frame-time soak on target hardware.
- The new v2 world remains a **synthetic integration diagnostic**, not
  the shipping launcher. Old saves stay isolated and preserved.

See [issue #1](https://github.com/nobleknights015-maker/bearframe-rpg-engine/issues/1),
[release gate](ENGINE_RELEASE_GATE.md) and [engine feature contract](ENGINE_V1_FEATURE_CONTRACT.md).
