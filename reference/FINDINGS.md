# Phantasy Star reference work · Pass 3

The input revisions are locked in probe.py. Pass 1 established cartridge identity. Pass 2 found the PSIV main, field and battle dispatch tables and tested several isolated behavioral models. Its original code and dated report are in pass2/. This pass follows the targets named in that report. Bearframe's simulation has no dependency on the probes, ROMs, research labels or console emulators.

## What the supplied games actually did

| Game or subsystem | New result | Evidence and boundary |
|---|---|---|
| GBA launcher | Index 0 launches I at file offset 0x738000, 1 launches II at 0x390000 and 2 launches III at 0x080000. Each has its own header and ARM reset branch to local +0xC0. | Captured the selection variable in emulated EWRAM at 0x0202436C for all three choices and booted them by controller. Separately executed Thumb lookup at 0x782 through trampoline 0x8BC into each ARM entry. No claim that these offsets delimit every data reference. |
| PS I dungeon | Local SMS-layout base inferred at 0x7722D4. The packed row data at collection offset 0x7B0242 matches the beginning of the externally documented first floor at SMS offset 0x3DF6E. Two four-bit cells per byte, high nibble first in these rows. | Compared the wall row, two upward markers and three walkable cells on the next row. A bounded static match. Other floors, door semantics and movement have not been replayed. |
| PS II and III | Verified title selection and distinct program entry points in the US compilation. | The earlier PSII physical damage and PSIII opening-priority models still refer to Genesis research. Their formulas, port-specific implementation addresses, item records and RNG have not been validated in the GBA games. |
| PS II name entry | Two equal-duration GBA replays selected A versus B in the character name dialog. EWRAM 0x020039C3 changed from 11 to 12. | Observed screen and RAM difference. This byte is a correlated location, not yet proven to own the permanent name. |
| PS III field input | The first controllable field scene responded to right/left and down/up. EWRAM bytes 0x02003F64 and 0x02003F62 increased by 16 along the corresponding axis and reverted when moving back. | Repeated horizontal steps and a vertical pair using native GBA controls. Other mirrored bytes changed too; ownership of authoritative actor coordinates remains open. |
| PSIV field interaction | Routine 0x58E00 scans ten-byte records until a 0xFFFF terminator. For shape 1 the test at 0x547C2 uses a 64-by-64 half-open rectangle in field coordinate units. The facing offset feeds the query. One bank of event flags starts at RAM 0xFFFFF120. | In isolated execution, the lower edge and last interior point hit, the exclusive upper edge missed, and a pre-set flag suppressed the same record. This is one interaction shape and flag branch, not a general wall-collision decoder. |
| PSIV events | Selector at RAM 0xFFFFECA8 branches on bit 15. The two routes use pointer tables at 0x5A2B4 and 0x5A580. The second masks the high bit. | CPU selector fixtures include low, high and maximal values. Synthetic maximal values stop at the dispatch path, before indexing. Opcode semantics and full script progression remain open. |
| PSIV turn order | Nine 64-byte descriptors at RAM 0xFFFF4400. Active descriptors clear status bit 7 in the linked actor. Signed opening flag selects all nine, first five, or last four. A 0x6E mask filters eligibility. One-based actor IDs and speed form candidate records. | Verified the shortlist for all three opening classes. Ran the actual score randomization, RNG subroutine and stable descending sort for three fixture seeds, with a fixed external input word. The nine score slots and adjacent zeroed scratch word were initialized. Later macro reordering and complete combat rounds remain open. |
| PSIV attack effect | Two global gates and action codes 7, 12, 13 and 14 can divert processing before effects. | Isolated tests vary both global flags and occupied versus empty last slot. Final HP loss, animation and targeting were not inferred from this gate. |
| PSIV exploration | At the end of the opening sequence, a south input changed position from (768,288) to (768,320). A repeated south input at the obstruction produced no displacement. North restored Y to 288 and then 256. | Replayed controller inputs from cartridge reset in Genesis Plus GX. Read guest field coordinates after each step. This validates a specific walkable/blocked boundary. Portal lookup and complete map decoding are outstanding. |
| PSIV save and load | The in-game system menu saved physical slot 1. The 2,560 odd-lane bytes beginning at SRAM +0x201 summed to 0x58C0, the value stored at +0x29 and +0x2B. A cold boot with only SRAM retained offered Continue and restored (768,256). | Real in-game save, deterministic replay. 735 bytes changed in this fixture. Separately ran the RAM checksum routine 0x64ECE and physical slot checksum 0x64EE4 on varied payloads. The slot helper masks two bits, while the observed player-facing menu displayed three slots. Character and inventory subfields still need differential saves. |

## Verification commands

Use Python 3.12 with unicorn 2.1.4, capstone 5.0.9, Pillow and NumPy. The two ZIPs remain privately supplied. The optional libretro harness takes Linux x86-64 cores by path. Video hashes are deliberately tied to the tested mGBA build and pixel format.

```sh
python reference/probe.py "/path/to/ROM folder"
python reference/disassemble.py "/path/to/ROM folder"
python reference/collection_boot.py /path/to/mgba_libretro.so "/path/to/Phantasy Star Collection.zip"
python reference/port_controls.py /path/to/mgba_libretro.so "/path/to/Phantasy Star Collection.zip"
python reference/field_save.py /path/to/genesis_plus_gx_libretro.so "/path/to/Phantasy Star IV.zip"
(cd reference/pass2 && PSIV_ROM_ARCHIVE="/absolute/path/to/Phantasy Star IV.zip" python -m unittest -v)
```

Tested shared-object SHA-256 values from the Linux x86-64 libretro buildbot on November 9, 2026:

- mGBA · c840f305825d07c9bec7a6ec18841073c4b539fd234f73623474f97c507f1cdc
- Genesis Plus GX · b28d4c7c271cae387004ba4818ed2e2109ca2112475e94479ed5d60b08a9a9b5

## Technical research used

- PSIV's community disassembly and Grand Cross's field/battle state analysis supply the names for the Pass 2 entry points. Addresses, CPU results and the save round trip above come from the supplied cartridges. [Disassembly](https://github.com/squidfeatures/ps4disasm) · [Grand Cross](https://ps4grandcross.net/posts/ps4-game-engine-1/)
- The PS I map transcription supplies the external row pattern and Japanese-version offset. [SMS Power discussion](https://www.smspower.org/forums/20474-EditingPhantasyStarDungeonsUsingRetranslationDisassemblyFiles)
- The earlier Genesis reference models can be compared with the PS II disassembly and PS III technical index. Hugues Johnson distinguishes character, level, item, enemy and shop tables in the Genesis image. Those offsets are not assumed to transfer into the GBA collection. [PS II](https://github.com/innocenthedgehog/ps2disasm) · [PS III ROM map](https://huguesjohnson.com/ps3/hacking-rom.html) · [Lorenzo's four disassemblies](https://www.pscave.com/dow/disassemblies/)

## Next reproducible targets

Trace one actual PSII GBA attack and one PSIII GBA battle opening from normal input. In IV, capture one full multi-actor round and a doorway transition, then change just one inventory item across two genuine saves. Preserve input recordings, expected RAM deltas and cartridge hashes with each new test.
