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
| Deterministic simulation | Unit tests for state, input, combat, map transitions | Basic slice tests in `tests/systems.test.js` |
| Content data loading | Check schema, tile geometry, exit targets, event and foe references | `game/content-validator.js` validation gate |
| Save compatibility | Restart after turn advancement; reject damaged save; future schema migration coverage | Earlier two-process emulator evidence, no migration system yet |
| Android deployment | Checkout-to-APK CI build; fresh Android device install; no private keys in repository | CI added; device acceptance pending |
| Rendering & UI | Sprite layering/animation, scaling, touch gestures, accessibility/legibility | Prototype renderer only |
| Combat framework | Reusable encounters, statuses, abilities, elemental types, enemy behavior and party turns | Single-actor prototype only |
| World & events | Data-driven maps, scripted NPC events, robust collisions, camera and scenes | Three hardcoded sample maps only |
| Progression & inventory | Modular items, equipment, party, quests, character creation, upgrades | Prototype equipment and recruitment only |
| Audio | BGM/SFX scheduling, mixing, mute, pause/resume and asset validation | Not implemented |
| Performance | Frame-time, RAM and thermal profiling on representative Android device | Not measured |
| Stability | Soak tests, resume/rotation, process death, malformed assets, failed save, recovery | Emulator replay only |
| Documentation | Stable module API, asset schemas, build & debugging guide, known limits | Partial |

## Rules for marking work done

1. Keep fixes in small reviewable commits with matching tests and make CI green.
2. Release gate rows turn complete only after code plus observed test/device evidence.
3. Don't erase previous test evidence or rename a prototype to 'complete engine'.
4. Keep all signing materials external to GitHub; CI uses an ephemeral key that cannot update production installations.
5. Preserve existing save compatibility unless a verified migration exists.
