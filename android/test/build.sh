#!/usr/bin/env bash
set -eu
root="$(cd "$(dirname "$0")" && pwd)"
t="${BUILD_TOOLS:-$ANDROID_HOME/build-tools/35.0.0}";j="${ANDROID_JAR:-$ANDROID_HOME/platforms/android-35/android.jar}"
w="$(mktemp -d)";trap 'rm -rf "$w"' EXIT
mkdir "$w/classes" "$w/dex"
java -m jdk.compiler/com.sun.tools.javac.Main -source 8 -target 8 -bootclasspath "$j:$t/core-lambda-stubs.jar" -d "$w/classes" "$root/RouteRunner.java"
(cd "$w/classes" && zip -qr "$w/classes.jar" .)
"$t/d8" --min-api 28 --lib "$j" --output "$w/dex" "$w/classes.jar"
"$t/aapt2" link -o "$w/base.apk" --manifest "$root/AndroidManifest.xml" -I "$j"
(cd "$w/dex" && zip -q "$w/base.apk" classes.dex)
"$t/zipalign" -f 4 "$w/base.apk" "$w/aligned.apk"
"$t/apksigner" sign --ks "$SIGNING_KEY" --ks-pass env:BF_KEY_PASS --out "$1" "$w/aligned.apk"
