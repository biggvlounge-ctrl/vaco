# Tasks — Phase 2: Wallboard display layer

- [x] Create `public/wallboard.html`: dependency-free, polls
      `/api/dashboard` every 5s, renders per-app cards with
      `latest`/`avg`/`count` per metric, shows an explicit
      "connection lost" state on fetch failure.
- [x] Wire `server.js`: `express.static()` serving `public/`, added
      ahead of the API routes.
- [x] Verify against a real running server (`curl`, deleted no test
      files — nothing to delete, this ran directly against the live
      HTTP server same as Phase 1):
      - `GET /wallboard.html` returns 200 with
        `content-type: text/html`.
      - Response body contains the expected page title, the
        `REFRESH_MS` polling constant, and a reference to
        `/api/dashboard` — confirms the right file is actually being
        served, not a stale/empty response.
      - Ingesting a new metric (`VOKEN` / `trading_activity`) and then
        querying `/api/dashboard` directly shows it — the same
        endpoint the wallboard's JS polls, confirming the data path
        the page depends on is live.
      - A genuinely nonexistent path (`/does-not-exist.html`) still
        404s — confirms `express.static()` isn't swallowing unmatched
        requests.
      - Server shut down cleanly; confirmed via a follow-up `curl`
        that the port stopped accepting connections.
- [x] Commit as its own change.

## Next
Phase 3 (Proactive Intelligence Layer, from
`PROACTIVE_ECOSYSTEM_INTELLIGENCE_LAYER.md`) is next, not started
here. Historical charting and the per-app drill-down view are
believable next steps for this wallboard specifically, also not done.
