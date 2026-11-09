# Bearframe Engine — Reference Research Gates

This is a verification-first plan, **not** a promise that the original games have already been decompiled.

| Gate | Required evidence | Pass condition |
|---|---|---|
| A. ROM provenance | SHA-256, architecture, headers | Reproducible inventory (pass 1 complete) |
| B. Executable control flow | Valid 68000 disassembly and GBA ARM/Thumb control flow | Decode reachable entry functions; separate code from assets; record verified references |
| C. World/navigation | Emulator traces, map transition examples, input rules | Build reference map/movement tests, including walls and portals |
| D. Event/dialogue | Trigger/table layout and branch behavior | Reproduce multiple scripted transitions in isolated original test interpreter |
| E. Battle | Turn order, targeting, status, damage evidence | Deterministic combat test fixture with expected outputs |
| F. Party/inventory | Character structure, equipment effects, recruitment | Save/load and equipment regression fixtures |
| G. Asset/runtime | Render paths, tile/sprite constraints, memory behavior | Original 32-bit-inspired Bearframe renderer, not Sega assets |
| H. Android engine | Startup, input, save migration, crashes, performance | APK smoke test plus physical device acceptance |

## Architectural rule for the new game

The Phantasy Star games are references for mechanics, not the engine we will ship. Bearframe owns its renderer, movement, event interpreter, data schema, combat rules, and saves. Source reference notes must carry confidence labels, and all Bearframe implementations require regression tests. Never couple one subsystem to undocumented original ROM offsets.

## Bearframe canon constraints already decided

- Player-created Sleeper starts with no personal memory or returning personality.
- Guardian assists awakening using the Founder's entrusted sentience chip; the Sleeper core remains ancient and irreplaceable.
- Core instability can affect battle and verbal communication, without overriding the player's intent.
- Old Frame hardware is incompatible with modern Bearframe technology.
- Chassis improvements modify statistics but only weapons visibly change.
- Echo Frames and Ghost Grid units are distinct; companions require their own in-world agency and compatibility logic.
- Exploration begins at Sleeper ruins and the planet's surface; Mira is encountered considerably later.
- Visual target: modernized 32-bit-era 2D sci-fi JRPG, with Phantasy Star II–IV structure and no high-complexity Sea of Stars visual effects.
