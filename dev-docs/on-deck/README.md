# On deck — accepted, not started

Architecture the owner has frozen and deliberately deferred. Nothing in
this folder is built, and nothing in it should be built without the
owner saying so.

**Why a folder rather than a branch or an issue.** Both documents here
arrived as complete freezes with their own mandatory first step — audit
before writing code — and the audit was stopped part-way by the owner
to prioritise VACON-C. Keeping the frozen text verbatim means the
audit restarts from what was actually specified rather than from
somebody's memory of it, which is the failure this repo keeps finding.

| document | status | parked |
|---|---|---|
| `VACO_VERIFIED_BUSINESS_NETWORK_FREEZE.md` | frozen, **§30 audit complete 25 Sep 2026** — see below; Levels 1-3 built and shipped as `vaco-passport` | 17 Sep 2026 |
| `VAGO_GROUP_WAGERS_FREEZE.md` | frozen, **audit complete 25 Sep 2026** — see below | 17 Sep 2026 |
| `HVNTZ_CONNECTED_NETWORK_FREEZE.md` | frozen, **§40 audit complete 25 Sep 2026** — see below; §47 Phases 1-3 built (Network/Node/invite-accept-decline, Vault Studios stream link, Hunt checkpoint↔Network) plus §15-18's core revenue-sharing engine and growth analytics in `hvntz/lib/networkConnections.js`, `hvntz/lib/hunts.js`, `hvntz/lib/revenueShareAgreements.js` and `hvntz/lib/networkAnalytics.js` | 23 Sep 2026 |
| `VASH_TAP_FREEZE.md` | frozen, **§1/§55 audit complete 25 Sep 2026** — see below; narrowest demo built and shipped | 23 Sep 2026 |

**More are expected.** The owner said on 23 Sep 2026 that three or four
add-ons were coming and that two had been sent; this folder holds those
two. A count stated here rather than remembered is the point — if a
third and fourth arrive and nothing records that they were expected,
their absence looks like a decision rather than a gap.

## The two restored on 23 Sep 2026, and why it is not a formatting note

**Both 17 Sep freezes said "Verbatim as frozen by the owner" and were
not verbatim.** The owner re-supplied the full text; comparing it
against what was on file:

- `VAGO_GROUP_WAGERS_FREEZE.md` had been condensed and reflowed. §17's
  seven payout formats were folded into a running sentence and the
  "BLIND GROUP — 10 PLAYERS" example was gone. 278 lines against 741.
- `VACO_VERIFIED_BUSINESS_NETWORK_FREEZE.md` **lost content, not just
  shape.** Missing entirely: **"BUSINESSES DO NOT JUMP DIRECTLY TO
  TOKENIZATION"** — the freeze's own stated fundamental principle, the
  sentence the whole five-level progression exists to enforce — and
  **"Do not invisibly pool separate hub allocations unless a documented
  community program explicitly authorizes pooling"**, a specific
  constraint on how community money may be handled. 472 lines against
  1,188.

Both now carry the full text with a note recording what was restored.

**Why this is the worst version of this repo's recurring failure.**
Everywhere else, a document drifted from code and the code was
authoritative, so the damage was bounded — you could always re-measure.
Here the document IS the authority. There was nothing to re-derive it
from. Had the audit resumed from the condensed copy, it would have
planned tokenisation without the rule that tokenisation is a graduation,
and community treasuries without the rule against pooling them — and
every downstream artefact would have been consistent, tested, and built
on a specification the owner never wrote.

The instruction at the top of each file was already correct: *an edited
copy is a different specification.* It was written and then not
followed, in the same commit, by whoever filed the condensed text.

**The rule this establishes: a frozen document is transcribed, never
summarised, and a summary lives beside it rather than replacing it.**
If a freeze is too long to file comfortably, that is not a reason to
shorten it — the length is the specification. Any future freeze filed
here should be diffed against the owner's message before the session
that received it ends, because after that the original is gone and the
copy becomes the truth by default.

## The two filed on 23 Sep 2026

Both arrived as additive freezes with the same mandatory first step as
the 17 Sep pair — inspect the existing implementation before writing
anything — and neither audit has begun. What the earlier audit already
established applies directly to both and is worth pointing at rather
than rediscovering:

**HVNTZ Connected Network.** HVNTZ has a real surface (40 routes) and
Vault Studios exists, so the freeze's "extend, do not rebuild"
instruction has something concrete to extend. Its §40 is an explicit
non-duplication rule naming Vault Studios, VACA, VASH/VCoin, V4, DREA
and VOID — all of which the earlier audit confirmed are real.

**VASH TAP.** Its §1 and §7 forbid a second wallet, ledger or payment
system, and the earlier audit already identified what that means in
practice: **V3 is the canonical VCoin/VASH ledger** — `/api/vcoin/
balance`, `transfer`, `settle`, `transactions`, `reconciliation`,
`/api/vash/cashout`, `/api/vash/balance` — with a row-level ledger
behind `DATABASE_URL` and idempotent settlement via `settleOnce.js`.
That is the system §7 means. Note also the unverified owner correction
below ("VACA is blockchain app in v3"), which bears on VASH TAP's
identity resolution in §6 and §10.

