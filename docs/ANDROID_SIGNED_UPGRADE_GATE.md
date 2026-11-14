# Bearframe RPG Engine — Same-Signer Android Upgrade Gate

**Scope:** reusable engine, original Rhino compatibility and Android package replacement. This is an automated test gate, **not** production signing approval.

## Build contract

- Checked-in `android/AndroidManifest.xml` retains original `dev.bearframe.ridge`, `versionCode=1`, original Rhino launcher and unchanged exported/unexported Activity routing.
- `android/build.sh` accepts optional `BF_ANDROID_VERSION_CODE` for a **higher versionCode**. `scripts/build_versioned_manifest.py` rejects values that are non-decimal, zero-padded, negative, unchanged, beyond 2,100,000,000 or packages outside the two allowed Bearframe identities. It writes only a new manifest in temporary build storage; checked-in manifests and saves remain unchanged.
- The CI job generates one **disposable local key** and signs a baseline engine APK with version code 1, plus an upgrade APK with code 2, using the **same key**. It compares their verified signer SHA-256 certificate fingerprints and checks `aapt2 dump badging` identities and version codes.
- After the user-confirmed historical compatibility import reaches an independently saved battle at sequence 1, the installed package is upgraded with `adb install -r` to code 2. The installed Android 35 instrumentation asserts version code 2, the exact playable original-rule journal, the original untouched source save key, a separate unrelated preference and the canonical independent engine journal.
- The standalone optional owner-profile CI test uses version code 3 afterward so it never tries to downgrade the test APK. CI refuses signature mismatches or malformed version overrides.

## What remains open

1. Production app signing identity: long-lived owner key in a secure owner-controlled location, with documented key rotation/loss handling. Do not commit or upload the private keystore to the public repository.
2. Physical Moto G (2025) same-signer **real version upgrade** with authentic user saves, live app profile, gamepad and no-clear memory/thermal soak. The emulator uses synthetic fixture saves only.
3. A safe downgrade/rollback plan. Android normally rejects lower version codes, and uninstalling an app erases its private data. Do NOT suggest uninstall/reinstall as a save-preserving workaround. User-exported validated backup/recovery and user consent need full field acceptance.
4. The CI preview APK uses a fresh disposable signer each run. Its Android package is separately installed from the original game; previews from different runs are **not** a safe in-place update. Keep earlier preview data until external backups are established.
5. Final bound original/licensed art and sound, actual physical SAF document picker, production launcher decision, and complete release gate Issue #1.

**Acceptance:** latest-source Node + Rhino green, signed package certificate equality, actual v1 -> v2 Android PackageManager replacement and installed two-process original/compatibility save continuity. CI job logs and link to release milestone must be recorded; no engine release declaration without physical evidence.
