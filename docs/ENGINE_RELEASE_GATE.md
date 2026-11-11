# Bearframe RPG Engine — engine-first release gate

Status: **development**, not production-ready.

**Versioned capability baseline:** [Engine v1 draft feature contract](ENGINE_V1_FEATURE_CONTRACT.md). It is not the final API freeze or a claim of release readiness. Sounding Ridge remains a frozen regression fixture and proof of concept. No new campaign content until the engine framework reaches the agreed v1 criteria. This document does not claim the game engine is finished.

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
| Asset manifest and cache | Reject unsafe paths, validate image bounds and bytes, cache/evict safely, load packaged textures | Versioned `framework/asset-manifest.js` and `framework/asset-cache.js` with tests; actual PNG atlases loaded by WebView diagnostics; large original art and device memory-pressure trials pending |
| Save compatibility | Restart after turn advancement; reject damaged save; import/export and recover a verified original-format save without overwriting either active namespace | **Original-rules compatibility mode verified** in installed Android 35 emulator: user-consented exact-byte original archive, isolated playable copy, original-rule combat, restart, original-format continued export, missing-only restore, direct file import to a fresh compatible journal and force-stop recovery. **Not** a migration to newer and behaviorally different portable RPG rules. Physical Android document-picker, target-class device, and update/rollback release acceptance remain outstanding. |
| Android deployment | Checkout-to-APK CI build; fresh Android device install; no private keys in repository | Clean Android CI; legacy Rhino and new unified WebView two-process recovery validated on Android 35 emulator; **physical Moto G acceptance pending** |
| Rendering & UI | Sprite layering/animation, scaling, touch gestures, accessibility/legibility | Portable atlas/camera/animation composer and Canvas adapter now execute inside a restricted offline Android WebView Activity; native Canvas adapter remains available; **final art/UI integration pending** |
| Combat framework | Reusable encounters, statuses, abilities, elemental types, enemy behavior and party turns | Portable single-actor runtime plus separately tested multi-character combat with skills, poison, healing, resistances and turn ordering; **integration into the main RPG state and battle UI outstanding** |
| World & events | Data-driven maps, scripted NPC events, robust collisions, camera and scenes | Legacy three-map prototype; portable framework now validates and runs independent maps/events/exits, but large-map pipeline untested |
| Progression & inventory | Modular items, equipment, party, quests, character creation, upgrades | Portable item/equipment/quest/recruitment effects tested; Android host renders original engine event choices, inventory/equip/use and quest stage through the canonical durable session; [installed Android 35 emulator test 42844472493](https://github.com/nobleknights015-maker/bearframe-rpg-engine/actions/runs/42844472493) passed two-process scripted choice/equip/unequip/quest recovery (200/200 Node regressions). Full party progression, character creation, balance and release UX still not implemented |
| Audio | BGM/SFX scheduling, mixing, mute, pause/resume and asset validation | Portable BGM/SFX director tested in Node/Rhino; offline HTMLMediaElement playback adapter added with Node regression coverage; **Android WebView playback, audio-asset integration and real-device validation still pending** |
| Controller compatibility | Native Bluetooth/USB gamepad navigation, confirm/cancel, analog deadzones/repeat and platform-neutral mappings | Android KeyEvent/MotionEvent adapter and WebView Gamepad API bridge, 77 total Node tests passing; Android 35 synthetic D-pad/A/B/left-stick emulator route **passed**; Bluetooth/USB physical hardware and remapping acceptance pending |
| Performance | Frame-time, RAM and thermal profiling on representative Android device | Not measured |
| Stability | Soak tests, resume/rotation, process death, malformed assets, failed save, recovery | Android emulator restart replay passed; save-journal fault injection passed; rotation, low-memory and long-running soak tests outstanding |
| Documentation | Stable module API, asset schemas, build & debugging guide, known limits | Portable framework API, native WebView integration, host adapter and release gates documented; stable public API/versioning and full debugging guides pending |

## Latest CI evidence (November 9, 2026 US Central)

- 58 Node tests passed, zero failed, including simulation fuzz, content contract, rendering, audio scheduling and persistence failure injection.
- Browser and portable engine modules execute in Mozilla Rhino under CI; Android APK and instrumentation APK successfully compile from GitHub checkout.
- Android 35 emulator installed the original prototype APK, passed stage one, force-stopped it, and passed stage two after restart. **The experimental framework is not yet the installed-app runtime.**
- These are *test results*, not a claim of production release readiness.

## Engine v1 selective reuse evidence

The separate [Engine v1 reuse audit](ENGINE_V1_REUSE_AUDIT.md) identifies reusable, tested foundation code on Plushbound's `engine-v1-rebuild` branch. Ports now include `framework/viewport.js`, `framework/performance.js`, `framework/window-layout.js`, and `framework/save-migrations.js`. These replace duplicative reimplementation effort without changing Plushbound or pulling in its artwork.

The latest verified GitHub run at [commit 3c6913a](https://github.com/nobleknights015-maker/bearframe-rpg-engine/actions/runs/42731607407) passed **70 Node regressions (0 failures), Android Rhino compatibility, and clean APK compilation**. The ports remain reusable modules, **not yet hooked to the native Bearframe Activity**, and a new project-state migration still requires actual schema mapping tests.

## Unified Android engine integration (November 9, 2026 Central)

The [unified engine host](UNIFIED_ENGINE_HOST.md) now packages the **same** portable engine modules under `framework/` inside a locked-down Android Chromium WebView. A native `SharedPreferences.commit()` bridge provides synchronous durable journal access; Android and WebView have no independent gameplay rule implementations.

The installed APK passed Android 35 emulator tests at [CI run 42737252607](https://github.com/nobleknights015-maker/bearframe-rpg-engine/actions/runs/42737252607). In `unified-first`, the app started the WebView core, composed a Canvas scene, advanced to sequence 1, and durably saved `hub (1,2)`; after `am force-stop`, `unified-second` reloaded sequence 1 and advanced to sequence 2 at `hub (1,1)`. The original Rhino gameplay restart and gamepad checks also passed. [CI run 42737405555](https://github.com/nobleknights015-maker/bearframe-rpg-engine/actions/runs/42737405555) additionally passed **83 Node tests, zero failures**, including damaged-save overwrite protections.

**Still open:** The new Activity is intentionally not the launcher, and the diagnostic test project is not Bearframe campaign content. Production map/art imports, actual Android/browser audio playback, full integrated party battle presentation, migration of existing game saves, device-specific performance/thermal tests, rotation and long-running soak checks are required for a release. Do not mark the engine finished on the strength of this integration test alone.

## Verified engine-only asset loading checkpoint (November 9, 2026 Central)

The [asset pipeline contract](ASSET_PIPELINE.md) now describes a reusable image/audio manifest validator, Engine v1-derived asynchronous LRU cache, local packaged-file loader, and fail-closed image-dimension checks. Android's unified WebView host no longer paints synthetic in-memory textures: it loads real PNG atlas fixtures from its APK before drawing the canvas. The fixtures are synthetic test data, not game art.

[CI run 42740510268](https://github.com/nobleknights015-maker/bearframe-rpg-engine/actions/runs/42740510268) passed **90 Node tests (0 failures)**, Rhino compatibility, and a clean signed Android build. An explicit installed-app emulator rerun on the updated code is required before marking all Android integration checks verified; the CI commit carrying this note requests that run.

## Rules for marking work done

1. Keep fixes in small reviewable commits with matching tests and make CI green.
2. Release gate rows turn complete only after code plus observed test/device evidence.
3. Don't erase previous test evidence or rename a prototype to 'complete engine'.
4. Keep all signing materials external to GitHub; CI uses an ephemeral key that cannot update production installations.
5. Preserve existing save compatibility unless a verified migration exists.

## Browser audio lifecycle regression checkpoint (November 9, 2026 Central)

The offline HTMLMediaElement host adapter now serializes overlapping command batches so UI and lifecycle requests cannot reorder music stop/play transitions. Failed music autoplay cleans up the active element; disposal blocks queued playback commands. Three new deterministic Node regressions exercise these races. The adapter remains an isolated host component: Android WebView audio playback, packaged audio fixtures, audio-focus handling and physical-device verification are **not yet proven**. The engine release gate remains open.

## Offline WebView audio integration checkpoint — November 9, 2026 Central

The portable `framework/audio.js` director is now connected to the `framework/audio-browser.js` HTMLMediaElement adapter through an isolated `enginehost/audio-probe.js` gesture-triggered diagnostic. `scripts/generate_audio_fixture.js` generates a deterministic original 8 kHz/16-bit mono silent WAV, packaged under the WebView's own `enginehost/audio/diagnostics/` directory. The host CSP permits `media-src 'self'` only; remote media remain blocked. This probe is separate from gameplay state and does not alter the legacy launcher, saves, or campaign.

`tests/audio-probe.test.js` covers WAV byte structure/determinism, local media path, non-autoplay behavior, browser rejection cleanup, CSP and build packaging wiring. **Do not mark audio complete** until the installed Android WebView actually decodes/plays the packaged fixture, audio-focus/lifecycle and real music/SFX behavior are tested, and physical-device audio acceptance passes. The new tests and APK build require CI verification.

## Native WebView audio delivery hardening — November 9, 2026 Central

The earlier audio probe was blocked by an Android-side response CSP mismatch: the HTML meta policy allowed `media-src 'self'`, but `UnifiedEngineActivity.asset()` independently set a response policy without a media directive, causing `default-src 'none'` to govern audio. The native response now explicitly permits **same-origin packaged audio only**, preserving `connect-src 'none'` and the offline security boundary. The response also provides correct WAV/OGG/MP3 MIME types instead of generic binary data. `tests/audio-probe.test.js` now verifies the native response policy and MIME contract. This is a source-level and CI build regression; actual WebView playback and device audio-focus/lifecycle tests are still **not verified**. Legacy launcher and save data are untouched.

## Offline audio lifecycle hardening — November 9, 2026 Central

The diagnostic audio probe now suspends by stopping and disposing all active HTML media, and foreground recovery creates a fresh backend **without autoplay**. Browser blur/focus, page visibility, and Android Activity onPause/onResume route to this behavior. The native WebView itself now receives onPause alongside the existing host suspension call. This is isolated from the deterministic simulation and native save journal; the original Rhino launcher is unchanged. Added Node regression cases for background cancellation, pending playback, foreground user-gesture requirement and native lifecycle wiring.

**Still pending:** installed-APK Android emulator lifecycle acceptance, actual audio decoder/playback confirmation, audio focus and headset routing, original music/SFX, and physical-device testing. The audio release gate remains OPEN.

## Installed WebView audio decoder acceptance (November 10, 2026 Central)

An additional Android instrumentation stage, `unified-audio`, now launches the **actual installed offline WebView** and asks Chromium's HTMLMediaElement to load and decode the packaged original synthetic WAV. It requires a positive finite media duration, fails on media decode errors or timeout, and does not trigger audible playback or modify any save. The Android emulator CI workflow now invokes this stage independently of the existing two-process save-recovery tests. `tests/audio-probe.test.js` includes a regression guarding the instrumentation and CI wiring.

Commits: `05cc7faf` (instrumentation), `637b9c1c` (CI stage), `203930dd` (Node regression). **Verification pending:** the Android emulator job must pass this stage before counting media decoding as verified. Even then, actual audible output, audio focus, device-specific codecs, physical device and all other engine release criteria remain OPEN.

## Stronger installed-WebView audio decode gate — November 10, 2026 Central

The earlier `unified-audio` stage accepted `loadedmetadata`, which establishes duration but **does not prove that PCM samples are available for playback**. The Android instrumentation now requires `loadeddata`, `readyState >= HAVE_CURRENT_DATA`, and a nonempty positive-duration buffered range. Invalid duration, media error and timeout remain explicit failures; Node regression guards these checks. This is an engine-only verification change, with no legacy launcher or save modifications.

**Important CI distinction:** a green standard push run can skip the Android emulator entirely. Only a run where the installed-app emulator step actually executes and passes can validate this gate. The associated `[emulator]` commit requests that installed-app run. Even successful decoded-media acceptance does **not** establish audible playback, audio focus, physical device acceptance, or overall engine completion.

## Two-phase legacy save import foundation — November 10, 2026 Central

Added `framework/save-import.js` as an **opt-in, non-destructive migration transaction**. A caller must explicitly provide a source key, read-only legacy decoder, game-specific mapping function, portable engine and target two-slot journal. `inspect()` validates and stages an import without writing anything. `commit()` checks that the legacy bytes are unchanged and that the destination remains completely empty (including unreadable occupied slots), then writes through the existing durable journal and verifies the recovered state. No automatic migration is performed; source data is never deleted or overwritten. Six Node regressions cover successful import, occupied/corrupted destinations, changed sources, invalid mappings, failed writes and invalid configuration.

**Still OPEN:** Real legacy Rhino save-format decoding, project-specific state mapping and compatibility tests, Android SharedPreferences source bridge and installed-device migration/rollback verification. This foundation is deliberately not wired into the launcher or production save keys. [CI for implementation and tests](https://github.com/nobleknights015-maker/bearframe-rpg-engine/actions/runs/42804729999) must pass before treating the code as verified.

## Read-only Rhino save compatibility checkpoint — November 10, 2026 Central

The existing native Rhino launcher still saves a v1 JSON snapshot in its Activity-local `ExpeditionActivity` preferences under the exact `expedition` key. Without changing that launcher or its saved bytes, the experimental offline WebView now has an exact-key, **read-only** `readLegacyExpedition()` native bridge. Engine-owned `read/write` remain restricted to separate `bf:...` two-slot namespaces. A portable `framework/legacy-save-v1.js` decoder validates known historical envelope fields and rejects incompatible/corrupt data; `framework/save-import.js` requires explicit opt-in and a project-specific mapper before any journal write.

**Acceptance evidence:** [commit e27947e / Android 35 run 42806318423](https://github.com/nobleknights015-maker/bearframe-rpg-engine/actions/runs/42806318423) and [commit fce8a01 / Android 35 run 42806671152](https://github.com/nobleknights015-maker/bearframe-rpg-engine/actions/runs/42806671152) each completed green Node and Android jobs, including installed `unified-legacy` readback/isolation, corruption rejection, existing legacy restart/gamepad and unified WebView routes. Those results verify transport and historical schema inspection, **not** migration.

**Still OPEN:** ensure the actual legacy `restore()` world/tile validation runs prior to mapping; ship an engine-owned compatible target project/schema preserving location, equipment, battle, quest and flags; implement explicit user-directed import plus reversible rollback on Android; then test upgrade and downgrade with real device saves. Do not auto-import, overwrite legacy sources, promote the new WebView host to launcher, or mark this release gate complete.

## Installed offline WebView save/restart soak — November 10, 2026

A new installed-APK `unified-soak-first` emulator stage exercises **256 consecutive durable runtime transitions** as 128 reversible movement cycles in the existing synthetic engine fixture, checking the journal's exact sequence and position every 16 moves. After Android `am force-stop`, `unified-soak-second` must restore the exact revision 256 from on-device `SharedPreferences`, commit 64 additional transitions and finish at revision 320 with both journal slots valid. The instrumentation reports observed elapsed milliseconds, but neither this emulator timing nor its short soak replaces physical Android performance, thermal, rotation or hours-long reliability acceptance. No game content, legacy launcher or saved source is changed.

## Installed Android Activity recreation regression — November 10, 2026

The experimental WebView now has an installed Android 35 instrumentation route `unified-recreate`: it starts from an empty diagnostic journal, commits a movement to sequence 1, invokes the real Activity `recreate()`, waits for a **new Activity instance**, verifies the offline scene atlases and journal restore exactly at sequence 1, then commits a second movement at sequence 2. A failure blocks the CI emulator job. This isolates lifecycle recovery from story content and does not alter `ExpeditionActivity` or legacy saves. **This is not a forced physical orientation change or physical Moto G acceptance**; landscape/portrait transitions, accessibility, RAM/thermal profiling and prolonged device testing remain OPEN.

## WebView renderer-process recovery — November 10, 2026

The experimental `UnifiedEngineActivity` now handles `WebViewClient.onRenderProcessGone` by detaching and discarding the defunct WebView and constructing a fresh **restricted, offline** WebView that reopens the existing Android durable journal; the recovery callback does not mutate gameplay or legacy preference data. Recovery attempts are bounded to two per Activity, after which a visible fail-closed message instructs a restart instead of repeatedly relaunching a crashing renderer.

Installed Android 35 CI `unified-renderer` deterministically invokes the real WebViewClient callback, validates replacement of the WebView, restoration of previously committed sequence/position and packaged art, then commits a second movement. This establishes callback-path acceptance only: an actual OS-induced renderer crash under memory pressure, physical Moto G acceptance and hours-long reliability still require separate validation.

## Android audio-focus wiring checkpoint — November 10, 2026

The experimental WebView now uses a narrow `BearframeAudioFocus` interface to Android `AudioManager`, through `AudioFocusRouter.java`. Its focus request occurs only when the user presses the offline audio diagnostic play control; failure prevents playback. Rejection, background/blur, renderer disposal and Activity destruction release focus. On a platform focus-loss callback, the host suspends audio, and focus gain **does not autoplay**. This alters no world state or saved data.

The installed Android 35 emulator stage `unified-focus` requests focus through the real native bridge, checks repeat request and release semantics, and verifies unchanged durable journal. Passing the emulator will demonstrate native API wiring only, not speaker output, call interruptions, Bluetooth compatibility or physical Moto G measurements. Those remain OPEN.

## Explicit old-save recovery archive (compatibility preservation)

`framework/legacy-save-v1.js` now refuses historical snapshots located on blocked or out-of-world tiles, checking the frozen original geometry. The original game's `restore()` is still the reference for gameplay semantics. `framework/legacy-archive.js` implements a separate **opt-in**, exact-byte recovery journal at `bf:legacy-v1-archive:v1:backup`, using the current two-slot corruption and readback protection. Inspecting never writes; a separate user action confirms archival after rechecking the source, target occupancy and source identity. The original `ExpeditionActivity/expedition` key is *never* written or removed. Existing valid or malformed archive slots cannot be overwritten; archived bytes can still be recovered if the old launcher subsequently changes its save.

An Android-only internal diagnostic exposes distinct **Inspect** and **Confirm separate backup** controls and does not run either automatically. Installed Android 35 emulator routes `unified-archive-first` and `unified-archive-second` validate a real historical snapshot, require explicit UI confirmation, compare the archived byte string with the original, force-stop/restart, verify exact readback, and simulate later old save changes without replacing the archived copy. **This is lossless preservation/rollback protection, not a playable new-engine save conversion.** A complete, reviewed mapping of all original state to a compatible gameplay project and physical-device upgrade/downgrade acceptance remain BLOCKED; do not promote the new launcher.

## Android phone-friendly external backup export

The experimental host now offers an **Export verified backup JSON** button after successful archival. Its native `LegacyArchiveExport` adapter revalidates the isolated save journal's envelope, checksum, origin and historical raw payload, then opens Android's `ACTION_CREATE_DOCUMENT` system file picker. The user chooses the destination; no general storage permissions or legacy preference writes are granted. Cancelling or failing the picker keeps the original and internal archive unchanged. The installed emulator recovery stage confirms that a verified archive becomes eligible for export, and regression checks guard the native wiring. **Actual document provider selection and resulting file contents still require manual physical-device acceptance**. Do not uninstall the existing app or use disposable CI-signed APKs as an upgrade path: app-private backup data is not guaranteed to survive uninstall.

## Native missing-save restoration from external JSON

A separate, **user-triggered** Android `ACTION_OPEN_DOCUMENT` picker can now restore an exported historical JSON save into the original `ExpeditionActivity/expedition` preference **only when that key does not exist**. `LegacyV1Validator.java` performs strict historical schema, geometry, flags, battle, equipment, bounds and version checks. Native restoration is bounded to 2 MB of strict UTF-8, uses synchronous `SharedPreferences.commit()`, checks exact readback and refuses to overwrite any present legacy value, including malformed or empty records. No JavaScript bridge can write arbitrary original save bytes: only the user-selected document result invokes the restore method. The old launcher implementation is unchanged.

The installed emulator route `unified-restore-native` invokes the native validation and missing-only restoration logic directly, verifies byte-exact preservation and unrelated preferences, rejects a second overwrite, and checks the new engine journal is untouched. This is **not** an end-to-end physical document-picker test. Export/import picker interoperability, already-installed signing-key upgrade paths, and real-device rollback acceptance remain release blockers.

## Installed Android JSON file recovery round-trip

New emulator stage `unified-archive-file` uses the **same actual native export/import result handlers** as Android's system file pickers, with an app-private test URI instead of interactive user selection. Starting from the prior crash-recovered historical archive, it exports the original raw string, compares the UTF-8 file content with the archive, simulates a missing old-save key, restores the JSON from that file, proves the old launcher preference is recovered byte-for-byte and prevents a second overwrite. Unrelated preferences and the new engine journal must remain unchanged. This is automated low-level file I/O acceptance, **not** successful physical Android picker or app-upgrade acceptance.


## Phone-preview usability regression and engine-only repair — November 10, 2026

A real first-install phone test found that after moving right about twice,
the WebView D-pad appeared to stop responding, with no obvious way to save.
This is **not** a confirmed low-level touch/controller failure: the portable
engine intentionally blocks navigation during a pending event prompt or
combat encounter, but the first preview buried the necessary actions
below the directional pad and gave no understandable save status.

[Commit 81af727](https://github.com/nobleknights015-maker/bearframe-rpg-engine/commit/81af727e91be96ce063a890a36e65c88f5911e39)
promotes pending scripted choices and active world-combat actions immediately
under the scene; disables the pad with a visible explanation during action
resolution, then re-enables it when normal exploration resumes. Its
`session.verifySave()` is a read-only comparison of the in-memory state
against the independently validated durable two-slot journal. Save-on-every-
turn remains the authoritative write path; the new status and button make it
visible without overwriting data or creating extra journal revisions.

[Commit bd114e9 / passing Android CI 42851708602](https://github.com/nobleknights015-maker/bearframe-rpg-engine/actions/runs/42851708602)
verifies the *actual installed Android WebView*: right-movement triggers
a scripted choice, touch chooses and releases movement, a later encounter
shows combat controls, strike commits revision 5, Android force-stop/restart
restores active battle and same original revision, flee unlocks movement,
then an explicit save audit verifies revision 7. **205/205 Node tests**
and installed Android 35 tests passed. The original Rhino launcher and its
saves remain untouched. The user's physical device reported the defect
against the **older APK**; a post-fix physical-device acceptance has NOT
occurred. Continue engine release work without requiring the user to
test incomplete builds, and keep device acceptance OPEN.

The engine is still not production-ready; see the existing release checklist.


## November 10 second engine-only integration round

**Core content determinism**: [commit 894f77d](https://github.com/nobleknights015-maker/bearframe-rpg-engine/commit/894f77d3bd09b030959f17b509d2b6534aa014ae) snapshots each validated project into the portable runtime and independently snapshots the scene project's geometry and atlas/animation theme. Later caller mutations to rule catalogs, maps, event choices, stats, or theme no longer alter an established engine or scene composer. A custom JSON serialization hook must still yield valid project data. [CI 42888810062](https://github.com/nobleknights015-maker/bearframe-rpg-engine/actions/runs/42888810062) completed **SUCCESS** with Node/Rhino, Android compilation and installed-app emulator regression.

**World-to-party combat connection**: [commit b45d787](https://github.com/nobleknights015-maker/bearframe-rpg-engine/commit/b45d787fc278aac23b917f6fcb51af253832cacd) applies saved lead-weapon power in opt-in v2 party encounters; `view.partyActors` exposes a cloned, live battle roster with accurate health, mana, and statuses instead of prebattle HUD resources. V1 states and saves are unchanged. [CI 42889567227](https://github.com/nobleknights015-maker/bearframe-rpg-engine/actions/runs/42889567227) completed **SUCCESS**, including Android 35 emulator regression.

**Shared inventory for allies**: [commit efa0286](https://github.com/nobleknights015-maker/bearframe-rpg-engine/commit/efa028660373f74d77fa355b82823d420f9823ef) adds optional actor-targeted out-of-combat consumable healing through the canonical `use` command. Valid recruited allies can consume shared inventory to recover HP; full/unknown targets are refused without deducting items or advancing sequence. Save write failure leaves both the item and actor state unmodified. The generic inventory DOM control supports per-actor targeting, with no separate item store. [CI 42890113867](https://github.com/nobleknights015-maker/bearframe-rpg-engine/actions/runs/42890113867) completed **SUCCESS**: **223/223 Node regressions**, Rhino and installed-app Android 35 emulator suite.

**Installed v2 host acceptance**: [commit dae1554](https://github.com/nobleknights015-maker/bearframe-rpg-engine/commit/dae1554d5db94ca54f59209263213bf884e8f8e7) adds `unified-v2-world-first` and `unified-v2-world-second` Android instrumentation that runs a shared v2 session inside the actual offline WebView, equips saved gear, resolves a party round, force-stops the Android process, then resumes the same native journal. [CI 42890708855](https://github.com/nobleknights015-maker/bearframe-rpg-engine/actions/runs/42890708855) is the acceptance evidence (check completion before marking the installed route verified).

**Release remains OPEN**. This is meaningful engine progress, not a finished v1. Stable project-content version binding across app upgrades, full party gear/level progression, production-ready unified party menus, original asset/audio pipelines, controller ergonomics, physical target-device QA, performance and production-signed update/rollback tests still need acceptance. No campaign content or copyrighted ROM assets were added; the original launcher and its save namespace are preserved.


## Content compatibility guard — November 10, 2026

The portable save subsystem now supports opt-in `project.contentRevision`
and deterministic, key-order-independent project fingerprints. New
content-bound journals reject changed/missing version bindings with
`incompatible-content` and prohibit overwriting any mismatched occupied
slot. Existing unbound v1/v2 journal payloads and original Rhino saves
remain unchanged; enabling the feature on old project IDs is not an
automatic migration. Tests cover map, event, combat and item mutations,
same-revision content changes, key ordering, and mixed-slot refusal.
The Android host now includes a two-process content-bind regression. See
[framework API](FRAMEWORK_API.md) for details.

**Remaining release gate:** migration/rollback for changed project content,
production version naming/signing, real-device acceptance, full engine
UI/progression and audio/asset/performance work. No release completion claim.


## Shared v2 inventory and per-actor weapon equipment — November 10

The canonical v2 party implementation now permits equipping and
unequipping weapons for any recruited actor using the same shared
inventory/journal. No item copy may be assigned more times than it is
owned; event-driven item removals reconcile equipment deterministically;
all saved state remains v2-compatible with old states lacking per-ally
weapon fields. Party combat attack uses each member's equipment.
The generic inventory controls render per-party-member buttons and
disable assignments when no unreserved item remains. V1 behavior
is preserved. Automated regressions cover duplication refusal, scripted
removal, save write failure, persistence, serialization, and combat.

**Not yet complete:** multi-slot accessories/armor, generalized party
progression, production-quality screen UX, signed upgrade and physical
Android acceptance. Do not claim the full inventory/equipment release
gate complete solely from a successful single-weapon schema integration.


## Wearable gear categories (weapon / armor / accessory)

The portable project and v2 party runtime now support all three
gear slots, item-derived damage/defense/speed bonuses, per-actor
equip/unequip, one-physical-copy-per-assignment, and deterministic
event removal of equipment. Legacy weapon-only APIs/saves are
preserved. The UI now exposes all slot controls through the same
canonical journal. Automated tests cover schema rejection, battle
stat propagation, prevention of duplicated reservations, scripted
item loss, and durable recovery. Separate progression, finalized UI,
production item art and target-device acceptance remain outstanding.


## Installed mobile inventory/gear route

Android 35 instrumentation `unified-gear-ui-first/second` validates
real WebView inventory panel buttons for recruited ally gear selection,
physical-copy reservation, default/actor-specific gear swapping,
targeted consumable healing, three equipped item categories, quest
state and the same native save journal across `am force-stop` restart.
This is synthetic neutral project data running in the installed app,
**not** player content or physical phone acceptance.


## Opt-in character/party progression checkpoint

A reusable configurable progression policy now derives levels from
cumulative experience, applies actor-specific per-level combat and
resource growth, and unlocks catalog skills at validated level
thresholds. Victory awards XP through the same single v2 party journal,
preserving previous ally gear. The generic panel displays progress and
next-level threshold. The option requires a content-revision binding
so old v2 saves are never reinterpreted silently. Node/Rhino/WebView
packaging tests have been added; physical QA and full character
creation remain outstanding.


## Installed XP progression checkpoint

Two Android 35 instrumented stages `unified-level-first/second` exercise
a synthetic, **content-revision-bound** v2 party project inside the actual
offline WebView and native save bridge. Recruited allies participate in
battle, victory XP advances levels and maximum resources, skills unlock,
the generic inventory UI renders XP/levels, and force-stop/restart must
rehydrate the same saved progression. This is a verification target for
the opt-in leveling engine, not physical-device acceptance or a complete
character creation system.
