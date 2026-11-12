# Opt-in owner-art renderer binding

The existing JS/Android engine keeps its 32x32 terrain, integer pixel coordinates, independent gameplay state, durable journals, and original launcher. Character art can be taller than 32px, with feet at the tile edge.

Build after importing **all** four owner archives using scripts/import_owner_asset_archives.py:

1. python3 scripts/build_owner_art_profile.py OWNER_IMPORT_DIR docs/OWNER_SCENE_ART_ROLES_EXAMPLE.json
2. BF_ASSET_PACK_DIR=OWNER_IMPORT_DIR/runtime-pack BF_ENGINE_PREVIEW=1 bash android/build.sh owner-art-preview.apk

The generated art-profile.json is inert data, converted by the Android build into a CSP-local JS literal. It registers **all** owner runtime images but decodes only images needed for the scene. The example role map uses sci-fi station floor/wall and service-robot drawings to verify the real rendering path, not to define canon character appearances or final directional animations.

Without an owner art profile, existing synthetic diagnostic assets remain the fallback. No saved progress, engine rules, collision, event logic, or existing installed application is replaced. UI icons, named effects, original directional animations and physical Android device release gates are still outstanding. This is an engine integration checkpoint, not a finished game or engine.
