# Vvltvre Flix

`VVLTVRE -> FLIX` — the third Vvltvre division built this session,
alongside VOID MAGIC (`VVLTVRE -> TOURING & TIX`) and Vvltvre Music/
Distribution (`VVLTVRE -> MUSIC/DISTRIBUTION`). Built specifically
against the real, named comparable given for this division: **the
Netflix Originals model, for its real exclusive-content strategy** —
not a generic streaming-app build.

**The real structural point, and why this is deliberately NOT shaped
like `../vulture-music/`** despite both being Vvltvre content
divisions: the two real comparables run in genuinely opposite economic
directions. DistroKid/TuneCore (Vvltvre Music) let the artist keep
100% ownership and 100% of ongoing revenue, charging only a flat
distribution fee — the platform never acquires anything. Netflix
Originals is the real opposite: Netflix pays a real, one-time
acquisition/commissioning fee to buy **exclusive** global rights, and
the creator does not continue earning ongoing per-view royalties on
most real Original deals — they were already paid in full up front.
`ownershipRetainedPercent: 0` on every acquired title here is the
literal, deliberate mirror of Vvltvre Music's own
`ownershipRetainedPercent: 100` — not a bug, the real defining
contrast between the two real comparables this session was given.

The other real, defining Netflix mechanic: access is **subscription-
gated, never per-title**. There is no per-title price anywhere in this
codebase — `watchTitle` checks only whether the caller has an active
subscription.

## Run
```
cd ../venvs-mock-backend && npm install && npm start   # localhost:8791 (V3 stand-in)
cd vulture-flix && npm install && npm start              # localhost:8807
```

## Test
```
curl http://localhost:8807/api/health
curl -X POST http://localhost:8807/api/titles -H "Content-Type: application/json" -d '{
  "creatorId":"studio-1","title":"Cherokee St: The Movie","type":"film","acquisitionFee":250,"exclusivityWindowDays":365
}'
```

