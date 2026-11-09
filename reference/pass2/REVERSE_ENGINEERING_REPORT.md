# Classic Phantasy Star — Reverse Engineering Workbench, Pass 1

**Status: Started; not complete.** This package is a reproducible static-analysis baseline using the two user-provided ZIP archives. It does **not** claim to have recovered combat source code, the event interpreter, map formats, or a working reimplementation. Source ROMs and copyrighted artwork are deliberately excluded from the deliverable.

## Confirmed source formats

| Source | Platform | ROM bytes | SHA-256 |
|---|---|---:|---|
| Phantasy Star Collection (USA) | Game Boy Advance (I–III collection) | 8,388,608 | `6747a17af7ccb082bab1f2a8ed7d88952ab93879d93173b12331b1e5e8ec1c4e` |
| Phantasy Star IV (USA) | Sega Genesis/Mega Drive | 3,145,728 | `511f35cc11f88316f8b8940e28ab298bd75a4da193672a80172884d6eb913b6a` |

The collection is **one GBA executable** and should not be disassembled as three independent 68000 binaries. PSIV runs on Motorola 68000; the GBA collection uses ARM7TDMI (ARM/Thumb). Different architectures need different instruction decoders and runtime tracers.

## Verified technical details — Phantasy Star IV

- The standard Genesis cartridge header reports `SEGA GENESIS`, title *PHANTASY STAR The end of the millennium*, product `GM MK-1307 -00`.
- Cartridge declares ROM `$000000`–`$2FFFFF` and work RAM `$FF0000`–`$FFFFFF`.
- 68000 initial stack pointer: `$FFFF4FF0` (from vector 0).
- 68000 reset entry point: `$000220` (from vector 1).
- Vertical blank interrupt vector: `$000524` (from vector 30).
- Horizontal blank interrupt vector: `$FFFFECB0` (from vector 28; points to RAM, **not** ROM — do not treat it as ROM code).
- Standard Genesis checksum: stored `$05CB`, independently recomputed `$05CB` — **match**.
- Near `$000200` are recognizable 68000 words including `$60FE` (a self-loop branch encoding), `$4E73` (RTE), and `$4E75` (RTS). These are low-level control-flow structures, not evidence of an identified combat routine.
- Entropy map sampled in 64 KiB blocks: 48 blocks across 3 MiB; 16 blocks have entropy above 7.7 bits/byte. Such blocks may be compressed art, music, packed data, or something else; entropy alone **cannot** establish their contents.
- An aligned-word scan finds 8,874 apparent absolute-long JSR/JMP patterns whose destinations fall inside the ROM. **This is not 8,874 confirmed calls:** patterns inside graphics/compressed data can appear by chance. Full instruction-boundary-aware 68000 disassembly is needed before interpreting these as a call graph.

## Verified technical details — Phantasy Star Collection

- Header title `PHANTASYSTAR`, game code `AYCE`, maker `78`.
- GBA header checksum: stored `$1E`, independently recomputed `$1E` — **match**.
- ARM entry instruction `$EA00002E` decodes as an unconditional ARM branch from ROM offset `$000000` to `$0000C0` (ARM PC-relative pipeline offset accounted for).
- 128 x 64 KiB entropy blocks catalogued. Low-entropy/filler areas appear among occupied regions. This does not prove where the three games' assets or engines begin or end.

## What the deliverables provide

- `analyze_roms.py`: read-only, dependency-free Python script that opens supplied ZIPs; verifies checksums; extracts entry/vectors; surveys 64 KiB regions; and records **candidate** Genesis control-flow/pointer patterns.
- `rom_inventory.json`: machine-readable findings for future disassembly and triage.
- `test_analyzer.py`: three synthetic unit tests for entropy, GBA branch/checksum, and Genesis checksum. No ROM content is embedded in tests.
- `ENGINE_RESEARCH_PLAN.md`: a bounded extraction plan and test criteria for the relevant RPG subsystems.

## Evidence grades

- **Verified:** cart identity, sizes and hashes, header fields, entry-point addresses, checksum computations, ROM/RAM header ranges.
- **Observed, unclassified:** entropy differences, pointer-shaped values, apparent branch opcodes within otherwise undecoded bytes.
- **Not yet established:** ROM data section boundaries, compression algorithms, behavior of combat/formulas, movement/collision logic, party data, event scripting, save format and actual control-flow graph.

## How to reproduce

With Python 3, provide your own original ROM ZIPs. Nothing is uploaded or shared by this script.

```bash
python analyze_roms.py --collection '/path/to/Phantasy Star Collection.zip' --iv '/path/to/Phantasy Star IV.zip' --out './analysis'
python -m unittest -v test_analyzer.py
```

For the next pass, use a 68000-aware disassembler and a Genesis emulator/debugger to trace from reset (`$220`) to the main loop, from VBlank (`$524`) to the scheduler, and from input and encounter handlers to party/combat data. Then perform independent GBA ARM/Thumb analysis from offset `$C0`. Each claimed subsystem should have an address, function signature or call trace, test inputs, expected outputs, and evidence confidence.

## Intellectual property boundary

Analyze the user's ROMs as local reference material. Write original engine code and tests; do not bundle Sega ROM binaries, extracted game artwork/audio, or substantial original game code in the Bearframe game.
