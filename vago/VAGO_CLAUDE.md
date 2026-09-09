# VAGO — Claude Code Project Brief

**App:** VAGO — Wagering + Predictions platform
**Part of:** VACO ecosystem (14+ interconnected apps sharing V4/Shell AI OS, VASH/VCoin/VACA, unified avatar)
**Status:** UI/mechanics prototype complete (2 build passes). No backend. Not production-ready.
**This doc replaces all prior VAGO summaries — treat it as canonical.**

---

## 0. Correction — VAGO is a standalone app, not a VENUS division

Earlier versions of this brief described VAGO as living entirely inside
VENVS/VENUS (the digital-planet app), the same way Music/Pods are divisions
of Vvltvre. **That's wrong.** VAGO is one of the 14+ standalone VACO apps —
it can be opened and used directly on its own, not only reached by walking
into a district inside VENVS.

Practical implications for anything built from here:
- VAGO needs its own entry point in Vaco Shell (its own tile/deep link),
  not just a doorway inside VENVS's digital world.
- Any integration with VENVS (e.g. a VAGO casino district you can walk into
  in Digital Mode) should be understood as VENVS linking out to VAGO — the
  same relationship VENVS has with its other "lounge district" sibling apps
  (VVLTVRE, VXLLAGE, CVNVO, Vavlt Stvdios, VOID, etc.) — not VAGO being
  owned by or contained within VENVS.
- Section 8 and any other place below that says "VAGO does not live outside
  VENUS" is superseded by this correction — kept below only for historical
  context, not as current guidance.

---

## 1. What VAGO is

VAGO is a universal wagering, prediction, and betting platform. It powers:

- Casino floor (table games, slots, live dealer, VIP rooms)
- Sportsbook (live odds, parlays, player props, futures, cash out)
- Prediction Hub (sports/entertainment/creator/community prediction markets — the flagship surface)
- Esports lounge (live match viewing + wagering, brackets, fantasy esports)
- Fantasy contests
- Wallet/economy layer (VCoin, missions, VIP tiers, marketplace)
- Avatar/identity (XP, reputation, badges — projected from the shared cross-app avatar, not owned by VAGO)

It uses the same shared avatar and VCoin wallet as every other VACO app, and
can additionally be surfaced inside VENVS's Digital Mode as a walkable
casino/wagering district — but per §0, VENVS is a *consumer* of VAGO, not
its container.

---

## 2. Currency decision (important, deliberate)

The original spec described real-money odds, payouts, and settlement. **This
build uses VCoin instead of real money, by design** — not an oversight to
"fix" later without a plan.

Real-money casino/sportsbook/prediction-market wagering is a licensed
gambling/gaming product in essentially every jurisdiction:
- US: state-by-state gaming licenses, age + geolocation verification
- Elsewhere: country-by-country licensing regimes
- Everywhere: AML/KYC before a single real wager can legally be taken

**Do not wire real money into this without gaming counsel and
jurisdiction-by-jurisdiction licensing first.** That's a legal/business
decision Bigg has to make explicitly, not something to infer from "make it
production-ready." If/when that decision is made, see Section 7 (path to
real money) before writing any settlement code.

---

## 3. Feature inventory — real vs. mocked

### Fully interactive (client-side, real logic, fake money)
| Feature | Where | Notes |
|---|---|---|
| Wagering (single bets) | Casino, Sportsbook, Predictions, Esports | Adds a "leg" to the shared bet slip |
| Parlay / multi-leg slip | Global (`SlipBar` + `SlipSheet`) | Combines odds multiplicatively across any surface |
| VCoin balance | Global (`useVCoin` hook) | In-memory only, resets on reload |
| Wager settlement | `useVCoin.place()` | `setTimeout` + `Math.random() > 0.47` — placeholder, not a real odds engine |
| Wager history | Avatar tab | Populated by the same hook |
| Daily reward claim | Wallet tab | One-time per session (in-memory flag) |
| Missions list | Wallet tab | Static list, "done" state hardcoded, not tied to real activity |
| Favoriting games | Sportsbook | Local state only |
| Category filters | Casino, Predictions | Local state, filters mock arrays |

