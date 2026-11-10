# Bearframe Engine Kit: portable core v0.2 (experimental)

This directory is a new **game-independent** simulation and rendering contract. It does not use Plushbound code or cartridge-derived game content and is not yet the default engine used by the Sounding Ridge Android app. The legacy prototype remains an immutable regression reference while the new foundation is validated.

## Modules

- `framework/schema.js` — validates a complete project definition, cross-references, map geometry, exits, event scripts, items, enemies, quests and game rules.
- `framework/runtime.js` — deterministic pure state machine. No DOM, I/O, timers or platform APIs. State owns its PRNG seed. Use `fresh()`, `step()`, `view()`, `serialize()` and `restore()`.
- `framework/save-slots.js` — two-slot durable save journal with rolling checksum, readback verification, stale-write rejection and recovery from a corrupted latest slot.
- `framework/save-import.js` — explicit two-phase, non-destructive source-to-journal import contract; mandates a reviewed source decoder and target mapper and rejects occupied destinations.
- `framework/legacy-save-v1.js` — strict, read-only historical Rhino v1 snapshot envelope decoder/inspector. It does not map source fields or authorize migration.
- `framework/session.js` — **canonical host-facing runtime** integrating `createBearframeEngine`, the durable save journal, and `createBearframeSceneComposer`. A host calls `start`, `resume`, `dispatch`, `snapshot`, and `compose`; `dispatch` never presents a simulation update before the journal confirms a durable commit.
- `android/src/dev/bearframe/ridge/UnifiedEngineActivity.java` — internal, offline Chromium WebView host serving only packaged engine scripts, with a synchronous, namespace-restricted native Android save adapter.
- `enginehost/index.html` and `enginehost/boot.js` — Android/browser diagnostic host for this same session, **not game story content**.
- `framework/scene.js` — independent presentation composer with atlas metadata verification, tile culling, camera tracking, actor depth ordering and tick-driven sprite animation.
- `framework/canvas.js` — browser Canvas adapter that validates all atlases before painting and renders without pixel smoothing.
- `android/src/dev/bearframe/ridge/AtlasSceneRenderer.java` — native Android Canvas adapter for the same scene commands; compiles with the APK but is not connected to the current Activity.
- `framework/audio.js` — deterministic transport/controller for BGM and SFX, including playback cues, pause/resume, mute and separate bus gains. It does not load or play sound files itself.
- `framework/party-combat.js` — independent, deterministic party-versus-enemies round simulation with configurable skills, MP costs, speed ordering, elemental resistance, guard, healing, poison, and terminal draw handling. This module is **not yet hooked into the main RPG runtime**.
- `fixtures/engine-project.js` — synthetic engine fixture for tests (not intended as Bearframe canon).

## Example (Node)

```js
const project = require('../fixtures/engine-project');
const createEngine = require('./runtime');
const createSave = require('./save-slots');
const engine = createEngine(project);
let state = engine.fresh('New Frame', 123);
state = engine.step(state, { type: 'move', dir: 'right' });
state = engine.step(state, { type: 'choose', id: 'collect' });
// For Android, commit synchronously before displaying the new state.
const storage = {
  read: key => prefs.getString(key),   // supply platform adapter
  write: (key, value) => prefs.commit(key, value) === true
};
const journal = createSave(engine, storage, 'bearframe:slot-1');
const result = journal.save(state);
if (result.ok) present(engine.view(state));
else showSaveFailure(result.reason);
```

This snippet illustrates the integration contract; `prefs`, `present` and `showSaveFailure` are host-provided functions, **not** included APIs.

## Engine project definition

A project has `id`, `start:{map,x,y}`, `maps`, `events`, `items`, `foes` and `quests`. Each map contains rectangular `rows` using `#` for collision and `.` for walkable cells; `exits` map coordinate keys (`"x,y"`) to `{map,x,y}`; `events` map coordinates to event identifiers; `encounters` map coordinates to foe identifiers. Event choices may trigger `flag`, `give`, `take`, `heal`, `charge`, `battle`, `quest`, `recruit`, `message` or `warp` effects. References and argument ranges are checked before the engine starts.

