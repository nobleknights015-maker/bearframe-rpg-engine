# Gameplay audio integration and private soundtrack packaging

**Engine milestone; not yet a finished soundtrack.** Bearframe's portable
`framework/audio.js` director, validated `framework/audio-browser.js`
offline playback backend and Android audio-focus bridge are now connected to
actual JRPG UI actions and canonical saved world events.

No music or sound-effects library has been supplied to this repository. The
default `enginehost/audio-profile.js` is deliberately null, and gameplay is
silent with an explicit "No licensed game soundtrack has been packaged"
message in Options. The existing generated silent WAV is an *emulator
diagnostic only*, not music or finished game sound design.

## Authored audio profile (private local build input)

The user or game producer supplies a JSON file:

```json
{
  "version": 1,
  "catalog": {
    "field_theme": {"type": "music", "path": "audio/music/field.ogg", "loop": true},
    "battle_theme": {"type": "music", "path": "audio/music/battle.ogg", "loop": true},
    "confirm_ui": {"type": "sfx", "path": "audio/ui/confirm.wav"},
    "door_ui": {"type": "sfx", "path": "audio/ui/door.wav"}
  },
  "cues": {
    "menu_select": "confirm_ui",
    "door": "door_ui"
  },
  "music": {
    "default": "field_theme",
    "battle": "battle_theme",
    "maps": {"hub": "field_theme"}
  }
}
```

In the private local audio source directory, the files appear under the exact
relative paths in `catalog`. All media must be owned or properly licensed.
Audio IDs and area IDs are stable engine/project identifiers, not new
game lore. `music.maps` entries must reference actual authored map IDs.

### Build

Set both `BF_GAME_AUDIO_PROFILE_JSON` and `BF_GAME_AUDIO_PACK_DIR` when
invoking `android/build.sh` for a **private local APK build**. The
`scripts/install_game_audio_profile.js` installer validates the data-only
catalog, strictly local paths, valid music/SFX types, sound cues, byte size,
and absence of symlinked media. It copies only declared audio clips into
`enginehost/audio/...` within the APK asset tree and SHA-256 verifies their
exact bytes after writing. It also creates an APK-internal, non-secret
`game-audio-manifest.json` with hashes and lengths. Source file paths,
unlicensed demo content, and original sound bytes never enter public GitHub.

The validation and build are fail-closed; a profile without its matching
media cannot create a playable APK.

## Playback contract

- User action is required: choose **Options → Enable game sound**. Neither
  scene startup nor foreground resume activates sound.
- Looping music follows the current saved map, with optional battle music
  during the canonical combat state. Door transitions and saved party
  combat rounds emit configured sound cues, not simulated events.
- Other selectable cues include `menu_open`, `menu_close`,
  `menu_select`, `step`, `event`, `item`,
  `battle_start`, `battle_round`, `battle_end` and `save`.
  Missing optional cues are silent, not errors.
- Audio mute/volume bus changes are ephemeral presentation settings and
  do not change the RPG save. Android focus loss, app background and
  Activity suspension stop playback; foreground resume does not autoplay.
- The native audio focus request happens only in a user-triggered enable
  action, before attempting browser playback.
- Browser policy/decoder rejection is surfaced as unavailable and requires
  another explicit activation, never silent retries inside game ticks.

## Open QA/release gates

This closes the **audio integration API wiring** gap only. It does not
claim completed music, sound design, user-licensed media, audible output,
headset/Bluetooth/call interruption acceptance, physical Android latency,
performance or production APK signing. End-to-end verification with the
actual audio library and physical device remains required.