### Realistic UI, NOT wired to real data (needs real backend/infra)
| Feature | Where | What's actually needed |
|---|---|---|
| Live odds | Sportsbook, Esports | Real odds feed / odds-provider integration |
| Real game/match results | Everywhere settlement happens | Results feed from VACANCY (for in-ecosystem esports) or a licensed odds provider (for real sports) |
| Cash Out, Bet Builder, Same Game Parlay | Sportsbook | Shown as UI affordances only — no backend logic |
| V4/Shell AI insight card | Predictions | One static example card — needs a real Shell agent-layer recommendation |
| Leaderboards | Predictions | Static mock list |
| Tournament brackets | Esports | Static mock list |
| Live streams | Esports | Placeholder text, no video infra |
| Community/voice chat | Esports | Not implemented — needs real-time chat/voice service |
| Fantasy lineup builder | Fantasy | "Build Lineup" button is a stub, no roster logic |
| Marketplace | Wallet | Static items, no purchase/inventory logic |
| VIP tier progress | Wallet | Hardcoded progress bar |
| Friends / Clubs | Avatar | Static counts, no real social graph |
| Cross-app shared avatar/wallet/reputation | Avatar | VAGO-side UI only. **The actual shared service doesn't exist yet** — see Section 5 |

---

## 4. Architecture notes (current state)

- **Stack:** React 18 + Vite. No router (single-file tab-switched view). No backend, no DB, no API calls.
- **State:** All state is local React state in `App.jsx` (`useVCoin` hook + component-level `useState`). Nothing persists across reload.
- **File layout:**
  ```
  src/
    App.jsx      — everything: primitives, Casino, Sportsbook, Predictions,
                    Esports, Fantasy, Avatar, Wallet, slip system, root component
    main.jsx     — ReactDOM entry point
  ```
  This is intentionally a single file for prototype speed. **First real refactor task:**
  split into `src/components/`, `src/features/{casino,sportsbook,predictions,esports,fantasy,avatar,wallet}/`,
  and a `src/state/` layer once real data sources exist.
- **Design tokens** (used throughout, keep consistent if extending):
  - Background `#0A0C16`, card `#12162A` / `#171C36`, hairline `#212642`
  - Gold accent `#E8B54A` (odds/currency), violet accent `#8B5CF6` (VENUS/digital-planet brand — retained as VAGO's accent since it originated as a VENUS-district color, even though VAGO is now standalone)
  - Green `#3ECF8E` (win/live-positive), red `#E8544A` (loss/live-negative)
  - Display font: Space Grotesk (headers, numerics), body: Inter
  - Signature motif: "Odds Orb" — a spinning conic-gradient circle used as a live/odds indicator throughout
- **Bet slip pattern:** any wagerable item across any tab calls `addLeg(item)`. A single global
  slip (`legs` state in root) aggregates picks; `SlipBar` appears when non-empty; `SlipSheet`
  handles stake selection and confirms via `useVCoin.place(legs, stake)`. This is the one
  piece of cross-feature architecture worth preserving as-is when refactoring.

---

## 5. Explicit gaps (the real work, not UI work)

1. **No backend at all.** Every "real" feature above is client-only. Needs an actual API layer before this is a product.
2. **No real odds/settlement engine.** Current settlement is a coin flip. Real version needs either a licensed odds provider (real sports) or a deterministic results feed from VACANCY (in-ecosystem esports).
3. **No shared cross-app identity/wallet service.** V3 (VASH/VCoin/VACA) is the canonical ledger — VAGO's `useVCoin` hook needs to be replaced with real calls to V3, and the avatar/XP/reputation data needs to come from the shared identity layer once it exists, not be re-invented per app.
4. **No Shell agent-layer integration.** The "AI insight" card is a hardcoded example string. Needs a real call into Shell's shared agent layer (V4's Command Center / MIA), not a bespoke model.
5. **No compliance layer.** No age verification, no geolocation gating, no AML/KYC — required before any real-money version, not optional add-ons.
6. **No real-time layer.** Live odds, live scores, chat, and notifications all need WebSocket/streaming infra; none exists yet.
7. **VAGO needs its own Shell entry point** (per §0) — currently only demonstrated as reachable from within VENVS's Digital Mode; the standalone entry point/launch flow isn't built yet.

---

## 6. Two-deliverable status

- ✅ Live demo artifact (`VagoDemo.jsx`) — mobile-first, all 7 surfaces, working slip/wagering mechanics
- ✅ Replit-deployable zip — Vite + React, `.replit`/`replit.nix` configured, README with the same real-vs-mocked breakdown as this doc
- ✅ This CLAUDE.md brief

