# Engine v1 reuse audit — Bearframe RPG

Decision date: November 9, 2026 (Central).

Bearframe will **selectively reuse proven, independently authored Engine v1 code**, not merge the whole Plushbound runtime, overwrite the working Bearframe prototype, or start again from scratch. Source: [Plushbound Engine v1 `engine-v1-rebuild` branch](https://github.com/nobleknights015-maker/Plushbound-Legends-mobile/tree/engine-v1-rebuild/engine/src). Source branch contains tested modules and an [Engine v1 freeze-readiness assessment](https://github.com/nobleknights015-maker/Plushbound-Legends-mobile/blob/engine-v1-rebuild/docs/ENGINE_V1_FREEZE_READINESS.md).

## Ported in this pass

| Engine v1 source | Bearframe port | Contract | Limitation |
| --- | --- | --- | --- |
| `platform/ScreenAdaptation.js` + `render/Canvas2DRenderBackend.js` logical viewport | `framework/viewport.js` | aspect-safe viewport, cutout insets, responsive anchors, logical-to-screen touch coordinate mapping | host UI must apply this transform |
| `platform/PerformanceBudget.js` | `framework/performance.js` | rolling FPS/latency, asset/sprite/tile pressure, memory trim guidance | measurements require a real host frame loop |
| `ui/ClassicWindowSystem.js` | `framework/window-layout.js` | paged command/choice, message/help layout, viewport clipping | these are layout *models*, not a rendered menu yet |
| `saves/SaveManager.js` | `framework/save-migrations.js` | validated schema version-chain migration and project ownership protection | migrations require explicit version-specific transform functions; no game-state conversion is invented |

The ports are adapted for the Bearframe engine's CommonJS / direct Rhino execution style, mobile-size defaults, and generic identifiers. They contain no Plushbound game characters, content or artwork. The existing `framework/save-slots.js` continues to own durable synchronous two-slot commits; Engine v1's async storage API must **not** silently replace it.

## Evaluated for reuse, not yet ported

- **AssetManager and content catalog:** useful but rely on asynchronous browser/WebView image loading. Native Bearframe uses Java `Bitmap` objects; implement an explicit Android cache/loader adapter while keeping the manifest validation contract.
- **AudioManager:** contains BGM/BGS/ME/SE transport, bus volumes, fades and adapter calls; its built-in `NullAudioAdapter` does not produce sound. Reuse the channel/track control ideas, but a native Android MediaPlayer/SoundPool (or equivalent) backend and real audio-asset tests are still required.
- **AndroidLifecycle/AndroidHostBridge:** useful responsibilities (Back handling, background saves, memory trim) but composed for the Engine v1 browser/WebView adapter. Bearframe's current application is a **native Java Activity with Rhino and Canvas**, so direct class copying is not a drop-in replacement.
- **ClassicScreenPresentation, TilemapRenderer and EventInterpreter:** richer systems than the small prototype; promising references, but tightly coupled to Engine v1's scene/data contracts. Assess each dependency and port in complete, testable slices instead of copying partial code.

## Acceptance rules for a port

1. Identify original Engine v1 source file and preserve provenance in the new file.
2. Preserve both GitHub repositories; never modify the protected Plushbound baseline to implement Bearframe.
3. Eliminate game-specific world data, assets and identifiers.
4. Add Node regressions and (where portable) Rhino execution tests.
5. Integrate with the new Bearframe Android/renderer/storage boundary only after tests pass.
6. Keep the old Bearframe Android app and Sounding Ridge route as regression fixtures until replacement passes the same force-stop/restart checks.

**Status:** Integration and release testing remain incomplete. This is a reuse audit, not a claim that importing a module finished the engine.
