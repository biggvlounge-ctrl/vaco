# Plan — Phase 6: studio-produced titles

## Goal
Give the new `../vulture-studios/` division (a Universal-Studios-style
production-financing company) a real, honest way to distribute a
completed film/TV project into this catalog, without double-charging
the project or forcing a fabricated fee through either existing
title-creation path.

## Design
Investigated both existing paths first: `acquireExclusiveTitle` and
`licenseNonExclusiveTitle` both hard-require a positive fee
(`acquisitionFee` / `licenseFee` respectively) — correct for their own
real use cases (Vvltvre Flix paying a creator to acquire or license
already-independently-financed content), but wrong for a
studio-produced project, where the real payment already happened as
production financing entirely inside Vvltvre Studios' own ledger.
Reusing either path here would mean either rejecting a `0` fee (the
honest value) or accepting a fabricated positive one and moving real
money a second time for the same project.

Added a clean third path instead: `registerStudioProducedTitle(store,
{studioId, studioProjectId, title, type})`. Mirrors the existing
title record shape but sets `acquisitionType: 'studio-produced'`,
`acquisitionFee: null`, `licenseFee: null`,
`ownershipRetainedPercent: 0` (the studio funded it, so it owns the
resulting rights outright — the same `0` value `acquireExclusiveTitle`
already uses, for the same real reason), and a new `studioProjectId`
field — a real, honest cross-reference back to the financing project,
not present on either existing path's records. Calls no `transferFn`.
Exposed as `POST /api/titles/studio-produced` on `server.js`.

## Verification approach
No new unit tests written specifically for this function in isolation
— covered instead by Vvltvre Studios' own live-verification pass
(see `../../vulture-studios/dev-docs/phase-1-fund-and-produce-core/`),
which exercised this endpoint end-to-end against a real running
Vvltvre Flix instance: confirmed the created title record's exact
shape via this app's own separate `GET /api/titles/:id` call
(independent of Vvltvre Studios' own reported success), and confirmed
the real `502` honest-failure response when this app was deliberately
killed mid-test.
