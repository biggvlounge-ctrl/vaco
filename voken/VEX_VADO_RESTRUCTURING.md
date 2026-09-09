# VEX / VADO Restructuring (v1) — SUPERSEDED on VEX

> **Half of this document is now wrong, and the wrong half is its
> headline claim.** VEX was extracted out of VOKEN into its own
> standalone app in Phase 16. VADO remains a VOKEN division exactly as
> described. Read the VADO section as current; read the VEX section as
> history. Details at the bottom.

Confirmed architecture: VEX and VADO are internal divisions of VOKEN,
not separate standalone VACO apps — same pattern as Vvltvre's five
divisions.

VOKEN Trading (VEX): Robinhood-style stock/tokenized-asset trading
floor, also incorporates VACA blockchain/identity info. Compliance
status: on hold, same as VAGO's sports betting piece. Real cost:
$200,000-600,000 (broker-dealer net capital requirement $50,000-
100,000 for introducing-broker model, plus $150,000-500,000 legal/
FINRA registration). Deferred to Part Two of the financial plan.

VOKEN Art (VADO): gallery/auction house division. Compliance status:
genuinely lighter than VEX — selling whole, complete art pieces is
standard business licensing and sales tax, not a heavily regulated
securities category. VOKEN's existing Cvltvre Card authenticity/
provenance system already covers this. Exception: fractional art
ownership rides on the same securities compliance already budgeted
for VOKEN generally (Reg D/Reg A+, $50,000-250,000) — not a new cost.

Shared VDP presence: both VEX and VADO maintain a shared VOKEN entry
point inside VDP — only app-level organization changes, not the VDP
link.

---

## Implementation status (added when this file was placed into the repo)

### VEX — superseded, and superseded deliberately

This document's central claim is that VEX is a VOKEN division rather
than a standalone app. That was true when written and is no longer.
Three completed phases moved it:

- VEX was extracted out of VOKEN into a standalone `vex/` app.
- `call/` was renamed `vex-business/` (a separate thing — the futures
  research platform, not the brokerage).
- A `vex-trading/` parent shell app was built to host VEX and Vex
  Business as sub-apps.

`voken/README.md` already records this in its own words: "**VEX
(Robinhood-style brokerage trading) was extracted into its own
standalone app (Phase 16)**." VDP's `VexView` was repointed from VOKEN
to the standalone app, and `vaco-shell`'s registry was updated to drop
the stale VEX line and add `vex-trading`.

So the ecosystem now has three VEX-named directories, which is worth
stating plainly since this document predates all of them:

| Directory | What it is |
|---|---|
| `vex/` | The Robinhood-style brokerage — what this document calls VOKEN Trading |
| `vex-business/` | Futures-trading research platform (formerly `call/`) — unrelated to this document |
| `vex-trading/` | Parent shell hosting the two above as sub-apps |

**What is still accurate in the VEX section**: the compliance posture.
Broker-dealer registration remains genuinely on hold, no live trading
exists, and the cost range is unverifiable from inside this repo — it
should be treated the same way as the MTL figure in
`v3/VASH_BAAS_VCOIN_ADVANCEMENT.md`: a real planning input to confirm
with counsel, not a settled number. Extraction into a standalone app
changed the code layout, not the regulatory position.

### VADO — accurate, and matches the code

No correction needed. VADO is a real VOKEN division, implemented in
`voken/lib/artCultureCard.js` and `voken/lib/auctions.js`, whose own
header describes it as "the art gallery/auctions sub-division." Real
auction settlement runs through V3 with a `voken_vado_*` transfer
reason, and VDP has a real VADO browsing district.

The document's compliance reasoning also holds up against the code:
whole-piece art sales are ordinary commerce, and fractional ownership
is handled by VOKEN's existing fractional-share machinery rather than
by anything VADO-specific — so it genuinely inherits VOKEN's
securities posture rather than adding a new one.

### Shared VDP presence — partially superseded

"Both VEX and VADO maintain a shared VOKEN entry point inside VDP" is
no longer how it works. VDP's `VexView` now points at the standalone
`vex/` app; `VadoView` still points at VOKEN. The two districts are
separate consumers of separate services, which is the correct
consequence of the extraction — but it is the opposite of the "only
app-level organization changes, not the VDP link" line above.
