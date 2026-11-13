# Free movement (opt-in) — engine acceptance checkpoint

Status: engine-only implementation under verification. **Not the default mode in
the existing installed owner-art preview.** No existing preview journal is
silently migrated.

## Choosing locomotion

Historical projects that omit movement keep the original four-direction,
one-tile-per-action behavior and exactly the same save format.

New authored projects can opt in using:

    "movement":{"mode":"free","directions":4,"speed":32,"radius":48}

**Production decision: exactly four cardinal directions.** An omitted
`directions` value defaults to 4 in free mode. Eight-direction locomotion
is preserved only behind an explicit `"directions":8` configuration for
existing experimental tests and future engine reuse; no Bearframe production
profile enables it. Grid/tile projects are always cardinal-only regardless
of runtime input. A joystick that reports two axes is reduced to one
cardinal movement command by the player-input adapter; no diagonal move is
committed.

Free movement and directions are independent: 32x32 map art and four-facing
character animations work with either classic one-tile steps or fractional
tile positioning. The current installed owner-art preview is still
four-way **tile-based**; switching to four-way free movement requires a
separately validated authored content profile and isolated journal.

All units are fixed point: 256 canonical units = one authored tile (the
rendering tile may still be native 32x32). Speed is 8..64 fixed-point units
per successful movement command; radius is 8..96 units of collision footprint
half-width. Production commands: up, down, left, right only.
The stored experimental eight-way implementation retains normalized diagonal
vectors, wall sliding, and corner avoidance when directions=8 is explicitly
selected for a different profile.

Collision samples all four corners of the character's footprint and uses
separate X/Y sweeps. That permits wall sliding but blocks crossing a
diagonal between two impassable wall tiles. Entry into an event, encounter
or exit still uses the original integer cell map and original event origin
identifiers. A room transition and scripted warp center the character in
the destination tile.

The canonical player includes integer px/py coordinates only in free-mode
projects, with x/y still denoting the tile occupied by the character center.
Every successful movement commits both tile and sub-tile position before
the host presents it. Failed storage writes leave the prior position visible.
Native journal restart recovers exact sub-tile location. A movement setting
change alters the authored content contract, and active journals must not
be overwritten or silently converted.

## Rendering and four-facing art

The renderer uses canonical freePosition for camera/player coordinates,
but keeps collision, event and room geometry in integer map cells.
A separate 110 ms host-side tween blends between already saved positions,
at a 16 ms presentation cadence in free mode. This interpolation never
generates a gameplay command or save write, and transitions between rooms
cancel rather than animate through the wall. Fixed-tick rendering audits
disable the tween. Grid mode keeps its previous 50 ms animation cadence.

Four-direction sprite art is now the default for both grid movement
and smooth exploration. Production gameplay does not need diagonal-facing
frames. Optional diagonal pad buttons are hidden for both four-way grid and
four-way free projects. Native Android analog input and simultaneous physical
D-pad buttons may still generate diagonal semantic signals, but the gameplay
input adapter reduces those to cardinal input unless the authored project
explicitly opted in to eight-way locomotion.

## Outstanding release requirements

- Tune repeat rates, movement speed, collision radius and frame pacing on a
  real Moto G / equivalent Android device; 16 ms redraw is not yet a
  measured 60 fps performance guarantee.
- Run large-map, narrow doorway, irregular collision, camera-panning and
  prolonged save-write/flash endurance acceptance on hardware.
- Perform an explicit save migration or create a separate content project
  ID and validated journal for existing installed previews; never overwrite
  the working tile-mode journal.
- Confirm character sprites and art anchor positions for all four real
  characters; the engine does not produce those assets.
- Keep historic Android Rhino/Engine v1 rule paths unchanged.

See tests/free-movement.test.js, tests/motion-tween.test.js and the
installed Android WebView free-movement acceptance stage.
