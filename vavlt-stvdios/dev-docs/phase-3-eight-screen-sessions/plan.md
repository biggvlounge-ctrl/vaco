# Plan — Phase 3: Eight-Screen Interactive Sessions + Repositioning

## Goal
Per direct instruction, reposition Vavlt Stvdios' whole product
identity around a single named, real objective: an "eight screen
interactive" streaming platform, explicitly compared against YouTube,
Instagram, Patreon, OnlyFans, Kick, and Twitch. Build the real
structural mechanic that objective requires and unify it across both
directions the instruction named: broadcaster-composed multi-camera
sessions and viewer-composed multi-view sessions.

## Real investigation before any code
Checked what already exists against each of the six named comparables
before writing anything new: Channels (`lib/channels.js`, Phase 1)
already answers YouTube's channel-based identity; the Post/Feed/
Stories/Reels/Explore layer (`lib/posts.js`, Phase 2) already answers
Instagram; `lib/lockedContentTiers.js` (Phase 2) already answers
Patreon/OnlyFans' paywalled-subscription model; `lib/channelTips.js`
(Phase 1) already answers Kick/Twitch's direct-tipping model. None of
the six comparables, and nothing already built here, lets a single
session genuinely compose several channels together — confirmed via
grep across every existing `lib/` file. This is the one real gap
Phase 3 fills, not a rebuild of anything already covering a
comparable.

Also confirmed `VAULT_STUDIOS_INTERACTIVE_CASINO_LAYER.md`'s own
"1-8 screen broadcast" example was previously scoped narrowly to the
still-blocked VENVS/VAGO casino layer (see Phase 1's own plan). Per
this instruction, that "up to 8" shape is now the platform's own
general, defining mechanic — not casino-specific — while the actual
VENVS/VAGO casino *world* broadcast (the walkable Venus Resort
streaming in) remains correctly blocked on infrastructure that still
doesn't exist (this app's own video pipeline, VAGO's own visual casino
world).

## Design
- One real `ScreenSession` shape serves both directions named
  directly in the clarifying instruction, rather than two separate
  entities: `sessionType: 'broadcaster'` vs. `'viewer'` is the one
  real structural difference.
- `sessionType: 'broadcaster'`: every included channel must be owned
  by the session's own `ownerId` — a business composing its own camera
  feeds (the casino-floor example) has no reason to include someone
  else's channel, and allowing it would silently misrepresent whose
  content is in the session.
- `sessionType: 'viewer'`: no ownership constraint at all — combining
  channels across totally unrelated owners is the literal, real gap
  named in the README (MultiTwitch/ViewGrid/TwitchTheater today, no
  native platform).
- `MAX_SCREENS = 8` enforced identically on session creation and on
  every subsequent add, not just at creation time.
- The real, honest scope line: a `ScreenSession` groups channels that
  are each *already* independently interactive (Phase 1's own chat +
  tips per channel) — it is not a new video-compositing engine, and
  none is invented here, matching this session's consistent "no real
  capture/rendering infra" posture (CHOPZ, VOID MAGIC's Media module).

## Explicitly NOT in this task
Real synced multi-stream video composition/rendering. The VENVS/VAGO
casino world broadcast layer itself (still blocked on infrastructure
that doesn't exist). Any fee/fee-share model on screen sessions — none
is specified anywhere, so none is invented.

## Verification approach
Plain-Node pass (17 checks, one test-script bug found and fixed —
the test's own expected error message was wrong for a 9-element
duplicate array, since the real length check correctly fires before
the duplicate check; not an app bug): the 8-screen cap on create and
add, the broadcaster ownership guard (with the specific offending
channel id named), a viewer session mixing three unrelated owners,
duplicate rejection, add/remove mutation, filling to exactly 8 then
rejecting a 9th, owner-scoped listing, and the composed read resolving
every screen to its own real channel record. Live HTTP pass: 8 real
channels for one casino business composed into a broadcaster session
and read back with all 8 full channel objects attached; a live viewer
session mixing unrelated streamers; the ownership guard and the
9-screen cap both confirmed live, not just in the unit suite; a screen
removed and the session confirmed shrunk; owner-scoped listing
confirmed live.

## Done when
- The eight-screen mechanic is real, tested, and live-verified for
  both session types.
- The README's repositioning against all six named comparables
  accurately maps each existing module to the comparable it answers,
  and names the eight-screen mechanic as the one real gap none of them
  close.
