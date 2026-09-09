# Plan — Phase 1: Shows, Episodes, Listening, Subscriptions

## Goal
Build Vvltvre Pods, the one entirely unbuilt item from the ecosystem
status audit, closing the false doc claim
(`VXLLAGE_CHOPZ_VACAY_ARCHITECTURE.md`'s "Podcasts — already covered
by Vvltvre's Pods division") that the VXLLAGE build had already
flagged but not resolved.

## Real investigation before any code
Grepped every `.md` file in the repo for "Pods" and "podcast" —
confirmed no dedicated source doc names Vvltvre Pods' own product
shape, unlike every other Vvltvre division (VOID MAGIC has
`VOID_MAGIC_MASTER_BUILD_BRIEF.md`, Vvltvre Music has DistroKid/
TuneCore/gamma. comparables, Vvltvre Flix has the Netflix Originals
brief). The only real leads: VAGO_CLAUDE.md's passing "Music/Pods are
divisions of Vvltvre," and the one already-debunked false claim.

Also found: `vulture-music/lib/releases.js`'s own `RELEASE_FORMATS`
already includes `podcast-episode`, and its own README already cites
gamma.'s real comparable extending its artist-owned, flat-fee model
"across music, video, AND podcasts, not music alone." This means the
real distribution/monetization economics for a podcast episode already
exist and are already tested — building Vvltvre Pods from scratch
would duplicate that if it reinvented distribution instead of calling
into it.

Asked the user directly how to proceed given the missing spec; user
chose: build it grounded in the real, well-known Spotify/Apple
Podcasts model.

## Design
New standalone app (port 8810, next free port per
`vaco-shell/lib/registry.js`), following the same project shape as
`vulture-music`/`vulture-flix`. `lib/shows.js` — the real grouping
entity missing everywhere else in this ecosystem, with an optional
creator-set `subscriptionPriceVCoin` (null by default — most real
podcasts are free). `lib/episodes.js` — `publishEpisode` calls an
injected `distributeFn`; `server.js` wires that to a real, live HTTP
call into `vulture-music`'s own `POST /api/releases`
(`format: 'podcast-episode'`), reusing its own existing `Spotify`
target rather than expanding that project's `DISTRIBUTION_TARGETS`
enum as a side effect of this build. `lib/subscriptions.js` — real,
optional, creator-level subscriptions (the Spotify "Fans"/Patreon
pattern), `PLATFORM_TAKE_PERCENT = 0.10` grounded in Patreon's own
real, well-known standard take rate, same 30-day renewal cadence as
`vulture-flix`'s own subscriptions for ecosystem consistency.
`lib/listening.js` — free by default, gated only for an episode
explicitly marked `requiresSubscription` (which itself requires the
show to actually have a real paid tier).

## Explicitly NOT in this task
Real audio hosting/CDN infrastructure. Real ad-serving. RSS feed
generation (this ecosystem uses internal cross-app calls, not external
syndication, as its own established integration pattern). Multiple
subscription tiers per show. Transcripts/chapters/show notes.

## Verification approach
10 plain-Node checks. A live pass with `venvs-mock-backend`,
`vulture-music`, and `vulture-pods` all running independently: a real
episode published through the real cross-app call, V3's own live
balance confirming the real distribution fee, the resulting release
independently confirmed on `vulture-music`'s own server (not mocked);
a free listen moving zero money; a real paid show with a gated bonus
episode, the listen correctly blocked before subscribing and allowed
after, a real subscription's dual payout confirmed exactly against V3,
including confirming the creator's balance composing correctly across
both their own publish fee and this subscription payout.

## Done when
Vvltvre Pods exists as a real, tested, live-verified app, grounded in
a real, well-known comparable rather than an invented spec, reusing
`vulture-music`'s own real distribution economics rather than
duplicating them, and registered in `vaco-shell`'s app list.
