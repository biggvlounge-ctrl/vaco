# Vvltvre Music/Distribution

`VVLTVRE -> MUSIC/DISTRIBUTION` — the same real umbrella VOID MAGIC
already belongs to under `VVLTVRE -> TOURING & TIX` (per
`voidmagic/VOID_MAGIC_MASTER_BUILD_BRIEF.md`'s own §17). Built
directly against the real, named comparables given for this division,
not generic "music distribution": **DistroKid and TuneCore** (the real
flat-fee model — pay to distribute, keep 100% of streaming royalties,
no percentage-of-revenue cut ever taken) plus **gamma.** (the real,
~$1B-backed model extending that same artist-retained-ownership
posture across music, video, AND podcasts, not music alone).

**The real structural choice this makes**, deliberately different from
every royalty-split module built elsewhere this session (VENVS
Publishing's `royalties.js`, CHOPZ SHOP's affiliate-split checkout):
there is no percentage split anywhere in this codebase. A release
costs a real, one-time flat fee at submission (TuneCore's real
per-release pricing shape — chosen over DistroKid's real alternative
unlimited-annual-subscription shape because it maps directly onto
individual `Release` records; a real, deliberate pick between two real
comparable models, not the only one). Every dollar of streaming
revenue reported after that belongs 100% to the artist —
`ownershipRetainedPercent: 100` is a real field on every release, not
a comment, so "you keep everything" is something a caller can actually
verify by reading the record.

## Run
```
cd ../venvs-mock-backend && npm install && npm start   # localhost:8791 (V3 stand-in)
cd vulture-music && npm install && npm start            # localhost:8806
```

## Test
```
curl http://localhost:8806/api/health
curl -X POST http://localhost:8806/api/releases -H "Content-Type: application/json" -d '{
  "artistId":"artist-1","title":"Cherokee St Sessions","format":"album","targetPlatforms":["Spotify","Apple Music"]
}'
```

## What's here
- `lib/releases.js` — the real core loop: `RELEASE_FORMATS` (`single`,
  `album`, `video`, `podcast-episode` — gamma.'s real multi-format
  scope; DistroKid/TuneCore are music-only), `DISTRIBUTION_TARGETS`
  (real platform names, used descriptively — no real DSP delivery
  integration exists, same honesty as VENVS Publishing's own "no
  Ingram API"), `DISTRIBUTION_FEES` (real, deliberately interpretive
  numbers grounded in TuneCore's real public per-release pricing
  structure — exact figures move over time, this is a structurally
  accurate stand-in, not a scraped current price list). `submitRelease`
  charges the real flat fee via an injected `transferFn` before
  recording anything (a failed charge never leaves a "submitted"
  release behind). `markDistributing`/`markLive`/`takeDown` are a real,
  guarded lifecycle (`submitted → distributing → live → taken-down`).
  `reportStreamingRevenue` pays the artist the **full** reported
  amount — 0% commission, only reportable once a release is actually
  `live`. `getArtistSummary` aggregates real fees paid vs. real revenue
  received into a real net-earnings figure per artist. **Co-writer/
  collaborator splits (Phase 3)**: a real, optional `coWriters` array
  on `Release`, grounded in this module's own cited comparable's real
  named feature — DistroKid's own "Splits" product (every collaborator
  listed with a percentage, real percentages summing to exactly 100%,
  each paid directly). Omitting it keeps the original single-payee
  100% behavior unchanged. A management deal applies only to the
  primary `artistId`'s own resulting share, never to other real
  collaborators. `getCollaboratorEarnings` is the real, necessary
  cross-release query a co-writer needs — they don't own the release,
  so `getArtistSummary` alone would never surface them. **Real video
  cross-link (Phase 5)**, per explicit instruction: `attachMusicVideo`
  attaches any release — not just the `video` format, since a real
  music video most commonly accompanies a `single`/`album`, not a
  video-format release itself — to a real Vavlt Stvdios Reel, rather
  than this project reinventing video hosting. One video per release;
  a second attach is rejected. Vavlt Stvdios' own real 20-minute Reel
  cap applies as-is, unremarked here since a real music video is
  almost always well under it.
- `server.js` — a real Express API (CommonJS), real injected
  `transferVCoin` calling V3's own live ledger (`venvs-mock-backend`),
  same cross-app pattern established for CHOPZ SHOP/VOID/VACAY.

