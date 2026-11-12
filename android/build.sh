#!/usr/bin/env bash
set -eu
root="$(cd "$(dirname "$0")/.." && pwd)"
tools="${BUILD_TOOLS:-$ANDROID_HOME/build-tools/35.0.0}"
platform="${ANDROID_JAR:-$ANDROID_HOME/platforms/android-35/android.jar}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/classes" "$work/dex" "$work/assets"
: "${RHINO_JAR:?Specify Mozilla Rhino 1.7.15}"
echo "2427fdcbc149ca0a25ccfbb7c71b01f39ad42708773a47816cd2342861766b63  $RHINO_JAR" | sha256sum -c -
node "$root/android/compile.js" "$work/assets/simulation.js"
cp "$root"/game/*.webp "$work/assets/"
# The portable Engine Kit executes unchanged inside the offline Android WebView.
# Keep existing Rhino output and assets intact as regression baselines.
mkdir -p "$work/assets/framework" "$work/assets/fixtures" "$work/assets/enginehost"
cp "$root"/framework/*.js "$work/assets/framework/"
cp "$root"/fixtures/*.js "$work/assets/fixtures/"
cp "$root"/enginehost/*.js "$root"/enginehost/*.html "$root"/enginehost/*.css "$work/assets/enginehost/"
# Package the exact unchanged historical game logic ONLY for explicit
# legacy-save compatibility; do not replace the canonical portable engine.
mkdir -p "$work/assets/enginehost/legacy"
cp "$root/game/world.js" "$work/assets/enginehost/legacy/world.js"
cp "$root/game/engine.js" "$work/assets/enginehost/legacy/engine.js"
# The two pixel fixtures exist only for WebView asset I/O diagnostics.
mkdir -p "$work/assets/enginehost/assets"
base64 --decode "$root/enginehost/fixtures/terrain.png.b64" > "$work/assets/enginehost/assets/terrain.png"
base64 --decode "$root/enginehost/fixtures/characters.png.b64" > "$work/assets/enginehost/assets/characters.png"
printf '%s\n' \
  "eaaae7e1a33e854df437f592ea0cc98e530e8b955172ae47b75406378e4ea179  $work/assets/enginehost/assets/terrain.png" \
  "797416870b420e67ef0f43443b039f21c3e86710ecb74c0f7380559041404a4a  $work/assets/enginehost/assets/characters.png" | sha256sum -c -
# Opt-in original-asset pack is verified again at build time, never trusted
# solely because its index claims a checksum. Leave the current default assets
# and diagnostic launcher unchanged when no external pack is provided.
if [[ -n "${BF_ASSET_PACK_DIR:-}" ]]; then
  node "$root/scripts/verify_asset_pack.js" "$BF_ASSET_PACK_DIR" \
    "$work/assets/enginehost/packs/active"
  # Scene roles are data-only. Validate every owner image ID and descriptor
  # before synthesizing the sole CSP-local script; never execute source ZIP code.
  if [[ -f "$(dirname "$BF_ASSET_PACK_DIR")/art-profile.json" ]]; then
    python3 - "$BF_ASSET_PACK_DIR" "$work/assets/enginehost/art-profile.js" <<'BF_OWNER_ART_PY'
import json, pathlib, sys
pack=pathlib.Path(sys.argv[1])
src=pack.parent/"art-profile.json"
if src.stat().st_size>4000000:
    raise SystemExit("Owner art profile exceeds build input limit")
profile=json.loads(src.read_text(encoding="utf-8"))
original=json.loads((pack/"asset-manifest.json").read_text(encoding="utf-8"))
if profile.get("version")!=1 or not isinstance(profile.get("manifest"),dict) or original.get("version")!=1:
    raise SystemExit("Invalid versioned owner art profile")
assets=profile["manifest"].get("assets")
if not isinstance(assets,dict) or len(assets)!=len(original["assets"]):
    raise SystemExit("Owner art profile must register EVERY original image")
for ident,desc in original["assets"].items():
    expected={**desc,"path":"enginehost/packs/active/"+desc["path"],"preload":False}
    if assets.get(ident)!=expected:
        raise SystemExit("Owner art profile is not byte-library-consistent: "+ident)
required=profile.get("requiredImages")
if not isinstance(required,list) or not 1<=len(required)<=32 or len(set(required))!=len(required) or any(
        ident not in assets for ident in required):
    raise SystemExit("Invalid owner scene dependency list")
theme=profile.get("theme")
if not isinstance(theme,dict) or theme.get("tileSize")!=32 or not all(
        k in theme.get("tiles",{}) for k in ("floor","wall")):
    raise SystemExit("Owner profile must preserve native 32x32 terrain")
pathlib.Path(sys.argv[2]).write_text("var BEARFRAME_OWNER_ART_PROFILE = "+
    json.dumps(profile,ensure_ascii=True,separators=(",",":"))+";\n",encoding="utf-8")
BF_OWNER_ART_PY
  fi
fi
# A generated, original silent WAV proves local audio packaging without game media.
node "$root/scripts/generate_audio_fixture.js" "$work/assets/enginehost/audio/diagnostics/silence.wav"
unzip -p "$RHINO_JAR" META-INF/LICENSE.txt > "$work/assets/Rhino-LICENSE.txt"
unzip -p "$RHINO_JAR" META-INF/NOTICE.txt > "$work/assets/Rhino-NOTICE.txt"
java -m jdk.compiler/com.sun.tools.javac.Main -source 8 -target 8 -bootclasspath "$platform:$tools/core-lambda-stubs.jar" -classpath "$RHINO_JAR" -d "$work/classes" "$root/android/src/dev/bearframe/ridge/"*.java
(cd "$work/classes" && zip -q -r "$work/classes.jar" .)
"$tools/d8" --min-api 28 --lib "$platform" --output "$work/dex" "$work/classes.jar" "$RHINO_JAR"
# Preview has a different Android application id and launches the same offline
# engine host directly, so user testing never requires replacing an installed
# original Rhino app or its saved preferences.
manifest="$root/android/AndroidManifest.xml"
if [[ "${BF_ENGINE_PREVIEW:-0}" == "1" ]]; then
  manifest="$work/preview-manifest.xml"
  python3 "$root/scripts/build_preview_manifest.py" "$root/android/AndroidManifest.xml" "$manifest"
fi
"$tools/aapt2" link -o "$work/base.apk" --manifest "$manifest" -I "$platform" -A "$work/assets"
(cd "$work/dex" && zip -q "$work/base.apk" classes.dex)
"$tools/zipalign" -f 4 "$work/base.apk" "$work/aligned.apk"
: "${SIGNING_KEY:?Specify a development keystore}" "${BF_KEY_PASS:?Set key password}"
"$tools/apksigner" sign --ks "$SIGNING_KEY" --ks-pass env:BF_KEY_PASS --out "${1:?specify output APK}" "$work/aligned.apk"
"$tools/apksigner" verify --verbose "$1"