One thing in VASH TAP is worth flagging now because it is a claim about
physics rather than architecture, and the freeze itself gets it right:
§41 states that passive NFC does not continuously broadcast location
and "must not be falsely represented as an NFC capability". Any
geographic analytics built under §23 and §43 are therefore tap-event
analytics, not location tracking, and the distinction should survive
into whatever the dashboards say.

## The VASH TAP §1/§55 audit, 25 Sep 2026

The owner picked VASH TAP as the first add-on to resume. Its §1 and §55
both mandate inspecting the existing codebase against a ~30-item
non-duplication list before writing any code — this is that audit, six
parallel searches across the ~30 categories §1 names, each verified by
reading the actual implementation rather than trusting a filename or a
prior doc's claim.

**Confirmed first: VASH TAP itself is entirely new.** A repo-wide
search for `nfc|vash.?tap|wristband|tap.?point|tap.?resolution` outside
this folder returns nothing. Nothing here is a wiring job — everything
either reuses a real system below or has to be built from zero.

**Real and reusable, confirmed by reading the code — build on these:**

- **VASH/VCoin/ledger.** V3 remains the canonical ledger —
  `/api/vcoin/{balance,transfer,settle,transactions,reconciliation}`,
  `/api/vash/{cashout,balance}`, row-level, idempotent via
  `settleOnce.js`. §7's "do not create a separate wallet/ledger" points
  here.
- **VACA identity — and the 23 Sep correction was wrong.** VACA is its
  own app (`vaca/`, port 8804), and `vaca/VACA_BLOCKCHAIN_IDENTITY_
  COMPARABLES.md` itself records that it was designed to live inside V3
  and was split out — it is not blockchain identity in any sense (no
  ledger, wallet, DIDs or Verifiable Credentials). It is a centralized,
  human-reviewed attestation/KYC service:
  `POST /api/verifications` → operator `approve`/`reject` →
  `GET /api/identity-status/:subjectType/:subjectId`. Real, but
  **siloed per consumer app** (`voken-card`, `void-provider`,
  `cvnvo-user` are separate attestations for the same real person) —
  "verify once, reuse everywhere" is only half built.
- **Notification dispatch.** `vaco-notify` is a real cross-app
  subscribe/dispatch service with delivery tracking
  (`/api/notifications/undelivered`).
- **Business + location (partial fit).** HVNTZ (`hvntz/lib/
  revenueStack.js`) has a real business→locations model with lat/lng
  and 14 revenue-event types, already the closest thing to §16's
  "Chair 1 → $4,820" example. But `locationType` is a closed enum
  (`screen`/`hub`/`business-locker` — hardware placements), not a
  general venue/table/stage concept, and there is no unified business
  model — VOID has a second, thinner "provider" business concept that
  does not share a schema with HVNTZ's.
  `vavlt-stvdios/lib/mapSearch.js` (Haversine `searchNearby`) is the
  real geo-search engine if location matters.
  `sync-design-system.sh` is real and small (two files — a CSS token
  sheet and one JS file — not a component kit) with a `--check` drift
  guard, and its target-app list is where a new frontend gets added.
  API/DB/test conventions are consistent across the ecosystem: flat
  JSON (no envelope), `{error}` on failure, Shield session or
  service-token auth, `attachStore()`'s JSON-file-or-Postgres split,
  `node --test` under each app's `test/`.

**Named in the freeze, and confirmed NOT to exist — the real work is
here, not in wiring:**

- **Push notifications.** `vaco-notify` explicitly lists `push` in
  `UNIMPLEMENTED_CHANNELS` and throws rather than silently accepting
  one. No APNs/FCM/web-push/service-worker/VAPID anywhere in the repo.
  §8's "immediate phone alert" is new infrastructure, not a call into
  something that exists.
- **General messaging/DMs.** The only real person-to-person message
  store is `cvnvo/lib/messages.js`, and it is hard-scoped to an active
  dating match (`sendMessage` throws once `match.expiresAt` passes) —
  two arbitrary users cannot message each other anywhere in this
  codebase today. §9's "reuse existing VACO messaging/DM
  infrastructure" has nothing general-purpose to reuse.
- **QVAN.** Not a security or fraud system at all — it is one of
  fourteen chat personas in `vacon/lib/agents.js` (id `qvan`, a system
  prompt telling an LLM to talk like a CSO) plus a keyword router that
  decides which persona's prompt to use. No fraud detection, no
  anomaly system tied to payments, exists under that name or any other
  — the closest thing, `vaco-analytics`'s z-score anomaly detector, is
  generic and metric-only. §21/§39's "use existing VACO/QVAN security
  infrastructure" and §40's "Freeze Tap"/"Lock Tap" have no real
  precedent to extend: the only account-level lock/suspend actions in
  the whole repo are `vaco-operator`'s internal-operator disable and
  VOID's per-skill provider suspension, neither a general "freeze this
  person's account" mechanism.
