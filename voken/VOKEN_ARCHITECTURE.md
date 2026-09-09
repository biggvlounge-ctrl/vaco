# VOKEN — Data Models + API Map (v1)

> **VEX is no longer a VOKEN division.** This document was written
> when it was. VEX (Robinhood-style brokerage trading) was extracted
> into its own standalone app at `vex/` in Phase 16, with a
> `vex-trading/` parent shell over it and Vex Business. VADO remains a
> real VOKEN division. See the implementation status at the bottom and
> `voken/VEX_VADO_RESTRUCTURING.md`.

Translating the VDAS standard, Cvltvre Cards, and the VEX/VADO
restructuring into buildable specs.

## Data models

```
CultureCard {  // the VDAS core asset type
  id, ownerId, category: string  // one of 10 (placeholder names, see
    // VOKEN_MASTER_SPEC_PROGRESS.md — confirm real labels before launch)
  rarityTier: string  // one of 7 (placeholder: Common..1/1)
  tokenizationType: "physical" | "digital" | "tokenized" | "avatar"
  formats: [string]  // subset of the above
  provenance: [{ year, event }]  // ownership timeline, VACA-verified
}

Auction {
  id, cardId, auctionType: "instant" | "english" | "dutch" | "offer"
  currentBid, bidCount, endsAt
}

FractionalOwnership {  // real estate/vehicles — securities-adjacent,
                        // compliance-flagged, held pending Reg D/A+ work
  id, cardId, totalShares, soldShares, pricePerShare
}

// VEX division (Robinhood-style trading, incorporates VACA)
BrokerAccount {
  id, userId, netCapitalModel: "introducing-broker"  // per real
    // FINRA registration decision — broker-dealer compliance flagged,
    // held pending real counsel
}
TradeOrder { id, accountId, cardId, orderType, quantity, status }

// VADO division (art gallery/auctions)
ArtListing {
  id, artistId, cardId, isFractional: boolean
  // isFractional: true rides on the same securities compliance work
  // as FractionalOwnership above — not a separate cost
}
```

## API map

- `POST /voken/cards` — mint a new Cvltvre Card
- `POST /voken/auctions/:id/bid` — real-time bid, routes payment via V3
- `POST /voken/vex/orders` — trade order (held pending broker-dealer
  compliance resolution — build the code path, gate it behind a
  compliance flag)
- `POST /voken/vado/listings` — art listing, `isFractional` gated the
  same way
- Cross-app: `voken/cards` presence inside VDP's VEX/VADO district
  (shared entry point, per the confirmed VOKEN-as-umbrella structure)

## Status
Ready for Claude Code now for all non-fractional, non-brokerage
functionality. Fractional ownership (VOKEN + VADO) and VEX's brokerage
trading should be built with a compliance gate/feature flag, since both
are on hold pending real legal review — the code path is worth building
now, the live-money trigger should stay off until cleared.

---

## Implementation status (updated when the VEX extraction was reconciled)

**Built and real**: Cvltvre Cards (`lib/cardTypes.js`), the value
algorithm with real scarcity/authenticity/rookie weighting
(`lib/valueAlgorithm.js`, `ROOKIE_BONUS = 15`), auctions
(`lib/auctions.js`, settling through V3 with a `voken_vado_*` reason),
fractional shares with a real secondary resale market, pack opening
that actually charges the buyer, and VACA-verified authenticity grades
— VOKEN queries `GET /api/authenticity-grade/voken-card/:id` rather
than trusting a caller-supplied grade.

**The compliance-gate recommendation was followed exactly.**
`lib/complianceGate.js` exists and holds the live-money trigger off:

| Gate | Default | Why |
|---|---|---|
| `fractional-ownership` | `false` | Reg D / Reg A+ work not done |
| `influencer-culture-card-rewards` | `false` | **Held pending Deskins' review** — see below |

The `vex-brokerage` gate that this document's API map implies moved out
with the rest of VEX's brokerage logic when VEX became standalone. It
now lives in `vex/lib/complianceGate.js`, which is where a
broker-dealer gate belongs.

**Open compliance item, flagged rather than resolved.** Paying
influencers in Cvltvre Card value for promotional engagement is held on
a founder decision pending Deskins' review. The question is specific:
Cvltvre Cards have a real secondary market (`lib/resale.js`), so
rewarding promotion with them is compensated promotion in an asset with
resale value — disclosable regardless of whether the compensation is
cash, and adjacent to the securities posture VOKEN already carries for
fractional ownership. The gate is wired and defaults closed, so the
code path can be built and demonstrated without the question being
answered first. It should not be opened by anyone but Deskins.

**Stale in the API map**: `POST /voken/vex/orders` and the shared
`VDP VEX/VADO district` entry point. VDP's `VexView` was repointed to
the standalone `vex/` app; `VadoView` still points at VOKEN. Two
separate consumers of two separate services now, which is the correct
consequence of the extraction.

**Still open, as this document itself flags**: the 10 category names
and 7 rarity tiers are explicitly placeholders here and remain
unconfirmed. Worth resolving before launch, since they are
user-visible and expensive to rename once cards exist under them.
