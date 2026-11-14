# Bearframe Engine — Isolated CI Preview Installs

**Purpose:** let an Android-only tester install and compare disposable GitHub Actions preview builds without wiping the previous preview app's private save data or altering the original Rhino launcher.

## Why this is necessary

Each GitHub Actions run currently generates a **different disposable signing key**. Android correctly refuses to install a new APK with a mismatched signer over an already-installed app that uses the same package ID. Uninstalling the earlier preview would erase its app-private saves.

**After this change**, CI embeds a unique opaque build identity made from the source SHA prefix, GitHub run ID and attempt. The test package is `dev.bearframe.ridge.preview.c<hex-build-id>`, with launcher label `Bearframe Engine QA <sha8>`. The installed QA build keeps the same portable engine and native 32x32 rendering, with its **own** isolated Android preferences. A new CI run installs beside earlier previews, rather than replacing them.

The original production-like package `dev.bearframe.ridge` is **never renamed**; its original Rhino launcher and journals remain untouched. A manual stable-key preview can still be made with `BF_ENGINE_PREVIEW=1` and no build ID, preserving existing workflows. Both modes use the same packaged source and build toolchain.

## Download and install

1. Open a **successful** main-branch GitHub Actions run for `Bearframe engine checks`.
2. Download its `bearframe-android-ci-build` artifact ZIP before GitHub's seven-day expiration.
3. Extract **only** `bearframe-engine-preview.apk` from that ZIP and install it on Android. The other APKs are CI tests/legacy harnesses, not the standalone preview launcher.
4. Launch the **Bearframe Engine QA <sha>** app. In Save > Developer diagnostics, generate a device QA report after visiting the screens under investigation; avoid sharing private save contents.
5. A later successful run installs as another QA app. Compare behavior without deleting the earlier build. Do not uninstall an older preview containing progress unless you've separately preserved any progress you want to keep.

## Important limits

- This is a **diagnostic** preview using synthetic CI art/content, not a licensed owner-art production build. It is not a final Bearframe game release.
- Save progress is isolated *per preview app*. It does NOT automatically transfer between different CI builds. A stable production signing identity and physically tested export/import/upgrade are still required for release.
- CI key generation remains disposable and private. The unique package identity is not a substitute for actual same-signer upgrade acceptance, which is tested separately by `docs/ANDROID_SIGNED_UPGRADE_GATE.md`.
- The `BF_ENGINE_PREVIEW_BUILD_ID` input accepts only 8–32 lowercase hexadecimal characters and is invalid without `BF_ENGINE_PREVIEW=1`. Malicious package path or shell strings fail closed.
- The Android 35 emulator must install and launch the dynamically named QA package before GitHub publishes the APK artifact.

**Release gate remains open** until real Moto G performance, physical SAF picker, production signing and update/rollback, real licensed media binding, long memory/thermal soak and original launcher promotion have concrete device evidence.
