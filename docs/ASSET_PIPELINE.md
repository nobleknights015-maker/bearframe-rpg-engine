# Bearframe Engine Kit — asset pipeline contract

Status: **engine integration verified in Node and Android WebView diagnostics; not final campaign content**.

## Scope and provenance

This is the reusable loading/caching layer adapted from Chris's own [Plushbound Engine v1 AssetManager](https://github.com/nobleknights015-maker/Plushbound-Legends-mobile/blob/engine-v1-rebuild/engine/src/assets/AssetManager.js). The Bearframe implementation lives in `framework/asset-manifest.js` and `framework/asset-cache.js`. It is not coupled to any game map, character, spritesheet, art generation service, or dialogue.

The production model is:

1. The **project** supplies a versioned manifest of original art and audio IDs, paths, expected dimensions, and preload flags.
2. The **portable validator** rejects malformed, duplicated, remote, or traversal paths, mismatched type/extensions, unsupported keys, and unreasonable image sizes.
3. The **host loader** retrieves approved packaged files, verifies dimensions, and keeps a memory-bounded LRU cache with in-flight de-duplication.
4. The **scene composer** emits atlas IDs and source/destination rectangles, without fetching or decoding art itself.
5. The **platform renderer** verifies every texture before drawing; missing or corrupt textures fail visibly rather than presenting an incomplete frame.

## Local manifest format

```js
const manifest = {
  version: 1,
  assets: {
    terrain: {
      type: 'atlas', path: 'assets/terrain.webp',
      width: 384, height: 768, pixelArt: true, preload: true
    },
    player: {
      type: 'atlas', path: 'assets/player.png',
      width: 256, height: 256, pixelArt: true
    },
    fieldTheme: {
      type: 'music', path: 'assets/music/field.ogg', bytes: 640000
    }
  }
};
```

Allowed types: `atlas`, `image`, `music`, `sfx`. Images support PNG, WebP and JPEG; audio supports OGG, WAV and MP3. Paths must be relative inside the packaged app, not HTTP URLs, `..` traversal, absolute paths, or scripts. Atlases/images must declare their pixel dimensions, which the loader checks against the decoded image. The runtime memory estimate for images is `width × height × 4` bytes. A manifest may contain no more than 4,096 asset entries.

## Android offline packaging

The internal `UnifiedEngineActivity` runs a restricted local WebView origin `https://appassets.androidplatform.net`. It loads `enginehost/index.html` and approved static assets from the APK, with no Internet permission or general filesystem access. `enginehost/boot.js` now uses `createBearframeAssetCache` to load PNG textures through the browser's image decoder before any scene is drawn. The browser adapter and Android WebView use the same manifest/caching API.

The two tiny files in `enginehost/fixtures/*.png.b64` are deterministic, synthetic test atlases. `android/build.sh` decodes them during packaging and verifies their SHA-256 hashes. They exist solely to prove that the installed Android WebView reads actual packaged PNG files, decodes them, validates dimensions, and renders pixels from them. **They are not final game graphics or production assets.**

## Failure and memory handling

- Repeated concurrent loads share one in-flight request; failures clear the pending entry and may be retried.
- Invalid atlas dimensions cause a rejected load, and the host reports failure without drawing a partial scene.
- Cache bounds apply to both entry count and estimated bytes. The least recently used entries are discarded under pressure.
- Calling `clear()` invalidates pending cache insertions from old requests, avoiding stale repopulation during a scene transition.
- Missing critical art does not destroy save data; the engine's authoritative state remains separate from rendering and its journal is unchanged.
- Browser loading is asynchronous; all game-state saves remain synchronous and verified by the native save bridge.

## Acceptance evidence and open work

`tests/asset-cache.test.js` covers manifest rejection, local path safety, dimension mismatches, concurrent loading, LRU eviction, memory budgets and async invalidation. `tests/framework-rhino.js` checks the manifest contract in the legacy interpreter. Android's installed-app `RouteRunner` tests that **two packaged atlases are actually loaded** and verifies the expected first pixel of the Canvas frame from the real PNG. The existing dual-process save/restart tests are retained.

Further work before engine-v1 release: manifest tooling that packages user-supplied original art with asset IDs, per-scene dependency groups and mobile memory-pressure callbacks, load-time telemetry, asset replacement and compatibility validation, audio decoding/playback, and physical-device performance under large original art sets. None of those items is represented as completed.

## Memory-pressure cache control (November 10, 2026)

The portable cache exposes `trimTo(targetBytes)` for a host-managed low-memory policy. It evicts decoded resources in least-recently-used order until the resident estimate is within the requested target, returning the number evicted and remaining estimated bytes. The target must be a nonnegative integer no larger than the configured cache budget. `trimTo(0)` performs a critical purge using `clear()`, invalidating in-flight insertions so late image decodes cannot silently repopulate memory. This changes only cached resources, **not** engine simulation or saves. Node regressions cover LRU ordering, budget validation, and critical-pressure races.

**Integration still required:** Android `onTrimMemory` delivery to the WebView, safe asset rehydration before the next Canvas frame, and real-device memory profiling. Until those exist, this is a tested cache primitive, not a completed Android low-memory acceptance gate.
