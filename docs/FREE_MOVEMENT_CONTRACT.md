# Free movement (opt-in) — engine acceptance checkpoint

Status: engine-only implementation under verification. **Not the default mode in
the existing installed owner-art preview.** No existing preview journal is
silently migrated.

## Choosing locomotion

Historical projects that omit movement keep the original four-direction,
one-tile-per-action behavior and exactly the same save format.

New authored projects can opt in using:

    "movement":{"mode":"free","speed":32,"radius":48}

All units are fixed point: 256 canonical units = one authored tile (the
rendering tile may still be native 32x32). Speed is 8..64 fixed-point units
per successful movement command; radius is 8..96 units of collision footprint
half-width. Diagonal movement normalizes both axes, avoiding a sqrt(2)
speed advantage. Supported commands: up, down, left, right, up-left,
up-right, down-left, down-right.

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

The eight directions do **not** require eight sets of character artwork.
Diagonal movement reuses up/right/down/left poses, retaining the previous
compatible facing when practical. The optional diagonal pad buttons are
hidden for historical tile-mode content. Native Android analog and
simultaneous physical D-pad buttons can generate diagonal semantic actions.

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
