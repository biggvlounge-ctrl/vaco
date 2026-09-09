# VAGO — Data Models + API Map (v1)

Translating the Kalshi/DraftKings blend, sweepstakes-casino model, and
in-world prediction integration into buildable specs.

## Data models

```
PredictionMarket {  // Kalshi-model: peer-to-peer, priced by the market
  id, question: string, category: string  // spans beyond sports
  contracts: [{ userId, side: "yes"|"no", price, quantity }]
  source: "real-world" | "vdp-in-world" | "vacancy-in-game"
    // in-world predictions are the genuinely unique differentiator —
    // no competitor can offer this since it requires owning the
    // simulated world itself
}

SportsBet {  // DraftKings/FanDuel-model: house-set odds
  id, eventId, odds, userId, stakeVCoin
}

EsportsBet {  // 1v1Me-model: skill-based staking, not house odds
  id, matchId, player1Id, player2Id
  stakes: [{ userId, backedPlayerId, amountVCoin }]
  isFlashStake: boolean  // live in-match staking
}

CasinoSession {
  id, userId, gameType: "live-dealer" | "originals" | "game-show"
  currency: "gold-coin" | "vcoin"  // Gold Coin is the REQUIRED separate,
    // non-redeemable sweepstakes currency — must be genuinely distinct
    // from VCoin for the sweepstakes-compliant model to actually apply
  amoeEntryUsed: boolean  // real, functional alternate-entry path,
    // legally required for the sweepstakes model to hold up
}
```

## API map

- `POST /vago/markets` — create a prediction market
- `POST /vago/markets/:id/trade` — buy/sell a contract
- `POST /vago/sports/:eventId/bet` — place a house-odds bet (VCoin only)
- `POST /vago/esports/:matchId/stake` — skill-based stake
- `POST /vago/casino/sessions` — start a session; MUST specify
  `currency: gold-coin` for sweepstakes-compliant play
- `POST /vago/casino/amoe-entry` — the real, required free-entry path
- `GET /vago/vdp-predictions` / `GET /vago/vacancy-predictions` —
  in-world event prediction feeds specifically

## Status
Ready for Claude Code now, with one hard architectural requirement:
**Gold Coin and VCoin must be implemented as genuinely separate,
non-interchangeable currencies from day one** — this is not a later
migration, it's the structural requirement that keeps the sweepstakes
model legally distinct from real-money gambling. Real-money sports
betting (state-licensed) stays a separate, gated feature pending the
Iowa license decision.

## Open item, flagged for later discussion — financial/market predictions specifically

Real, honest flag: VCoin-settled predictions on **financial markets
specifically** (stock movements, interest rates, and similar) likely
follow the same real logic already established for VAGO's other
prediction categories — non-redeemable VCoin settlement should keep
this outside the $100M federal DCM license requirement, the same way
it does for sports/event predictions. **But this sits closer to
securities-adjacent territory** than VAGO's other prediction types,
even with compliant currency — worth a real, direct legal confirmation
rather than assuming the existing clearance automatically extends to
this specific category. Flagged at this level for a later, more
detailed conversation — not blocking current development.

---

## Implementation status (added when this file was placed into the repo)

**Substantially built — this is the most fully-realized architecture
document placed in this session.** `vago/lib/` contains a module for
essentially every model above: `predictionMarkets.js`, `sportsbook.js`,
`esportsStaking.js`, `casinoSession.js`, `goldCoin.js`, `amoe.js`,
`originals.js`, `fantasy.js`, and `provablyFair.js`.

**The hard architectural requirement was met, and met the right way.**
"Gold Coin and VCoin must be genuinely separate, non-interchangeable
currencies from day one, not a later migration" — `vago/lib/store.js`
holds `goldCoinBalances` as its own ledger, whose own comment records
that it is "a genuinely separate ledger from VCoin." There is no
conversion path between them.

This is the single most important thing in the document and it is worth
saying why plainly: the sweepstakes model's entire legal footing is
that the promotional currency is not redeemable. A conversion function
added later "just for convenience" would not be a feature change, it
would collapse the distinction the model rests on. Because the ledgers
were built separate rather than unified-then-split, there is nowhere
for that function to naturally appear.

**AMOE is real, not a checkbox.** `lib/amoe.js` with `amoeEntries` in
the store — an actual alternate entry path, which is the other half of
the sweepstakes structure. A model with a non-redeemable currency but
no functioning free entry method is not a sweepstakes.

**`provablyFair.js` is a genuine addition this document did not ask
for** and is worth keeping: verifiable game outcomes are what let a
player check that a result was not manipulated. That matters more, not
less, when the currency is promotional — a player who cannot cash out
has only fairness to rely on.

**Real-money sports betting remains gated**, as instructed. Settlement
is in VCoin throughout; nothing in VAGO moves real currency.

**The open flag is still open, and worth restating because it is the
sharpest live question in this document.** VCoin-settled predictions on
*financial markets* specifically do sit closer to securities-adjacent
territory than predictions on, say, an in-world VDP event. The
distinction is real: a contract whose payoff tracks an external
financial instrument is a different object from a contract about
whether it rains. `PredictionMarket.category` is free-form, so nothing
in the code currently distinguishes them.

Two things follow, neither of which was done unilaterally:

1. If that legal question is going to be asked, the code should be able
   to answer "which markets are in this category" — which today it
   cannot, because `category` is uncontrolled text.
2. If the answer comes back restrictive, the enforcement point is a
   compliance gate keyed on category, matching the pattern
   `voken/lib/complianceGate.js` already establishes. That is a small
   change *if* categories are controlled, and an unpleasant one if they
   are not.

Recorded rather than acted on, since constraining `category` changes
behavior for markets that already exist.

**Genuinely unbuilt**: `vacancy-in-game` prediction sources. VACON-C is
paused, so there is no in-game state to predict against. `vdp-in-world`
is the reachable half of that differentiator today.
