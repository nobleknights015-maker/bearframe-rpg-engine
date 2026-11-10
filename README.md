# Bearframe RPG · Sounding Ridge

**Copyright © 2026 Chris (nobleknights015-maker), Bearframe Labs. All rights reserved.** Reuse of my original engine and Bearframe intellectual property requires my prior written permission. [Full ownership notice](COPYRIGHT.md)

Development build 0.1.0. An original, offline slice from the buried planetary Sleeper site to Mira's survey expedition.

## Playing on Android

Open the signed APK and choose Install. Launch **Bearframe RPG**, enter a chosen name, choose a finish and tap **Awaken**. Walk into an individual or object to interact. The Guardian and service drawer are in the chamber. The gallery leads east and the service berth restores chassis integrity and charge. **Brace** softens the next strike and restores charge. The expedition saves after actions and resumes when the app opens. Mira's field-record choice ends the slice. Removing the app also removes its local save.

## Scope and authority

Revision 4.10 master SHA-256: 195c831e5d579ce7675750f038645fddedcd3f9e88b1a3dc8210e0c9abebb31f. Sections 86 and 101, the planetary-site retcon, the director reporting rules and the Ghost Grid first-contact restriction govern this chapter. The requested RPG premise is one possible forward event for this player. The chip entrusted by Chris allows fresh sentience in this Sleeper whose earlier identity was erased. The existing Sleepers already possessed sentience. The Guardian remains at the site. No one gains Founder access, repairs the core or changes station admission policy.

Sounding Ridge, its individual encounters, field gear and dialogue are original game additions. The player can choose to travel with an Echo and can engage a legacy crawler's local escort protocol. A hostiles-first alternative exists for each. A Hollow is a Directorate drone. A modern coupling cannot fit, a compatible legacy bearing increases chassis capacity, and only the equipped weapon alters the chosen frame's field/battle appearance. Mira speaks for her expedition and never claims prior Ghost Grid knowledge. The encounter does not update the lore bible or become established RP history.

## Project layout

- game/ contains original world data, a deterministic state machine, rendering, a browser interface and compact art. Open index.html with the folder intact for the browser version.
- android/ hosts the same simulation, interpreted by Mozilla Rhino 1.7.15, with native Android buttons, Canvas rendering and app-private SharedPreferences. The fixed 296 × 202 pixel buffer is reused. The application requests no Android permissions.
- tests/ covers major systems, phone touch interaction and the Android presentation adapter. android/test/ exercises real native widgets across two Android processes.
- reference/ contains the independent ROM research. FINDINGS.md lists exactly which results are observed, emulated, inferred and unverified.
- evidence/ contains the actual test logs and build results for this version.

The opening portrait is a crop of the supplied Weathered S-03 design sheet. The three environment illustrations are original to this build. Sprites use authored pixel shapes. Final character animation, sound, a full campaign and release-grade device profiling remain open.

## Development and rebuild

The player needs only the APK. For developers, use Node 24, JDK 21, Android platform 35 and build-tools 35.0.0. Build inputs are TypeScript 5.9.3 and Rhino 1.7.15 from npm and Maven Central. The script verifies the Rhino JAR hash, includes its license and notices, and compiles the canonical game sources directly into the Android asset. Keep the signing key private. A local developer key can sign a fresh install and its instrumentation runner. Updating an installed APK in place requires signing continuity. This source bundle contains no private key.

```sh
node --test tests/systems.test.js
python tests/phone.py --chromium /path/to/chrome-headless-shell
export ANDROID_HOME=/path/to/sdk
export RHINO_JAR=/path/to/rhino-1.7.15.jar
export TYPESCRIPT_PATH=/path/to/typescript/lib/typescript.js
export SIGNING_KEY=/path/to/development.p12
read -rs BF_KEY_PASS; export BF_KEY_PASS
android/build.sh "$PWD/Bearframe-Sounding-Ridge.apk"
android/test/build.sh "$PWD/route-test.apk"
```

On a disposable test emulator with a fresh save, install both APKs and run the native widget replay. The first run stops after the player's first combat turn. The second must start in turn two, recruit the crawler and reach Mira.

```sh
adb install -r Bearframe-Sounding-Ridge.apk
adb install -r route-test.apk
adb shell am instrument -w -e stage first dev.bearframe.ridge.tests/.RouteRunner
adb shell am force-stop dev.bearframe.ridge
adb shell am instrument -w -e stage second dev.bearframe.ridge.tests/.RouteRunner
```


## Independent Engine Kit (engine-first development)

The original Sounding Ridge Android Activity remains the launcher and frozen regression baseline. The reusable JRPG engine under `framework/` is now **integrated into a separate, internal Android WebView Activity** (`UnifiedEngineActivity`), using the same portable gameplay code, the native synchronous save bridge, and a shared sprite-scene interface. The [unified engine host design](docs/UNIFIED_ENGINE_HOST.md) documents both the passing Android process-restart test and the remaining launcher-promotion gates. The Engine v1 reuse ports are owned by this repository; they do not modify Plushbound Engine v1.

The Engine Kit currently provides verified project/schema validation, a deterministic state machine, scripted event choices, configurable combat and inventories, a two-slot save journal, a renderer-independent scene composer, a pixel-perfect browser Canvas adapter, an Android atlas drawing adapter, a portable audio scheduler, and an independently tested multi-character battle module. See [Framework API](docs/FRAMEWORK_API.md) and [engine release criteria](docs/ENGINE_RELEASE_GATE.md).

Tests for these modules run in GitHub Actions using Node, the Rhino interpreter used by Android, and clean Android APK builds. The Android emulator has also verified the new offline WebView session through a two-process save/restart sequence alongside the unchanged Rhino game route. **Do not treat this as the complete engine release:** production save migration, real artwork and audio backends, full party UI integration, physical-device profiling, and final launcher promotion are still pending. Story expansion remains paused.
