# Bearframe RPG Engine — v1 Feature Contract (Draft)

**Contract ID:** `bf-engine-v1-draft.1`  
**Status:** DRAFT / ENGINE RELEASE GATE OPEN. This is not a shipping engine specification or game release.  
**Scope:** Reusable Android-first, offline JRPG engine only. No campaign, characters, lore, or artwork production.

## Runtime ownership and compatibility

The engine has **one canonical gameplay state machine** (`framework/runtime.js`) and one host-facing session contract (`framework/session.js`). World commands, event effects and optional party-combat rounds must be deterministic for the same project, state, command and PRNG seed. A successful state change must be synchronously committed through `framework/save-slots.js` and independently read back before the host presents the new state. The renderer, sound adapter, input adapter and scene composer do not own authoritative gameplay state.

- **Legacy runtime state v1**: Existing portable project states without `project.partyCombat`. Their `version:1` payload, journal namespace and command semantics are preserved.
- **Opt-in party-combat state v2**: Projects explicitly providing `project.partyCombat` use `version:2` and embed party encounters and ally resources in the same state/journal. There is no automatic v1→v2 conversion.
- **Original Rhino game saves**: The old `ExpeditionActivity/expedition` snapshot is playable under a *separate original-rule compatibility session* after explicit archive, preview and consent. Continued progress can be externally exported as original-format JSON and recovered directly into an empty compatibility journal, with Android emulator restart/reinstall coverage. The original launcher save remains untouched. This is **not** a state conversion to the newer portable engine's different event/combat rules, and physical-device acceptance remains open.
- **Platform**: Android API 28+ is the current build baseline; GitHub CI uses Android 35 emulator. Offline WebView is experimental. Rhino is retained as the compatibility/regression launcher only.
- **Distribution**: CI APKs use disposable signing keys, are non-production test artifacts, and do not establish an update path for an already installed app.

## Public-facing engine API candidates (subject to compatibility freeze)

| Contract | Portable entrypoint | Release intention | Current evidence |
| --- | --- | --- | --- |
| Content validation | `validateEngineProject(project)` | Fail closed on invalid maps, exits, items, foes, events and rules | Node/Rhino regressions; content test fixture |
| State transitions | `engine.fresh/step/view/restore/serialize` | Deterministic, serializable, data-driven | Node fuzz, Rhino and synthetic Android WebView |
| Session + persistence | `session.start/resume/dispatch/snapshot/compose` | Synchronous durable commit before display | Two-slot failure injection, emulator two-process restart and 320-move soak |
| Renderer commands | `scene.compose` + Canvas adapters | Deterministic, pixel-snapped sprites, culling and layering | Node and installed synthetic atlas pixel tests |
| Assets | version 1 manifest, cache, offline packager | Path/type/dimension/byte checks, safe memory trim and rehydrate | Node, signed-APK pack and installed WebView decode |
| Controller | portable mapping + native adapter | Touch, keyboard, gamepad navigation/action mapping | Synthetic Android gamepad; physical Bluetooth/USB pending |
| Audio | director + HTMLMediaElement adapter | Music/SFX, pause/resume, bus gain, audio focus | Node lifecycle/race tests, installed offline WAV decode; focus/device output pending |
| Party battle (opt-in v2) | `party-round` command through the **same session** | Speed, MP, status, resistance, target selection and persistence | Node/Rhino tests and installed synthetic party diagnostic; full UX and progression pending |
| Save import / original-rule compatibility | `save-import.inspect/commit` and isolated `legacy-compat.inspectFile/commitFile` | Explicit preview and consent, never erase source, reject occupied targets | Node/installed Android emulator legacy archive, gameplay, file import/export/restart and same-signed APK replacement; migration into different game rules and real-device testing still open |

Commands, project schemas and journal versions must be frozen and semantically versioned before `v1.0.0`. A green test against a synthetic fixture is **not** proof of compatibility with untested original game data.

## Minimum v1 release acceptance

1. **API & schemas:** Explicit versioned project schema, actor/party/combat interfaces, asset manifest, command vocabulary and migration path, plus actual backward compatibility tests.
2. **Runtime:** Fully integrated maps/events, inventory/equipment, party combat and progression, scripted UI and audio; verified deterministic replay, malformed-input refusal, fault handling and saves.
3. **Android:** Clean checkout builds/signs installable APK with published reproducible instructions; final WebView host replaces the experimental test only after the original launcher/save migration or rollback is verified.
4. **Device tests:** Real Moto G 2025 or documented equivalent target-class Android device, touch/controller ergonomics, readable UI in portrait/landscape, backgrounding, rotation, renderer exit, memory pressure, actual audible output/focus, frame-time, RAM, thermals and extended soak.
5. **Assets:** Original licensed/provenance-tracked media through the validated manifest and signed APK pipeline, bounded memory use with fail-closed decoding and replacement compatibility tests.
6. **Evidence:** Links to green Node/Rhino CI, installed-app emulator acceptance, target-device test logs, known-limit review, and issue #1 evidence. Zero critical open regressions.

## Exclusions and non-claims

This contract does **not** include Bearframe story development, playable campaign expansion, visual asset production, copyrighted ROM content or reverse-engineered third-party source inclusion. Synthetic test maps and sprites are strictly engineering fixtures. Actual Android frame-rate and thermal measurements have **not** been collected from a physical target device. Installed WebView renderer-termination callback simulation is not equivalent to an OS-induced renderer crash. Engine v1 must remain **not production-ready** until every acceptance line above has supporting evidence.

Development ownership and evidence tracking: [issue #1](https://github.com/nobleknights015-maker/bearframe-rpg-engine/issues/1), [release gate](ENGINE_RELEASE_GATE.md), [API](FRAMEWORK_API.md), [Android host](UNIFIED_ENGINE_HOST.md), [assets](ASSET_PIPELINE.md).
