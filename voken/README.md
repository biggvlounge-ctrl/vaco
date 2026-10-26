# VOKEN

The ecosystem's digital collectibles marketplace, under a real,
consolidated umbrella standard: VDAS (the VOKEN Digital Asset
Standard). Anything with rarity, ownership, or cultural relevance —
vehicles, property, music, art, creator memberships, digital
wearables, business loyalty, event moments, landmarks, **real historic
places/people/inventions/books** — becomes a Cvltvre Card: collectible,
tokenized, ownable, buyable/sellable/
tradeable/auctionable/rafflable/giftable/displayable/shareable. VADO
(art gallery/auctions) is a sub-division sharing the same card
infrastructure. **VEX (Robinhood-style brokerage trading) was extracted
into its own standalone app (Phase 16)** — see "VEX moved out
(Phase 16)" below. Fresh build in
this repo; no prior VOKEN codebase exists anywhere in this session —
the ~1,780-line `App.jsx` prototype referenced in the master spec doc
isn't retrievable (recovered only as a summary from an earlier,
now-compacted part of this conversation, not present in this repo).

**CVLTVRE — the real, customer-facing brand (Phase 9)**, per direct
instruction: VOKEN is the technical/project name; **CVLTVRE** is what
the product is actually called, the same relationship V3 already has
to VCoin/VASH. Real, named comparables ground every real piece here,
not invented ones — confirmed already present in this project's own
source research (`VOKEN_MASTER_SPEC_PROGRESS.md`), not newly added:
**VOKEN as a whole ↔ eBay** (a general marketplace: buying, trading,
*and* auctioning, not just one mechanic — eBay's own real Authenticity
Guarantee/PSA partnership is the direct model for VOKEN's own
verification-embedded-in-marketplace approach); **VEX ↔ Robinhood**
(brokerage trading); **VADO ↔ Sotheby's/Christie's** (real digital and
physical art auctions); **CVLTVRE itself ↔ Fanatics** (collecting,
trading, and packs — the specific card-collector product identity
layered on top of VOKEN's real eBay-like marketplace core).
`lib/brand.js` (`getBrandInfo()`, `GET /api/brand`, also folded into
`/api/health`) is the one real, queryable source of truth for the
brand name — not just prose here, so it can't drift between this
README and any real consumer (VDP's own VexView/VadoView headers now
read it).

**VOKEN is now the single canonical home for VEX/VADO (Phase 8)**:
VENVS had independently built its own, separate `vex.js`/`vado.js`
(Aug 11, a generic trading floor + auction gallery) two days before
this project's own `vex.js`/`vadoExplore.js` (Aug 13, trading actual
Cvltvre Card editions) — checked directly via git history, not
assumed: neither codebase ever referenced the other, these were never
one shared feature. Per direct instruction, VENVS's own copy was
removed (`../venvs/README.md`'s own Phase 12); VDP's VEX/VADO
districts now render real clients of this project's own API directly
(`../vdp/src/lib/vokenClient.js`), no longer iframing into VENVS.

Source docs: `VOKEN_ARCHITECTURE.md` (data models + API map),
`VOKEN_MASTER_SPEC_PROGRESS.md` (the real component/asset shape and
competitive comparables research), `VOKEN_NEW_VALUE_ALGORITHM.md` (the
real value formula, Kenji, the onboarding/pack/raffle/trade system),
`VOKEN_VALUE_DISPLAY_CARD_INDUSTRY_COMPARABLES.md` (real PSA/BGS/Topps
mechanics VOKEN should adopt).

**Scope note**: Kenji (VOKEN's confirmed named agent, joining DREA/
HVNTER/Gibson/Kevin/QVAN/MIA) doesn't exist as an actual AI agent
anywhere in this session — matching this session's consistent stance,
what's real and buildable is the deterministic logic underneath what
Kenji is described as doing (the value algorithm, the Established
Creator Assessment), never a fake AI call. VADO/VOKEN's fractional
ownership (and, before Phase 16, VEX's own brokerage trading) is real,
genuinely securities-adjacent territory the architecture doc itself
flags as held pending real legal/broker-dealer review — built as real
code behind a compliance gate, per the doc's own explicit instruction,
not skipped and not launched live.

**VEX moved out (Phase 16)**: per direct instruction, VEX is now its
own standalone app (`../vex/`), a sibling of Vex Business inside the
new Vex Trading shell, no longer a VOKEN module. VOKEN kept nothing
VEX-specific — no broker accounts, no trade orders, no
`vex-brokerage` gate. What VOKEN still owns is the thing VEX actually
trades: Cvltvre Cards themselves. VEX is a real, live HTTP client of
VOKEN's own card API (`GET /api/card/:id`, `POST
/api/card/:id/edition`, `POST /api/card/:id/transfer`) — same shape as
every other real cross-app client in this ecosystem, not a shared
in-process module. See `../vex/README.md` and this repo's own
`dev-docs/phase-16-vex-extracted-to-standalone-app/`.

## Run
```
cd voken && npm install && npm start   # localhost:8794
```

## Test
```
curl http://localhost:8794/api/health
curl -X POST http://localhost:8794/api/card -H "Content-Type: application/json" \
  -d '{"subjectPersonId":"subject-1","category":"music","rarityTier":"legendary","tokenizationType":"digital","formats":["digital","physical"],"plannedDigitalMintCount":500,"plannedPhysicalMintCount":50}'
curl -X POST http://localhost:8794/api/card/1/value-score -H "Content-Type: application/json" -d '{
  "traditional": {"totalMintCount":100,"isRookieDesignation":false},
  "digitalEngagement": {"views":5000,"clicks":100,"comments":20,"likes":300,"engagementVelocity":2},
  "genuineSignificance": {"longevityOfImpactYears":60,"institutionalRecognitionCount":10,"documentedHistoricalImpact":true}
}'
# authenticityGrade is no longer read from this request -- it's fetched
# live from VACA (../vaca/, localhost:8804). Needs VACA running too.

# An operator-minted external-entity card (a World Layer landmark, no
# single real owner to verify) -- needs a real X-Operator-Credential
# for the voken:mint-external-card scope in production; VACO_OPERATOR_
# MODE=off bypasses that for local testing, as here.
curl -X POST http://localhost:8794/api/card/external -H "Content-Type: application/json" \
  -H "X-Operator-Credential: <a real operator credential>" \
  -d '{"sourceApp":"world-layer","sourceType":"location","externalRef":"WL-LOC-0001","category":"landmarks","rarityTier":"legendary","tokenizationType":"digital","formats":["digital"],"plannedDigitalMintCount":500,"reason":"UNESCO landmark curation"}'

# Browse the real historic register before minting against it.
curl http://localhost:8794/api/historic-register?subjectType=invention

# A historic card -- operator-only (there is no owner path for history
# at all), checked against the register above rather than free text.
curl -X POST http://localhost:8794/api/card/historic -H "Content-Type: application/json" \
  -H "X-Operator-Credential: <a real operator credential>" \
  -d '{"historicSlug":"printing-press","rarityTier":"legendary","tokenizationType":"digital","formats":["digital"],"plannedDigitalMintCount":500,"reason":"educational historic series, invention"}'

# The Instagram-Explore-style browsing surface: one section per real
# subject type, each card's real attentionScore and genuineSignificanceScore
# shown right in the feed.
curl http://localhost:8794/api/explore/historic
```

## What's here
- `lib/cardTypes.js` — `CATEGORIES` (11) and `RARITY_TIERS` (7):
  flagged placeholders, since the master spec doc itself confirms the
  real label strings weren't recoverable from its source transcript —
  replace the moment real labels are available.
- `lib/cultureCards.js` — `mintCultureCard()` is the literal
  implementation of two real, confirmed requirements: mint
  transparency (the full mint plan is set and exposed at mint time)
  and the subject's guaranteed first mint, performed atomically for
  both digital and physical formats in the same call.
  `mintAdditionalEdition()` enforces the real mint cap per format.
  **`mintExternalEntityCard()` is the other mint path**, for a card
  about something that is not a person — a World Layer `location` or
  a Vavlt Stvdios `casino-event` (`landmarks`/`eventMoments` already
  existed as real categories; no new ones needed). The subject-gets-
  card-1 guarantee has no person to apply to here, so `mintedByRole`
  decides what the mint actually guarantees instead:
  `server.js`'s `POST /api/card/external` verifies a real `'owner'`
  (a Vavlt Stvdios casino event's real `hostId`, checked live against
  `GET /api/casino-events/:id` — never merely claimed) and gives them
  the same guaranteed-first-copy treatment a person subject gets, or
  falls back to a real `'operator'` credential
  (`voken:mint-external-card`, recorded in vaco-audit first) for a
  subject with no verifiable single owner at all — a World Layer
  location's `ownershipData` is always `null` there (VACON-C, not
  World Layer, would generate it), and World Layer itself exposes no
  HTTP API to check against in the first place. **An operator-minted
  card deliberately mints no guaranteed edition to anyone, including
  the operator themselves** — curating a card into existence is not
  the same act as owning what it depicts, and the alternative would
  make minting-on-behalf-of a way to self-enrich. See
  `test/externalEntityCard.test.js`.
- `lib/historicRegistry.js` + `mintHistoricCard()` — a **real, fixed
  register** of historic places, monuments, homes, people (inventors/
  authors/notable figures), inventions, and books, each a real,
  well-documented historical fact rather than caller-supplied free
  text (31 entries as of this register's latest pass — the Great Wall,
  the Statue of Liberty, Monticello, Marie Curie, the printing press,
  Hamlet, and more). The same "no single owner" shape
  `mintExternalEntityCard`'s operator path already established applies
  here too: nobody owns Machu Picchu or the invention of penicillin, so
  no guaranteed first edition goes to anyone, including the operator
  who curated the card into existence. Checked against the register at
  mint time rather than accepted as free text, specifically so a
  `historic` card's factual content is always real and checkable — the
  one thing this category exists to guarantee. Browse the register
  with `GET /api/historic-register` (optionally
  `?subjectType=place|monument|home|person|invention|book`) or
  `GET /api/historic-register/:slug` before minting against it. See
  `test/historicCard.test.js`.
  **Each entry also carries a real `earliestYear` and `recognitions`
  list** (a Nobel Prize, a UNESCO World Heritage Site designation —
  left empty rather than guessed where no specific, confident citation
  exists), feeding `genuineSignificanceInputsFor()`: the real bridge
  into the Value Algorithm's Genuine Significance Score below, so a
  historic card's "how much is it worth" answer is computed from the
  register's own real facts, never asserted per mint or per scoring
  call. `POST /api/card/:id/value-score` now forces this for any
  historic card — the same "never trust the request body" discipline
  that route already holds for the live VACA authenticity grade,
  applied to the one other score a caller could otherwise just assert.
- `lib/valueAlgorithm.js` — **the real, hybrid Value Algorithm (Phase
  1)**: a log-scale scarcity curve, log-normalized digital engagement
  with a real capped velocity bonus, and a completely independent
  Genuine Significance Score, combined with `digitalEngagement` and
  `genuineSignificance` weighted **equally** so neither can silently
  dominate the other — verified against a direct "MLK test" proving
  real lasting significance genuinely outranks pure virality, not just
  asserting it does. **`authenticityGrade` is now real**: `server.js`'s
  value-score endpoint fetches it live from VACA (`../vaca/`) instead
  of trusting the request body — confirmed live that a lying request
  (`"authenticityGrade":"A"` on an unverified card) is genuinely
  ignored, still resolving to grade C. See `../vaca/README.md`.
  **Cross-platform social influence, added by direct instruction**:
  "how many views, how many likes, the algorithm of all of their
  social media put together, their influence" is answered two ways
  now, deliberately kept separate rather than blended into one number
  — `digitalEngagementScore` already answers it for the card itself
  (views/clicks/comments/likes *on this Cvltvre Card*); the new
  `externalInfluenceScore` inside `traditionalScore` answers it for
  the *subject* — how famous they already are, across every platform
  they're on, the same real factor that makes a LeBron rookie card
  worth more than an equally scarce card of an unknown player. It
  reuses `establishedCreatorAssessment.js`'s own `computeExternalScore()`
  (real social-following log curve + press coverage + industry
  recognition) rather than inventing a second formula for the same
  question, and the ceiling is unchanged: the three multiplicative
  traditional weights (scarcity/authenticity/influence) still sum to
  the same 0.85 the original two-weight version had. `server.js`'s
  value-score endpoint computes this live too, from the subject's most
  recent real `establishedCreatorAssessment` — never from the request
  body — defaulting honestly to 0 when no real assessment is on file,
  rather than guessing.
  **No special "legend" card type, by direct instruction, reversing an
  earlier pass of this same file.** A `computeStature()` function
  briefly classified a card as `legend`/`living-legend` based on
  whether its real subject was alive. Removed on direct, explicit
  correction: "I don't even think there should be [that
  distinction]... let the value do the talking." Every card — a
  historic figure, a living artist, a monument — is scored by the
  exact same real formula with no special path for being deceased;
  `combinedRealValueScore` alone differentiates one card from another.
  See `test/valueAlgorithm.test.js`.
  **A card's effective value only ever rises, by direct instruction:**
  "the more attention that they gain, their card goes up in value or
  can go down in value... I guess it really can't really lower, it
  just won't raise." `recordPeakValueScore(store, { cardId,
  combinedRealValueScore })` in `lib/cultureCards.js` is the real
  high-water mark: it keeps each card's highest `combinedRealValueScore`
  ever computed as `card.peakValueScore` (with `peakValueScoreAt`), and
  a later, lower live score never pulls it back down — only a real new
  high replaces it. `server.js`'s value-score endpoint calls this on
  every real scoring request, so `peakValueScore` is always included
  alongside the live `combinedRealValueScore` in the response. See
  `test/peakValueScore.test.js`.
  **Real subject self-verification, by direct instruction:** "I want
  people to be able to verify their own cards to show that that is
  them and they verify it." `verifySubjectIdentity(store, { cardId,
  verifierId })` in `lib/cultureCards.js` lets a card's own real human
  subject confirm the card is genuinely about them, strictly gated on
  `card.subjectPersonId === verifierId` — nobody else, and an
  external-entity card (no living subject) can't be "verified" by
  anyone, since there's no real person to confirm it. Exposed as
  `POST /api/card/:id/verify`, with `verifierId` taken from
  `requireActor('verifierId')` session auth at the route layer, never
  trusted from the request body alone. Sets `verifiedBySubject` /
  `verifiedBySubjectAt` on the card (present only on person-subject
  cards minted via `mintCultureCard`). See
  `test/verifySubjectIdentity.test.js`.
- `lib/establishedCreatorAssessment.js` — calibrates a real starting
  tier from external metrics for someone joining with existing fame,
  never the blank-slate `common` tier. `getLatestAssessmentForCreator()`
  is the real lookup the Value Algorithm's new influence term is built
  on — a creator can be reassessed over time, so this always returns
  their *most recent* real record, not their first or their biggest.
  **`realContentConsumptionCount`, added by direct instruction**:
  "check all their social media platforms... check the sales of what
  they've done... duplicate this and use it for all of our
  participants." `computeExternalScore()` now also takes a real,
  cross-app content-consumption total — `server.js`'s value-score
  endpoint fetches it **live, on every scoring call**, by summing real
  per-creator totals over real HTTP: `vulture-music`'s
  `getTotalStreamCountForArtist` and `getAlbumCountForArtist`,
  `vulture-pods`'s `getTotalListensForCreator`, `vulture-flix`'s
  `getTotalViewsForCreator`, and `cvllex`'s
  `getTotalUnitsRedeemedForCreator` — real streams, listens, views,
  albums, and units sold, generic across any real participant, nothing
  hardcoded to one person. Each fetch is fail-soft (`fetchRealTotal`):
  an unreachable app contributes 0 rather than failing the whole
  score, the same posture `pushMetric` already takes elsewhere in this
  ecosystem for an optional signal. Deliberately **not** persisted
  onto the stored assessment the way social following is — it changes
  continuously (a stream happening right now should move the number
  right now), where a follower count is realistically only re-checked
  occasionally.

  **Recalibrated, by direct instruction: "it shouldn't be easy to get
  to 100. The top of the top should hit 100."** The original formula
  summed four differently-scaled raw terms into one unbounded sum --
  confirmed directly against two real public figures that a single
  real but unremarkable signal (~215,000 followers alone) already
  saturated it. Every real signal is now its own real, log-scaled
  **sub-score independently capped at 100**, combined by real weights
  that themselves sum to exactly 100 (`social: 0.30, press: 0.15,
  recognition: 0.10, consumption: 0.25, achievement: 0.20`) — the same
  weighted-components pattern `valueAlgorithm.js` already uses.
  Reaching 100 now requires being near-maximal on every real axis at
  once; the same two real figures from before no longer tie at 100,
  or even come close.

  **A real "key," by direct instruction: "we should have a key that
  shows influence."** `EXTERNAL_SCORE_TIERS` / `describeExternalScoreTier()`
  name a real score band (`Global Icon`, `Industry Legend`, `Major
  Influence`, `Established`, `Rising`, `Emerging`) rather than leaving
  a bare number nobody can place — attached to every assessment
  (`externalScoreTier`) and to the live value-score response
  (`externalInfluenceTier`).

  **Real occupation categories, by direct instruction**: "different
  categories: influencers, musicians, political... just different
  categories." `OCCUPATION_CATEGORIES` (`influencer`/`musician`/
  `political`/`author`/`athlete`/`other`) is a real, stored label for
  display/filtering — it does not change which formula runs, since the
  achievement sub-score below is already self-selecting (a musician
  naturally has real albums, a politician naturally has real office
  terms, never both).

  **A real "achievement" sub-score, by direct instruction**: "just how
  many of everything they have... how many albums... political
  influence, how many times they've been in office." `realAlbumCount`
  is live-fetched from `vulture-music` the same way content
  consumption is (a real discography keeps growing). `realArticlesPublished`,
  `realBooksPublished`, and `realTimesElectedToOffice` are honestly
  self-reported — no real backend tracks a person's own published
  output or political career anywhere in this ecosystem, the same
  posture `realPressCoverageCount` already has.

  See `test/establishedCreatorAssessment.test.js`.
- `lib/cardPacks.js` — **Card Packs (Phase 2)**: the real, structured
  pack-tier system (basic/standard/premium/chase); `openPack()`
  genuinely enforces a tier's guaranteed-minimum-rarity even when the
  random draw alone would miss it, by swapping in the best-available
  qualifying card — proven against an `rng` deliberately rigged to
  otherwise fail the guarantee.
- `lib/raffles.js` — real one-entry-per-user raffles, winner drawn and
  minted through the same real edition-minting mechanic packs use.
- `lib/trading.js` — real peer-to-peer trading with genuine ownership
  re-verification at accept time, not just trusted from proposal time.
- `lib/cultureCardApplication.js` — Kenji's real onboarding flow
  (proactive invitation vs. self-initiated request), reusing Phase 1's
  own external-score formula rather than a second one. **A third real
  path, `community-nomination`, added by direct instruction**: "you
  can be nominated for a card." Genuinely different in one real way: a
  self-initiated applicant vouches for themselves, and a Kenji
  invitation already passed Kenji's own vetting before it ever reached
  this file — a nomination is a third party claiming facts about
  someone else, with no vetting at all yet. So it is never
  auto-accepted by score the way a self-initiated request is
  (`runKenjiAnalysis` refuses to run on one at all); `reviewNomination()`
  is the real, required, named human-operator decision instead (`POST
  /api/application/:id/review-nomination`, same `voken:grade`
  authority and decision-log recording `analyze` already uses). The
  nominee's real external score is still computed and surfaced for
  the operator to actually look at — it just never gets to decide the
  outcome on its own. Accepting a nomination only marks the nominee
  eligible, the same real effect an accepted application of any path
  already has here — nothing in this file ever mints a card, so a
  nomination can never mint one about someone without their own
  session, regardless of who nominated them. See
  `test/cultureCardApplication.test.js` — the first real test coverage
  this module has had.
- `lib/cardEngagement.js` — **real card engagement tracking (Phase
  3)**: a real event log (not counters that could desync from
  reality), with `engagementVelocity` computed for real from a
  time-windowed rate, feeding directly into Phase 1's existing
  velocity bonus. **`share` added as a real engagement type, by direct
  instruction** — "promote their card for views, clicks, promotions,
  share, like": a real, standard social metric this file's original
  four (view/click/comment/like) didn't cover. `computeDigitalEngagementScore()`
  weighs shares on par with comments and likes (0.25 each, rebalanced
  from the original four weights so they still sum to exactly 1.0 —
  an unshared card isn't silently penalized by the new term existing).
  See `test/cardEngagement.test.js`.
  **How "promoting a card" actually works, mechanically**: there is no
  separate boost/ad mechanic — real views/clicks/shares/likes/comments
  *are* the promotion. A creator driving more of them (sharing their
  own card, asking fans to engage with it) directly raises
  `digitalEngagementScore`, which is the exact real signal
  `exploreVoken.js`/`historicExplore.js` already rank the Explore
  page by — so real engagement earned today is also real, better
  placement tomorrow, the same loop a real social feed runs on.
- `lib/exploreVoken.js` — the Explore Page: ranks cards by Phase 1's
  own `computeDigitalEngagementScore()`, fed by this phase's real
  engagement stats — genuine cross-phase code reuse, not a rebuilt
  formula.
- `lib/historicExplore.js` — **the Historic Explore Page**, an
  Instagram-Explore-style browsing surface by direct instruction:
  `GET /api/explore/historic` groups historic cards into one section
  per real subject type (`place`/`monument`/`home`/`person`/
  `invention`/`book`), cards ranked within each section by the same
  real `attentionScore` `exploreVoken.js` already uses. Each card also
  carries a real `genuineSignificanceScore`, computed synchronously
  straight from the historic register (no VACA round-trip — a historic
  card's significance is a fact about history, not about any one
  minted card's condition) — two real, separable value signals shown
  side by side in the feed itself, rather than one blended number a
  viewer can't take apart. The *full* `combinedRealValueScore` (which
  does need the live authenticity grade) stays a deliberate, single-
  card action through `POST /api/card/:id/value-score`, the same
  "quote first, then act" shape `sell-back-quote` already has. See
  `test/historicExplore.test.js`.
- `lib/creatorDigitalProfile.js` — aggregates a creator's own cards
  into one real, averaged engagement score (not a raw sum, which would
  unfairly favor volume over genuine per-work attention), with a real,
  threshold-gated rising indicator.
- `lib/complianceGate.js` — **the real compliance gate (Phase 4)**:
  the architecture doc's own instruction implemented literally — the
  code path is real and testable, the live-money trigger stays closed
  until a real admin action clears it. Originally shared by VEX and
  VADO fractional ownership; now only guards fractional ownership,
  since VEX's own `vex-brokerage` gate moved out with the rest of VEX
  (Phase 16, see above) rather than each module inventing its own flag.
- `lib/platformAccount.js` — `VOKEN_PLATFORM_ACCOUNT`, split into its
  own module in Phase 16 when `lib/vex.js` (where it originally lived)
  was deleted; `lib/cardPacks.js` and `lib/referralGrowth.js` both
  import it from here now.
- `lib/auctions.js` — **VADO auctions (Phase 5)**: four genuinely
  distinct settlement mechanics, not one settlement path with a label —
  `instant` settles immediately at the asking price; `dutch` computes a
  real linear price decay and settles at the *live* price the moment a
  bid meets it, never the bid amount itself; `english` only records
  bids until a real `endAuction()` closes it (correctly distinguishing
  zero bids and below-reserve bids from a genuine sale, both `unsold`);
  `offer` is entirely seller-driven via `acceptOffer()`. Every listing
  is checked against real, current edition ownership before it's
  allowed to be created. **`listOpenAuctions` added (Phase 8)**: every
  route here used to require a known auction id — no way to browse
  what's actually open. Added as the minimal real piece VDP's own VADO
  district genuinely needed to have anything to show (`GET
  /api/auctions/open`), not routed around with `vadoExplore.js`'s
  different, unrelated data (that ranks *art cards* by engagement
  generally, not live auction state).
- `lib/artCultureCard.js` — real code reuse of Phase 1's
  `mintCultureCard()` (`category: 'art'`) for the card-#1 guarantee and
  mint transparency, with a separate `artCultureCards` record linked by
  `cardId` (the same own-entity-linked-by-id pattern as VOID's
  `VoidLocker`) holding the physical-original + limited-digital-edition
  structure and real gallery view tracking.
- `lib/vadoExplore.js` — VADO's own dedicated Explore feed, per the
  doc's explicit confirmation: the same real engagement-based ranking
  as `exploreVoken.js`, scoped to `category === 'art'`.
- `lib/galleryAccounts.js` — real gallery accounts and a real holdings
  aggregation over existing ownership data — no second ownership
  ledger.
- `lib/fractionalOwnership.js` — **fractional ownership (Phase 6)**,
  reusing the same `'fractional-ownership'` compliance gate VEX
  established: listing a fractionalized asset moves no money (it
  transfers real custody of the edition into a shared pool, Rally-
  style) so it's ungated; `buyShares()` is the real, gated action,
  with real per-investor stake tracking independent of the edition's
  normal single-owner shape. **Real secondary resale market (Phase
  10)**: `VOKEN_MASTER_SPEC_PROGRESS.md`'s own comparables research
  names the exact real mechanism to build toward — Rally's own "real
  (if thin) secondary market via a registered ATS (PPEX) after a
  90-day lockup." `SECONDARY_LOCKUP_MS` is that real, cited 90-day
  figure. This project has no registered ATS, so secondary trades
  settle as direct, real peer-to-peer transfers (`buySecondaryShares`
  pays the seller straight from the buyer, same `transferFn` pattern
  as the primary sale), gated by the same `'fractional-ownership'`
  compliance gate. **Real per-share-lot lockup cohort tracking (Phase
  11)**, closing this file's own previously-flagged simplification:
  each purchase now opens a genuinely separate lot with its own
  90-day `lockedUntil`, real brokerage-style FIFO behavior (Robinhood/
  Fidelity/Schwab all track purchase lots this way) — a shareholder
  whose earliest lot already cleared can resell those specific shares
  immediately even while a newer lot they just bought is still locked,
  instead of the whole position re-locking on every purchase.
  `createSecondaryListing` draws from the oldest unlocked lot(s) first
  and records exactly which lot(s) it drew from, so a cancellation or
  a completed sale debits/releases the correct real lot. Shares
  acquired via secondary resale still open their own brand-new,
  immediately-sellable lot, matching the real rule that an ownership
  transfer through a secondary market isn't a new private-placement
  purchase.
- `lib/limitedEditionMerch.js` — creator-designed limited-edition
  merch with real, StockX-style dynamic pricing: price rises as real
  supply shrinks, and every purchase charges the live price at that
  moment, not a stale one. `ITEM_TYPES` now also covers real physical
  media (`cd`, `vinyl`, `cassette`, `magazine`, `poster`, `pin`),
  not just apparel.
- **Physical production (ordering a real limited run made) now lives
  in its own standalone app, `../cvllex/`** — briefly built as a
  module here first, then moved out by direct decision: this
  constellation is now five members (VOKEN · VEX · VADO · CVLTVRE ·
  CVLLEX, up from the four-member VOKEN square, drawn as a star, still
  named VOKEN), not VOKEN's own code. VOKEN's
  job in that flow is unchanged and narrow: `mintExternalEntityCard()`
  (see `lib/cultureCards.js`'s `SOURCE_APPS`) now recognizes
  `sourceApp: 'cvllex'` the same way it already recognized
  `vavlt-stvdios` — CVLLEX calls VOKEN's existing, real
  `POST /api/card/external` to mint the Cvltvre Card for a produced
  run; VOKEN never calls CVLLEX. `ITEM_TYPES` on
  `limitedEditionMerch.js` still covers the real physical-media types
  (`cd`, `vinyl`, `cassette`, `magazine`, `poster`, `pin`) in case a
  listing is ever created directly here, independent of CVLLEX.
- `lib/digitalArtFrame.js` — the Meural-Opus-comparable digital art
  frame: loading artwork is double ownership-gated — genuine ownership
  of both the frame and the specific digital edition being displayed.
- `server.js` — a real Express API (CommonJS) wrapping the above.

## Verified
120 plain-Node checks across all six phases plus a full cross-phase
regression, plus live passes:
`voken/server.js` alone confirmed a real card minted with the
subject's guaranteed first copy on both digital and physical formats,
an additional edition minted to a buyer, a live value score matching
the plain-Node MLK-test scenario exactly, a live established-creator
assessment correctly returning `mythic` (never `common`) for a
genuinely large profile, a premium pack correctly guaranteeing its
legendary card from a small pool, a raffle drawn to its real entrant,
a real trade between two card subjects with the resulting ownership
swap **independently confirmed** via separate `GET` calls on both
cards, and a proactive Kenji invitation confirmed always accepted;
real engagement tracked on two cards with clearly different activity
levels, with the Explore page correctly ranking the more-engaged card
first and a Creator Digital Profile correctly returning real, non-zero
data for the active creator and real, zeroed data for one with no
cards; a VEX trade order correctly rejected before compliance clears
and correctly succeeded after, with the resulting $30 buy payout
**independently confirmed against the mock V3 ledger**; a VADO instant
auction's real $75 payout **independently confirmed against the mock
V3 ledger** on both the buyer and artist accounts, with edition
ownership genuinely transferred, an offer-type auction correctly
settled seller-driven at the accepted (not asking) price, and the
VADO Explore page and a gallery account's real holdings both confirmed
correct against live server state; a fractional-ownership share
purchase correctly rejected before the compliance gate clears and
correctly succeeded after, with the resulting $50 payout
**independently confirmed against the mock V3 ledger** on both the
investor and seller accounts; two sequential limited-edition merch
purchases at two different, correctly-recomputed dynamic prices, both
payouts independently confirmed; and a digital art frame correctly
loaded with genuinely owned artwork, correctly rejected for a second
collector who didn't own it. A final **Phase 7 cross-phase
regression** then ran every module above together in one shared store
(five cards across four categories, each subsequent module deliberately
routed through a different card/edition than the ones before it), with
both compliance gates re-proven to block-then-allow correctly amid five
other modules' state, and a hand-computed global sanity total — every
real mint operation across the whole run sums to exactly 19 total
editions, checked directly against the store's own data, not asserted.
See `dev-docs/` for the full record.

**Phase 8 (VDP now embeds VEX/VADO directly)**: 4 plain-Node checks for
`listOpenAuctions` (empty initially, real auction appears once created,
returns the real record, still open after a bid), plus a full live
pass with `venvs-mock-backend`, `voken`, and `vdp` all running
together: a real vehicle Cvltvre Card and a real art Cvltvre Card
minted directly on VOKEN's server; walked to VDP's VADO district,
confirmed the real pre-seeded auction rendered (not VOKEN's separate
Explore ranking), placed a real bid, confirmed it server-side
(`currentBid: 20`, `highestBidderId` correctly the real player);
walked to VEX, confirmed the real, honest "trading locked" state
rendered (`vex-brokerage` defaults closed), confirmed the pre-seeded
card was still browsable, opened a real broker account (never gated),
confirmed Buy correctly disabled while locked, and independently
re-confirmed the account server-side. Separately confirmed VENVS's own
tab bar now shows exactly 3 tabs with VEX/VADO genuinely gone, not
just hidden. Zero console/page errors across the whole pass.

**Phase 10 (secondary resale market)**: 10 plain-Node checks (a
primary buyer's shares rejected as locked immediately after purchase,
resalable once the 90-day lockup passes, over-listing beyond sellable
shares rejected, a full peer-to-peer secondary purchase confirmed
paying the seller directly with the buyer's new shares immediately
resalable — not re-locked, cancelling a listing releasing shares back
to sellable, only the real seller able to cancel their own listing,
double-purchase and self-purchase both rejected, buying more primary
shares confirmed to re-lock the whole position, and open-listing
scoping excluding sold/cancelled), plus a live pass against the real
running server and the real V3 mock: a real card and edition minted, a
real fractional listing created and 4 shares bought, an immediate
secondary-listing attempt confirmed rejected with the real ~90-day
lockup timestamp; using the same `now` testability parameter every
other module in this codebase already exposes, a secondary listing 91
days out was created, confirmed via the open-listings endpoint, and
bought by a second real buyer — the seller paid exactly the real
proceeds, the buyer's new shares confirmed with `lockedUntil: null`
(genuinely immediately resalable, unlike the residual primary shares
still held by the original buyer) — plus double-purchase, self-
purchase, non-seller-cancel, and a real seller-initiated cancel all
confirmed over real HTTP.

**Phase 11 (real per-share-lot lockup cohort tracking)**: 6 plain-Node
checks (two purchases confirmed opening two independently-tracked
lots with their own real `lockedUntil`, an old unlocked lot proven
sellable while a newer lot in the same position stays locked, listing
beyond the real per-lot sellable total rejected even though the total
position is larger, a FIFO draw spanning two unlocked lots when
neither alone covers the request, cancelling a secondary listing
releasing the exact real lot(s) it drew from, and a secondary purchase
confirmed opening a real unlocked lot for the buyer while the seller's
fully-sold-off lot is cleaned up rather than left as a zero-share
husk), plus a live pass against the real running server and the real
standalone V3: a real two-lot position built (`10` shares bought `100`
days ago, `5` more bought moments later), holdings confirmed showing
both lots' own independent lock state and a real `sellableShares: 10`
— not the full `15` — proving the per-lot total, not a
position-wide one; listing `15` correctly rejected, listing exactly
`10` succeeding; and a real secondary purchase of those `10` shares
confirmed against V3's own balance, with the buyer's new lot showing
`lockedUntil: null` and the seller's now-empty position confirmed
gone entirely.

## Real persistence
`lib/persistence.js` wraps `server.js`'s own store in a real file-backed
store, `data/store.json` (port 8794) — VOKEN's own real state now survives a
restart. Live-verified: created a real Cvltvre Card, killed the running
process, restarted it, and confirmed the same real state came back from a
real GET. See `dev-docs/phase-12-real-persistence/`.

## Real metrics feed (Phase 13)
Every real fractional-shares purchase pushes a real
`resale_trade_volume` metric to VACO Analytics (fail-soft — a real
purchase is never held up if VACO Analytics is down). See
`vaco-analytics/dev-docs/phase-6-more-live-metric-feeds/`.

## Real pack charge (Phase 14)
A real, self-flagged gap from the metrics-feed work above: `openPack`
minted real cards to a real buyer without ever actually charging
them — `packTier.price` was a real field nothing collected. Now a
real `transferFn(buyerId, VOKEN_PLATFORM_ACCOUNT, packTier.price, ...)`
call fires after the pack's real contents are resolved (so a real "no
qualifying card" failure never charges a buyer for a pack that
couldn't be filled) but before minting (a buyer who paid always gets
real cards back). `openPack` is now async and requires a real
`transferFn`, same posture as every other real money-moving function
in this ecosystem. The response now also returns the real
`pricePaid`. See `dev-docs/phase-14-real-pack-charge/`.

## Real referral/growth mechanic (Phase 15)
A user-flagged real gap, not self-discovered: a real Temu-style
gamified referral mechanic — escalating invite tiers, a real progress
bar, spin-to-win — confirmed genuinely missing by direct grep across
the whole repo (the only "referral" hits anywhere in this app's docs
were unrelated marketplace referral-fee-percentage research, not a
peer-to-peer invite program; no referral/growth mechanic of any kind
existed here before this, despite the initial ask assuming one
already did).

`lib/referralGrowth.js`: `recordReferral` (each real referee can only
ever be credited to one referrer), `getReferralProgress`, and
`spinWheel`. Same four real, flagged-interpretive escalating tiers as
Vavlt Stvdios' own build of this feature (1/3/5/10 referrals →
10/25/50/150 VCoin + 1/1/2/3 spins). Bonus/prize payouts reuse the
existing `VOKEN_PLATFORM_ACCOUNT` (from `lib/vex.js`) rather than
inventing a second platform account.

**Spin-to-win reuses VAGO's own provably-fair scheme verbatim**
(`lib/provablyFair.js`, copied, not reinvented).

Verified with 5 real unit test groups, then live against real running
`v3` + `voken` instances: a real referral crossed tier 1 and paid a
real 10 VCoin bonus, the real anti-abuse rule confirmed (a second
referrer trying to claim an already-referred user was rejected), and
restart-survival confirmed.

## Not yet built
- **VACA now exists** (`../vaca/`) and the value-score endpoint is a
  real, live client of it — see above. A visible, ecosystem-wide
  verification *badge* (a UI/display concept, not just the underlying
  grade the score already consumes) is still real, later work.
- A real registered ATS/order-book matching engine for secondary
  fractional-share resale — Phase 10 built real peer-to-peer secondary
  trades (list a price, another buyer takes it), not live price
  discovery or partial-fill matching.
- **Physical production order intake moved to its own standalone app,
  `../cvllex/`** (built here first, 25 Oct 2026, then extracted the
  same day by direct decision — this constellation is now a five-app
  star, still named VOKEN, not a VOKEN module). What VOKEN itself still does not do: any real
  vendor integration for manufacturing anything — that boundary moved
  with the code, it did not close. See `../cvllex/README.md` for
  what's real there and what still isn't.
- The actual Kenji AI agent, and any connection to VACANCY Tribes.
  Kenji genuinely does not exist anywhere.
- **Connection to the Universal World Layer and Vavlt Stvdios is now
  real, via `mintExternalEntityCard()`** (`lib/cultureCards.js`,
  `POST /api/card/external`) — see below. What's still not built: any
  *automatic* minting from either app's own content (a World Layer
  UNESCO import, a Vavlt Stvdios casino event going live) — every mint
  today is a real, explicit, individually-authorized call, never a
  background job that mints on its own.
