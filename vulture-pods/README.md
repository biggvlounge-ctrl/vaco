# Vvltvre Pods

`VVLTVRE -> PODS` — the fourth Vvltvre division built this session,
alongside VOID MAGIC (`VVLTVRE -> TOURING & TIX`), Vvltvre Music/
Distribution (`VVLTVRE -> MUSIC/DISTRIBUTION`), and Vvltvre Flix
(`VVLTVRE -> FLIX`).

**Scope note, read this before touching anything here**: unlike every
other Vvltvre division, no source doc in this ecosystem names Vvltvre
Pods' own product shape — only passing mentions that it's "a division
of Vvltvre," and one already-debunked false claim elsewhere
(`VXLLAGE_CHOPZ_VACAY_ARCHITECTURE.md`'s "Podcasts — already covered
by Vvltvre's Pods division," which the VXLLAGE build already found to
be false: zero real Pods code existed anywhere before this). Built,
by explicit direction, grounded directly in the real, well-known
Spotify/Apple Podcasts model instead of a fabricated spec.

**The real design, in one paragraph**: `vulture-music` already lists
`podcast-episode` as a real release format — gamma.'s own cited
comparable (already in that project) explicitly extends its
artist-owned, flat-fee distribution economics "across music, video,
AND podcasts, not music alone." So Vvltvre Pods doesn't reinvent
distribution economics; it calls into `vulture-music`'s own real,
already-tested `POST /api/releases` at publish time. What Pods
actually owns is the real, missing layer on top of that: **Shows**
(grouping episodes into a series, which no other project has), **free
listening by default** (the real Spotify/Apple Podcasts economics —
most podcasts are free/ad-supported, a genuinely different default
from Vvltvre Flix's mandatory subscription), and **optional
creator-level subscriptions** for bonus/exclusive episodes (the real
Spotify "Fans"/Patreon pattern — a creator sets one price, listeners
pay the creator directly minus a real, flagged platform take, distinct
from a platform-wide paywall).

## Run
```
cd ../venvs-mock-backend && npm install && npm start   # localhost:8791 (V3 stand-in)
cd ../vulture-music && npm install && npm start          # localhost:8806 (real distribution economics)
cd vulture-pods && npm install && npm start               # localhost:8810
```

## Test
```
curl http://localhost:8810/api/health
curl -X POST http://localhost:8810/api/shows -H "Content-Type: application/json" -d '{
  "creatorId":"host-1","title":"The Vaco Download","description":"Weekly ecosystem news","category":"technology"
}'
```

## What's here
- `lib/shows.js` — the real grouping entity: `SHOW_CATEGORIES`, a
  real `Show` record. **Real, multiple subscription tiers per show
  (Phase 4)**: `subscriptionTiers` is a real, creator-set array
  (`{ id, name, priceVCoin }`), defaulting to empty — most real shows
  have no paid tier at all, matching the real fact that most podcasts
  are entirely free. Closes this project's own previously-flagged
  gap, grounded in the real fact both Spotify's own "Fans" product and
  Patreon's own real product let one creator offer more than one price
  point on the same show.
- `lib/episodes.js` — real episodes under a show
  (`submitted → published` via a real, guarded `draft`/`published`
  lifecycle). `publishEpisode` is the real cross-app integration
  point: it calls an injected `distributeFn`, which `server.js` wires
  to a real, live HTTP call into `vulture-music`'s own
  `POST /api/releases` (format `podcast-episode`) — the real
  distribution fee and `ownershipRetainedPercent: 100` posture come
  from that already-built, already-tested project, not duplicated
  here. `requiresSubscription` is real and honest: an episode can only
  be gated this way if its own show actually has a real subscription
  tier to gate behind. **Real video cross-link (Phase 2)**, per
  explicit instruction: `attachEpisodeVideo` attaches a real video
  episode to Vavlt Stvdios, mirroring `vulture-music`'s own
  `attachMusicVideo`, rather than this project reinventing video
  hosting. **Real length-aware routing (Phase 3)**: Vavlt Stvdios has
  two real, separate video primitives — Reels (capped at a real,
  deliberate 20 minutes) and, since its own Phase 5, real long-form
  Video (capped at a real 12 hours, YouTube's own verified-account
  figure). `server.js`'s own `postVideoToVaultStvdios` picks the real
  one based on the episode's own real `durationSeconds` — a short
  episode routes to a genuine Reel, a long one (the real, common case
  for video podcasts) routes to a genuine long-form Video instead of
  being rejected. `vaultStvdiosContentType` (`'reel' | 'video'`)
  records honestly which real entity `vaultStvdiosPostId` actually
  points to.
- `lib/subscriptions.js` — real, optional, creator-level show
  subscriptions, genuinely different economics from
  `vulture-flix/lib/subscriptions.js`'s own mandatory, platform-wide
  paywall: this is real, optional, per-creator support, the actual
  Spotify "Fans"/Patreon pattern. `PLATFORM_TAKE_PERCENT` (10%) is a
  real, flagged, interpretive number grounded in Patreon's own real,
  well-known standard platform take rate — the rest goes straight to
  the creator, the same "one source, real dual payout, sums to exactly
  what was charged" discipline as every other split this session. Same
  real 30-day renewal cadence as `vulture-flix`'s own subscriptions,
  for ecosystem consistency. `subscribeToShow` now takes a real
  `tierId` (Phase 4) — a subscriber holds exactly one active tier per
  show at a time, Patreon's own real model; subscribing again with a
  different `tierId` is a real, deliberate tier switch that re-prices
  the one existing subscription rather than creating a second,
  competing one.
- `lib/listening.js` — real, free-by-default listening, genuinely
  different from `vulture-flix`'s own `watchTitle`: no subscription
  check, no money moves, unless the specific episode is a real gated
  bonus episode, in which case it checks the listener's own real
  subscription to that show.
- `server.js` — a real Express API (CommonJS), real injected
  `transferVCoin` against V3 (`venvs-mock-backend`), plus a real,
  live HTTP client into `vulture-music`'s own server for episode
  distribution — same cross-app pattern established for CHOPZ SHOP/
  VOID/CVNVO's own cross-app calls. `Spotify` is reused as-is from
  `vulture-music`'s own existing `DISTRIBUTION_TARGETS` (a real, valid
  podcast platform already in that project's enum) rather than
  expanding another already-shipped project's own list as a side
  effect of this build.

## Verified
10 plain-Node checks (free listening moving no money and requiring no
subscription, `requiresSubscription` rejected when a show has no paid
tier, a real subscription's dual payout proven to sum exactly to the
charged price, a gated bonus episode blocking a non-subscriber and
allowing a real subscriber, cancelling a subscription revoking future
access, double-publish rejected, listening to a draft episode
rejected, invalid show inputs rejected, subscribing to a free-only
show rejected, and listen history/counts correctly scoped per user and
per episode), plus a live pass with `venvs-mock-backend`,
`vulture-music`, and `vulture-pods` all running independently: a real
show and episode created, published through the real cross-app call
into `vulture-music`'s own server — V3's own live balance confirmed
the real `4.99` `podcast-episode` distribution fee charged
(`1000 → 995.01`), and the resulting release independently confirmed
on `vulture-music`'s own server (`ownershipRetainedPercent: 100`,
correct `coWriters` shape) — not a mocked response. A free listen
confirmed moving zero money. A real paid show (`30` VCoin) with a
gated bonus episode: the listen attempt correctly rejected before
subscribing, a real subscription confirmed splitting exactly `27` to
the creator and `3` to the platform against V3's own live balance
(the creator's own balance independently confirmed reflecting both
its own publish fee **and** this subscription payout composing
correctly: `1000 − 4.99 + 27 = 1022.01`), and the listen succeeding
immediately afterward. Double-publish, invalid category, and
subscribing to a free-only show all confirmed rejected over real HTTP.

