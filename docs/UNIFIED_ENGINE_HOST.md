# Unified Engine Host — Android Integration Checkpoint

The Bearframe platform direction is **one gameplay core** with interchangeable host adapters—not two competing game engines.

## What is now implemented

**Portable engine (`framework/`)**: `runtime.js`, `schema.js`, `session.js`, `save-slots.js`, `scene.js`, `canvas.js`, `audio.js`, `party-combat.js`, `controller.js` and the relevant Engine v1 reuse ports. `createBearframeSession` is the central integration API: one simulation, one synchronous durable-save contract, and one render command format.

**WebView host (`android/src/.../UnifiedEngineActivity.java`)**: native Java wraps a locked-down Android WebView. The page is served only from packaged assets at `https://appassets.androidplatform.net/`, with no Internet permission, a strict page CSP, no file access, no content access, and no remote navigation. The only exposed JavaScript-native methods are scoped `read` and `write`, backed by synchronous `SharedPreferences.commit()`. They accept only the engine save-slot key pattern. No arbitrary Java invocation, network request, or game-rule implementation is part of the bridge.

**Host page (`enginehost/`)**: loads the *same* unmodified `framework/` JS sources used by Node and Rhino tests. It runs the `createBearframeSession` API, composes a scene, draws its atlas frames using Canvas, and commits movement before updating the visible state. The small in-memory texture atlas and `fixtures/engine-project.js` are diagnostic assets only—not new gameplay content or final artwork.

**Existing Rhino Activity**: `ExpeditionActivity` remains the installed launcher and regression baseline while the new host is proven. Its source, saves, and existing Android route are preserved unchanged by this integration. The two activities are not merged into a double-runtime arrangement.

## Verified and pending tests

- Unit: session startup, transactional movement, no-op input, safe rendering, save restart, failure injection, occupied-corrupt-save protection and slot isolation in `tests/session.test.js`.
- Interpreter: the portable simulation and related modules still have their Rhino compatibility checks.
- Android: `RouteRunner` now has two separate WebView engine acceptance stages (`unified-first` and `unified-second`). The first launches the actual offline WebView activity, confirms its renderer and project/session values, moves a tile and confirms a durable save. The second, after `adb shell am force-stop`, checks the exact saved revision and moves back.
- Existing legacy Android stage-one/stage-two restart and controller tests remain required.
- **Physical device testing**, original production art and audio backends, shared save migration from the old prototype, fully polished UI/menu integration, party-combat wiring and launcher promotion are **not completed**.

Do not label the unified Android runtime release-ready until *both WebView emulator stages have passed* and the other requirements in [ENGINE_RELEASE_GATE.md](ENGINE_RELEASE_GATE.md) are verified.

## Promotion gate

1. The real Android WebView test must run the production portable engine with the native save bridge.
2. Shutdown and process-death recovery must preserve journal sequence and state.
3. Both Canvas frames and user actions must be exercised against the installed APK.
4. Legacy saves must be preserved or migrated with tests; no silent overwrite.
5. Regression tests for original gameplay, controller input, touch, and graphics must continue to pass.
6. Browser-based renderer/audio asset adapters must be completed before the engine becomes the default launcher.

This is the integration architecture, not an assertion that the engine is finished.

## Read-only legacy save source bridge — November 10, 2026

The original Rhino `ExpeditionActivity` uses Android `Activity.getPreferences(MODE_PRIVATE)`, whose preferences file is named `ExpeditionActivity`, with a single `expedition` JSON string key. The experimental `UnifiedEngineActivity.NativeSaveBridge.readLegacyExpedition()` now reads **only** that exact old key from the corresponding Android preferences file, with a 1,900,000-character upper bound and fail-closed handling of absent or wrong-type values. It does not accept arbitrary keys or expose any legacy write/remove API. Existing engine journal `read/write` methods still reject `expedition`.

The installed-APK emulator stage `unified-legacy` seeds a source snapshot matching the frozen legacy v1 schema, checks exact byte-for-byte JS bridge transport, verifies legacy values and the separate unified journal remain unchanged, and rejects missing/wrong-type source data. This is a **read-only transport gate**, not a mapping or successful migration claim. A reviewed field-by-field adapter into a compatible project schema, explicit import UI/consent, conflict/rollback testing and physical-device migration remain release blockers. Keep the original launcher and saves unchanged.

