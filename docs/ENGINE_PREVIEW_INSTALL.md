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

## Separate v2 party-world diagnostic (engine only)

Below the original v1 world diagnostic, the offline preview now contains a
**separate rendered v2 party-world scene**. Its own D-pad, event choices,
inventory, party combat, XP/level display, and save-verification control use
one canonical session with a different synthetic project ID and journal
namespace. The world canvas uses the existing packaged PNG atlas and
renderer; it is not a new campaign or permanent production layout.

After recruiting a second party member, the generic status section shows
both actors' HP, MP and stats. Equipping an item reserves one physical copy
from shared inventory. Android memory trim pauses controls when required
atlases are missing; restoration redraws the scene without changing the
journal. Returning to the original v1 panel will not load or rewrite the
v2 test save.

The app may still need to be uninstalled **only from its separate preview
package** before installing a later CI APK signed with another disposable
key. This is not the production upgrade path.

## v2 engine screen navigation and optional controllers

The integrated v2 engine diagnostic is now organized into **World**,
**Party & inventory**, and **Save** tabs. Switching tabs does not change
gameplay state or increment the durable journal revision. Returning to
dialogue or an active encounter highlights the required action. The Save
screen checks already committed progress, without creating a new save.

Touch works without a gamepad. The unified WebView Activity additionally
forwards Android standard gamepad/joystick keys through the existing
`ControllerInputRouter` into the canonical v2 engine view:

- D-pad/left stick: walk when exploring; navigate focused controls when
  dialogue/combat is active, and move among controls/tabs in menus.
- South/A/Cross: confirm a focused dialogue, combat, equipment or save action.
- East/B/Circle: close a cancellable event or return from Party/Save to World.
- West/X/Square: Party & inventory; shoulders L1/R1: previous/next screen.
- North/Select: World; Start: Save screen (a *navigation shortcut*, not a
  system-level Android pause operation).

The native adapter still has a hardware-device acceptance requirement.
Synthetic Android 35 emulator gamepad events are not proof of correct
button labels, Bluetooth pairing, latency or accessibility on a real Moto G.
The default old Rhino launcher and its controller route are unchanged.
