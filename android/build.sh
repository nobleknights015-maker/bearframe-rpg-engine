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
cp "$root"/fixtures/engine-project.js "$work/assets/fixtures/"
cp "$root"/enginehost/*.js "$root"/enginehost/*.html "$root"/enginehost/*.css "$work/assets/enginehost/"
# The two pixel fixtures exist only for WebView asset I/O diagnostics.
mkdir -p "$work/assets/enginehost/assets"
base64 --decode "$root/enginehost/fixtures/terrain.png.b64" > "$work/assets/enginehost/assets/terrain.png"
base64 --decode "$root/enginehost/fixtures/characters.png.b64" > "$work/assets/enginehost/assets/characters.png"
printf '%s\n' \
  "eaaae7e1a33e854df437f592ea0cc98e530e8b955172ae47b75406378e4ea179  $work/assets/enginehost/assets/terrain.png" \
  "c9d3ad73ed2d6a8c67d8cec169cd190841eb61cc7a51c52e040ae0f8bf573722  $work/assets/enginehost/assets/characters.png" | sha256sum -c -
unzip -p "$RHINO_JAR" META-INF/LICENSE.txt > "$work/assets/Rhino-LICENSE.txt"
unzip -p "$RHINO_JAR" META-INF/NOTICE.txt > "$work/assets/Rhino-NOTICE.txt"
java -m jdk.compiler/com.sun.tools.javac.Main -source 8 -target 8 -bootclasspath "$platform:$tools/core-lambda-stubs.jar" -classpath "$RHINO_JAR" -d "$work/classes" "$root/android/src/dev/bearframe/ridge/"*.java
(cd "$work/classes" && zip -q -r "$work/classes.jar" .)
"$tools/d8" --min-api 28 --lib "$platform" --output "$work/dex" "$work/classes.jar" "$RHINO_JAR"
"$tools/aapt2" link -o "$work/base.apk" --manifest "$root/android/AndroidManifest.xml" -I "$platform" -A "$work/assets"
(cd "$work/dex" && zip -q "$work/base.apk" classes.dex)
"$tools/zipalign" -f 4 "$work/base.apk" "$work/aligned.apk"
: "${SIGNING_KEY:?Specify a development keystore}" "${BF_KEY_PASS:?Set key password}"
"$tools/apksigner" sign --ks "$SIGNING_KEY" --ks-pass env:BF_KEY_PASS --out "${1:?specify output APK}" "$work/aligned.apk"
"$tools/apksigner" verify --verbose "$1"
