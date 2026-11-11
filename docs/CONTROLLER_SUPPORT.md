# Controller compatibility — engine input contract

Controller support is implemented as an **optional input source**. Touch controls and keyboard remain available; no controller is required to use the app.

## Devices and bindings

Standard Bluetooth and USB HID gamepads are intended to work on Android when the phone and controller expose a supported Gamepad/Joystick input source. Browser/WebView uses the standard [Gamepad API](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API), when available. Xbox, PlayStation, Nintendo-style and generic controllers may have different physical label layouts or driver mappings; compatibility with each specific controller model is **not yet confirmed on physical hardware**.

| Physical input | Engine action | Current Sounding Ridge behavior |
| --- | --- | --- |
| D-pad / left stick | Navigate | Walk in the world; move highlight between available options |
| South face button (A / Cross on common mappings) | Confirm | Activate the selected enabled action |
| East face button (B / Circle on common mappings) | Cancel | Step back from dialogue or withdraw from battle |
| West face button (X / Square) | Menu | Reserved until game menu integration |
| North face button / Select | Map | Reserved until map integration |
| Start | Pause | Reserved until pause menu integration |
| L1 / R1 | Previous/next tab | Navigate action choices on current Android prototype; future party/menu tabs |

**Do not assume printed button labels correspond to the same Android keycode on every controller**—the binding is to semantic South/East and OS key mappings. The native adapter also recognizes Android legacy `BUTTON_1`/`BUTTON_2`.

## Architecture

- `framework/controller.js`: browser-standard Gamepad snapshot normalization, D-pad/stick arbitration, deadzone and hysteresis, movement repeat, and edge-triggered face/shoulder buttons. No DOM or game state dependencies.
- `android/src/dev/bearframe/ridge/ControllerInputRouter.java`: Android `KeyEvent` and `MotionEvent` adapter translating physical controllers to the same semantic actions. A single repeat loop avoids runaway directional input; lifecycle resets held state.
- `android/src/dev/bearframe/ridge/ExpeditionActivity.java`: routes Android semantic actions to the existing simulation and visible menu buttons. Input is disabled during initial character setup so the standard Android field controls still receive D-pad focus.
- `game/ui.js` and `game/index.html`: browser Gamepad API polling when available. No controller attached means no change to gameplay, keyboard or touch.

## Verification

`tests/controller.test.js` covers standard buttons, D-pad dominance, analog deadzone/hysteresis, repeat rate, edge-triggering, and disconnect/pause state resets. GitHub Actions additionally installs the app in an Android emulator and sends synthetic `SOURCE_GAMEPAD` D-pad/A/B and `SOURCE_JOYSTICK` axis events through the native Activity. The installed-app gamepad route **passed** on Android 35 in [CI run 42735568465](https://github.com/nobleknights015-maker/bearframe-rpg-engine/actions/runs/42735568465), including controller confirmation from character creation, D-pad walking from a rest tile, B cancellation, A dialogue confirmation, and synthetic analog-stick movement. This demonstrates Android input routing, not compatibility with every physical controller.

This is **basic controller compatibility**, not final controller UX. Device-specific mapping profiles, player-remappable binds, hot-plug overlay prompts, vibration/haptics, full battle party shortcuts, and physical Bluetooth/USB controller testing remain open acceptance items.

## Platform reliability

Controller I/O must never mutate simulation state directly. It dispatches the same semantic game actions as touch input, and the existing storage/validation boundary remains authoritative. Unsupported menu actions are intentionally unbound in the prototype rather than implemented as misleading nonfunctional UI.

## Unified engine v2 input bridge — development checkpoint

The separate `UnifiedEngineActivity` now passes Android
`SOURCE_GAMEPAD` and `SOURCE_JOYSTICK` events into the same
`ControllerInputRouter` used for native semantic mapping. The
WebView `input-host.js` then chooses a visible UI action or dispatches
the same canonical world movement command used by touch. World state and
saves are *never* directly mutated by the native adapter.

The new v2 screen tabs support arrow-key navigation and Android shoulder
button changes. Controller A confirms a focused valid dialogue choice or
party action; X opens the party screen, B cancels/backtracks and Start opens
the Save screen. Normal gameplay mode still determines whether directions
walk or navigate visible choices. The host intentionally does not add a
separate controller-owned simulation state.

Android 35 installed emulation includes dedicated
`unified-v2-controller-first/second` stages for D-pad, A/B, X, L1/R1,
native analog axis and journal recovery across force-stop. A staged run
is evidence only once GitHub Actions reports **success** with the emulator
step actually executed; any skipped step is not acceptance.

Unresolved: verified named Bluetooth/USB controller models, per-device
button remapping, haptic feedback, focus ergonomics in all complex party
menus, actual latency and physical Moto G acceptance.