Optional `rules` configure `playerHp`, `playerCharge`, `baseAttack`, `pulseBonus`, `pulseCost`, `guardReduction`, `foeBurstBonus`, `foeVariance`, and `victoryXp`. Unsupported rules are rejected. Default behavior remains compatible with the framework fixture.

## Persistence and invariants

The runtime never writes to disk. A host must **commit** via a synchronous adapter before presenting a new game state, and must surface errors. The journal alternates two revision-checked slots, validates a checksum and actual deserialization, and recovers the latest valid revision. It does not claim transactional durability if a storage adapter lies about writes or the underlying filesystem loses both slots. The checksum is designed for corruption detection, **not** authenticity or encryption.

Persist the same `project.id` and schema version for compatible saves. Future state/schema changes require deliberate migrations and corresponding tests. Changing rules, content, or IDs without versioning can alter behavior even if a previous save deserializes. Maintain stable IDs and migrate explicitly. Multiple player save slots require distinct namespace prefixes. A newly created game must not silently overwrite a prior saved campaign.

## Rendering contract

Create a scene composer with a pixel-art theme containing `tileSize`, `clearColor`, `atlases`, `tiles.floor`, `tiles.wall`, and `sprites.player`. Other sprites are optional and referenced by actors. Every atlas and sprite frame is bounds-checked. `compose(view,{width,height,tick,actors})` returns deterministic `clear` and `sprite` commands; it never accesses images, a Canvas or an Android renderer. The renderer supplies loaded atlases by `imageId`, draws source rectangles at destination rectangles without smoothing, and clips to the viewport.

This intentionally supports original multi-frame sprite art and scalable maps instead of locking game content to the prototype's hand-coded shapes.

## Commands and tests

```bash
node --test tests/*.test.js
# GitHub Actions additionally runs Rhino tests, clean Android compilation
# and an optionally triggered installed-app two-process emulator replay.
```

The experimental framework now runs end-to-end in a separate Android WebView Activity, verified by a two-process emulator test; it has **not replaced the shipping Rhino Android launcher**. No claim of a polished final engine, actual audio playback/mixing, production save migration, large-map streaming, full party AI, release-grade touch ergonomics, or real-device thermal profiling is made here.

## Historical save compatibility limitation

The original installed Android game's saved `expedition` JSON is not a `framework/runtime.js` state. The new read-only native source bridge and historical v1 decoder can inspect it, but **cannot yet convert a real campaign without losing world-specific progress**. The generic importer requires an explicit source key, `decode`, `map`, target engine and empty journal. `inspect()` never writes; `commit()` rejects changed sources and occupied destinations. Production migration needs a compatible project schema, a reviewed complete field mapping, original legacy `restore()` validation, an explicit user action, and installed-device rollback tests.

## Opt-in party-combat integration — engine v2 development checkpoint

A game-neutral project may opt into `project.partyCombat` with validated skill, protagonist, ally and enemy actor templates. The **existing canonical `framework/runtime.js`** then uses `framework/party-runtime.js` to drive `framework/party-combat.js` from normal project encounter and event effects, with one shared engine state, sequence counter, PRNG and two-slot journal. Commands are `{type:'party-round',orders:[{actor,skill,target},...]}`. Invalid orders are no-ops; a valid round is durably committed by the regular `framework/session.js` before being displayed.

For save compatibility, the opt-in capability requires **runtime state version 2**; projects without it retain the exact v1 state shape and behavior. Recruited ally HP/MP carries between encounters in `allyStats`. Active encounter, status, resistance and order data live inside `partyBattle.encounter`, which is serialized and restored atomically with the world state. The synthetic `fixtures/party-engine-project.js` exercises this contract without campaign/game content.

**Not production-ready yet:** the optional Android WebView combat UI/installed-party-restart stage, whole-party progression and equipment policy, target-device acceptance, migration of old game saves and release-grade combat balancing remain open. Do not enable this capability on an existing v1 project without a reviewed migration and new journal namespace.
