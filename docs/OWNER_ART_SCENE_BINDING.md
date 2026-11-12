# Opt-in owner-art renderer binding

The existing JS/Android engine keeps its 32x32 terrain, integer pixel coordinates, independent gameplay state, durable journals, and original launcher. Character art can be taller than 32px, with feet at the tile edge.

Build after importing **all** four owner archives using scripts/import_owner_asset_archives.py:

1. python3 scripts/build_owner_art_profile.py OWNER_IMPORT_DIR docs/OWNER_SCENE_ART_ROLES_EXAMPLE.json
2. BF_ASSET_PACK_DIR=OWNER_IMPORT_DIR/runtime-pack BF_ENGINE_PREVIEW=1 bash android/build.sh owner-art-preview.apk

The generated import-root art-profile.json is inert data, converted by the Android build into a CSP-local JS literal. It registers **all** owner runtime images but decodes only images needed for the scene. The example role map uses sci-fi station floor/wall and service-robot drawings to verify the real rendering path, not to define canon character appearances or final directional animations.

Without an owner art profile, existing synthetic diagnostic assets remain the fallback. No saved progress, engine rules, collision, event logic, or existing installed application is replaced. UI icons, named effects, original directional animations and physical Android device release gates are still outstanding. This is an engine integration checkpoint, not a finished game or engine.

## Directionally animated original owner artwork

The example role file now exercises two **unmodified** player source sheets from the
uploaded `Apocalypse Character Pack.zip`: `Player/Idle.png` (96x128) and
`Player/Walk.png` (160x128). Each is arranged in **32x32** source cells.
Source rows are `down, up, right, left` — not the common
`down, left, right, up` convention. The explicit directional role map preserves
that order; idle uses cell 0 and walking uses source columns 0-3. The trailing
label columns are never rendered. The science-fiction station tiles and 64px-tall
service technician remain independent original images. These are **neutral
engine verification assets**, not approved canonical Bearframe characters.

Each directional sprite has `ticksPerFrame` and exactly four
`directions` entries (`down`, `left`, `right`, `up`), each with one
`idle` source rectangle and a nonempty `walk` array of source rectangles.
These rectangles may reference different original images. The profile builder
checks every rectangle against the original inventory and rejects missing
directions or invalid coordinates, with no partial profile output. A canonical
character can later replace this example by data only, not engine rewrites.

Only the visual host remembers facing and a five-presentation-tick walk window.
Gameplay movement/collision decisions and saved journal remain authoritative.
Animations cannot fabricate a movement success or write into a save.
Full gameplay actor art, NPC-specific animation, equipment overlays,
lighting/effects and physical-device release acceptance remain open.


## JRPG room entrances and distinct map identity

The owner-role JSON now optionally supports:
- `mapTiles`: per-map overrides for `floor` and `wall` tile role IDs,
  e.g. `{"field":{"floor":"fieldFloor","wall":"fieldWall"}}`.
  All referenced roles are still native 32x32 and validated in the pure scene
  composer against real project map IDs.
- `portals`: a map ID to an independently referenced original image frame
  for doors/thresholds. Portals may be 32x64 and are feet-anchored over each
  destination entry in that map's existing `exits` list. No map collision,
  warp target, progression or journal field changes.

The included example deliberately exercises a closed service door in `hub`
and an open service door in `field`, with visibly different grating and
rusted wall art in the second room. Original owner bytes remain unchanged.
These are engine-verification room styles rather than Bearframe canon maps.

The WebView overlays a non-interactive arrival label for a brief fade when
`view.map` changes. First startup/resuming a save does not pretend a
transition happened; all effects are visual and preserve normal movement and
save recovery. The default diagnostic theme and old art-profile syntax remain
supported without an optional door asset. For a finished game, author proper
doors and room palettes for every map rather than treating these two test
rooms as the final world.
