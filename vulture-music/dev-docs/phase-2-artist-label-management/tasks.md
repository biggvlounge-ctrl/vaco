# Tasks — Phase 2: Artist/Label Management

- [x] `lib/managers.js` — deal statuses, `DEFAULT_COMMISSION_PERCENT`,
      `signArtist` (exclusive), `getDeal`, `terminateDeal`,
      `getArtistManager`, `getManagerRoster`, `getManagerSummary`.
- [x] Wire `lib/releases.js`'s `reportStreamingRevenue` to split payout
      when an active deal exists; unchanged behavior with none.
- [x] Add `totalManagementCommissionPaid`/`netAfterManagement` to
      `getArtistSummary`, additive only.
- [x] `lib/store.js` — `managementDeals`, `commissionPayouts`.
- [x] `server.js` — roster sign/list, manager summary, artist-manager
      lookup, deal termination.
- [x] Verify in plain Node (22 checks): exclusivity, invalid
      commission, a real split proven via transfer-call arguments, an
      explicit unmanaged-artist regression check against Phase 1,
      roster/summary aggregation with hand-verified totals, new
      summary fields hand-verified, termination reverting to 100%.
- [x] Verify live against `venvs-mock-backend`'s real running V3
      ledger: artist signed to a manager at 17.5%, a release
      submitted/advanced/reported with real revenue, both the artist's
      and manager's real V3 balances confirmed exactly, deal
      terminated live, a follow-up report confirmed reverting the
      artist to 100%.
- [x] Shut down test server; confirmed via port check.
- [x] Update `README.md`, this plan/tasks pair.

## Next
Label-level deal shapes (advances, recoupment, per-release deals).
Commission on income streams beyond streaming revenue. Vvltvre Flix
as the next Vvltvre division.
