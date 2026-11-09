# Phantasy Star — Reverse Engineering, Pass 2

**Date:** 2026-11-09  
**Status:** targeted static control-flow recovery for *Phantasy Star IV*, not a complete decompilation.

## What is genuinely ROM-verified

The script `reverse_pass2.py` opens the user's *Phantasy Star IV* ROM, checks its exact SHA-256, locates **three unique dispatcher instruction signatures** and decodes three adjacent branch-pointer tables. The ROM contains **35 distinct table entries** across these tables; some entries are unnamed in the source research. The table targets below were read from the supplied ROM, not fabricated from memory or copied from a wiki.

The labels were cross-referenced against an external, community-written Phantasy Star IV disassembly. They are **research labels**, not names embedded in the commercial ROM. The value of this pass is that we can now point to exact executable addresses when investigating gameplay problems.

| Dispatcher | ROM location | Table location | Entries | Encoding |
|---|---:|---:|---:|---|
| main | `0x0003D0` | `0x0003DC` | 7 | `absolute_be32` |
| field | `0x05199A` | `0x0519AA` | 10 | `absolute_be32` |
| battle | `0x00528E` | `0x00529E` | 18 | `signed_be16_relative_to_table` |

## Decoded routine address reference

Targets have been checked for range/alignment. A pointer-table entry alone does not prove the full target routine was disassembled or its behavior dynamically executed.

### Main dispatcher

| Index | Community routine label | Target address |
|---:|---|---:|
| 0 | `GameMode_Sega` | `0x04103A` |
| 1 | `GameMode_Title` | `0x0424D4` |
| 2 | `GameMode_LoadFieldMap` | `0x051790` |
| 3 | `GameMode_Field` | `0x05199A` |
| 4 | `GameMode_LoadBattle` | `0x006902` |
| 5 | `GameMode_Battle` | `0x00093A` |
| 6 | `GameMode_JmpToVInt_Prepare` | `0x000AC2` |

### Field dispatcher

| Index | Community routine label | Target address |
|---:|---|---:|
| 0 | `FieldRoutine_Controls` | `0x05770E` |
| 1 | `FieldRoutine_Menu` | `0x057B32` |
| 2 | `FieldRoutine_Interaction` | `0x0587C2` |
| 3 | `FieldRoutine_Event` | `0x05A264` |
| 4 | `FieldRoutine_Settings` | `0x05918E` |
| 5 | `FieldRoutine_Battle` | `0x058424` |
| 6 | `FieldRoutine_Shop` | `0x065D44` |
| 7 | `FieldRoutine_PlaceName` | `0x06638A` |
| 8 | `FieldRoutine_WorldMap` | `0x066658` |
| 9 | `FieldRoutine_ItemFound` | `0x066B10` |

### Battle dispatcher

| Index | Community routine label | Target address |
|---:|---|---:|
| 0 | `BattleRoutine_Nothing` | `0x0052D4` |
| 1 | `loc_52C2` | `0x0052C2` |
| 2 | `loc_52D6` | `0x0052D6` |
| 3 | `loc_5380` | `0x005380` |
| 4 | `Battle_ProcessCOMD` | `0x0053E2` |
| 5 | `Battle_ProcessMACRO` | `0x005430` |
| 6 | `Battle_ProcessRUN` | `0x005440` |
| 7 | `Battle_OrderTurns` | `0x0054CC` |
| 8 | `loc_576A` | `0x00576A` |
| 9 | `loc_6672` | `0x006672` |
| 10 | `loc_6670` | `0x006670` |
| 11 | `Battle_DoAttackEffect` | `0x005CE6` |
| 12 | `loc_67AE` | `0x0067AE` |
| 13 | `loc_67BE` | `0x0067BE` |
| 14 | `loc_5366` | `0x005366` |
| 15 | `loc_66B8` | `0x0066B8` |
| 16 | `loc_684A` | `0x00684A` |
| 17 | `loc_68C0` | `0x0068C0` |

## Independent behavior models and evidence levels

- `FlagBank`: standalone original implementation of a 256-bit event flag bank. Bit-ordering reflects the public PSIV disassembly interpretation; tests verify set/check/clear and boundaries. **Source-correlated, not emulator-tested.**
- `EncounterState`: independent step-trigger model. After an initial 10-move countdown, sampled checks use a 1-in-32 foot or 1-in-128 vehicle condition when not blocked by transition/event guards. **Source-correlated, simplified guard handling, not emulator-tested.**
- `sum_sram_bytes`: independent 0xA00-byte unsigned 16-bit checksum reference. **Source-correlated, not validated against a user's actual save file.**
- `ps2_weapon_damage`: independent PSII battle-damage calculation, including a stock 16-bit overflow/shift edge case and optional community bugfix behavior. **External Genesis disassembly-derived; NOT verified against the supplied GBA collection.**
- `ps3_priority_from_rng`: independent 3-bit opening-battle priority selector. **External Genesis disassembly-derived; NOT verified against the supplied GBA collection.**

> The user-provided Phantasy Star Collection ROM contains the GBA compilation. It is **not** identical to stand-alone Genesis PSII/PSIII binaries, and we have not reverse-mapped the compilation's full ARM/Thumb game implementations.

## Execution evidence

The tests are real code executed against the supplied archive where appropriate. `test_pass2.py` uses the locally supplied PSIV ROM to assert the exact dispatcher route destinations; independent tests exercise the original reference logic without embedding Sega assets or executable bytes.

To reproduce:

```bash
python reverse_pass2.py --iv '/path/to/Phantasy Star IV.zip' --out reference_routes.json
PSIV_ROM_ARCHIVE='/path/to/Phantasy Star IV.zip' python -m unittest -v test_pass2 test_cross_game test_analyzer
```

The confirmed PSIV ROM revision has SHA-256 `511f35cc11f88316f8b8940e28ab298bd75a4da193672a80172884d6eb913b6a`. Passing ROM-address tests does **not** demonstrate gameplay correctness without emulator tracing.

## Exact next verification targets

1. **Event interpreter / field interaction:** From `0x0587C2` (field interaction) and `0x05A264` (event), trace event-flag reads and script data access. Record a finite set of field interactions with matching state/output fixtures.
2. **Combat:** From `0x0054CC` (battle turn ordering) and `0x005CE6` (attack effects), trace data dependencies and reproduce several complete turn sequences under deterministic RNG.
3. **Map/collision:** From `0x05770E` (field controls), locate map tile collision and portal routines; verify position and transition fixtures using an emulator.
4. **Save/inventory:** Locate serialized character/inventory blocks and verify checksums against actual in-game saves.
5. **GBA collection:** Decode the ARM/Thumb boot and menu path, identify three game entry boundaries, and compare with the separate Genesis architecture. Do not conflate their binaries.

## Engineering boundary for Bearframe

No ROM is included. The artifacts are the original analysis scripts, metadata, tests and high-level notes. The original Bearframe engine should implement its **own** state machine, combat mechanics, event data, graphics, and Android runtime rather than include extracted commercial code or resources.

## External background research

- Phantasy Star IV Disassembly (community labels): https://github.com/squidfeatures/ps4disasm
- Analysis of IV's game modes and field update loop: https://ps4grandcross.net/posts/ps4-game-engine-1/
- Phantasy Star II disassembly: https://github.com/innocenthedgehog/ps2disasm
- Phantasy Star III disassembly listing: https://www.pscave.com/dow/disassemblies/

**Bottom line:** We now have an exact, rerunnable IV dispatcher address map and working reference models for several isolated mechanics. We do **not** have a complete decompilation of I–IV, a verified full combat model, or an engine ready to ship. Those claims would be premature.
