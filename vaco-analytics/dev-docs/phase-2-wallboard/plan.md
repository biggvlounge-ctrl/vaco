# Plan — Phase 2: Wallboard display layer

## Goal
Second piece of `VACO_ANALYTICS_MANAGEMENT_DASHBOARD.md`: "the live
display layer... Geckoboard's real, proven 'TV wallboard' model —
always-on displays built specifically for keeping a team looking at
live key metrics throughout the day, refreshing continuously."

## Real constraint, same pattern as Phase 1
Geckoboard is a paid, hosted SaaS product — no account exists in this
environment, and provisioning one isn't something to fabricate. Built
a real, honest substitute instead: a self-hosted, dependency-free
static HTML page (`public/wallboard.html`) served directly by the same
Express app, polling the real `/api/dashboard` endpoint from Phase 1
every 5 seconds. It delivers the same *behavior* the doc actually asks
for (always-on, continuously refreshing, one screen showing every
app's live metrics) without pretending to be Geckoboard specifically.

## Design
- Pure HTML/CSS/vanilla JS, no build step, no external CDN dependency
  — `express.static()` serves it directly from `public/`, wired into
  `server.js` ahead of the API routes (confirmed via `curl` that this
  doesn't intercept `/api/*` — Express's static middleware only
  matches real files in `public/`, and there's no `api` file there).
- Polls `GET /api/dashboard` on a fixed interval (`REFRESH_MS =
  5000`), not a push subscription — no WebSocket/SSE endpoint exists
  in this codebase, and adding one wasn't asked for. A 5-second poll
  against an in-memory store handling this data volume is a reasonable
  default for "refreshing continuously," flagged as an interpretive
  choice (no specific interval given in the source doc).
  - On a failed fetch, the status line switches to an explicit
    "connection lost — retrying…" state rather than silently freezing
    on stale data — matters specifically for a wallboard meant to be
    glanced at across a room; a frozen-but-plausible-looking number is
    worse than an obviously-stale one.
- Renders one card per app (from `getEcosystemSnapshot()`'s existing
  shape), one row per metric showing `latest`/`avg`/`count` — reuses
  Phase 1's summary shape directly rather than requesting raw events
  and re-aggregating client-side.

## Explicitly NOT in this task
- No real Geckoboard integration — see constraint above.
- No historical charting/sparklines — only the current summary
  snapshot; Phase 1's `getMetrics()` (raw event history) exists but
  isn't rendered here.
- No per-app drill-down view (the source doc's own "drill-down from
  ecosystem view into any single app") — this phase is the ecosystem-
  wide overview only.
- No authentication on the wallboard route — same posture as Phase 1's
  ingest endpoint, an internal tool, not a public page.

## Done when
- `wallboard.html` is served correctly (200, `text/html`) from the
  running server.
- The page's polling logic correctly targets `/api/dashboard` and
  correctly reflects newly-ingested data — verified by ingesting a new
  metric and confirming the dashboard endpoint it depends on reflects
  it (the same endpoint Phase 1 already verified; the page is a thin
  render layer on top).
- Static file serving doesn't interfere with the existing `/api/*`
  routes, and a genuinely nonexistent path still 404s correctly.
- Regression: Phase 1's ingest/query/summary/dashboard endpoints all
  still work with `express.static()` added ahead of them.
