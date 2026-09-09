# Tasks — Phase 1: Real App Launcher + Shared Session Host

- [x] Investigate: grep every `*.md` doc (not just READMEs) for
      "Shell"; read `shieldAuth.js` and `venvs-mock-backend/server.js`
      directly to confirm a real session contract ("Shield") already
      exists and is already consumed live by VDP/VENVS.
- [x] `lib/registry.js` — 24 real app entries, each `url` checked
      against that app's own real `PORT || <number>` in its own
      `server.js`; VACON-C entered with `url: null` per its own
      README's own honest gap.
- [x] `lib/insight.js` — `getInsightCard` wraps VACON's real
      `/api/route`; optional `invoke: true` attempts a real completion
      via VACON's `/api/agents/:id/invoke`, surfacing a real error
      rather than a fabricated response on failure.
- [x] `server.js` — `/api/apps`, `/api/apps/:id`, `/api/session` +
      `/api/session/:token` (real proxies to Shield), `/api/insight`.
- [x] `public/index.html` — plain tile-launcher UI (no build step):
      login, tile grid split into consumer/infrastructure, the
      `?shieldToken=` SSO handoff on outbound links, an "Ask Shell"
      insight box.
- [x] `npm install`.
- [x] Verify live with `venvs-mock-backend` + `vacon` + `shell` all
      running together: registry served (24 apps), real login via
      Shield, real insight-card routing confirmed against VACON.
- [x] Verify live in a real browser (Playwright): 24 tiles rendered,
      exactly 1 correctly disabled (VACON-C), login succeeds, the
      Shield token confirmed present on a live tile's `href`, a real
      insight query confirmed routed to the correct agent, zero
      console/page errors. One test-script bug found and fixed along
      the way (not an app bug): the wait condition matched the
      "Routing via VACON..." loading placeholder instead of the real
      result.
- [x] Confirmed v4-proxy's own real failure mode directly (ran it in
      the foreground rather than assuming): it refuses to start at all
      without a real `ANTHROPIC_API_KEY`, matching what the
      `invoke: true` path's `completionError` should say.
- [x] Shut down all test servers; confirmed via port checks.
- [x] Write `README.md`, this plan/tasks pair.

## Next
Migrating VDP/VENVS's own `shieldAuth.js` clients to actually read the
`?shieldToken=` handoff — a real, separate change to already-tested
apps. VACON-C's registry entry gets a real `url` once that project
gets an HTTP layer of its own (already flagged, ready to do, in its
own README).
