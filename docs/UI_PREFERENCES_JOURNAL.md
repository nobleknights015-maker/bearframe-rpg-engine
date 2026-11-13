# Durable display and audio preferences journal

A reusable, project-scoped `framework/ui-preferences.js` service now stores
**UI preferences separately from gameplay progress** using the same verified
two-slot native save journal as the simulation, with an unrelated prefix:

```
bf:ui:<project_id>:v1:a
bf:ui:<project_id>:v1:b
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

This module does not by itself wire the Options menu. That integration
belongs to the separate player-facing settings pass, after current
game-audio work is merged and tested. Physical Android restoration and
upgrade/rollback acceptance remain open.
