# Engine v1 rendering reuse — phone feedback remediation (2026-11-11)

## Physical Android feedback

The Founder's landscape preview screenshots at approximately 1604x720 show a centered 800x450 logical game stage with excessive side margins, and a synthetic world fixture whose event at hub (2,2) fires without a visible NPC sprite. A functioning event script is **not** evidence that an actor was visually composed. Treat both as release-blocking ergonomics defects for the preview APK.

## Existing source reused

- **Engine v1 platform/ScreenAdaptation.js + render/Canvas2DRenderBackend.js**: `framework/viewport.js` is already the Engine v1-derived logical viewport. `enginehost/landscape-layout.js` now adapts logical stage width/height to the usable safe-area aspect instead of always fitting a fixed 800x450 box. Never stretch pixel art independently in X and Y.
- **Engine v1 maps/MapRuntime.js** event locations and lifecycle/visibility concept, plus **render/TilemapRenderer.js** sprite-list concept and **CharacterSpriteRenderer.js** frame/source mapping: the new `framework/map-actors.js` creates purely presentational actor descriptors from existing map event placements and persisted one-time event flags. `framework/session.js` supplies these through its existing `scene.compose({actors})` contract, without modifying the simulation state, save schema, Android historical save namespace, or project-content fingerprints.
- Existing `framework/scene.js` handles validation, atlas rectangles, stable depth sorting and camera clipping. Existing `framework/canvas.js` consumes its validated draw commands. The change connects those capabilities rather than copying a separate renderer.

Source repository: https://github.com/nobleknights015-maker/Plushbound-Legends-mobile/tree/engine-v1-rebuild/engine/src

## Display assets and limits

The installed synthetic engine test has **only two tiny packaged character-sheet frames**, not a library of Bearframe NPC art. `enginehost/boot.js` temporarily binds event IDs `supply`, `mechanic`, and `scout` to a visible, explicitly configured diagnostic `eventMarker` using that existing sheet. This verifies the actor draw channel, **not** finished NPC visuals or the user's eventual game maps. If a project's theme omits a sprite binding, the bridge does not invent art.

One-time event actors disappear only after the durable session records the matching event flag; repeatable event NPCs remain visible. Rendering never writes saves. Explicit actor arrays remain supported for richer scenes.

## Acceptance

Node regressions:
- `tests/engine-v1-map-actors.test.js`: event actor command visibility, one-time completion persistence across restart, absence of invented art, renderer not writing saves and host script packaging.
- `tests/landscape-layout.test.js`: variable logical stage geometry, safe-inset correctness, full-width/full-height landscape area.
- Native Android installed emulator `unified-landscape` route: actual forced landscape orientation, visual bounds and no-scroll navigation; a viewport coverage floor rejects wide unused frame margins.

The latest source checks are not sufficient alone for a release. Require **latest-commit green CI**, a run whose installed Android emulator stage actually executes, and new **physical Moto G 2025** screenshots showing real landscape viewport fit and visible scene event markers. The currently installed prior APK will not include these patches.

## No scope drift

Keep the frozen Sounding Ridge game fixture, historical Rhino saves, and versioned gameplay rules untouched. Do not resume campaign production or import Plushbound game data/assets. Additional Engine v1 modules should be reused when useful, independently and with tests. Full original NPC sprite integration and real-world scene rendering remain later work.