- **Rate limiting.** No throttling middleware exists on any Express
  app in the repo. §21's "7 attempts in 60 seconds → lock" example is
  a mechanism to build, not a policy to attach to something existing.
  There is also no employee/staff model anywhere — VOID's `staffing.js`
  posts open gig positions to its marketplace and does not persist a
  "this person works here" record once filled — and no shift-scheduling
  system with recurrence; VOID provider `availability` is explicit
  `{startsAt, endsAt}` windows only, recurrence deliberately deferred
  to a UI layer that doesn't exist. §5's barber-chair rotation example
  has nothing underneath it.
- **Dimensioned/geographic analytics.** `vaco-analytics`'s schema is
  flat `{app, metric, value, timestamp}`, keyed only by app+metric —
  no per-entity field (chair, employee, outfit, product) and no
  location field at all. §15–17, §23 and §43's whole premise —
  "Chair 1 vs Chair 2", revenue by market, drill-down to a specific Tap
  — cannot be expressed in the schema that exists; it needs new,
  dimensioned tables, which is most of the freeze's stated core
  requirement (§15: "THIS IS A CORE REQUIREMENT").
- **Profiles/avatars.** No shared profile concept — `vavlt-stvdios`,
  VOID, V4-proxy ("twin" profiles, an unrelated concept despite the
  name) and vxllage each have their own, scoped and non-interoperable.
- **User accounts.** There is no canonical user object anywhere.
  Shield holds only `{sessions, credentials}` keyed by an opaque
  `userId` string every app supplies independently; `shieldAuth`/
  `serviceAuth` (the ~26/27-copy shared libs) authenticate a session or
  a service caller, never a user profile.
- **ARIES.** Appears three times across the on-deck freezes as a bare
  name with zero elaboration and has no implementation anywhere —
  spec vocabulary, not a system.

**Named in the freeze and confirmed real, contrary to what a name
alone would suggest:** V4 (`v4-proxy`) really is the Anthropic proxy
plus a maps/AI-twin/call-surface layer; MIA is a real, implemented
agent-orchestration system (`vacon/lib/agents.js` + `orchestrator.js`,
NOT the same app as `vacon-c`, the unrelated civilization simulation).

**What this means for scoping the actual build.** §1's own rule —
inspect and reuse, don't duplicate — cuts the other way once four of
its named categories turn out to be missing rather than thin: building
generic push infrastructure, a general messaging system, a real
fraud/security layer, and dimensioned analytics are each their own
undertaking, not a VASH TAP detail. The freeze's own §54 "Definition of
Done" checklist does not distinguish "wire an existing system" from
"design a new one from nothing," and this audit is what makes that
distinction visible before code gets written against a false premise —
the same failure this file's earlier entries already record happening
twice.

## The VACO Verified Business Network §30 audit, 25 Sep 2026

The owner picked this freeze as the second add-on to resume. Its §30
mandates the same "audit first" step every freeze here requires — this
is that audit, four parallel searches against the categories §30 names
by name (VACA, VASH, VCoin, V3, VOKEN, wallets, identity, business
profiles, transactions, settlement, contracts, escrow, security/QVAN,
multi-tenant isolation), each verified by reading the real
implementation rather than trusting a name or a prior claim.

**Real and reusable, confirmed by reading the code — build on these:**

