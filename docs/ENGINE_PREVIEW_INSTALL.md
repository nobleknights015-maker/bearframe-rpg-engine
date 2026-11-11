# Bearframe Engine Preview — Android-only testing

This is an **experimental engine testing build**, not the default game and not
a shipping release. The GitHub Actions build creates
`bearframe-engine-preview.apk` with the **separate** Android application ID
`dev.bearframe.ridge.preview` and label **Bearframe Engine Preview**.
Tapping its icon launches `dev.bearframe.ridge.UnifiedEngineActivity`, the
current restricted offline WebView engine host.

It builds the exact same engine code, packages and rules as the normal
`bearframe-ci.apk`; only Android manifest package, label and launcher routing
are different. `ExpeditionActivity` remains in the package solely as the
legacy source/regression implementation, not the preview launcher. The
regular `android/AndroidManifest.xml` and existing app behavior do not change.

## Safe installation on a phone

1. Download ONLY `bearframe-engine-preview.apk` from the latest successful
   GitHub CI `bearframe-android-ci-build` artifact.
2. In Android Files, tap the APK, allow installation from that source if prompted,
   and open **Bearframe Engine Preview**.
3. The preview's engine host shows its synthetic scene, directional controls,
   event, inventory, party and historical-save recovery controls. Events and
   combat must be resolved before movement resumes; their controls appear
   directly below the scene in current builds. When one opens, the preview
   automatically focuses and scrolls to the required action rather than
   leaving the disabled D-pad looking unresponsive. Every successful action saves
   automatically into the preview's independent journal. The **Save and
   continue** section offers a read-only **Verify saved progress** button.
   This is an engineering diagnostic, not a polished game menu.

**Never uninstall the original Bearframe RPG app to install this.** The preview
is a separate app with separate `SharedPreferences` and cannot directly read
the original app's private save. If testing historical recovery in the preview,
import an **externally exported original-format JSON** through its file picker.
Keep the original source app and its saves intact.

Each CI build is signed with a disposable temporary key; later preview builds
may not update the preview already installed because signing certificates differ.
Only the **preview** may be removed if necessary for testing another CI build.
Removing the preview removes its private synthetic progress and compatibility
journal; export any desired test progress to an external JSON first.
APK build verification and emulator launch are CI checks. Real physical-device
acceptance is still outstanding.
