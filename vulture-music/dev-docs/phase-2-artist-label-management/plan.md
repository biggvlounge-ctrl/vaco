# Plan — Phase 2: Artist/Label Management

## Goal
Add artist/label management to Vvltvre Music/Distribution: roster
management, real deals, multiple artists under one manager account.

## Design
- `lib/managers.js`: exclusive management deals (`signArtist` rejects
  double-signing an already-managed artist, matching how real
  personal-management relationships work), real
  `DEFAULT_COMMISSION_PERCENT` (17.5%, the flagged midpoint of the
  real 15-20% industry-standard personal-manager commission range),
  `terminateDeal`, `getArtistManager`, `getManagerRoster`,
  `getManagerSummary`.
- The real structural point, stated explicitly to avoid contradicting
  Phase 1's own "artist keeps 100%" claim: this is a *separate*
  economic relationship. Vvltvre Music itself still takes 0% of
  streaming revenue — a manager's commission comes out of the
  *artist's own share*, not Vvltvre's. `ownershipRetainedPercent: 100`
  on every release is unchanged and still true (copyright ownership
  and a manager's commission on income are two different real
  concepts — a musician can own 100% of their masters while still
  paying a manager a cut of what those masters earn).
- Wired into `reportStreamingRevenue`: with an active deal, a second
  real `transferFn` call pays the manager their commission out of the
  artist's share; without one, behavior is byte-for-byte unchanged
  from Phase 1.
- `getArtistSummary` gains `totalManagementCommissionPaid` and
  `netAfterManagement` as new, additive fields — existing fields
  (`totalStreamingRevenue`, `netEarnings`) keep their original Phase 1
  meaning so no existing caller silently gets a different number.

## Explicitly NOT in this task
Label-level deal shapes (advances, recoupment, per-release deals) — a
different real structure from a personal-manager commission.
Commission on anything other than streaming revenue. Multi-manager or
co-management arrangements.

## Verification approach
Plain-Node pass (22 checks): exclusivity, invalid-commission
rejection, a real split proven via the fake transfer's own call
arguments, an explicit regression check that an unmanaged artist's
behavior is unchanged from Phase 1, roster/summary aggregation with
hand-verified totals, the new summary fields hand-verified, and
termination correctly reverting the artist to 100%. Then a live pass
against the real, independently running V3 mock ledger: an artist
signed to a manager, a release reported with real revenue, V3's own
live balances confirmed exactly for both the artist and the manager,
then the deal terminated live and a follow-up report confirmed
reverting to the artist keeping 100% again.

## Done when
- The commission split is proven against a real, live V3 ledger for
  both parties (artist and manager), not just asserted in isolation.
- An unmanaged artist's behavior is provably unchanged from Phase 1.
- Termination genuinely reverts an artist's revenue to 100%, verified
  live.
