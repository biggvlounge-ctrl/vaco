# Tasks — Phase 4: label-level deal shapes

- [x] Investigate: confirm no VACO doc specifies label-deal terms;
      ground the design in real, standard record-industry mechanics
      (advance, recoupment, post-recoupment split).
- [x] `lib/labelDeals.js` — NEW. `signLabelDeal`, `getLabelDeal`,
      `terminateLabelDeal`, `getActiveLabelDealForRelease`,
      `applyLabelDeal`. Deliberately no `require('./releases')` to
      avoid a circular dependency.
- [x] `lib/releases.js` — `reportStreamingRevenue` now applies an
      active label deal to the primary artist's share before
      management commission; header comment updated.
- [x] `lib/store.js` — added `labelDeals`/`nextLabelDealId`.
- [x] `server.js` — wired `POST /api/label-deals`,
      `GET /api/label-deals/:id`, `POST /api/label-deals/:id/terminate`;
      exposed `labelDealTypes`/`defaultLabelSharePercent` on
      `/api/health`.
- [x] 9 plain-Node checks — all passing.
- [x] Live pass against `venvs-mock-backend` + `vulture-music`: found
      a real bug (unconditional zero-amount `transferFn` call when a
      report is fully absorbed by recoupment) — V3's own real ledger
      rejected it, crashing the report mid-transaction after the
      label's own recoupment payment had already committed.
- [x] Fixed: skip the artist/collaborator transfer when `netShare` is
      exactly `0`.
- [x] Added plain-Node regression check #10 for the exact scenario;
      tightened the test suite's fake ledger to match V3's real
      strictness (reject non-positive amounts) so this class of bug
      can't hide again.
- [x] Re-ran the full 10-check plain-Node suite — all passing.
- [x] Re-ran the live pass against a freshly restarted server — the
      same scenario now returns `HTTP 201` with `netShare: 0`, no
      crash; confirmed the full two-report recoupment/split sequence
      and blanket-exclusivity/termination rejections all correct over
      real HTTP.
- [x] Shut down all test servers (by PID, after discovering `pkill -f`
      wasn't matching bare `node server.js` processes); confirmed via
      process list.
- [x] Update `README.md` (What's here, Verified, Not yet built).
- [x] Write this plan/tasks pair.

## Next
Cross-collateralization and co-writer-level label deals remain real,
flagged gaps.
