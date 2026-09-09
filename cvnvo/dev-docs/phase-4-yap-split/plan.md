# Plan — Phase 4: Yap Split (pointer)

Yap was split out of this codebase into its own standalone app,
`../../yap/`, per explicit instruction — the same real split just
applied to CHOPZ/CHOPZ SHOP. The real plan, tasks, and verification
record for that split live in `../../yap/dev-docs/phase-1-standalone-split/`,
not duplicated here.

What changed in this codebase specifically: `lib/yap.js` deleted,
`yapReports`/`nextYapReportId` removed from `lib/store.js`, the
`lib/yap` require and all four `/api/yap/*` endpoints removed from
`server.js`. CVNVO's remaining endpoints (profiles, compatibility,
matching, First Date Safety via VSAFE, communication controls, message
screening) are unaffected — reconfirmed live after the removal.
