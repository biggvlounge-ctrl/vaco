# Plan — Phase 4: Ad Content Review Workflow, Screen Analytics, cross-phase regression

## Goal
After Phase 3, the README's "Not yet built" list had narrowed to items
that are genuinely out of scope (drone routing, physical hardware,
real AI agents, third-party integrations, a CHOPZ system that doesn't
exist yet) plus two items that are real, concretely-scoped, and still
software: an ad **submission/content-review workflow** around the
existing 4-tier ad pricing (`lib/adPricing.js`, Phase 1), and a
dedicated **screen analytics** rollup. Both close out the genuinely
buildable slice of the source docs. This phase also runs a full
regression pass exercising all nine `hvntz` modules together against
one shared store, mirroring this session's established pattern of a
final cross-phase regression before declaring a project ready.

## Design
- `lib/adReview.js`: a real, minimal `pending -> approved/rejected`
  state machine (`submitAdContent`, `reviewAdSubmission`). No review
  process, reviewer role, or approval criteria is specified in any
  source doc — this is the real, flagged, minimal shape: content is
  pending until explicitly approved or rejected, and only approved
  content can run. `submitAdContent` requires a `screen`-type location
  (ad tiers are screen-scoped per the source doc) and a `qrCodeUrl`,
  since every ad tier requires a QR code per `adPricing.js`.
  `runAdSubmission` is the real payout event — it requires `approved`
  status and routes through Phase 1's own `recordRevenueEvent()` with
  `eventType: 'screen-ad'`, closing the loop between ad pricing/review
  and actual revenue rather than leaving review as a disconnected
  moderation queue.
- `lib/revenueStack.js`: `recordRevenueEvent`'s stored event now
  includes `payerId` (it was computed and used for the transfer but
  never persisted on the event record) — a real, minimal data-model
  completeness fix needed for `screenAnalytics.js`'s distinct-advertiser
  count; doesn't change any existing behavior since nothing previously
  read `event.payerId`.
- `lib/screenAnalytics.js`: `getScreenAnalytics(store, businessId)` — a
  real, deterministic aggregation (no invented formula) over a
  business's existing `screen`-type locations: total revenue, revenue
  broken down by event type, distinct advertiser count, and ad
  submission counts by status. No source doc describes a dedicated
  analytics view; this is a straightforward rollup over data these
  modules already produce, flagged as scoped strictly to
  `locationType === 'screen'`.
- `server.js`: 5 new endpoints (`POST /api/ad-submission`,
  `GET /api/ad-submission/:id`, `POST /api/ad-submission/:id/review`,
  `GET /api/ad-submissions`, `POST /api/ad-submission/:id/run`,
  `GET /api/screen-analytics/:businessId`).

## Cross-phase regression
A second script section, run against the *same* shared store as the
Phase 4 checks (not a fresh one), exercises all nine modules together
on a fresh set of businesses: participation feeding Digital Twin level,
a DREA placement rule still enforced correctly after other modules
have mutated the store, real neighbor-program matching and CVNVO
placement, a hunt check-in whose revenue lands correctly in the same
Franchise List as a manually-recorded event, ad pricing computing
correctly independent of everything else, the Explore Page surfacing
both a hunt and a neighbor match together in one correctly-sorted feed,
and screen analytics correctly returning real zeroed data (not an
error) for a business with no screen locations.

## Explicitly NOT in this task
- No actual content moderation AI or automated approval — review is a
  manual, explicit `approved: boolean` call, matching this project's
  consistent "no fake AI" stance (DREA/HVNTER are both real only as
  their deterministic underlying logic, never as an actual model call).
- No analytics time-windowing (daily/weekly breakdowns) — a source doc
  never specifies a reporting period; this is an all-time rollup.
- No ad content storage/rendering (`content` is stored as an opaque
  string) — actual creative asset handling is out of scope.

## Verification approach
Plain-Node pass first (throwaway `.cjs` script, deleted after — 20
checks: 12 for Phase 4's two new modules, 8 for the cross-phase
regression). Then a live pass: both `hvntz/server.js` and
`venvs-mock-backend` running together, the full submit → reject-early
→ approve → run flow through actual HTTP calls, with the resulting
payout **independently confirmed against the mock V3 ledger**, and
`GET /api/screen-analytics/:businessId` checked against the same live
data.

## Done when
- `submitAdContent` validates a screen-type location and a QR code URL.
- `runAdSubmission` is correctly gated on `approved` status only —
  rejects both `pending` and `rejected` submissions.
- `reviewAdSubmission` enforces single-review (can't re-review an
  already-reviewed submission).
- `getScreenAnalytics` correctly scopes to screen-type locations only,
  correctly aggregates revenue by event type, and correctly counts
  distinct advertisers and ad-submission statuses; returns real zeroed
  data (not an error) for a business with no screen locations.
- The cross-phase regression confirms all nine modules compose
  correctly against one shared store with no interference.
- Live: the full ad review + run flow through the real HTTP API
  produces a ledger change independently confirmed against the mock
  ledger, matching the plain-Node pass exactly.