**Phase 2 (video cross-link)**: 4 plain-Node checks (a real video
attaches to an episode, a second attach rejected, attach works
independent of publish state, a missing `vaultStvdiosPostId`
rejected), plus a live pass across four independently running servers
(`venvs-mock-backend`, `vavlt-stvdios`, `vulture-music`,
`vulture-pods`): a real 10-minute video episode attached successfully
via the new `/api/episodes/:id/video` route; a real 45-minute video
episode attempt **correctly rejected by Vavlt Stvdios' own real
validation** (`"a reel requires a durationSeconds between 0 and 1200
(20 minutes)"`), proving the real length mismatch this project's own
"Not yet built" section flags is honestly enforced end to end, not
silently bypassed; double-attach confirmed rejected.

**Phase 3 (length-aware routing, closing the Phase 2 gap)**: 3
plain-Node checks (`attachEpisodeVideo` requires a valid
`contentType`, `'reel'` and `'video'` both recorded correctly), plus a
live pass against the real, upgraded Vavlt Stvdios server (now with a
real long-form Video primitive): the **exact same real 45-minute
episode Phase 2 had confirmed rejected** now succeeds, attached as a
genuine long-form `Video` (`vaultStvdiosContentType: 'video'`,
independently confirmed via Vavlt Stvdios' own
`GET /api/videos/:id`) — while a real 5-minute episode created
immediately after still correctly routes to a genuine Reel
(`vaultStvdiosContentType: 'reel'`, independently confirmed via
`GET /api/posts/:id`), proving `server.js`'s own real duration-based
routing picks the right primitive either way.

