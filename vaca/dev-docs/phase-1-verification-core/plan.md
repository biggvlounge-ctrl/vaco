# Plan — Phase 1: Verification Core

## Goal
Build VACA as its own real, standalone, app-agnostic service — the
third of V3's three real, distinct components (VCoin, VASH, VACA),
confirmed missing entirely from the codebase despite being named
across VSAFE's and VOKEN's own docs ("V3 (AI), DREAMS (ads), and VACA
(identity)"; VOKEN's "VACA-verified" provenance/authenticity).
Confirmed directly, before writing any code, that VOKEN's own
`POST /api/card/:id/value-score` trusted a caller-supplied
`authenticityGrade` with nothing behind it — the actual gap this
service closes.

## Design
- `lib/verifications.js`: a real `Verification { id, subjectType,
  subjectId, claimType, evidence, status, grade, reviewedBy,
  reviewNotes, reviewedAt, createdAt }`. `claimType` is deliberately
  free-form (the same real design choice `world-layer/propagation.js`
  already made for its own `eventType`) rather than a fixed enum,
  since VACA is meant to verify claims broadly (identity, asset
  authenticity, ownership provenance), not just VOKEN's one use case.
- `grade` (the real A/B/C scale VOKEN's `valueAlgorithm.js` already
  consumes) is only meaningful for `claimType === 'authenticity'`;
  every other claim type resolves plain verified/rejected with no
  grade — a letter grade doesn't mean anything for "is this person who
  they say they are."
- Grading is a real reviewer decision made at `approveVerification`
  time, not auto-computed from free-text evidence — authenticity
  attestation is fundamentally a human/institutional judgment call in
  every real comparable (KYC review, provenance authentication
  houses), the same posture VSAFE's own `idVerification.js` already
  takes.
- `getAuthenticityGrade(store, subjectType, subjectId)`: the real
  convenience query other apps actually call — the most recent
  *verified* authenticity claim's grade, or `null`. Unverified,
  rejected, and no-claim-at-all all honestly resolve to the same
  answer, not a fabricated default; the "unverified defaults to grade
  C" interpretive choice lives in the *caller* (VOKEN), not here,
  since that's a VOKEN-specific policy decision, not a universal VACA
  one.

## Real cross-app integration: VOKEN
`voken/server.js`'s `POST /api/card/:id/value-score` now calls
`fetchAuthenticityGrade(cardId)` — a real, live HTTP call to VACA's
`GET /api/authenticity-grade/voken-card/:cardId` — and uses that grade
unconditionally, ignoring whatever `authenticityGrade` the request
body might contain. A card VACA has no verified claim for resolves to
grade `'C'`, a real, deliberate, flagged default (unverified is
treated as the least-privileged tier, never silently promoted).

## Explicitly NOT in this task
- Real document/selfie/liveness identity verification infrastructure
  — VSAFE's `idVerification.js` already owns that specific real-world-
  safety concern; VACA's `identity` claim type is for a different
  real purpose (asset/account authenticity attestation for commerce
  and trading contexts), not a duplicate.
- Any UI/reviewer dashboard for actually working verification queues
  — this phase is the real API and data model only.
- Wiring VACA into VEX (VOKEN's own trading floor) or anywhere else
  "VACA-verified" is referenced — VOKEN's value-score endpoint is the
  one, real, concrete integration point this phase proves; others are
  real, later work.

## Verification approach
Plain-Node pass first (throwaway `.cjs` script, deleted after — 23
checks): submission validation; the real authenticity-claim happy path
(pending → grade required to approve → invalid grade rejected → real
grade recorded); double-approval rejected; non-authenticity claims
correctly reject a supplied grade and approve cleanly without one;
rejection requires a reason and is idempotent-safe (can't reject
twice); per-subject listing and isolation; a totally unclaimed subject
resolves honestly to `null`, not an error; a second, later authenticity
claim on the same subject correctly supersedes the first in
`getAuthenticityGrade`. Then a live pass: VACA and VOKEN running
independently — a real card minted, its value-score computed *before*
any VACA verification (confirmed grade C / authenticityScore 40), a
real VACA verification submitted and approved with grade A, the same
card's value-score recomputed live (confirmed grade A /
authenticityScore 100, `combinedRealValueScore` genuinely changed) —
and, critically, a **second** fresh card's value-score request that
lies with `"authenticityGrade":"A"` in the request body confirmed to
still resolve to grade C, proving the endpoint now genuinely ignores
client-supplied grades entirely.

## Done when
- VACA's own verification lifecycle is proven correct in isolation.
- VOKEN's value-score endpoint is proven, live, to have switched from
  trusting client input to genuinely calling VACA as the real
  authority — including the negative case (a lying client is still
  overridden).
