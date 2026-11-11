# Landscape menu and controller acceptance — November 11, 2026

This is an **engine-only** checkpoint for the experimental unified Android WebView host. It does not change the original Rhino launcher, the frozen game prototype, or historical save keys. Engine-v1 release gate remains open.

## Fixed behavior

- The 800 × 450 stage fits the live screen inside safe-area insets, with no scrolling required for gameplay. Landscape panels keep map, touch D-pad, events, party/inventory and save verification on screen.
- Event and multi-actor battle controls paginate without dropping action commands. A gamepad's Confirm action activates the **focused** Previous/Next button, not an unintended dialogue choice or battle turn. Disabled and wrong-menu paging controls are refused.
- After paging, keyboard/gamepad focus is transferred to the first enabled control on the newly visible page, or to an available page-navigation button if that page has no actions. This prevents focus from remaining on a detached DOM node.
- Confirm on the event Close button dismisses the event rather than choosing the first dialogue response. The Save screen also honors its focused button instead of always triggering Verify.
- The integrated party battle UI uses an explicit host-handled render contract. The host can rebuild the panel and attach pagination after a committed turn; the button's click handler no longer discards those controls with a second render. Failed turns can retain current selections and page state.

## Automated verification

- Node regressions: `tests/input-host.test.js`, `tests/battle-controller-navigation.test.js`, `tests/landscape-layout.test.js`, and `tests/party-panel-paging.test.js`.
- Clean Android build/Rhino tests and installed-app emulator run must be checked on the **latest commit**, not inferred from a previous green commit. Emulator runs that skip device stages do not count.
- Current installed emulator landscape geometry stage checks orientation, safe-area fit, no scrolling, visible panel regions, and diagnostics switch. It does **not** itself exercise real Bluetooth gamepad hardware or all multi-page focus flows. Those remain physical-device acceptance requirements.

## Target Android acceptance (Moto G 2025)

Open the new unified-engine landscape test APK. Exercise movement in all directions; repeatedly enter event/combat phases; use page Next/Previous with touch and a controller if available; verify party inventory, Save tab and journal revision; force-stop and reopen to confirm durable progress. Rotate to both landscape orientations and ensure no controls are cut off or require document scrolling. Record freezes, input drops, hidden buttons, soft-keyboard overlap and rendering/performance problems with the APK commit ID.

**Not a release claim:** Physical-device controls, screen-fit ergonomics, memory/thermal stability, large-art integration, release signing and complete engine-v1 validation remain outstanding.