**Phase 4 (multiple subscription tiers per show)**: 8 plain-Node
checks (a show created with two real tiers and real assigned ids, a
non-positive tier price rejected, subscribing to the cheaper tier
paying the real split at that tier's own price, switching tiers on an
existing subscription re-pricing the one record rather than
duplicating it, an unknown `tierId` rejected, a show with zero tiers
rejecting any subscribe attempt, the cheapest real tier alone
unlocking a gated episode — proving the gate is genuinely
tier-agnostic, not minimum-tier-specific — and gating an episode on a
zero-tier show rejected), plus a live pass against the real running
server and the real standalone V3: a real two-tier show
(`Supporter: 3`, `Superfan: 10`) created, a real subscription to the
pricier `Superfan` tier independently confirmed against V3's own
balance on both sides (`listener 1000 → 990`, `creator 1000 → 1009`,
the exact real `9`/`1` creator/platform split at the `10`-VCoin tier).

## Real persistence
`lib/persistence.js` wraps `server.js`'s own store in a real file-backed
store, `data/store.json` (port 8810) — Vvltvre Pods's own real state now
survives a restart. Live-verified: created a real podcast show, killed the
running process, restarted it, and confirmed the same real state came back
from a real GET. See `dev-docs/phase-5-real-persistence/`.

## Not yet built
- Any UI — this phase is the real API and data model only.
- Real audio hosting/streaming infrastructure — episodes are real
  metadata records, not actual audio files or a CDN.
- Real advertising insertion — "free, ad-supported" describes the
  real economic default (no listener charge), not a built ad-serving
  system; no ad infrastructure exists anywhere in this ecosystem.
- RSS feed generation/distribution — real podcast platforms sync via
  RSS; this project's own `vulture-music` cross-app call is the real
  distribution integration point instead, per this ecosystem's own
  established pattern of internal cross-app calls over external
  syndication formats.
- Episode transcripts, chapters, or show notes beyond the real,
  minimal metadata fields built here.
- A real 12-hour ceiling still exists on the long-form Video path
  (Vavlt Stvdios' own `MAX_VIDEO_DURATION_SECONDS`, YouTube's real
  verified-account cap) — comfortably covers any real episode length,
  but is a real, named limit, not literally unbounded.
