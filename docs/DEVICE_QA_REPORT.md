# Bearframe Engine — Phone-only Device QA Report

Status: engineering diagnostic, not an engine release certificate. This records small, bounded, non-destructive evidence from the installed offline Android WebView.

## Collecting on a Moto G (2025)

1. Open the separately installed engine preview. Continue to use the four-cardinal controls, menus, and the visible save verifier.
2. Open **Developer diagnostics** from the engine's diagnostic Save panel. The current visible game control bounds are sampled before the gameplay stage is hidden.
3. Tap **Generate and copy device QA report**. If Android's clipboard service succeeds, paste the JSON into a private bug report or issue. If clipboard is unavailable, the read-only text box still contains the report for manual copying.
4. To measure game controls in a different state, return to the game, navigate to the relevant phase, then reopen diagnostics and recapture. Only currently visible controls count; hidden, disabled and paginated controls are excluded.

## Collected fields

- UI: current adapted landscape stage width/height/scale, number of visible buttons, smallest CSS pixel width/height, number of hit targets under **44 CSS pixels**, up to 12 labelled undersized examples.
- Renderer: successful Canvas draw count, skipped unchanged draws and draw-only CPU timing.
- Scene work: bounded WebView CPU compose-plus-draw timing average and p95, count of over-budget samples, and loaded asset count.
- Native: Android API level, generic device model, HOST-process PSS, Java heap in use, native heap allocated. Android Chromium may run a separate renderer process; host-process PSS is **not whole-app memory**.
- Save validation: boolean **saveVerified** only. No journal, character, map, inventory, save key, historical data, phone ID, account, credentials or location is read or copied.

## Interpretation and limits

The report is deliberately on-demand and does not run a background sampler or write the game state. Values can vary with Android WebView visibility and cache state; the displayed rendering timings are JavaScript work costs, not actual delivered screen FPS. The report is copied only after an explicit button click; Android OS clipboard can be accessed by other apps as usual, so share it intentionally.

An undersized logical/visual CSS hit target is flagged, but the threshold is an ergonomic diagnostic, not a certification of accessibility. Android navigation inset and display scale need actual device review.

Physical Moto G performance, Bluetooth/USB controller behavior, audible audio, SAF document picker, safe production signing and upgrade/rollback remain open release gates. Installed emulator QA evidence does not close them.

## Callback pacing interpretation

The report also includes `callbackPacing`: the number of recent RAF callback gaps, average/p95/maximum interval in milliseconds, count of long gaps above 33.34ms/50ms, and callback-rate reciprocal. This can reveal JavaScript scheduling stalls on the phone without storing gameplay. **Callback rate is not GPU display FPS**, and no rate in the report certifies smooth physical delivery. Idle, active movement, menus and battle should be compared with the real display and Android frame metrics when available.
