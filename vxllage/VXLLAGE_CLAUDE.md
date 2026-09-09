# CLAUDE.md — VXLLAGE (VACO Ecosystem)

Handoff brief for Claude Code. This is a live-demo-only prototype (no
separate build thread existed to pull additional context from) — read this
whole file before touching code, especially §0.

---

## 0. Correction — rebalance toward Twitter/X as the dominant register

**This is the single highest-priority change, ahead of every other gap
below.** The founder's explicit direction: VXLLAGE should read primarily as
**Twitter/X**, with Reddit-, Zoom-, and Clubhouse-flavored sections mixed in
as secondary surfaces — not five comparables given equal weight.

The current build does the opposite. As shipped:
- **Home** (the X-style feed) is the thinnest surface in the app: 4 static
  posts, a decorative For You/Following toggle that doesn't actually filter
  anything differently, and a non-functional composer box ("What's
  happening in VXLLAGE?" with no submit action).
- **Villages** (the Discord-style layer) is by far the deepest, most
  built-out part of the prototype. Every village opens into its own
  six-tab sub-app (Feed/Threads/Channels/Events/Members/Shop) via
  `buildVillageDetail()`, complete with a boost economy, a cosmetics shop,
  and a procedurally generated members list/leaderboard. This is
  effectively a full nested application, not a "section."

**What needs to change architecturally:** Home needs to become the
deepest, most central surface — real posting, real thread/reply
expansion, real profile pages, quote-posts, a functioning For You vs.
Following distinction — and Villages needs to shrink back down to a
lighter, secondary Discord-flavored layer (closer to how Reddit-style
Threads and Clubhouse-style Live currently feel) rather than its own
nested six-tab application. Don't delete `buildVillageDetail()`'s content
wholesale — the channel/event/member/boost concepts are worth keeping —
but it shouldn't be structured as a bigger, richer app than the Home feed
it's supposed to be secondary to.

---

## 1. What VXLLAGE is

VXLLAGE blends five comparables into one app, phone-first, single shared
identity throughout:

- **Home** → reads like X (feed, engagement row, For You/Following)
- **Threads** → reads like Reddit (vote rail, community pill, card list)
- **Villages** → reads like Discord (server rail, live badges, join)
- **Live** → reads like Clubhouse (speaker bubbles, hallway of rooms)
- **Call** → reads like Zoom Business (tile grid, bottom control bar)

Per §0, Home/X should be primary; the other four are secondary registers
mixed in, not co-equal pillars.

This is a **live-demo-only prototype** — no separate Replit zip or backend
build thread exists yet for this app, unlike Vvltvre/V4/HVNTZ/etc. Producing
those (per the standing two-deliverable rule) is itself one of the gaps
below, not just a "nice to have."

---

## 2. Stack

- React 18, hooks only (`useState`, `useEffect`, `useMemo`), no class
  components
- Tailwind utility classes throughout (no inline `style={{}}` except for
  dynamic per-avatar/per-village colors, which is appropriate since those
  are data-driven)
- `lucide-react` for all icons
- No router — a single `tab` state string drives top-level navigation, with
  additional local state for drill-ins (`activeRoom`, `openVillageId`,
  `inCall`)
- No backend, no API calls — state persists to `localStorage`
  (`vxllage_state_v2`) for XP/VCoin/reputation/owned cosmetics/votes/likes;
  everything else (feed posts, threads, villages, rooms) is hardcoded
  module-level constants
- Single file, ~700 lines — should be split into modules (screens,
  components, data) before this grows further, same recommendation as every
  other VACO prototype at this stage

---

## 3. Feature inventory (as built — see §0 for target rebalancing)

### Home (X-style) — currently the thinnest surface, needs to become the deepest
- For You / Following toggle (decorative — both render the same `FEED`
  array, no actual filtering logic)
- Non-functional composer row ("What's happening in VXLLAGE?")
- `FeedPost` component: avatar, name, verified badge, handle, timestamp,
  content, reply/repost/like/share row. Like button has real local state
  (persisted); reply/repost/share are decorative

### Threads (Reddit-style)
- `ThreadCard`: up/down vote rail with real local state (persisted),
  community pill linking to a village, tag badge, comment count, share
  button (decorative)

### Villages (Discord-style) — currently the deepest surface, needs to shrink per §0
- Village list: avatar rail + full list, live badge, online/member counts,
  Join button (grants +3 XP, no real membership state beyond XP gain)
- Village detail (`VillageDetailScreen`, via `buildVillageDetail()`): banner
  header, 6 sub-tabs —
  - **Feed** — pinned message + the same global `FEED` reused per-village
  - **Threads** — village-scoped threads (falls back to a generated
    "start here" thread if none exist for that village)
  - **Channels** — text channels list (unread badges, decorative) + voice
    channels (real: tapping "Main Stage" opens a live `RoomScreen` if that
    village is flagged live)
  - **Events** — RSVP toggle with real local state, generates a going-count
    increment
  - **Members** — owner/mod/member role groups, procedurally generated
    names/reputation, online indicators
  - **Shop** — village boost (spends real VCoin, moves a progress bar),
    village-specific cosmetic purchase, weekly reputation leaderboard

### Live (Clubhouse-style)
- Room list: live pulse indicator, listener count, stacked speaker avatars
- `RoomScreen`: speaker grid, "in the room" avatar stack with overflow
  count, hand-raise toggle (real local state, cosmetic only — no actual
  effect), "Join with video" button transitions into the Zoom-style call

### Call (Zoom Business-style)
- `CallScreen`: 2-column participant tile grid (gradient avatars, not real
  video), per-tile mute/name overlay, bottom control bar (mute, video
  toggle, participants, more, leave) — all real local UI state, no real
  audio/video

### Profile / Wallet sheet
- Bottom sheet, Profile/Wallet sub-tabs
- Profile: level (derived from XP), reputation, VCoin stats, equipped
  cosmetics list
- Wallet: monetization stack list (5 illustrative revenue streams — Creator
  Subscriptions, Event Monetization, Avatar Economy, Feed & Room Ads,
  Community Boosting — labels only, no real billing), avatar cosmetic shop
  (3 items, real VCoin spend + equip state)

---

## 4. What's real vs. mocked

**Real (local React state, persisted to `localStorage`):**
- Like toggling (Home and per-village feed), upvote/downvote (Threads),
  village Join (XP grant only), RSVP toggle (Events), village boost spend,
  cosmetic purchase/equip, hand-raise toggle, XP/level/VCoin/reputation
  tracking throughout, toast notifications on state-changing actions

**Fully mocked / decorative:**
- All content itself — `FEED`, `THREADS`, `VILLAGES`, `ROOMS`,
  `CALL_PARTICIPANTS` are hardcoded arrays; `buildVillageDetail()`
  procedurally generates village sub-content but from a fixed `NAMES` list,
  not real users
- Composer ("What's happening") — no submit, no new posts ever created
- For You / Following toggle — no actual filtering difference
- Search icons (Threads, Villages) — decorative, no search executes
- Reply/repost/share buttons — no action
- All audio/video — `CallScreen` and `RoomScreen` are gradient avatars and
  CSS pulse animations, no real media capture or streaming
- No authentication — single implied "you.avatar" user throughout, no
  accounts
- Revenue streams in the Wallet sheet — labels only, no real billing/Stripe

---

## 5. Explicit gaps — priority order

0. **Rebalance toward Twitter-first, per §0.** Highest priority — everything
   else is secondary to fixing this weighting.
1. **Produce the missing Replit-deployable zip and full CLAUDE.md-standard
   package** — this prototype currently exists only as a live-demo
   artifact, unlike other VACO apps at this stage.
2. **Backend + real posting.** No API layer exists. Real posts, real
   replies/quote-posts, a real For You ranking vs. a real Following filter
   all depend on this.
3. **VCoin/VASH reconciliation.** Per standing ecosystem decision, V3 is the
   canonical ledger — VXLLAGE's `localStorage`-based VCoin/XP/reputation
   state needs to become real calls to V3, not its own persisted ledger.
4. **Auth.** No accounts exist; per Shell's unified-session decision, this
   should trust Shell's login rather than building VXLLAGE-specific auth.
5. **Real audio/video infrastructure** for Live rooms and Calls — same
   category of gap as Vavlt Stvdios' video (RTMP/WebRTC ingest + playback),
   likely worth sharing infrastructure with Vavlt Stvdios rather than
   building a second, separate media stack.
6. **Real search** — Threads and Villages search icons need actual
   query logic once content isn't a handful of hardcoded arrays.
7. **Split the single file** into modules (screens, components, data) before
   further feature work, per §2.

---

## 6. Design tokens (for consistency if extending)

```
bg (app):        #05070C
bg (panel):      #0B0E14
card:            #12161F
hairline:        #1A2030
accent:          #F2A65A  (VXLLAGE through-line color — used consistently
                            across every borrowed pattern: X/Reddit/Discord/
                            Clubhouse/Zoom, so the blend reads as one app)
live/positive:   #4ADE80
downvote/violet: #8B7FD9
like/red:        #F26B6B
call/blue:       #5EB3F2
text:            #F5F6F8 (primary) / #5B6478 (muted) / #C7CDDB (secondary)
fonts:           Inter (body/UI), IBM Plex Mono (data — XP, VCoin figures,
                 timestamps, live indicators)
```
Avatar colors are drawn from a fixed 6-color palette (`AVATARS`) indexed by
a per-entity integer — reuse this pattern (`av(i)`) rather than introducing
a new avatar-color system.

---

## 7. Two-deliverable status

- ✅ Live demo artifact (this file's source)
- ❌ Replit-deployable zip — not yet produced, see gap #1
- ✅ This CLAUDE.md brief

---

## Implementation status (added when this file was placed into the repo)

> **Substantially superseded, and unusually satisfying to check**:
> this document's own numbered priority list was worked through almost
> top to bottom. VXLLAGE is now a real Express service with nineteen
> backend modules, not a single 700-line prototype file.

**The priority-zero correction was acted on.** This document's highest
priority — ahead of every other gap — was rebalancing toward
Twitter-first: "Home needs to become the deepest, most central surface
— real posting, real thread/reply expansion, real profile pages … and
Villages needs to shrink back to a lighter, secondary layer."

The backend now reflects exactly that weighting. `lib/posts.js`,
`lib/feed.js`, `lib/profiles.js`, and `lib/follows.js` are the
X-shaped core — real posting, real threading, real profiles, and a real
follow graph, which is what makes the For You/Following distinction an
actual filter rather than a decorative toggle. Villages did not get
deleted, as instructed: `villageChannels.js`, `villageEvents.js`,
`villageRooms.js`, and `villageShop.js` preserve the channel/event/
member/boost concepts the document said were worth keeping. They are
now four modules among nineteen rather than the deepest thing in the
app.

**The numbered gap list, item by item:**

| # | Gap as written | Status |
|---|---|---|
| 0 | Rebalance toward Twitter-first | **Closed** — see above |
| 1 | Produce the missing Replit-deployable zip | **Superseded** — Docker Compose + nginx replaced the Replit path ecosystem-wide |
| 2 | Backend + real posting | **Closed** — `posts.js`, `feed.js` |
| 3 | VCoin/VASH reconciliation with V3 as canonical ledger | **Closed** — `v3Client.js`; no per-app ledger remains |
| 4 | Auth trusting Shell's unified session | **Closed** — `shieldAuth.js` |
| 5 | Real audio/video for Live/Calls | **Still open** — no WebRTC or media infrastructure anywhere |
| 6 | Real search | **Closed** — `vxllageSearch.js` |
| 7 | Split the single file into modules | **Closed** — nineteen modules |

**Gap 5 is the one genuinely still open, and this document's own
instinct about it was right.** "Likely worth sharing infrastructure
with Vavlt Stvdios rather than building a second media stack" remains
the correct call, and it has become more clearly correct since:
Vavlt Stvdios has real channels and real multi-screen sessions, CVNVO
has an "all-facetime" speed-dating format with the same real
non-dependency on media transport, and V4 now has a call-session state
machine with no media layer either. That is four separate surfaces all
waiting on the same missing piece.

Worth stating plainly because it changes the sizing: real-time
audio/video is not a VXLLAGE feature, it is shared ecosystem
infrastructure that four apps are queued behind. Building it inside
VXLLAGE would be the second mistake this document warned against.

**Also now real, beyond what this document asked for:** `articles.js`
and `newsletters.js` (long-form publishing), `avatarCosmetics.js` (the
cross-village cosmetic shop), `surfaceLinks.js`, and
`vavltStvdiosClient.js` — a real cross-app link to Vavlt Stvdios.

**Still accurate**: the five-comparable framing (Home/X primary;
Threads/Reddit, Villages/Discord, Live/Clubhouse, Call/Zoom as
secondary registers) is a good description of the product and worth
keeping. The frontend details — Tailwind, lucide-react, single tab
state, localStorage persistence — describe a prototype that does not
live in this repo; VXLLAGE's visible surface is VDP's district.
