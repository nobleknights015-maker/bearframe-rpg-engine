# JRPG battle overlay — engine presentation checkpoint

The installed Android WebView's opt-in v2 party encounter now has a
dedicated landscape JRPG battle overlay instead of a narrow developer-form
sidebar.

The battle scene is a fitted 800x450 logical layout with a separate enemy
arena, all-party HP/MP status strip, recent battle log, and a framed
actor command/target selector. Live enemy cards contain authentic enemy
names and HP values from the canonical encounter; no copyrighted battler
artwork or synthetic enemy sprites are added. Up to four enemy summaries
remain visible; overflow is counted and all living enemies remain selectable
through the canonical target control. The party roster shows up to six
members, including downed members, while only surviving actors receive
orders.

The command pane retains the existing data-party-skill, data-party-target,
party-command and party-commit integration contract. It selects all surviving
party members' actions and submits one complete round through
partyWorld.submit(orders). The engine validates ability cost, target type,
target status, turn order and effects, commits the save, and only then
rebuilds the UI. The existing landscape pager continues to show one actor's
command at a time, with controller/keyboard focus kept on visible controls.

This is presentation-only. The combat runtime, saved journal, encounter
state, enemy AI, party progression and RNG are unchanged.

Still required for a release: original authored battler sprites/animations,
attack and spell effect visual integration, full combat audio cues, field
and battle camera polish, physical Android ergonomics, reduced-motion
preference, hard UI data extremes and performance measurements.

Acceptance: tests/jrpg-battle-overlay.test.js plus the full installed
Android emulator run and the existing party-world-ui persistence stages.
