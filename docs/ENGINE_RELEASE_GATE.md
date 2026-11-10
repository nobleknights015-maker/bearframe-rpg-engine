# Bearframe RPG Engine — engine-first release gate

Status: **development**, not production-ready. Sounding Ridge remains a frozen regression fixture and proof of concept. No new campaign content until the engine framework reaches the agreed v1 criteria. This document does not claim the game engine is finished.

## Invariants

- Bearframe engine is independent of Plushbound Engine v1 and uses original Bearframe assets. No proprietary cartridge images, extracted ROM art or signing keys in Git.
- Every state transition must be deterministic with the same starting state and command; renderers and platform adapters cannot mutate simulation state.
- Saving is committed before the updated Android state is presented. A failed durable save must be made conspicuous and testable.
- Only validated maps, encounters, and event choices may enter a release build.
- Fixes must include automated regressions. A green CI run is necessary but not sufficient for a mobile release.

## Release checklist

| Capability | Minimum acceptance test | Current verified status |
| --- | --- | --- |
| Deterministic simulation | Unit tests for state, input, combat, map transitions | Original game tests plus `tests/framework.test.js` deterministic/fuzz tests; Rhino validation passes |
| Content data loading | Check schema, tile geometry, exit targets, event and foe references | Prototype validator plus portable `framework/schema.js` cross-reference contracts and rejection tests |
| Save compatibility | Restart after turn advancement; reject damaged save; future schema migration coverage | Installed Android emulator two-process restart passed for legacy app; separate `framework/save-slots.js` fail-closed two-slot journal tested; **migration to new runtime not implemented** |
| Android deployment | Checkout-to-APK CI build; fresh Android device install; no private keys in repository | Clean Android CI and two-stage Android 35 emulator test passed; **physical Moto G acceptance pending** |
| Rendering & UI | Sprite layering/animation, scaling, touch gestures, accessibility/legibility | Portable atlas/camera/animation composer, browser Canvas adapter and compiled native Android atlas renderer; **new renderer not connected to Activity** |
| Combat framework | Reusable encounters, statuses, abilities, elemental types, enemy behavior and party turns | Portable single-actor runtime plus separately tested multi-character combat with skills, poison, healing, resistances and turn ordering; **integration into the main RPG state and battle UI outstanding** |
| World & events | Data-driven maps, scripted NPC events, robust collisions, camera and scenes | Legacy three-map prototype; portable framework now validates and runs independent maps/events/exits, but large-map pipeline untested |
| Progression & inventory | Modular items, equipment, party, quests, character creation, upgrades | Portable item/equipment/quest/recruitment effects tested; full party progression and UX not implemented |
| Audio | BGM/SFX scheduling, mixing, mute, pause/resume and asset validation | Portable music/SFX director with pause, mute and channel gains tested in Node/Rhino; **platform playback/mixing adapters outstanding** |
| Controller compatibility | Native Bluetooth/USB gamepad navigation, confirm/cancel, analog deadzones/repeat and platform-neutral mappings | Android KeyEvent/MotionEvent adapter and WebView Gamepad API bridge, 77 total Node tests passing; Android 35 synthetic D-pad/A/B/left-stick emulator route **passed**; Bluetooth/USB physical hardware and remapping acceptance pending |
| Performance | Frame-time, RAM and thermal profiling on representative Android device | Not measured |
| Stability | Soak tests, resume/rotation, process death, malformed assets, failed save, recovery | Android emulator restart replay passed; save-journal fault injection passed; rotation, low-memory and long-running soak tests outstanding |
| Documentation | Stable module API, asset schemas, build & debugging guide, known limits | Portable framework API and release criteria documented; stable public API/versioning and full debugging guides pending |

## Latest CI evidence (November 9, 2026 US Central)

- 58 Node tests passed, zero failed, including simulation fuzz, content contract, rendering, audio scheduling and persistence failure injection.
- Browser and portable engine modules execute in Mozilla Rhino under CI; Android APK and instrumentation APK successfully compile from GitHub checkout.
- Android 35 emulator installed the original prototype APK, passed stage one, force-stopped it, and passed stage two after restart. **The experimental framework is not yet the installed-app runtime.**
- These are *test results*, not a claim of production release readiness.

## Engine v1 selective reuse evidence

The separate [Engine v1 reuse audit](ENGINE_V1_REUSE_AUDIT.md) identifies reusable, tested foundation code on Plushbound's `engine-v1-rebuild` branch. Ports now include `framework/viewport.js`, `framework/performance.js`, `framework/window-layout.js`, and `framework/save-migrations.js`. These replace duplicative reimplementation effort without changing Plushbound or pulling in its artwork.

The latest verified GitHub run at [commit 3c6913a](https://github.com/nobleknights015-maker/bearframe-rpg-engine/actions/runs/42731607407) passed **70 Node regressions (0 failures), Android Rhino compatibility, and clean APK compilation**. The ports remain reusable modules, **not yet hooked to the native Bearframe Activity**, and a new project-state migration still requires actual schema mapping tests.

## Rules for marking work done

1. Keep fixes in small reviewable commits with matching tests and make CI green.
2. Release gate rows turn complete only after code plus observed test/device evidence.
3. Don't erase previous test evidence or rename a prototype to 'complete engine'.
4. Keep all signing materials external to GitHub; CI uses an ephemeral key that cannot update production installations.
5. Preserve existing save compatibility unless a verified migration exists.
