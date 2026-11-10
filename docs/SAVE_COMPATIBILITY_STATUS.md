# Bearframe Engine — Rhino save compatibility contract

Status: **Engine compatibility path implemented and Android-emulator verified; physical-device release acceptance remains open.** This document describes supported *original-rule* save recovery, not a claim that the entire engine is finished.

## Decision: Preserve gameplay, not only JSON fields

The historical `ExpeditionActivity/expedition` snapshot is a v1 save with original map, equipment, flags, prompts and battle state. The newer portable engine's event/combat rules are not identical, so a field-only conversion would alter future gameplay. Do **not** silently migrate those saves into an incompatible project.

The supported compatibility path retains the frozen original `game/engine.js` and `game/world.js` rule set inside the restricted offline Android host. It operates on a **copied** historical state using the independent synchronous two-slot journal `bf:legacy-expedition-compat:v1:session`. Rendering and the new engine's own journal are separate. The original Rhino launcher remains installed and its `ExpeditionActivity/expedition` preferences are never overwritten, renamed or erased by this compatibility flow.

## Recovery workflows

**From an installed original launcher:** Inspect the old save, explicitly confirm an exact-byte independent archive, then separately inspect and confirm copying that archive into the playable compatibility session. Continue movement, choices and combat with the old rules. Every changed turn is committed before the UI shows it.

**To preserve newer compatibility-session progress:** Export the latest validated historical snapshot using Android's user-chosen document picker. This JSON is original-format and is *different* from the initial historical archive once gameplay has advanced. Keep an external copy outside the application's private storage.

**On a fresh installation or after losing app-private storage:** Choose the previously exported original-format JSON under the separate continued-save import controls, verify the preview, and explicitly confirm recovery to an **empty** compatibility journal. The imported state resumes using the original game rules; it does not overwrite any existing original launcher save or populated/corrupt compatibility slot.

**Return to the old launcher:** Its previous save remains available unchanged. If its key is **absent**, the separate historical JSON restore picker can put a strictly validated original-format file into the missing key. It refuses every existing key, even corrupted entries. Never delete an existing original save just to bypass this protection.

## Integrity rules

- All imports require user selection or explicit two-step inspection/confirmation. No import or archive runs on app start.
- Original-format JSON is checked against both strict historical format validation and original-world restoration. The file picker uses bounded UTF-8 decoding and no general filesystem permissions.
- Any occupied destination or a source/backup change during old-source import blocks overwrite. A failed verified durable write cannot advance the presented state.
- File selection is transient. Cancellation invalidates previous pending file consent, and saving requires a separate confirmation.
- The original launcher, archive vault, compatible journal and canonical portable engine journal are separate namespaces. Keep all four until physical acceptance and full engine release.

## Automated evidence and limits

- [Baseline original-rule import/restart/export Android emulator verification](https://github.com/nobleknights015-maker/bearframe-rpg-engine/actions/runs/42838097886)
- [Direct external JSON import, consent and two-process recovery installed-emulator verification](https://github.com/nobleknights015-maker/bearframe-rpg-engine/actions/runs/42842646533)
- [Additional cancellation protection and same-signed APK replacement acceptance](https://github.com/nobleknights015-maker/bearframe-rpg-engine/actions/runs/42843107462) — verify actual CI conclusion before crediting it as passing.

Remaining **release** acceptance: real user-selected Android Storage Access Framework provider UI, export destination permissions/availability, same-signed real version upgrades, app background/rotation and low-memory recovery during picker use, a target-class Moto G device, and actual signing identity continuity. CI APKs use disposable signing credentials; **never install one over the user's production app** to test preservation.

The compatibility path is intentionally not a general-purpose migration into new gameplay rules. A later native new-project conversion must establish state and behavioral parity separately. This does not block the new engine's unrelated feature development while preserving legacy support.