## Historical save v1 schema inspection

`framework/legacy-save-v1.js` now provides a read-only, strict decoder for the original Rhino `ExpeditionActivity` JSON envelope, including original identity, finish, location, position, HP/charge, equipment, flags, battle and prompt. It rejects malformed data, unknown future fields, impossible value ranges and inconsistent flag combinations. The installed offline WebView loads this validator and its `unified-legacy` stage checks a real native source read against it. Node regressions compare fixture snapshots against the frozen original engine's `restore()`.

**Important boundary:** structural validation is not tile/world validation and is not import approval. No new-runtime save mapping exists yet; an actual migration still requires full legacy restore validation, a reviewed target project mapping that preserves progress, user-directed opt-in, and Android rollback acceptance. This code does not read legacy source automatically at startup or write either source or destination.

## Opt-in v2 party-combat WebView integration checkpoint

The offline Android/browser host now packages `framework/party-runtime.js`, `framework/party-combat.js`, `fixtures/party-engine-project.js` and `enginehost/party-probe.js`. A small touch-accessible **engine diagnostic**, not a new game demo, uses the normal `createBearframeSession` to begin a synthetic encounter and commit party rounds in the separate `bf:framework-party-test:v2:diagnostics` journal. The v1 framework diagnostic, legacy Rhino launcher, and old `expedition` save remain isolated. A dedicated Rhino interpreter smoke test exercises the same opt-in v2 runtime.

Android installed `unified-party-first` and `unified-party-second` stages click the actual WebView controls, verify the rendered battle-status text and committed party turns, force-stop between stages, then require an exact v2 mid-battle restore and further durable turn. This verifies the combat *integration path*, **not** a finished tactical menu, multi-actor command selection UX, production battle animations, equipment balancing or physical device acceptance. The engine release gate remains OPEN.

## Portable party command selection diagnostic — November 10, 2026

`enginehost/party-ui.js` now builds a small DOM-accessible **engine-only** command panel for each living party actor. It lists skills with MP affordability, limits healing/guard/damage target choices appropriately, and submits one complete round through `BearframeHost.party.submit(orders)`. The UI cannot mutate gameplay state directly: it receives a clone of the canonical battle view and the runtime validates/commits all decisions atomically. All controls have accessible names and mobile-sized selection targets.

The installed `unified-party-choice` emulator route selects `pulse` rather than default strike via the actual WebView DOM controls, verifies the enemy target and persisted MP decrement, and checks the original diagnostic journal stays untouched. This is synthetic combat UI coverage, not release-grade menus, artwork or complete controller accessibility acceptance. 

## Read-only legacy source archive flow

The experimental Android host now offers explicit, separate buttons for historical save inspection and confirmation of a **lossless backup archive**. The Android bridge can only read the old `ExpeditionActivity/expedition` value; `framework/legacy-archive.js` writes the original bytes into an isolated versioned engine journal and verifies readback. Existing source saves remain unchanged, and old-game progress made after archival does not overwrite the archived snapshot. No archive or migration occurs during startup; the new host does not replace the old launcher.

The `unified-archive-first` / `unified-archive-second` installed Android emulator stages verify UI consent, source isolation, durable readback after process death and detection of changed legacy bytes. **Do not interpret an archive as conversion to a playable world state.** That still needs a versioned project-specific mapping and acceptance on a real device.

## Non-destructive playable historical compatibility session

When the user explicitly confirms a previously verified original Rhino archive,
`framework/legacy-compat.js` can now copy the exact old-save state to an
independent `bf:legacy-expedition-compat:v1:session:{a,b}` journal. This
compatibility adapter uses the **unchanged original** `game/world.js` and
`game/engine.js` rules packaged into the restricted offline WebView at
`/enginehost/legacy/`. It is **not** a conversion to the newer portable
project's incompatible event/combat mechanics. The original launcher/save key
is never written or erased. The UI provides separate inspect, explicit import
confirmation, resume, old-style movement, prompt choices and combat commands;
all gameplay transitions commit synchronously before UI presentation.

On failure or when returning to the old launcher, the original historical save
still exists at its import-time progress. New progress made inside the isolated
compatibility journal does **not** automatically update the old launcher. A
verified cross-engine migration to the canonical runtime, exported recovery
for new compatibility progress, and physical-device acceptance remain distinct
open gates. No new game content was developed.
