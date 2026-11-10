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

## Historical save compatibility and explicit original-rule mode

An original Rhino `ExpeditionActivity/expedition` JSON snapshot is **not** a `framework/runtime.js` project state. The supported path runs a **copy** of historical progress with the original frozen `game/engine.js` rules in a separate compatible two-slot journal. It supports explicit archive/confirmation, original-rule movement/combat and restart, current-progress original-format JSON export, and direct file import with a second confirmation. The original launcher save is untouched and remains independently playable. This avoids unsafe field-only conversion to the portable engine's different combat/event semantics.

Node, Android emulator process-death and same-signed APK replacement acceptance are verified. Physical target-device, real external picker and production-signed version upgrade remain open. See [save compatibility](SAVE_COMPATIBILITY_STATUS.md). The generic `save-import.inspect/commit` mapper remains a separate opt-in interface; an actual conversion into a *different* gameplay project's rules still needs full behavioral parity evidence.

## Opt-in party-combat integration — engine v2 development checkpoint

A game-neutral project may opt into `project.partyCombat` with validated skill, protagonist, ally and enemy actor templates. The **existing canonical `framework/runtime.js`** then uses `framework/party-runtime.js` to drive `framework/party-combat.js` from normal project encounter and event effects, with one shared engine state, sequence counter, PRNG and two-slot journal. Commands are `{type:'party-round',orders:[{actor,skill,target},...]}`. Invalid orders are no-ops; a valid round is durably committed by the regular `framework/session.js` before being displayed.

For save compatibility, the opt-in capability requires **runtime state version 2**; projects without it retain the exact v1 state shape and behavior. Recruited ally HP/MP carries between encounters in `allyStats`. Active encounter, status, resistance and order data live inside `partyBattle.encounter`, which is serialized and restored atomically with the world state. The synthetic `fixtures/party-engine-project.js` exercises this contract without campaign/game content.

**Not production-ready yet:** the optional Android WebView combat UI/installed-party-restart stage, whole-party progression and equipment policy, target-device acceptance, migration of old game saves and release-grade combat balancing remain open. Do not enable this capability on an existing v1 project without a reviewed migration and new journal namespace.

## Historical gameplay equivalence proof is separate from save-field mapping

`framework/legacy-parity.js` supplies an **independent, read-only** step-by-step audit of the old Rhino `step()` against the canonical new runtime, using an explicit old-command → new-command mapping and the existing reversible state mapper. It compares the entire historical snapshot **after** each command. The probe never writes to a journal, cannot itself grant migration permission, refuses empty/no-changing scenario suites, and returns the first mismatched scenario.

The frozen synthetic migration fixture currently **fails** gameplay parity for historical equipment actions and combat, even though its stored fields round-trip successfully. A future migration UI must not enable playable conversion merely because the saved JSON is valid. Complete approval requires the real target project's world/event/combat rules to match every supported progression state, followed by explicit opt-in and Android/device validation. The original launcher remains authoritative until then.

## Data-driven events, equipment and quest panel (Android host diagnostic)

The generic DOM panel `enginehost/runtime-panels.js` reads the canonical
`session.snapshot().view` (which provides **copied** `inventory`, `equipment`
and `quests` alongside existing `weapon` and `prompt`). It renders choices
from the validated project's event catalog, equip/unequip/use actions based on
the item catalog, and current quest stage text. All actions are submitted as
ordinary `session.dispatch` commands, with the same save-before-display
guarantee. Interactions are disabled during combat or another pending prompt.
The synthetic diagnostic host demonstrates this contract without introducing
new game content. This is not a final production-grade menu.


## Immutable project and presentation configuration snapshots

At construction, `createBearframeEngine(project)` and
`createBearframeSceneComposer(project, theme)` validate and capture independent
JSON snapshots of their input. They validate the copied project again before
using it. This prevents later changes to the caller's map geometry, event
choices/effects, item stats, enemies, party actor templates, skills, or
presentation atlas/animation metadata from silently changing the behavior of
an existing engine or renderer. The original caller objects are **not**
frozen or modified; a newly constructed engine may use a revised project.
The existing v1/v2 state and journal formats are unchanged.

Do **not** interpret this as a cross-version content migration guarantee:
constructing a *new* engine with a different project definition under the
same project ID could still change how a saved game behaves. Explicit project
schema/version binding remains an open release requirement.
