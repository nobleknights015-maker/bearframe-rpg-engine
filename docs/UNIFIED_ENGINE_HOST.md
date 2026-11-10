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
