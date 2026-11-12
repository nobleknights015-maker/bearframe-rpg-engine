# Bearframe Engine — complete owner asset library import

Status: ZIP importer and lazy runtime packaging added; actual visual scene/actor selection remains open. Bulk import is not equivalent to fully rendering every asset.

## Founder scope and inventory

Keep every supplied asset accounted for; no filtering because it does not fit a placeholder map. The four inspected uploads contain **3,155 archive entries**, of which **2,946 are PNG files** and **1,465 are native 32×32 PNG images**. Editable sources (.ase, .aseprite, .psd), GIFs, lore/reference documents and alternate versions remain in the provenance catalog and original ZIPs. A source file is not necessarily a finished playable sprite.

World tiles stay **32×32**; artwork is not enlarged to 48 pixels. Character display bounds may exceed their collision tile. Do not interpolate/blur existing pixels.

## Import all source archives locally

Run this in a build environment with all four owner-provided ZIPs:

    python3 scripts/import_owner_asset_archives.py /tmp/bearframe-owner-library \
      '/path/Bearframe assets.zip' \
      '/path/Bearframe_characters.zip' \
      '/path/Bearframe_Revision_4_10_Download.zip' \
      '/path/living_world_fx_urban_vol_1_free_citizen_v1.0.zip'
    node scripts/verify_asset_pack.js /tmp/bearframe-owner-library/runtime-pack

Outputs: runtime-pack/asset-manifest.json (all PNG IDs, exact dimensions, preload:false), runtime-pack/asset-index.json (SHA-256 and length), byte-identical runtime-pack/library/*.png, and source-inventory.json for **every** input entry including editable originals and documentation. Input ZIPs are never changed. All imported images are on-demand, not preloaded into phone RAM.

The current manifest supports at most 4,096 entries and 512 MiB per pack; the inspected inputs fit. Newer/larger libraries should be sharded rather than discard content. Paths are generated safe from ZIP filename traversal and errors fail closed without publishing partial imports.

## Existing Android build

    BF_ASSET_PACK_DIR=/tmp/bearframe-owner-library/runtime-pack \
      BF_ENGINE_PREVIEW=1 bash android/build.sh /tmp/bearframe-owner-preview.apk

The existing Android build verifies this pack and places every imported image under enginehost/packs/active in the APK. **The default diagnostic scene still uses its synthetic atlas** until an explicit scene-role/profile manifest selects the actual terrain, actor sprites, UI, and effects. Do not claim art is already visibly integrated from packaging alone. The eventual renderer must load scene dependencies lazily and test installed WebView actual pixels, including Android memory pressure.

Keep public source-control scripts separate from raw third-party source packs: several uploaded licenses allow art in finished games but not redistribution as independent asset packages. This is not a reason to omit any assets from the user's game; it is a distinction between deploying artwork in a game and uploading editable source as a standalone library.

## CI and quality gates

Node regression makes a synthetic nested ZIP containing two PNGs, editable source and documentation; importer must preserve all records, package every PNG, pass the independent asset-pack verifier, preserve source, and refuse corrupt images atomically. The four uploaded ZIPs are private test inputs, not included in public CI. Real 32px terrain, character sprites, UI and effect assignment, licensing manifests, large-pack installed-device profiling and phone acceptance remain open.

Live animation means stale memory-recovery tests must compare canvas at an identical presentation tick, rather than different accidental animation frames.
