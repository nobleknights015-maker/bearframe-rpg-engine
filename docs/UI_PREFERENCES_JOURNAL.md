# Durable display and audio preferences journal

A reusable, project-scoped `framework/ui-preferences.js` service now stores
**UI preferences separately from gameplay progress** using the same verified
two-slot native save journal as the simulation, with an unrelated prefix:

```
bf:<project_id>:v1:ui:a
bf:<project_id>:v1:ui:b
```

The state is intentionally small, versioned and independent of any map,
inventory, actor, battle or quest:

```json
{"version":1,"sequence":0,"showPad":true,"reducedMotion":false,
 "muted":false,"volumes":{"master":100,"music":80,"sfx":100}}
```

Each valid change writes an alternating journal slot, verifies exact
readback and only then publishes a new visible preference. Failed writes
leave the current displayed value unchanged. On restart, the newest
valid slot wins; a corrupt latest slot may recover the previous intact
generation. If both slots are unreadable or incompatible, updates refuse
to overwrite them silently. Readback errors do not change the RPG session.

`showPad` and `reducedMotion` are display-only; `muted` and volume
settings concern local playback only. `enabled` is deliberately **not**
persisted because Android/browser audio must not autoplay after startup
or foreground restoration. Playback still needs an explicit gesture.

The player-facing JRPG Options menu is now wired to these preferences:
D-pad visibility and reduced-motion settings are loaded at construction
and applied to the viewport; sound bus volumes and mute are restored into
the inactive audio director before any user-enabled playback. Every menu
change commits to this independent journal **before** updating the UI or
audio gain. A failed settings write displays an error and leaves the
previous verified value active.

The installed Android test `unified-ui-settings-first/second` opens the
real Options menu, changes display settings, writes audio preferences,
force-stops the Activity, and verifies restored CSS, audio levels,
non-autoplay, original RPG save revision and separate journals.

**Open:** physical Android acceptance, OS app update/rollback across
different signing identities, accessibility/large-font ergonomics and
long-running storage/flash endurance.
