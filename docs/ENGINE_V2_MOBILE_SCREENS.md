# Bearframe Engine — v2 mobile screens and controller integration

**Status:** engine-only integration checkpoint; not a shipping release.

The Android WebView integration fixture now uses three mutually exclusive,
accessible interface tabs: World, Party & inventory, and Save. UI selection
remains presentation state, and cannot increment or rewrite the canonical
world journal. The engine phase resolver automatically directs focus to
pending dialogue choices, selectable party abilities, or movement controls,
without choosing anything on behalf of the player.

## Code changes

- `enginehost/screen-navigation.js`: validates tab/panel relationships,
  tracks the active panel, implements touch, keyboard roving and event-driven
  focus without modifying the simulation
- `enginehost/input-host.js`: accepts semantic directional/confirm/cancel,
  tab, menu, map and save commands and routes through visible DOM controls
  or the canonical v2 `navigate` method; no secondary save state
- `UnifiedEngineActivity.java`: now uses `ControllerInputRouter` for
  standard native gamepad buttons/joystick, resets held state on pause
  and renderer crash, and forwards only JSON-quoted semantic actions to
  the restricted offline WebView. Existing original Rhino launcher unchanged
- New Android instrumentation tests use real installed WebView tab controls
  and v2 native gamepad routing across separate Android process launches
- Node regressions verify read-only tab changes, focus transitions, invalid
  semantic refusal, party and save screen actions, and native wiring contracts

## Acceptance still required

1. Latest installed Android CI must pass **with emulator enabled**, not
   only Node/Rhino/clean APK compilation. The native input test is new
   and must not be reported complete before that result exists.
2. Physical Moto G 2025 button/touch/controller testing, portrait/landscape,
   OS process removal, system audio, frame pacing, memory/thermals.
3. Production UI and content/API versioning, reliable original-to-engine
   save migration, supported signing and upgrade/rollback strategy, and
   real-world audio/assets/provenance.

Original game saves and the existing Rhino regression game remain untouched.
Continue engine-only development under
[issue #1](https://github.com/nobleknights015-maker/bearframe-rpg-engine/issues/1).