- **VACA verification is already generic, and already unused for
  businesses.** `subjectType` is a free-form string VACA never
  validates against an enum (`vaca/lib/verifications.js:47`) — real
  callers already pass `voken-card`, `void-provider`, `cvnvo-user`,
  `vash-tap-assignee`. Verifying a business needs no new VACA code,
  only a real caller passing `subjectType: 'business'` — nobody does
  today. HVNTZ's own `registerBusiness` (`hvntz/lib/
  revenueStack.js:125-136`) calls VACA **zero** times; any session
  authenticated as any `ownerId` can register a business with no
  identity check at all (`requireActor('ownerId')` only proves the
  session matches the field the caller supplied, not that a real
  business exists behind it).
- **V3/VCoin is real and the escrow pattern already exists on top of
  it, proven three times over.** `voidmagic/lib/bookings.js:32,49-83`
  charges a customer into a fixed `VOID_MAGIC_ESCROW_ACCOUNT` userId at
  booking time and pays the host out later on a separate trigger; VAGO's
  sportsbook (`vago/lib/sportsbook.js:145-192`) holds a stake in
  `VAGO_HOUSE_ACCOUNT` and releases it only on event settlement; VOKEN's
  fractional-ownership pool (`voken/lib/fractionalOwnership.js:107-140`)
  does the same over `VOKEN_FRACTIONAL_POOL`, backed by the shared
  race-safe `settleOnce.js` primitive. None of this is a first-class
  ledger concept — every "escrow account" is just an ordinary V3 userId
  by convention, no `held`/`pending` balance state exists in the schema
  — but the pattern is real, proven three separate times, and is
  exactly what §6/§12/§13's escrow language means in practice.
- **External API-key access already exists, narrowly.** `void/lib/
  externalIntegration.js:22-58` (`registerExternalBusiness`) issues a
  real `crypto.randomBytes(16)` API key per external business and
  authenticates inbound calls by it — genuinely distinct from the
  internal `serviceAuth.cjs` token system. This is the one real
  precedent for §14's Interoperability Gateway and §16's Developer
  Portal, and it is VOID Direct only: no self-service portal, sandbox,
  scoping, or third-party webhook registration exists anywhere.
- **VOKEN's transfer/ownership machinery is real and mechanically
  reusable — but hardcoded to a card/collectible domain, not a
  business-token factory.** `transferEditionOwnership`
  (`voken/lib/cultureCards.js:149-163`) checks real ownership before
  moving anything; `mintCultureCard`'s required fields (`subjectPersonId`,
  a fixed 10-value `category` enum, `rarityTier`) are baked into the
  function signature (`cultureCards.js:21-38`) with no parameterized
  schema for an arbitrary business-defined token, and there is no
  RETIRE/burn operation anywhere. §11's "token factory" is a real
  undertaking on top of this, not a config flag.

**Named in the freeze, and confirmed NOT to exist — the real work is
here, not in wiring:**

- **Business Passport.** VACA's entire store is one flat array of
  `{id, subjectType, subjectId, claimType, evidence (a free-text
  string), status, grade, ...}` (`vaca/lib/verifications.js:52-64`)
  reduced to a single boolean by `isIdentityVerified`
  (`verifications.js:141-144`). There is no legal name, registration
  number, authorized-representative list, license status, or document
  field anywhere — nothing a Business Passport could be built from
  except by adding real new fields.
- **The five-tier progression (NETWORK MEMBER → ... → TOKENIZED
  ASSETS).** No staged/leveled status concept exists anywhere in the
  repo for any entity. The nearest-sounding hits (VOID driver tiers,
  Vavlt Stvdios content tiers, VACON-C's simulation trait tiers) are
  each a different, unrelated domain concept — none models progression
  through ordered real-world business stages.
- **Multi-tenant isolation (§17, "a foundational requirement").** No
  employee/role/permission system scoped to a business exists anywhere.
  HVNTZ's only access control is `requireBusinessOwner`
  (`hvntz/server.js:206-239`) — single-`ownerId`-equality, a 403 or
  nothing, no staff list, no roles. `void/lib/staffing.js` posts open
  gig positions to a marketplace and persists no "this person works
  here" record once one is filled.
- **Role-based wallet/treasury authorization.** Confirmed absent
  ecosystem-wide: no spend limits, multi-signature approval, or
  "employee may act but not exceed X" check exists on any V3 account or
  any money-moving path in the repo. §6's "employees must not
  automatically control company treasury" has no existing gate to
  extend — it would be new.
- **Community Treasury / Proof-of-Impact (§19-25).** Zero real hits for
  "community", "treasury", "dividend" or "allocation" as a fund
  concept anywhere in the repo. The one near-miss is cosmetic: HVNTZ's
  demo seed data names a payer id `'demo-vcoin-treasury'`
  (`hvntz/lib/seedDemoData.js:48`) — a placeholder string, not an
  object, ledger, or allocation mechanism. No 5-mile-radius service
  area, no 25% split, no transparency ledger.
- **Businesses have no wallet distinct from a personal balance.** V3's
  schema is `userId`-keyed throughout (`v3/lib/vcoin.js:31-33`,
  `v3/lib/ledgerPg.js:84,96,155,184`) with no `ownerType`/`accountType`
  discriminator. HVNTZ's `registerBusiness` record carries no balance
  field at all (`hvntz/lib/revenueStack.js:125-136`) — a business's
  money is purely an aggregate of settled transfers to its owner's
  individual personal userId, indistinguishable in the ledger from any
  other person's balance.
- **Contracts with defined terms, an approval step, and enforcement.**
  Not found anywhere. The closest hit, VAGO's `predictionMarkets.js`
  `contract` (`vago/lib/predictionMarkets.js:225-286`), is a market
  position data object (quantity/price) with no terms or signing step
  — a different meaning of the word entirely.
- **Generic token classification.** VOKEN's `complianceGate.js:23,39-48`
  is a flat two-entry admin on/off switch, not a system that could
  assign different legal/economic rules to different business-defined
  token types.
- **Blockchain, anything.** No chain, no wallet address format, no
  on-chain record of any kind, anywhere — consistent with the freeze's
  own conditional language throughout ("if legally, financially,
  technically and strategically approved").
- **QVAN, reconfirmed.** Still exactly what the VASH TAP audit found: a
  keyword-routed chat persona (`vacon/lib/orchestrator.js`,
  `vaco-analytics/intelligence.js:107`), not enforced security or
  fraud-detection code under any name.

**What this means for scoping the actual build.** The freeze's own
five-level progression already orders itself by how real its
foundation is: **Level 1→2 (Network Member → Verified Business)** rests
entirely on real, extendable infrastructure — VACA's already-generic
verification plus a small, genuinely new Business Passport record
referencing it and an existing HVNTZ business. **Level 3 (Network
Business)** needs the proven-three-times escrow *pattern* generalized,
which is real work but has real precedent to extend. **Levels 4-5
(tokenization, tokenized assets) and the community-treasury,
multi-tenant, VIG/SDK/developer-portal sections are each their own
undertaking with no existing substrate** — building any of them now
would be exactly the "plan tokenisation without the rule that
tokenisation is a graduation" failure this folder's own history
already records happening once, from working off a document instead of
the codebase.

**A correction to the note below: resolved, not still open.** The
"partial audit" section beneath this one flags "VACA is blockchain app
in v3" as an owner correction "not yet verified in code." The VASH TAP
§1/§55 audit (25 Sep 2026, this session) settled it: `vaca/
VACA_BLOCKCHAIN_IDENTITY_COMPARABLES.md` itself records that VACA was
designed to live inside V3 and was later split out — it is a
centralized, human-reviewed attestation service, not blockchain
identity in any sense (no ledger, wallet, DIDs, or Verifiable
Credentials). Left below rather than deleted, so the record shows what
was asked and when it was actually settled.

## The VAGO Group Wagers audit, 25 Sep 2026

The owner picked this freeze as the third add-on to resume. Its own
17 Sep audit note (preserved verbatim at the top of the frozen file)
already found the named prerequisite infrastructure — "the existing
VAGO Wager Contract Engine, Wager Graph, Wager Threads, Odds Layer,
Escrow Adapter, Resolution Engine" — at **zero files each**. This
audit went one step further: not just confirming those names are
absent, but checking whether the real *mechanics* those names describe
exist under a different name.

**They do, partially, and it changes the scope.** `vago/lib/
predictionMarkets.js`, read directly, is already a real, working,
N-participant pooled wagering engine: `createPredictionMarket` opens a
proposition, any number of users `buyContract` onto either side
(`contracts: [{userId, side, quantity, avgPrice}]`), pricing is a real
pari-mutuel `yesPool`/`noPool` (the "Odds Layer" in substance), custody
is a real `VAGO_HOUSE_ACCOUNT` moved only through an injected
`settleFn` (the "Escrow Adapter" in substance), and `resolveMarket`
splits the entire real pool proportionally among winners,
`settleOnce`-protected against duplicate payout (the "Resolution
Engine" in substance, and solvent by construction — the module's own
header records finding and fixing a real house-insolvency bug here on
12 Sep 2026). This is not the "Wager Contract Engine" by that name and
was never built for group wagers — but it is a real N-party pooled
proposition mechanic, today, and §29's own rule ("do not create
duplicate versions... build only the missing group-specific
functionality") points straight at it.

**Real and reusable, confirmed by reading the code — build on these:**

- **The pooled wagering mechanic itself** — `predictionMarkets.js`,
  above. Any "Group Wager" built now should be a social/organizational
  frame around this, not a second pooling engine.
- **A real thread/reply system, in a different app.** VAGO has no
  thread/comment module of its own (grepped `vago/lib/` for
  `thread|comment|discussion` — nothing). `vxllage/lib/posts.js` does:
  `createPost`, `getReplies`, `getThread` (real recursive reply-tree
  assembly), `likePost`, `repostPost`. The freeze's own §9 ("reuse the
  existing VACO social/thread infrastructure") and §21 ("VAGO + VILLAGE
  ... VAGO remains the wagering engine, VILLAGE remains the social/
  community environment") both point at exactly this, by name.
- **VACO Notify** for §13's invitation notifications — the same real
  dispatch service VASH TAP and VACO Passport already call.
- **V3/VCoin and `settleOnce`** — the real ledger and the real
  idempotent-settlement primitive `predictionMarkets.js` already uses.

**Named in the freeze, and confirmed NOT to exist — the real work is
here, not in wiring:**

- **No 3+-peer shared-pool mechanic anywhere else in VAGO.**
  `sportsbook.js` is pure house-vs-bettor (each bet settles
  individually against the house, no pooling among bettors).
  `esportsStaking.js` is pari-mutuel but hard-capped at exactly 2
  backed sides (`player1Id`/`player2Id`) — same 2-outcome shape as
  `predictionMarkets.js`, not a peer group unit. `casinoSession.js` is
  single-user only. `fantasy.js` grades each entry independently
  against a fixed payout table, never against other entrants — no
  shared-contest math anywhere in it.
- **No group/team/party concept anywhere in VAGO.** Grepped for it —
  the only hits are the unrelated "group-2 route" authorization-tier
  phrase from `decisionLog.cjs`/`operatorAuth.cjs`.
- **No invitation state machine anywhere in the repo.** §13's own
  `Invited → Viewed → Joined → Funded → Locked → Settled` chain exists
  only in the freeze text itself — nothing in the codebase models
  per-invite states today.
- **No tournament, bracket, league, or standings system anywhere in
  VAGO.** Checked `sportsbook.js`, `esportsStaking.js`,
  `casinoSession.js`, and `fantasy.js` directly for
  `bracket|tournament|elimination|standings|leaderboard|contest|league`
  — zero hits in any of them. §11 (tournaments) and §12 (leagues) have
  nothing underneath them.
- **No Side Wager architecture at all.** §8 assumes one already exists
  ("Group wagers must work with the existing Side Wager architecture")
  — it does not, so a parent-wager-to-side-wager relationship (§26's
  "Wager Graph") has nothing to attach to yet.
- **QVAN, reconfirmed a third time.** §24's "QVAN should monitor
  group-specific risks" has no enforcement layer to extend — still a
  chat persona, not security code, per the VASH TAP and VACO Passport
  audits before this one.
- **VAKA (§'s own list of systems to integrate with) is very likely a
  typo for VACA** — it appears exactly once, nowhere else in this
  freeze or any other document, and VACA is the real identity/
  verification app every other freeze here names correctly. Flagged
  rather than silently corrected, per this folder's own "an edited copy
  is a different specification" rule — the frozen text is not amended
  even to fix an apparent typo.

**What this means for scoping the actual build.** The narrowest real
slice is a social/organizational wrapper around
`predictionMarkets.js`'s existing pooled mechanic — a named group
(creator, entry deadline, max participants, invite list) that opens
and locks one underlying prediction market, with `vxllage/lib/posts.js`
providing the group's thread. That covers §1's OPEN/PRIVATE group
types, §2's unbounded group size, most of §3's structure fields, §5's
JOIN→FUND→LOCK flow (`buyContract` already does JOIN+FUND atomically),
§9's thread, §14's escrow, and §15's settlement — all through
functions that already exist. Side wagers, tournaments, leagues, BLIND/
Before-the-Answer group modes, team roles, and QVAN-based group-risk
monitoring are each their own undertaking with no substrate to extend,
the same shape of gap the two audits before this one kept finding.

## The HVNTZ Connected Network §40 audit, 25 Sep 2026

The fourth and last on-deck freeze, and the largest by non-duplication
surface: §40 names Vault Studios, VACA, VASH/VCoin, notifications,
messaging, search, QVAN, V4, ARIES, MIA, VACON, DREA, maps, routing,
analytics, advertising, business accounts/tiers, DREAMS, VOID, VDP,
plus HVNTZ's own existing Hunts/Hunt Builder/Hunt Engine/checkpoints/
rewards/sponsorships. Five parallel searches, each verified by reading
the actual implementation rather than trusting a name.

**The freeze's own factual claim is wrong, and it changes the shape of
Phase 2.** §3 says "the existing eight-camera concept is retained." No
eight-camera or camera/stream code of any kind exists anywhere in
`hvntz/` — confirmed by exhaustive grep. The real eight-position
concept lives in two *other* apps: `vavlt-stvdios/lib/
screenSessions.js` (`MAX_SCREENS = 8`, an ordered array of `channelIds`
capped at 8 — a session limit, not numbered slots) and `vdp/src/lib/
stage.js` (`STAGE_CAMERAS`, 8 named roles wired into VENVS' "Stage"
district). HVNTZ has no reference to, dependency on, or integration
with either. Building §11-13's live-stream checkpoints means
integrating with `vavlt-stvdios`, not extending anything inside
`hvntz/` — a materially different Phase 2 than "retain and extend."

**HVNTZ's own real surface (confirmed 40 routes, `hvntz/server.js`):**
`registerBusiness` (`hvntz/lib/revenueStack.js:125`) is `{id, name,
ownerId, createdAt}` — one owner, no tiers, no staff. `Location` adds
`locationType ∈ ['screen','hub','business-locker']`. "Tiers" in HVNTZ
today are three separate, unrelated things (a *computed* Digital Twin
Level 1-3, a participation-type enum driving revenue share, and a
CVNVO package tier for date-algorithm visibility) — no unified
business-tier entity for §23's packages to hang off. Hunts/checkpoints
are real, executable code (`hvntz/lib/hunts.js`) with real VCoin bounty
payout and revenue-event recording (`hvntz/test/money.test.js` proves
it) — but "Hunt Builder"/"Hunt Engine" are not named concepts anywhere,
and there is exactly one checkpoint type: an unverified photo-proof
check-in. §12's QR/NFC/geofence checkpoint types are a currently-empty
verification layer, not an extension of several existing ones.

**Real and reusable, confirmed by reading the code — build on these:**

- **Vault Studios per-person streaming is already the whole design.**
  `vavlt-stvdios/lib/channels.js`: one `Channel` = one `ownerId`,
  explicitly "not one combined stream per business" per its own header.
  §4's "DJ stream, Bartender A stream..." is not new architecture, it's
  what Vault Studios already does — the gap is only that no `Channel`
  carries a `businessId`/network membership today.
- **Two real paywall/subscription mechanisms already exist.**
  `vavlt-stvdios/lib/lockedContentTiers.js` (real 80/20 VCoin split,
  `creatorId` already accepts "either an individual OR an
  HVNTZ-onboarded business") and `vulture-flix/lib/subscriptions.js`
  (three-tier Netflix-style, `ad-supported`/`standard`/`premium`). §9's
  Level 2 paywall and §10's Level 3 advanced-creator-subscription each
  have a real pattern to extend rather than invent.
- **A real HVNTZ↔VOID integration point already exists.** `void/lib/
  staffing.js`'s `requestHuntStaffing` (service-gated `POST /api/
  hunt-staffing`) verifies an HVNTZ business via an injected fetch and
  fills a role through VOID's existing staffing marketplace — direct
  precedent for §19/§20's node invitation and scheduling, one level
  removed from a green field.
- **VACA's identity-dedup pattern is real and has three call sites to
  copy.** `GET /api/identity-status/:subjectType/:subjectId`, consumed
  by `cvnvo` (hard-fail), `void` (fail-soft), `vash-tap` (generic
  wrapper). §19's "do not create duplicate accounts if the person
  already exists in VACA" is exactly this: a per-app `subjectType`
  (e.g. `hvntz-member`), one fetch before creating any invitation-
  resolved record.
- **V4-proxy's maps API already anticipates this.** `POST /api/maps/
  place`'s own code comment names "a VOID station, an HVNTZ business"
  as example callers — but nothing in `hvntz/` calls it today; HVNTZ's
  Explore ranking uses a local Haversine implementation instead. §28's
  "use existing V4 mapping" is real infrastructure sitting unused, not
  infrastructure that needs building.
- **Search, analytics ingest, and notification dispatch are all real
  and cross-app**, same as the prior three audits found: `v4-search`
  (unified index, HVNTZ already one of its adapters), `vaco-analytics`
  (`POST /api/metrics/ingest`, dashboard, anomaly/alert), `vaco-notify`.
- **DREAMS is the real advertising system** §24 wants reuse of — a full
  ad marketplace (advertisers, campaigns, budget, launch, per-screen
  revenue), and it already names HVNTZ, Vault Studios and VENVS in its
  own build notes as apps it expects to integrate with later.

**Confirmed NOT to exist — the real work is here, not in wiring:**

- **A configurable N-party revenue-sharing engine — the biggest single
  gap, and §15-18's central ask.** Every real settlement mechanism in
  the repo (`hvntz/lib/revenueStack.js`, `void/lib/marketplace.js`
  courier payouts, VAGO's `esportsStaking.js` pari-mutuel payout to
  winners) is hardcoded to exactly two legs: platform vs. one
  recipient, or proportional-by-stake to one role. Nothing supports
  named per-agreement roles (business/DJ/bartender-pool/hosts/
  platform) with configurable percentages — even `vaco-analytics/
  VACO_REVENUE_SPLIT_MODEL.md`'s own 3-party sketch is documentation
  with no implementing code. §16's revenue attribution across up to 13
  named dimensions has no substrate to extend either.
- **An invitation accept/decline state machine.** VAGO Group Wagers'
  `invitedUserIds` is the closest thing in the repo, and it's a static
  allow-list with no stored per-invite state and no accept/decline
  transition — its own header says as much. The one real
  submit→review→terminal-status shape in the repo, VOKEN's Cvltvre
  Card application (`pending-review`→`accepted`/`declined`), is
  one-sided (a reviewer decides, not the invited person responding) —
  worth copying the *shape* of, not the semantics.
- **Multi-role RBAC.** Zero role→capability grant matrices exist
  anywhere in the repo (confirmed by grep across all apps) — every app
  uses the same flat actor/operator-scope/service shape
  `OPERATOR_ROLES_SCOPE.md` documents as deliberate. §7's 16 named
  roles (Owner, Administrator, DJ, Bartender, Camera Operator, Sponsor,
  Premium Member...) would be genuinely new infrastructure, not an
  extension of anything.
- **Recurring per-person schedules.** Every real "time window" in the
  repo (`vacay/lib/bookings/bookings.js`'s overlap guard, VOID MAGIC's
  single-instant `scheduledAt`) is a one-off reservation interval. No
  "Friday 6PM-2AM" recurring day-of-week concept exists to extend for
  §20.
- **Ephemeral, archivable, multi-business groupings.** No `'archived'`
  status literal exists anywhere in the repo. The closest analogues
  (VAGO Group Wagers, VAVLT STVDIOS casino events, VXLLAGE village
  events) are all single-host, single-entity, with no archive step —
  §21's temporary event network spanning many businesses is new on
  every axis: multi-business, time-bounded, archivable.
- **QVAN is not a security system.** It is a chat persona
  (`vacon/lib/agents.js`) routed to by keyword match
  (`vacon/lib/orchestrator.js`) — no scanning, flagging API, or fraud
  detection exists. §34's "reuse QVAN security... fraud detection" has
  nothing real to reuse; same finding, same caveat, for MIA.
- **DREA is not an AI Hunt-generation system.** There is no app named
  `drea`. "DREA" is DREAMS' ad-copy-assistant persona, and separately
  `hvntz/lib/drea.js` is a deterministic placement-exclusion/flagging
  engine — explicitly *not* the AI, per its own comment. §29's "DREA
  can propose a Hunt" is future work by the freeze's own words, not an
  existing capability being extended.
- **VENVS today has no resort/casino/venue-streaming concept at all.**
  Real VENVS is analog commerce only (Shop/Marketplace/Publishing,
  frontend-only, talking to a mock backend). The freeze's §32
  "resort/casino/lounge/hotel" framing actually matches VDP's
  `venusResort.js` (Venus Resort Complex), a different app. §32 is new
  territory regardless of which app it lands in.
- **ARIES does not exist.** Zero occurrences anywhere in the repo
  outside the word "boundaries." The freeze names it once in its
  "do not replace" list (§ list, near the top) and it corresponds to
  nothing real.

**What this means for scoping the actual build.** Unlike the three
freezes before it, HVNTZ Connected Network's real gaps
(revenue-sharing engine, invitation state machine, RBAC, recurring
schedules, archivable multi-business groupings) are large enough that
no single "narrowest slice" covers even one phase cleanly — §47's own
PHASE 1 (Network entity + membership + permissions) already touches
three of those five gaps at once. The freeze's own acceptance criteria
(§48) are phrased as a 30-item checklist across all five phases, not a
demo. Scoping this will need the owner's call on which phase, and how
thin a slice within it, rather than a single obvious narrowest path.

## What the partial audit established

Recorded because it is the expensive part and it is easy to redo badly.

**Real and reusable today.** V3 is the canonical VCoin/VASH ledger —
`/api/vcoin/balance`, `transfer`, `settle`, `transactions`,
`reconciliation`, `/api/vash/cashout`, `/api/vash/balance` — with a
row-level ledger behind `DATABASE_URL` and idempotent settlement.
VOKEN (64 routes), VAGO (41), VOID (161), VXLLAGE (64), VSAFE (43),
HVNTZ (40), V4-proxy (28) all have real surfaces. `settleOnce.js`,
`provablyFair.js`, `goldCoin.js`, `serviceAuth`, `shieldAuth` and the
shared persistence layer all exist and are what the freezes mean by
"do not duplicate".

**Named in the freezes and NOT present.** Measured by grep across every
non-`node_modules` JS file:

- `wager contract`, `wager graph`, `wager thread`, `side wager`,
  `escrow adapter`, `resolution engine` — **0 files each.** The VAGO
  Group Wagers freeze opens by requiring integration with "the existing
  VAGO Wager Contract Engine, Wager Graph, Wager Threads, Odds Layer,
  Escrow Adapter, Resolution Engine" and instructing that they not be
  duplicated. None of those exist. What VAGO actually has is casino
  (mines, plinko, hilo), fantasy props, prediction markets, a
  sportsbook, esports staking and AMOE — a different shape entirely.
  **Group wagers cannot be layered onto a wagering engine that has not
  been built**, so that engine is the real first task whenever this
  resumes, not the group layer. **Refined by the full VAGO Group Wagers
  audit below (25 Sep 2026): the named engine doesn't exist, but a real
  one does under a different name** — `predictionMarkets.js`'s pooled,
  N-participant, pari-mutuel mechanic is functionally the Wager
  Contract/Odds Layer/Escrow Adapter/Resolution Engine this note
  found absent. The real first task turned out to be a social wrapper
  around it, not a wagering engine built from zero.
- `KYB` / "know your business" — 0 files.
- `multi-tenant` / `multiTenant` — 0 files. VACO freeze §17 calls
  tenant isolation "a foundational requirement".
- `proof-of-impact`, `community allocation` — 0 files.
- `passport` — 1 file; `tenant` — 2; `blockchain` — 1.

**A correction the owner made mid-audit, not yet verified in code:**
"VACA is blockchain app in v3." The audit had VACA as a small
identity service (8 routes) and had not connected it to V3. Verify
this first when resuming — it changes where the blockchain substrate
for freeze §9, §10 and §24 is presumed to live.

**A measurement error worth keeping.** The first concept scan used
`grep -rliE "vcoin\|VCoin"` — `\|` is a literal in an extended regex,
so it searched for the string `vcoin|VCoin` and reported **0 files**
for the ledger the whole freeze is built on. Three of fourteen terms
were wrong the same way. A scan that finds nothing must be suspected
before it is believed.

## Compliance gates that stay shut regardless

These are legal gates, not scope decisions, and neither freeze
overrides them:

- Gambling/casino systems #291-305 remain closed pending compliance
  review.
- VAGO settles in VCoin or Gold Coin only; real-money gambling is out
  of scope.
- `isComplianceCleared(store, 'fractional-ownership')` stays shut,
  which bears directly on freeze §4, §5, §11 and §12 (tokenised
  businesses and assets).
- VEX `placeTradeOrder` is not cleared to move money.
- No standalone `/api/banking/*`; banking routes through VASH.
- VACANCY ownership stays in-simulation-only, permanently.

The freezes themselves say tokenisation "must follow applicable legal,
regulatory and compliance requirements" and that a group structure
"must never be used to bypass individual restrictions", so these gates
and the frozen architecture agree.