## 7. Path to real money (only if/when Bigg decides to go there)

Do not start this without an explicit go-ahead, since it's a legal decision, not a technical one:
1. Pick jurisdictions to target; engage gaming counsel per jurisdiction.
2. Get licensed (or use a licensed platform/partner) before any real wager is taken.
3. Build age + geolocation verification and KYC/AML into onboarding.
4. Replace the coin-flip settlement with a real odds/results engine.
5. Only then does "real payout system" become something to build.

## 8. Ecosystem cross-references

- VACANCY — source of in-ecosystem esports/game results VAGO would settle against.
- V3 (VASH/VCoin/VACA) — canonical ledger; VAGO's wallet is a mock that needs reconciling here.
- Shell's shared agent layer (VACON→MIA, DREA, etc.) — V4/insight card should eventually call this, not a hardcoded string.
- VENVS — a *consumer* of VAGO (can surface it as a walkable casino district in Digital Mode), not VAGO's container. Per §0, VAGO is a standalone app with its own Shell entry point.

---

## Implementation status (added when this file was placed into the repo)

> **Substantially superseded.** This document describes a UI/mechanics
> prototype with no backend. VAGO is now a real Express service with a
> real backend, real settlement, and its own Shell entry point. Read
> the sections below as history except where noted.

**Both of this document's headline problems are solved.**

**The standalone-app correction was acted on.** VAGO has its own entry
in `vaco-shell/lib/registry.js` (`id: 'vago'`, port 8795, bundle
"Financial & Trading"), independent of VENVS. The relationship this
document asked for — VENVS linking *out* to VAGO rather than owning it
— is what exists.

**"No backend at all" is no longer true.** `vago/lib/` holds thirteen
real modules: `predictionMarkets.js`, `sportsbook.js`,
`esportsStaking.js`, `casinoSession.js`, `goldCoin.js`, `amoe.js`,
`originals.js`, `fantasy.js`, `provablyFair.js`, plus `store.js`,
`persistence.js`, `shieldAuth.js`, and `seedDemoData.js`. State
persists to disk. The "single file, resets on reload" architecture
described above is gone.

**"Settlement is a coin flip" — the sharpest gap in this document, and
it is closed.** `setTimeout + random` has been replaced by real
settlement functions that take an actual outcome and pay out
accordingly: `settleSportsEvent()` in `sportsbook.js` and
`resolveMarket()` in `predictionMarkets.js`, both requiring a real
`transferFn` so winnings move through V3 rather than a per-app
balance. `provablyFair.js` was added beyond what this document asked
for, giving verifiable game outcomes.

**The gap list, item by item:**

| Gap as written | Status |
|---|---|
| No backend at all | **Closed** |
| No real settlement engine | **Closed** — real outcome-driven settlement |
| No shared identity/wallet; "needs real calls to V3, not a reinvented per-app ledger" | **Closed** — V3 is canonical, Shield handles sessions |
| No compliance layer | **Partially** — VCoin/Gold Coin separation and AMOE are real; age/geo/KYC still absent, and still correctly gated |
| No real-time layer | **Still open** — no WebSocket/streaming infra |
| No Shell entry point | **Closed** |
| No Shell agent-layer integration | **Closed** — DREA and the VACON roster are real; VAGO feeds VACO Analytics |

**Still accurate, and the most important part of this document to
preserve:** the currency decision and the path-to-real-money section.
Nothing in VAGO moves real currency. The instruction that real-money
wagering is "a legal/business decision requiring explicit go-ahead, not
an inference from 'make it production-ready'" remains the standing
rule, and it has been honored — no pass has quietly wired real money
in. Real-money sports betting stays gated pending the Iowa license
decision.

**Still accurate on the frontend.** The design tokens (#0A0C16 ground,
#E8B54A gold, #8B5CF6 violet, Odds Orb motif) and the bet-slip
`addLeg()` pattern describe a prototype UI that does not live in this
repo. VAGO's server is real; its visible surface is VDP's district.
Those tokens are also among the few concrete per-app visual identities
recorded anywhere in this project — worth keeping for whenever
`vaco-shell/VISUAL_DESIGN_COHESION_DIRECTIVE.md` gets picked up, since
that document notes almost no app has one written down.
