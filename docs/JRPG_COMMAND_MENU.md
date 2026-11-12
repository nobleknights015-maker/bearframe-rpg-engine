# Bearframe JRPG command UI checkpoint

The Android landscape engine now presents an exploration-first screen rather
than three large diagnostic tabs. The map, native-pixel scene renderer, room
transition, touch D-pad, and canonical save journal are unchanged. A visible
Menu button opens a full-screen classic JRPG command dialog with Items,
Techniques, Equipment, Status, Party, Quests, Save and Options.

The menu is presentation-only, backed by the existing canonical
partyWorld.view() state. Commands to equip, unequip or use consumables
delegate to partyWorld.dispatch(), which commits and verifies the durable save
before the menu refreshes. Opening, changing pages, navigating or closing
never writes a gameplay revision.

The save screen exposes the actual single automatic checkpoint and
independent verification; it does not pretend there are multiple manual
save slots. Techniques lists actual learned battle skills and their MP costs;
out-of-battle casting remains explicitly unavailable. The Options screen
toggles the touch pad and transition animations as ephemeral display state.

Native controller Menu opens the command UI; Pause opens Save; Confirm,
Cancel and directional navigation operate the visible command list before
any world movement. Touch works through the same button callbacks. The menu
is refused during pending dialogue and party battle, preserving the existing
decision/target-selection flow. Long lists use page buttons instead of
scrolling or clipping.

The old World/Party/Save diagnostic DOM remains available for test
instrumentation and explicit developer mode. In normal landscape gameplay
the old tab bar is no longer player-facing.

## Acceptance

- Node regression test: node --test tests/*.test.js including
  tests/jrpg-menu.test.js.
- Android CI must build a signed APK and pass the installed Android 35
  emulator's movement, combat, save, input, room and restart routes.
- Still required: physical Moto G check for readable command windows,
  virtual pad hit areas, frame pacing, options, rotation/background and
  sustained play. The game content is still diagnostic; UI completion
  alone does not close the engine v1 release gate.
