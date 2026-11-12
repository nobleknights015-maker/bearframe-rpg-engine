# Reusable engine content profiles (data-only)

The engine's landscape WebView no longer needs compiled-in synthetic map, party,
event or skill definitions. An owner may supply a **validated JSON project**
when creating an Android preview or engine build. This is an engine capability,
not a Bearframe campaign or a substitute for the full release gate.

Default builds are **unchanged**: they use the established v1/v2 diagnostic
fixtures, existing journal prefixes, original Rhino launcher and old saves.

## Input schema

The JSON has exactly the following top-level shape:

```json
{
  "version": 1,
  "project": {
    "id": "sample-project",
    "contentRevision": "sample_1"
  }
}
```

The abbreviated `project` above is illustrative, not a valid playable
project. Supply a full validated project in the current
`framework/schema.js` contract: start, maps, events, items, foes,
quests, partyCombat and partyCombat.progression. A stable, lowercase
`project.id` and explicit `contentRevision` are mandatory.
A starter shape may be derived from `fixtures/party-world-project.js`,
**but don't publish authored game data as a fixture**. The validation
script also constructs an initial runtime state and roundtrips it through
the real portable serializer; invalid content fails the build.

## Prepare and build

```sh
node scripts/build_content_profile.js owner-project.json /tmp/content-profile.js
BF_CONTENT_PROFILE_JSON=/absolute/path/owner-project.json \
  BF_ENGINE_PREVIEW=1 bash android/build.sh /absolute/path/preview.apk
```

The build script uses the validated external JSON directly to replace
`enginehost/content-profile.js` in the **temporary APK workspace**.
It does not overwrite repository source or execute custom project JS.
The existing HTML loads this local data script before boot.
If `BF_CONTENT_PROFILE_JSON` is unset, nothing changes.

Content profiles can be combined with separately validated opt-in
owner-asset profiles using `BF_ASSET_PACK_DIR`. Game rules, art
manifests, scene composition and UI are independent contracts; authors
bind their own assets without rebuilding the engine's JavaScript.

## Save isolation and compatibility

* Existing full-world integration fixture:
  `bf:framework-party-world-test:v2:diagnostics` (unchanged)
* External authored world with id `sample-project`:
  `bf:sample-project:v2:runtime`
* Existing v1 diagnostics, party probe, historical Rhino saves and original
  launcher use their historical storage and are untouched.
* The existing content hash/revision gate **refuses** a content mismatch in
  an occupied authored project journal; it never silently wipes, migrates
  or overwrites that older state.

Identifiers determine save namespaces; use a stable project id across builds.
A new, incompatible project should use a new id or an explicitly managed
migration tool (not supplied by this feature).

## Release acceptance still outstanding

A successful profile build and synthetic installed-emulator test prove
validation and isolation, **not** that a complete user-authored game works
on a physical device. Before release, validate actual owner artwork,
screen fit, all UI modes, field and combat interactions, controller/touch,
long gameplay sessions and on-device save/restart and memory pressure.
