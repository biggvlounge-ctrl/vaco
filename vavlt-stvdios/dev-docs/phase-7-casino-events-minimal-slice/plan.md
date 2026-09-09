# Plan — Phase 7: casino streaming events, minimal slice

## Goal
Give the user a direct, honest status check on
`VAULT_STUDIOS_INTERACTIVE_CASINO_LAYER.md` (confirmed to be a design
document only, no code) separate from the already-confirmed-built
channel/tipping infrastructure, then build a real, minimal, buildable
slice of it — by the user's own explicit choice, after being offered
three scope options (minimal backend slice / the full vision / skip)
and picking the minimal slice.

## Design
The full vision needs two things that don't exist anywhere in this
codebase: real video streaming infrastructure for Vavlt Stvdios, and a
real, visual, walkable Venus Resort & Casino world on the VENVS/VDP
side (VAGO's own README already flags that world as unbuilt; VDP's
world map has no casino district at all). Neither is in scope for a
"minimal slice" — building either would be its own multi-phase
project.

What IS real and buildable now: a `CasinoEvent` — a tournament, game
night, VIP room, or creator show a host schedules, takes live, and
lets viewers join — built entirely on top of infrastructure that
already is real: `channels.js` (a host's own channel, with its own
already-real chat and tippable person) and `screenSessions.js` (the
real up-to-8-screen mechanic from Phase 3, reused directly for the
design doc's own "Screen 1: Main table, Screen 2: Host/commentator..."
example rather than building a second, parallel multi-screen concept).

Deliberately excluded from this slice: any gambling/game-outcome
logic (that's VAGO's own domain, already built there), any reference
field pointing at a VAGO game/contest id (not asked for, would be
scope creep), real video playback, and any visual world.

## Verification approach
Real unit tests (plain Node, scratchpad-only, deleted after passing)
covering ownership enforcement on both the required host channel and
the optional screen session, event-type validation, the full
`scheduled -> live -> ended` status guard chain, join being rejected
both before going live and after ending, duplicate-join rejection,
leave-then-rejoin, and the composed detail read.

Live pass against the real running server: created a real channel and
a real broadcaster screen session, created a casino event referencing
both, confirmed `join` is honestly rejected while `scheduled`, went
live, had two real viewers join, confirmed the composed detail
endpoint returns the real host channel + real screen session + a real
live attendee count, ended the event, confirmed `join` is rejected
again — then confirmed real restart-survival via a real kill/restart
and re-`GET` of the same event.