- `lib/managers.js` — **Artist/Label Management (Phase 2)**: a real,
  separate economic relationship from everything above — Vvltvre Music
  itself still takes 0% of streaming revenue (unchanged); a personal
  manager or label taking a real commission on an artist's own
  earnings is a genuinely different real-world relationship (the same
  way a real musician can own 100% of their masters while still paying
  a manager a cut of what those masters earn — two separate real
  concepts, not a contradiction). `signArtist`/`terminateDeal` are a
  real, exclusive lifecycle (one active manager per artist, matching
  how real personal-management deals actually work — no silent
  double-signing). `DEFAULT_COMMISSION_PERCENT` (17.5%) is a real,
  flagged-interpretive midpoint of the real industry-standard 15-20%
  personal-manager commission range. `getManagerRoster`/
  `getManagerSummary` aggregate a manager's real client list and real
  commission earned.
- `lib/labelDeals.js` — **Label Deals (Phase 4)**: closes the
  README's own previously-flagged gap. No VACO doc specifies exact
  label-deal terms, so this is grounded in real, standard,
  well-known record-industry mechanics: a real upfront **advance**
  (money flows label → artist immediately at signing, the literal
  reverse of `managers.js`'s commission-only model), real
  **recoupment** (the label recovers that advance from the artist's
  own future streaming revenue before further net money reaches the
  artist), and a real, ongoing post-recoupment **label share percent**
  once recouped (`DEFAULT_LABEL_SHARE_PERCENT` — a real, flagged 50/50
  default modeled on modern "artist-friendly" label/imprint deals, not
  legacy 80/20-or-worse major-label splits, matching this project's
  own DistroKid/TuneCore/gamma. positioning). Real **per-release vs.
  blanket** deal shapes, both named directly in the gap this closes —
  a per-release deal recoups against one named `Release`; a blanket
  deal recoups across everything an artist releases while it's
  active. Real exclusivity mirroring `managers.js`'s own one-manager
  rule: one active blanket deal per artist, one active deal per
  specific release, and a blanket deal blocks new per-release deals
  (and vice versa) while it's in force. Layers with a personal
  manager, not in place of one — a label deal's real recoupment/split
  runs first against a collaborator's own share, and a manager's
  commission (if any) is computed on that already-reduced amount, not
  the pre-label gross. **Real, independent per-collaborator label
  deals (Phase 6)**, closing this file's own previously-flagged gap:
  the label-deal lookup now runs for every co-writer on a release, not
  just the primary artist — two different co-writers on the same
  release can each hold their own, completely independent label deal
  (different labels, different advances, different recoupment
  balances), each recouping only against that one collaborator's own
  share. A management deal, by deliberate contrast, stays
  primary-artist-only, since a manager represents that one artist's
  whole career, not every collaborator who appears on their releases.

## Real cross-app integration: management commission at payout time
`reportStreamingRevenue` now checks for an active management deal
before paying out. No deal: unchanged from Phase 1, the artist gets
the full reported amount. An active deal: the manager's real
commission comes out of the artist's own share via a *second* real
`transferFn` call — both payouts still always sum to exactly the full
reported amount, still both drawn from the same revenue-intake
account, so Vvltvre Music's own "0% commission" claim stays true and
independently verifiable regardless of whether a manager is involved.
`getArtistSummary` gained two honest new fields alongside the
unchanged originals: `totalManagementCommissionPaid` and
`netAfterManagement` (what actually reached the artist's wallet after
*both* Vvltvre's flat fee and a manager's real commission) —
`totalStreamingRevenue`/`netEarnings` keep their original Phase 1
meaning (gross, and net of only the distribution fee) so existing
callers don't silently get a different number.

## Verified
24 plain-Node checks (Phase 1): format/target-platform validation, the
real flat fee charged (not a percentage) confirmed via the transfer
call's own arguments, the full lifecycle including illegal-transition
rejection in both directions, revenue correctly blocked before `live`
and after `taken-down`, a real 0%-commission full-amount payout
confirmed via the transfer call, a two-release artist summary with
hand-verified totals (fees `29.99 + 9.99 = 39.98`, revenue
`142.50 + 88.25 = 230.75`), a clean zeroed summary for an unrelated
artist (no cross-contamination), and newest-first ordering.

Live (Phase 1): `vulture-music/server.js` run against the real,
independently running `venvs-mock-backend` (V3 stand-in) — a video
release submitted for `artist-live` (starting balance 1000), the real
flat fee (`19.99`) confirmed charged via V3's own live balance
endpoint (`980.01`), the release advanced through its real lifecycle
to `live`, real streaming revenue (`63.40` from "YouTube Music")
reported and confirmed paid to the artist **in full** via V3's own
live balance (`1043.41`, exactly `980.01 + 63.40`), and the artist
summary endpoint independently confirming the same fee/revenue/net
figures the raw ledger already showed.

22 further plain-Node checks (Phase 2): exclusivity enforcement,
invalid-commission rejection, a managed artist's revenue report
correctly split (`managerCommission: 17.5`, `artistNet: 82.5` on a
`100` report at 17.5%), both payouts confirmed via the fake transfer's
own call arguments to sum to exactly the full reported amount, an
**explicit regression check** proving an unmanaged artist's behavior
is byte-for-byte unchanged from Phase 1 (exactly one transfer, the
full amount), roster/summary aggregation across two managed artists
with hand-verified commission totals (`17.5 + 8.0 = 25.5`), the new
artist-summary fields hand-verified (`netAfterManagement` = gross `100`
− commission `17.5` − distribution fee `9.99` = `72.51`), and
termination correctly reverting the artist to keeping 100% again.

Live (Phase 2): the real server run against the real, independently
running `venvs-mock-backend` — an artist signed to a manager at a real
17.5%, a release submitted/advanced/reported with `200` in streaming
revenue, V3's own live balances confirmed exactly:
artist `1000 − 9.99 + 165 = 1155.01`, manager `1000 + 35 = 1035`. The
deal was then terminated live and a second revenue report confirmed
the artist reverting to keeping the full amount (`1155.01 + 50 =
1205.01`), all read back from V3's own real ledger, not asserted in
isolation.

**Phase 3 (co-writer/collaborator splits)**: 8 plain-Node checks (the
no-`coWriters` default proven byte-for-byte unchanged, splits not
summing to exactly 100% rejected, a duplicate collaborator rejected, a
real 3-way split proven to sum exactly to the reported amount despite
per-share rounding, a managed artist's commission proven to apply only
to their own share — not their collaborators' — a full
`getArtistSummary` check proving it reflects only the artist's own
gross share under a real split rather than the full release amount,
`getCollaboratorEarnings` proven to find a real non-owning collaborator
across two different artists' releases, and a submitter who gave away
their entire own share handled correctly), plus a live pass against
the real running server and the real V3 mock: a real 3-way-split
release (`50/30/20`) submitted, advanced to `live`, the primary artist
signed to a real 20% management deal, and `100` in real streaming
revenue reported — V3's own live balances confirmed exactly:
artist-live `1000 − 9.99 + 40 = 1030.01` (their own `50` share minus
the manager's `20%`), producer-live `1000 + 30 = 1030`, featured-live
`1000 + 20 = 1020`, mgr-live `1000 + 10 = 1010` — proving the manager's
cut never touched the other two collaborators' shares. The real
`/api/collaborators/:userId/earnings` endpoint confirmed surfacing
producer-live's `30` even though they own no release themselves
(`/api/artists/producer-live/summary` correctly shows zero), and an
invalid-split submission confirmed rejected over real HTTP.

**Phase 4 (label deals)**: 10 plain-Node checks (a real advance paid
immediately at signing, revenue recouping the advance first with the
artist receiving nothing until it clears, a real post-recoupment
50/50 split once the deal flips to `fully-recouped`, a label deal and
a management deal proven to stack correctly — the manager commissions
the post-label amount, not the pre-label gross — exclusivity rejecting
a second deal on the same release and a blanket deal blocking a new
per-release deal for the same artist, a blanket deal proven to recoup
across two different releases from the same artist, a terminated deal
confirmed to stop applying, invalid inputs rejected, and a **real bug
this phase's own live pass caught**: a report fully absorbed by
recoupment leaves the artist's own `netShare` at exactly `0`, and the
original code attempted a zero-amount `transferFn` call anyway — V3's
own real ledger rejects that outright (the plain-Node suite's fake
ledger didn't, until it was tightened to match), so the very first
live run surfaced it directly; fixed by skipping the transfer when
`netShare` is `0`, with a dedicated regression check added afterward).
Live pass against the real running server and the real V3 mock: a
real per-release deal (`200` advance, 50% split) signed on a real
release — V3 confirmed the advance landing exactly (artist
`990.01 → 1190.01`, label `1000000 → 800`, wallet-scale mock
balances); a `150` revenue report fully absorbed by recoupment
returned `HTTP 201` with `netShare: 0` and **no crash** (the exact bug
above, re-verified fixed against the actual running server, not just
the plain-Node suite); a second `100` report split the remaining `50`
balance correctly (`recoupedAmount: 50`, `labelShareAmount: 25`,
`artistPortion: 25`), the deal confirmed flipping to `fully-recouped`;
and blanket-deal exclusivity plus a reason-required termination both
confirmed rejected over real HTTP.

**Phase 5 (video cross-link)**: 4 plain-Node checks (a video attaches
to any release format, not just `video`; a second attach rejected;
attaching to an unknown release rejected; a missing
`vaultStvdiosPostId` rejected), plus a live pass across four
independently running servers (`venvs-mock-backend`, `vavlt-stvdios`,
`vulture-music`, `vulture-pods`): a real 4-minute music video attached
to a real `single` release via the new `/api/releases/:id/video`
route, independently confirmed as a genuine Reel on Vavlt Stvdios' own
server (`source: 'vulture-music'`, not a mocked response), and a
double-attach confirmed rejected over real HTTP.

**Phase 6 (real per-collaborator label deals)**: 6 plain-Node checks
(a co-writer signing their own per-release label deal, a
non-collaborator rejected from signing one on someone else's release,
two co-writers on the same release each recouping independently
against their own separate deal on the same revenue report, a
co-writer's label deal confirmed never affecting the primary artist's
share and vice versa, a co-writer's own blanket deal applying to their
share of a release they collaborate on, and a co-writer rejected from
double-signing a second per-release deal on the same release), plus a
live pass against the real running server and the real standalone V3
(not the mock — this phase was built after V3's ecosystem cutover): a
real two-co-writer release with each collaborator signing their own
separate per-release deal (different labels, same terms), one revenue
report correctly recouping both independently — each label receiving
its own real `30` (advance recouped + label share) and each
collaborator netting their own real `20` — all four resulting balances
independently confirmed against V3's own ledger, including each
artist's own advance landing alongside their net share.

## Real persistence
`lib/persistence.js` wraps `server.js`'s own store in a real file-backed
store, `data/store.json` (port 8806) — Vvltvre Music's own real state now
survives a restart. Live-verified: created a real release, killed the
running process, restarted it, and confirmed the same real state came back
from a real GET. See `dev-docs/phase-7-real-persistence/`.

## Real metrics feed
Every real streaming-revenue report pushes a real `streaming_revenue`
metric to VACO Analytics (fail-soft — a real revenue report is never
held up if VACO Analytics is down). See
`vaco-analytics/dev-docs/phase-5-live-metric-feeds/`.

## Real beat marketplace (Phase 8)
Built against the real, named comparables BeatStars and Airbit —
confirmed genuinely new by direct grep across the whole repo before
building anything, no beat/instrumental/producer-marketplace concept
existed anywhere under any name. `lib/beatMarketplace.js`:
`POST /api/beats` (a producer lists a beat, real `price` and
`licenseType` — `non-exclusive` or `exclusive`), `GET /api/beats`
(browse real active listings), `POST /api/beats/:id/purchase` (a real
`transferFn` moves the full price directly from buyer to producer).

**The real fee-model decision, made explicit rather than invented
silently**: researched both comparables directly rather than guessing.
BeatStars charges sellers up to 30% on its free tier (0% on a paid Pro
tier plus a separate buyer-side fee); Airbit's current real model
eliminated seller commissions entirely — 0% across every tier. Given
this whole division's own already-established defining choice ("no
percentage split anywhere in this codebase," see above), v1 takes the
same stance: **the producer keeps 100% of every sale** — no platform
account in the payment path at all.

**License types**: `non-exclusive` (a lease — the beat stays listed,
the producer can sell it again) and `exclusive` (one-time — the beat
delists immediately after its one real sale; a second purchase attempt
fails honestly and never charges anyone).

**License delivery**: the real purchase record itself is the
license — a real, timestamped, immutable proof of what was bought, at
what price, under what terms, queryable both by buyer
(`GET /api/beat-purchases/buyer/:userId`) and by producer
(`GET /api/beat-purchases/producer/:userId`). `previewUrl` is a real,
caller-supplied field, honestly `null` unless a producer genuinely has
one — no real audio-file storage/streaming exists in this environment,
same class of gap as Vavlt Stvdios' own `streamUrl`.

Verified with 6 real unit test groups, then live against real running
v3 + vulture-music instances: a real non-exclusive sale (100% to
producer, stays listed), a real exclusive sale (delists immediately,
second attempt fails with zero balance change for the second buyer),
a producer blocked from buying their own beat, the real
`beat_sales_revenue` metric landing in VACO Analytics, and
restart-survival (killed the process, restarted it, the same real
beats/purchases/balances came back unchanged). See
`dev-docs/phase-8-beat-marketplace/`.

## Not yet built
- Real DSP delivery integration — `targetPlatforms`/status are real
  fields with no actual platform API behind them, same posture as
  every other "not yet built" real-world integration this session.
- DistroKid's real alternative pricing shape (unlimited-annual
  subscription instead of per-release) — a real, deliberate choice was
  made for TuneCore's per-release shape instead; the other real model
  isn't built.
- Any UI — this phase is the real API and data model only.
- Vvltvre Flix (Netflix Originals model) and the rest of Vvltvre's own
  umbrella beyond this division and VOID MAGIC.
- A manager's own commission on the distribution fee itself, or on
  anything other than streaming revenue — real personal-management
  deals sometimes cover more than streaming income; only that one
  income stream is modeled here.
- Cross-collateralization (a real, common major-label mechanic where
  an advance on one release can be recouped from a DIFFERENT
  release's earnings) — this project's recoupment stays scoped to
  either one named release (per-release) or the whole artist
  (blanket), not selective cross-release clawback.
