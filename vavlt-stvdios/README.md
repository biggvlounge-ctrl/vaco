# VAVLT STVDIOS (Vavlt Stvdios)

The ecosystem's creator streaming platform — positioned directly, per
explicit instruction, against six real comparables: **YouTube**
(channel-based creator identity), **Instagram** (Feed/Stories/Reels/
Explore/Notes/Profile Cards), **Patreon** and **OnlyFans** (locked,
paywalled subscription content), and **Kick**/**Twitch** (live
streaming with direct creator tipping). Every one of those mechanics
already has a real, built counterpart here — Channels, the Post layer,
Locked Content Tiers, and Channel Tips, respectively (see "What's here").

**The one thing none of those six actually do, named directly as this
platform's own defining objective**: let a single session genuinely
compose *up to eight* independently interactive live channels together
— Phase 3's real `screenSessions.js`. Twitch's own native attempt at
exactly this (Squad Stream) was retired in 2023 for low adoption; the
real demand today is served only by third-party tools (MultiTwitch,
ViewGrid, TwitchTheater) that just embed multiple players side by side,
with none of the per-screen chat/tip context this app's own channels
already carry. That gap — not any single comparable's individual
feature — is the actual product identity: a real eight-screen
interactive session, from either the broadcaster's side (a business
composing up to eight of its own camera feeds into one presented
session) or the viewer's side (a viewer freely combining up to eight
channels from any owners into their own personal multi-view session).

Phase 1 built the real multi-channel core (every camera/feed is its
own independently viewable, chattable, and tippable channel, not one
combined stream per business). Phase 2 added the real Instagram-style
content layer, plus HVNTZ's own real integration point (hunt-checkpoint
photo-proof posts). Phase 3 adds the real, unified eight-screen session
mechanic described above.

**Confirmed directly before writing any code**: despite being
referenced by name across 20+ source docs throughout this ecosystem
(HVNTZ, VOID, CHOPZ, VDP, VAGO, and more), Vavlt Stvdios had zero real
code anywhere — the same position VACON was in before it got built.
`VAULT_STUDIOS_IG_LAYER.md`'s own claim that "Vavlt Stvdios' existing
spatial multi-camera streaming" is "already confirmed... as a real,
separate, built app" does not describe this codebase. This project is
that real, missing foundation.

**Real, validated market gap, not an incumbent to copy**: Twitch's own
native attempt at this (Squad Stream) was retired in 2023 for low
adoption and a clunky layout. The real demand today is served only by
third-party tools (MultiTwitch, ViewGrid, TwitchTheater). No major
platform has built this well natively — that's the actual gap this
app exists to fill.

Source docs: `VAULT_STUDIOS_ARCHITECTURE.md` (the core `Channel`/
`ChannelChat`/`LockedContentTier`/`Post`/`MapSearchListing` data
model — all five are now built), `VAULT_STUDIOS_IG_LAYER.md` (the
Instagram-style layer, HVNTZ integration, per-channel tipping, and
global role-based channel grouping — Phase 2 adds the content layer
and the HVNTZ photo-proof integration specifically),
`VAULT_STUDIOS_INTERACTIVE_CASINO_LAYER.md` (its own "1-8 screen
broadcast" example — per direct instruction, this is now the whole
platform's own defining mechanic, not a casino-only feature; Phase 3's
`screenSessions.js` implements the general, unified version. The
VENVS/VAGO casino *world* broadcast layer specifically — the walkable
Venus Resort itself streaming into this app — remains explicitly out
of scope until both this app's own video infrastructure and VAGO's own
visual casino world exist; see "Not yet built").

**A real, deliberate completion of a genuine inconsistency between
the two source docs**: the architecture doc's own `Channel.groupingType`
only lists two values, but the IG layer doc's later "Global,
role-based channel grouping" section adds a real third
(`same-role-multi-location` — e.g. every DJ worldwide, one browsable
group spanning entirely unrelated venues) with its own
`ChannelGroup.groupingBasis` enum that already includes all three.
`GROUPING_TYPES` in `lib/channels.js` unifies both schemas around one
real three-value enum — see that file's own header for the full
reasoning.

## Run
```
cd ../venvs-mock-backend && npm install && npm start   # localhost:8791 (V3 stand-in)
cd vavlt-stvdios && npm install && npm start              # localhost:8808
cd ../hvntz && npm install && npm start                    # localhost:8792 (optional, for the real photo-proof integration)
```

## Test
```
curl http://localhost:8808/api/health
curl -X POST http://localhost:8808/api/channel-groups -H "Content-Type: application/json" -d '{"groupingBasis":"same-location-multi-room"}'
curl -X POST http://localhost:8808/api/posts -H "Content-Type: application/json" -d '{"authorId":"creator-1","postType":"photo","mediaUrl":"pic.jpg","caption":"hi"}'
curl -X POST http://localhost:8808/api/screen-sessions -H "Content-Type: application/json" -d '{"sessionType":"viewer","ownerId":"viewer-1","channelIds":[1,2,3]}'
```

## What's here
- `lib/channels.js` — `GROUPING_TYPES` (all 3, reconciled — see
  above), `createChannelGroup`/`getChannelGroup`, `createChannel`
  (real structural guard: a channel's `groupingType` must match its
  parent group's own `groupingBasis`, and `Channel.parentGroupId` /
  `ChannelGroup.memberChannelIds` are updated together in one real
  operation, never two arrays a caller has to keep in sync by hand),
  `listChannelsInGroup`, `listLiveChannels`, `goLive`/`endStream` (a
  real, guarded lifecycle).
- `lib/channelChat.js` — every channel gets its own real, independent
  chat the moment it's created (not lazily on first message), per the
  source doc's own "EVERY channel has its own independent chat, not
  one shared chat per business."
- `lib/channelTips.js` — the real, defining point of the whole
  section: `tipChannel` pays the specific `recipientPersonId`
  directly via a real, injected `transferFn` — never the channel's own
  `ownerId` (the business). `getTotalTipsForPerson` is a real,
  queryable proof of the doc's own "every role becomes its own earner"
  claim — a doorman with his own camera has a real, independent total,
  something no other platform gives that role today.
- `lib/follows.js` — `followUser`/`unfollowUser` (real, two-directional
  guard: no self-follows, no duplicate follows), `isFollowing`,
  `getFollowedIds` — the real graph Explore and the Feed itself both
  read from.
- `lib/posts.js` — the real content core: `createPost` (photo/reel/
  carousel/story/locked, with real per-type validation — a carousel
  needs 1-20 `mediaUrls`, a reel needs a `durationSeconds` under the
  doc's own 20-minute cap), `getPostForViewer` (real gated read,
  mirroring VACAY Homes' own lead-contact-info gating), `getFeedPosts`/
  `getActiveStories`/`getReels`/`getExplorePosts` (chronological,
  non-followed-only — see the file's own header for why this is
  honestly not full engagement ranking), `listPostsForAuthor`,
  `createHighlight`/`listHighlightsForAuthor`. **Real, deliberate
  normalization**: every post's `authorId` is stored as `String(authorId)`
  — found live via the HVNTZ integration test below, where HVNTZ's own
  numeric `businessId` silently failed every author-scoped lookup
  before this fix (see "Verified"). **`POST_SOURCES` gained
  `'vulture-music'`/`'vulture-pods'` (Phase 4)**: per explicit
  instruction, real music videos and video podcast episodes cross-link
  here as real Reels rather than either project duplicating video
  hosting — same real "tag the real origin" precedent `'hvntz-checkin'`
  already established. This project's own real, deliberate 20-minute
  Reel cap (`REEL_MAX_DURATION_SECONDS`) applies to those exactly as
  it does to anything else — a video podcast episode longer than that
  is genuinely rejected, not silently waved through; see
  `../vulture-pods/README.md`'s own "Not yet built" for the honest
  scope note this surfaces.
- `lib/notes.js` — the real "Notes" feature (a 60-character status
  visible on a post, auto-expiring after 3 real days) — `addNote`,
  `getActiveNotesForPost`.
- `lib/lockedContentTiers.js` — the real 80/20 creator/platform split
  on subscriptions: `subscribeTier` fires two real `transferFn` calls
  that together sum to exactly `priceVCoin`, never one combined
  transfer a caller would have to trust was split correctly.
  `canAccessLockedContent`/`isSubscribed` are the real gate
  `posts.js`'s `getPostForViewer` is driven by from outside.
- `lib/mapSearch.js` — a real, locally-reimplemented `haversineKm`
  (same posture as every other real-math reuse this session — not
  cross-imported from another app), `createListing`/`getListing`,
  `searchNearby` (real radius + category filtering).
- `lib/profileCards.js` — the real profile-card upsert
  (`createOrUpdateProfileCard`) behind a real, deterministic
  `PROFILE_BASE_URL`-based `qrCodeUrl` string — explicitly not an
  actual rendered QR image (see "Not yet built").
- `lib/screenSessions.js` — the real, unified "up to 8 interactive
  screens" mechanic (see the top of the README for the full
  positioning). `MAX_SCREENS = 8`. One `ScreenSession` shape serves
  both directions named directly: `sessionType: 'broadcaster'`
  (real ownership guard — every included channel must actually be
  owned by the session's own `ownerId`) and `sessionType: 'viewer'`
  (no ownership constraint at all, since freely combining channels
  across unrelated owners is the entire MultiTwitch/ViewGrid-shaped
  gap this closes). `createScreenSession`/`addScreenToSession`/
  `removeScreenFromSession` all enforce the real 1-8 range and reject
  duplicate channels. `getScreenSessionWithChannels` is the real
  composed read — each screen resolved to its own full channel record,
  proving the session is a genuine grouping of already-independently-
  interactive units (each with its own chat and tippable person from
  Phase 1), not a flattened, de-interactified view.
- `lib/videos.js` — **real long-form video (Phase 5)**, closing a real
  gap Phase 4 itself surfaced: this project claims YouTube among its
  own six real comparables, but its only video-shaped content before
  this was `posts.js`'s own Reel type — Instagram-shaped, capped at a
  real, deliberate 20 minutes. A `Video` is a genuinely separate real
  entity (own id space, own `videos` store, its own routes), not a
  duration bump on Reel — real long-form on-demand video, YouTube's
  actual defining product, needs its own real shape. `MAX_VIDEO_DURATION_SECONDS`
  (12 hours) is a real, flagged, interpretive number grounded in
  YouTube's own real, well-known verified-account upload cap — generous
  enough for any real content this ecosystem produces, not an invented
  "unlimited." Real code reuse, not reinvented: `isLocked`/
  `requiredTierId` gating uses the exact same
  `lib/lockedContentTiers.js` gate `posts.js` already established —
  one real subscription-tier system serving both content types.
- `server.js` — a real Express API (CommonJS), real injected
  `transferVCoin` against V3 (`venvs-mock-backend`), ~20 Phase 2 routes
  across posts/feed/stories/reels/explore/follows/notes/tiers/
  map-search/profile-cards, plus 5 Phase 3 routes for screen sessions.

## Verified
17 plain-Node checks: the reconciled 3-value grouping enum, a real
same-location-multi-room group (a barbershop's chairs) with channels
correctly linked both directions, a groupingType/groupingBasis
mismatch rejected, a real same-role-multi-location group spanning
genuinely unrelated owners (three DJs at three different real venues),
a channel that exists with no group at all, the live/end lifecycle
(including double-go-live and end-when-not-live rejection), chat
messages proven genuinely independent per channel, a tip proven to pay
the real specific person rather than the channel's owner (the
transfer call's own `to` argument checked directly), the doorman
example proving a real, previously-untippable role now has a real
queryable total across multiple tips, and rejection cases (unknown
channel, non-positive amount, unknown grouping basis).

Live: `vavlt-stvdios/server.js` run against the real, independently
running `venvs-mock-backend` — a real channel group and two real
channels created (a DJ booth and a doorman's channel) inside one
club, one channel taken live, a real chat message posted, and a real
tip sent to the doorman specifically — confirmed via V3's own live
balance (`1000 → 1015`), with the club's own business account
independently confirmed **unchanged** (`1000`, untouched), proving the
per-person payout routing live, not just asserted. The aggregate
`/api/people/:personId/tips` endpoint independently confirmed the
same total.

**Phase 2** — 14 plain-Node checks (after one 32-check pass found a
test-data-setup bug, not an app bug: an "Explore excludes an
unfollowed creator" case failed because that creator's only post was a
story, and Explore correctly excludes all stories, matching Feed's own
exclusion — confirmed by adding a real non-story post for that creator
and re-running clean): photo/reel/carousel validation (including a
reel rejected for exceeding the 20-minute cap and a carousel rejected
for 0 and for 21 slides), a locked post's `mediaUrl` genuinely withheld
from a viewer without access and genuinely returned to one with it,
Feed vs. Stories vs. Reels correctly partitioned, Explore excluding
both the viewer's own posts and followed authors' posts (proven via a
real follow graph, not a hardcoded list), Highlights rejecting a
non-story post and a post owned by someone else, Notes expiring after
3 days, and the Haversine distance sanity-checked against two known
real-world coordinate pairs.

Live: a full HTTP pass against a running `vavlt-stvdios` server —
photo/reel/carousel posts created and read back, a locked post
subscribed to via a real 25 VCoin tier subscription confirmed as an
exact 20/5 creator/platform split against V3's own live balances, the
same locked post's media confirmed hidden before the subscription and
visible after, Explore/Feed/Stories/Reels all independently checked,
a map search returning only listings inside the requested radius and
category, and a profile card created then upserted with a changed
bio.

**Live cross-app pass with HVNTZ**: HVNTZ's own real `/api/hunt/:id/
checkin` route, called with a real `photoUrl`, made a real HTTP call
into this app's own `/api/posts` — the returned post correctly tagged
to the checkpoint's business (`source: 'hvntz-checkin'`, `isStory:
true`). **A real bug was found and fixed during this test**: `GET /api/
authors/1/posts` returned an empty list even though the post
genuinely existed, because HVNTZ's `businessId` is a real JavaScript
number while Express route params are always strings, so `authorId
=== authorId` silently failed (`1 === '1'` is `false`) — confirmed
directly via a `node -e` type check before touching any code. Fixed by
normalizing `authorId: String(authorId)` at write time in
`posts.js`'s own `createPost` (protects any future numeric-ID caller,
not just HVNTZ), then re-verified via a full restart-and-rerun of this
same cross-app test, plus a full re-run of the 14-check Phase 2 suite
to confirm the fix didn't disturb existing string-authorId behavior.

**Phase 3** — 17 plain-Node checks (one test-script bug found and
fixed during this pass, not an app bug: a 9-element array containing a
duplicate correctly hits the real 1-8 length check before the
duplicate check ever runs, since the length check happens first — the
test's original assertion expected the wrong error message, not a
wrong behavior): the real 8-screen cap enforced on both create and
add, a broadcaster session rejecting a channel it doesn't own (with
the specific offending channel id named in the error), a viewer
session freely mixing channels across three unrelated owners,
duplicate-channel rejection, add/remove screen mutation, a session
filled to exactly 8 via repeated adds then rejecting a 9th, owner-
scoped session listing, and the composed read resolving every screen
to its own real, independent channel record.

Live: a real HTTP pass against a running server — 8 real channels
created for one casino business, composed into one broadcaster session
and read back with all 8 full channel objects attached; a viewer
session live-mixing two unrelated streamers' channels with one of the
casino's own; the ownership guard rejecting a foreign channel with the
specific channel id in the error message; the 9th-screen add correctly
rejected once a session was already full; a screen removed and the
session confirmed shrunk; the owner-scoped `/api/owners/:id/screen-
sessions` endpoint confirmed returning exactly the casino's own
session.

**Phase 4 (Vvltvre Music/Pods video cross-link)**: real, live pass
across four independently running servers (`venvs-mock-backend`,
`vavlt-stvdios`, `vulture-music`, `vulture-pods`) — a real music video
(4 minutes, well under the real 20-minute cap) attached to a real
`single` release via `vulture-music`'s own new `/api/releases/:id/video`
route, confirmed as a genuine Reel on this server's own
`GET /api/posts/:id` (`source: 'vulture-music'`, not a mocked
response); a real short (10-minute) video podcast episode attached
successfully via `vulture-pods`'s own new `/api/episodes/:id/video`
route; a real 45-minute video episode attempt correctly **rejected by
this server's own real validation** (`"a reel requires a
durationSeconds between 0 and 1200 (20 minutes)"`), proving the real
length mismatch is honestly enforced, not silently bypassed by either
caller; double-attach on both the music and pods side confirmed
rejected.

**Phase 5 (real long-form video)**: 7 plain-Node checks (a 90-minute
video accepted with no Reel-style cap, the real 12-hour cap enforced,
invalid source rejected, a locked video without a `requiredTierId`
rejected, gated read withholding/revealing `mediaUrl` correctly with
real tier reuse confirmed against `lockedContentTiers.js` directly,
author-scoped listing and feed ordering correct, numeric-vs-string
`authorId` lookup not silently failing), plus a live pass: with
`vulture-pods` re-pointed to route by real duration
(`REEL_DURATION_CAP_SECONDS = 1200`), the exact real 45-minute episode
Phase 4 had confirmed rejected now succeeds — attached as a genuine
long-form `Video` on this server (`contentType: 'video'`,
independently confirmed via `GET /api/videos/:id`), while a real
5-minute episode created immediately after still correctly routes to
a genuine Reel (`contentType: 'reel'`, independently confirmed via
`GET /api/posts/:id`) — proving both real Vavlt Stvdios primitives are
reachable through the same real endpoint depending on the caller's
own real content length. A video over the real 12-hour cap and a real
gated video (withheld without a viewer id, revealed with one) both
confirmed over real HTTP.

## Real persistence
`lib/persistence.js` wraps `server.js`'s own store in a real file-backed
store, `data/store.json` (port 8808) — Vavlt Stvdios's own real state now
survives a restart. Live-verified: created a real streaming channel, killed
the running process, restarted it, and confirmed the same real state came
back from a real GET. See `dev-docs/phase-6-real-persistence/`.

## Real referral/growth mechanic (Phase 7)
A user-flagged real gap, not self-discovered: a real Temu-style
gamified referral mechanic — escalating invite tiers, a real progress
bar, spin-to-win — confirmed genuinely missing by direct grep across
the whole repo (no referral/growth mechanic of any kind existed here
before this, despite the initial ask assuming one already did).

`lib/referralGrowth.js`: `recordReferral` (each real referee can only
ever be credited to one referrer — the standard anti-abuse rule),
`getReferralProgress` (the real numbers a progress bar renders —
`referralCount`, `nextTierThreshold`, `progressPercent`), and
`spinWheel`. Four real, flagged-interpretive escalating tiers (1/3/5/10
referrals → 10/25/50/150 VCoin + 1/1/2/3 spins) — no source doc
specifies exact thresholds or amounts, so these are real, deterministic
defaults, not invented per-call. Crossing a tier fires a real VCoin
bonus (from `vavlt-stvdios-growth`) and banks real spins.

**Spin-to-win reuses VAGO's own provably-fair scheme verbatim**
(`lib/provablyFair.js`, copied, not reinvented) — the same real
commit-reveal HMAC derivation VAGO's Originals games already
established in this ecosystem. A real, fixed, published prize-odds
table (weights summing to 100, read directly as percentages).

Verified with 5 real unit test groups, then live against real running
`v3` + `vavlt-stvdios` instances: a real referral crossed tier 1 and
paid a real 10 VCoin bonus (confirmed against V3), a real spin won a
real 100 VCoin jackpot — independently re-verified from scratch outside
this app's own code (recomputed `sha256(serverSeed)` matched the
committed hash, and re-deriving the HMAC with the real revealed seeds
reproduced the exact same jackpot outcome), a second spin correctly
failed with zero spins remaining, and restart-survival confirmed.

## Real casino streaming events — minimal slice (Phase 7)
Closes part of the real gap this README's own "Not yet built" section
below used to describe in full. `VAULT_STUDIOS_INTERACTIVE_CASINO_LAYER.md`
is a real, well-structured design document, not code — direct check
confirmed no route, no lib module, nothing runnable existed anywhere
for it before this phase. The FULL vision (real video streaming infra
+ a real visual, walkable Venus Resort & Casino world on the VENVS/VDP
side) is still genuinely not buildable — neither dependency exists in
this codebase, see below — but a real, minimal, honest slice is: the
real data model and API for a casino streaming *event* (a tournament,
game night, VIP room, or creator show), by direct user choice to scope
it this way rather than attempt the full vision at once.

`lib/casinoEvents.js` — `EVENT_TYPES` (`tournament`, `game-night`,
`vip-room`, `creator-show`), `EVENT_STATUSES` (`scheduled` -> `live`
-> `ended`). `createCasinoEvent` requires a real `hostChannelId` —
every event broadcasts through a channel the host already owns, reusing
`channels.js`'s own already-real chat and tippable-person infra rather
than inventing a parallel one. An optional `screenSessionId` reuses
Phase 3's real up-to-8-screen mechanic directly for the design doc's
own "Screen 1: Main table, Screen 2: Host/commentator..." example —
must be the host's own `broadcaster`-type session, the exact ownership
rule `screenSessions.js` already enforces, not re-implemented here.
`joinCasinoEvent` is a real, structural attendance record, only valid
while the event is actually `live` — the same honest gate Vvltvre
Flix's `watchTitle` applies to a non-streaming title — not a video
connection. `getCasinoEventWithDetail` composes the event with its
real host channel, real screen session, and a real live attendee
count.

**Deliberately not built in this slice**: any gambling/game-outcome
logic (VAGO's own `lib/provablyFair.js`-backed games already own
that; no unrequested VAGO game/contest cross-reference field was
added), real video playback, and any visual world.

Verified: 6 plain-Node unit tests (channel-ownership and screenSession-
ownership/type enforcement, event-type validation, the full
`scheduled -> live -> ended` guard chain rejecting out-of-order calls,
join rejected before going live and after ending, duplicate-join
rejected, leave-then-rejoin allowed, the composed detail read), run to
green then deleted — scratch only. Live pass against the real running
server: a real channel and broadcaster screen session created, a
casino event created referencing both, `join` correctly rejected
while `scheduled`, `go-live`, two real viewers joining, the composed
detail endpoint confirming the real host channel + screen session +
a live attendee count of 2, `end`, and `join` correctly rejected again
once `ended` — plus restart-survival confirmed via a real kill/restart
and a direct re-`GET` of the same event.

## Not yet built
- Real video/stream infrastructure — `streamUrl`/`isLive` are real
  fields with no actual media pipeline behind them, same posture as
  every other "no real capture infra" gap this session (CHOPZ, VOID
  MAGIC's Media module). This is also the honest limit of Phase 3's
  own "interactive" claim: a `ScreenSession` is a real, structural
  grouping of channels that are each already independently interactive
  (their own real chat, their own real tippable person) — not a new,
  separate synced video-wall compositing engine. No source doc or
  instruction describes real multi-stream video composition, and none
  is invented here.
- Real AI-generated interactive stickers and real-time story comments
  (`VAULT_STUDIOS_IG_LAYER.md`'s own Stories features) — both need
  real AI/websocket infrastructure this pass doesn't build; not
  faked with a static placeholder.
- A real rendered QR image behind `ProfileCard.qrCodeUrl` — it's a
  real, deterministic URL string, not an actual generated image.
- HVNTZ's own Map Search wiring (Yelp-style business discovery) is now
  real and closed on HVNTZ's own side — `registerLocation` there now
  has real lat/lng, and a real `syncLocationToMapSearch` call posts
  live into this app's own `/api/map-listings`, independently confirmed
  searchable via a direct `GET /api/map-search` call on this app's own
  server. See `../hvntz/README.md`'s own Phase 6 entry for the full
  record — no code changed on this side, this app's own Map Search API
  already existed and needed nothing new.
- The FULL VENVS/VAGO interactive casino streaming vision — Phase 7
  above closes the real, minimal data-model-and-API slice of this
  (casino events, real channel/screen-session reuse, real join/leave
  attendance). What's still genuinely missing, checked directly rather
  than assumed: this app's own real video infrastructure (a casino
  event's `hostChannel.streamUrl` is still the same honest, no-real-
  media-pipeline field as every other channel), and VAGO's own
  visual/walkable Venus Resort & Casino world, which VAGO's own README
  explicitly flags as not yet built ("a VENVS/VDP-side build, not this
  backend"). VDP's own world map has no casino/resort district defined
  at all.
- Kevin's date-planning concierge extension (`VAULT_STUDIOS_IG_LAYER.md`'s
  own aside) — a CVNVO/V4 change, not a Vavlt Stvdios one; out of
  scope for this project entirely.
- Real fee/commission on tips — none is specified anywhere for tips
  specifically (only the 80/20 split for locked-content subscriptions,
  which isn't built yet either), so none is invented here.