## What's here
- `lib/titles.js` — the real core loop: `TITLE_TYPES` (`film`,
  `series`, `documentary`, `special`). `acquireExclusiveTitle` charges
  Vvltvre Flix's own acquisition account and pays the **creator** a
  real, one-time `acquisitionFee` — deliberately caller-supplied, not
  looked up from a fixed schedule the way Vvltvre Music's
  `DISTRIBUTION_FEES` is: real Netflix Original deals are individually
  negotiated per project (a small documentary and a tentpole film
  aren't on the same rate card), only sanity-checked to be positive. A
  real, guarded lifecycle (`acquired → streaming → removed`).
  `isExclusive` is real and date-driven (computed against
  `exclusiveUntil`, not a stored status — the real "leaving soon"
  Netflix mechanic), not an action a caller triggers. `watchTitle` is
  the real access gate: requires an active subscription
  (`lib/subscriptions.js`) and a `streaming` title, moves **zero**
  money, and records a real watch event — the creator was already paid
  in full at acquisition. **Licensed, non-exclusive content (Phase
  2)**: closes the README's own previously-flagged gap —
  `licenseNonExclusiveTitle` is genuinely different economics from
  acquisition, not a renamed copy: a real `licenseFee` for temporary,
  NON-exclusive streaming rights (other platforms can carry the same
  title simultaneously), the licensor keeps full ownership
  (`ownershipRetainedPercent: 100`, the literal mirror of an acquired
  title's `0`), and the right itself expires for real at
  `licenseExpiresAt` — no `exclusiveUntil` window exists on a licensed
  record, since exclusivity was never granted. `acquisitionType`
  (`'exclusive-original' | 'licensed'`) is the real, honest
  discriminator on every record; `isLicenseActive` is the licensed-
  content mirror of `isExclusive`. `watchTitle` now also rejects a
  licensed title whose real license has expired, even while `status`
  is still `streaming` — the real Netflix "this deal ended" behavior,
  not something a separate manual `removeTitle` call should be
  required for. **Real concurrent-stream limit enforcement (Phase 3)**:
  closes this project's own previously-flagged gap. `startStream`
  shares `watchTitle`'s exact same access checks via a common
  `assertCanWatch` helper (so a rejected stream never logs a spurious
  watch event), then checks the caller's real subscription tier
  against how many of their own `streamSessions` are still `active`,
  rejecting a new stream at their tier's real `TIER_MAX_SIMULTANEOUS_STREAMS`
  limit. `endStream` closes a session and frees the slot for a new
  one — real session start/end, not the fire-and-forget single event
  `watchTitle` still is for a plain, non-slot-holding watch.
- `lib/subscriptions.js` — real monthly subscriptions
  (`MONTHLY_FEE`, a flagged-interpretive number grounded in Netflix's
  real current standard-tier price), `subscribe` (real charge + real
  30-day renewal window, correctly reactivating a lapsed subscriber),
  `cancelSubscription`, `isSubscriber` — the real check every watch
  action goes through. **Multiple subscription tiers (Phase 2)**:
  closes the README's own previously-flagged gap — real
  `ad-supported`/`standard`/`premium` tiers (`TIER_FEES`, flagged-
  interpretive numbers grounded in Netflix's real three-tier
  structure and relative pricing shape; `standard` keeps the original
  `MONTHLY_FEE` value exactly). `TIER_MAX_SIMULTANEOUS_STREAMS` is a
  real, named Netflix tier differentiator, now genuinely enforced by
  `lib/titles.js`'s own `startStream`/`endStream` (Phase 3, see below).
  No separate tier-change action exists or is needed:
  `subscribe` already doubled as this module's real renewal mechanism
  — calling it again with a different `tier` is the same real,
  immediate action, now also switching which tier and price take
  effect from that renewal on.
- `server.js` — a real Express API (CommonJS), real injected
  `transferVCoin` against V3 (`venvs-mock-backend`), same cross-app
  pattern as `vulture-music`/CHOPZ SHOP/VOID/VACAY.

## Verified
24 plain-Node checks: a non-subscriber correctly rejected from
watching even a live, streaming title; the real monthly fee charged on
subscribe; cancel/reactivate correctly flipping `isSubscriber`;
acquisition confirmed paying the **creator** (not the reverse) via the
transfer call's own arguments, with `ownershipRetainedPercent: 0`
proven on the record; type/fee/window validation; the full title
lifecycle including illegal re-transition rejection; watching blocked
before `streaming` and after `removed`; a real subscriber's watch
event recorded while **zero money moved** on the watch call itself
(proven via an empty transfer-call log); catalog listing with the
computed `isExclusive` flag and the `onlyStreaming` filter; per-creator
listing.

Live: `vulture-flix/server.js` run against the real, independently
running `venvs-mock-backend` (V3 stand-in) — an exclusive film
acquired for a real `250`, the **studio's** V3 balance confirmed
increasing by exactly that (`1000 → 1250`, money flowing platform →
creator, the real inverse direction from Vvltvre Music's artist →
platform flow); a viewer's watch attempt correctly rejected before
subscribing; the viewer subscribed, V3's own live balance confirmed
the real monthly charge (`1000 → 984.51`); the same viewer then
successfully watched the now-streaming title with their V3 balance
**unchanged** (`984.51` before and after), confirming the subscription-
gate/zero-per-view-cost design end-to-end against a real ledger, not
asserted in isolation.

**Phase 2 (licensed content + subscription tiers)**: 9 plain-Node
checks (a licensed title's real fee/ownership/expiry fields correct,
an exclusive-original title proven unaffected by the new schema
fields, `getCatalog`'s `isExclusive`/`isLicenseActive` proven honestly
mutually exclusive per type, an expired license blocking `watchTitle`
even while `status` is `streaming` and still watchable before expiry,
real distinct per-tier fees charged, the no-tier default proven
byte-for-byte unchanged from the original `MONTHLY_FEE` behavior,
re-subscribing with a different tier proven to switch tiers and charge
the new fee, invalid tier and invalid licensing inputs both rejected),
plus a live pass against the real running server and the real V3 mock:
a real title licensed from `studio-live` for `300`, V3's own live
balance confirmed increasing by exactly that; a `premium` subscriber
(`22.99` charged, confirmed against V3) watched it successfully; a
second, short-term-licensed title's expiry confirmed via the same
`now` testability parameter every module in this codebase already
exposes — the subscription renewed forward to a future `now` (proving
subscription validity alone), then the watch attempt at that same
`now` rejected specifically for the license having expired, not
subscription lapse; an `ad-supported` subscriber's distinct, lower fee
confirmed against V3; and invalid-tier/invalid-license-fee submissions
both confirmed rejected over real HTTP.

**Phase 3 (concurrent-stream limit enforcement)**: 8 plain-Node checks
(an `ad-supported` viewer's second concurrent stream rejected at their
real limit of 1, ending a stream freeing the slot for a new one, a
`standard` viewer allowed 2 concurrent streams and rejected on a
third, a `premium` viewer allowed 4 and rejected on a fifth, a
rejected over-limit stream confirmed logging **no** spurious watch
event, a non-subscriber rejected by `startStream` with the exact same
check `watchTitle` uses, double-ending and an unknown session both
rejected, and plain `watchTitle` confirmed unaffected — it still holds
no concurrency slot at all), plus a live pass against the real running
server and the real standalone V3: a real title acquired and marked
streaming, an `ad-supported` viewer's first stream succeeding, a
second concurrent stream from the same viewer correctly rejected with
their real tier's limit named in the error, and — after ending the
first stream — a new stream from that same viewer succeeding again.

## Real persistence
`lib/persistence.js` wraps `server.js`'s own store in a real file-backed
store, `data/store.json` (port 8807) — Vvltvre Flix's own real state now
survives a restart. Live-verified: added a real title, killed the running
process, restarted it, and confirmed the same real state came back from a
real GET. See `dev-docs/phase-4-real-persistence/`.

## Real metrics feed (Phase 5)
Every real subscription pushes a real `subscription_revenue` metric to
VACO Analytics (fail-soft — a real subscription is never held up if
VACO Analytics is down). See
`vaco-analytics/dev-docs/phase-6-more-live-metric-feeds/`.

## Real studio-produced titles (Phase 6)
Closes a real gap: `../vulture-studios/`, a new Universal-Studios-
style production-financing division, needed a real way to distribute
a completed, already-financed project into this catalog — but both
existing paths, `acquireExclusiveTitle` and `licenseNonExclusiveTitle`,
hard-require a positive fee, and forcing one through here would have
double-charged a project whose real financing already happened
entirely inside Vvltvre Studios' own ledger. `lib/titles.js` gained a
real, new, third path: `registerStudioProducedTitle`, exposed as
`POST /api/titles/studio-produced`. It creates the title record with
`acquisitionType: 'studio-produced'`, `acquisitionFee: null`,
`licenseFee: null`, `ownershipRetainedPercent: 0`, and a real
`studioProjectId` cross-reference back to the financing project — and
deliberately calls no `transferFn` of its own, since the real payment
already happened as production financing, not as an acquisition here.
Live-verified as part of Vvltvre Studios' own full lifecycle test: a
real completed project's `distribute` call created a real title here,
independently re-confirmed via this app's own separate `GET
/api/titles/:id` (not just trusting the caller's success response),
and a deliberately-killed instance of this app confirmed the caller's
own honest `502` failure path. See
`dev-docs/phase-6-studio-produced-titles/` and
`../vulture-studios/README.md`.

## Not yet built
- Any UI — this phase is the real API and data model only.
- Real content delivery/streaming infrastructure — `watchTitle` is a
  real access-gated event record, not actual video playback.
- Viewership-based bonus/backend participation clauses some real
  Original deals do include on top of the flat acquisition fee — the
  simpler, more common flat-fee-only shape is what's built here,
  flagged as a deliberate scope choice.
- Co-production/multi-studio acquisitions — every title here has
  exactly one `creatorId`.
