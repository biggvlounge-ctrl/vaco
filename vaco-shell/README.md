# VACO

The ecosystem's real app launcher and shared session host — named
directly after the ecosystem itself, per explicit instruction: this is
the one real front door to all of it. Lives on disk as `vaco-shell/`
(not bare `vaco/`, which is this whole monorepo's own root and would
collide with it) — built and originally referred to as "Shell" before
this rename; every "Shell" reference below is this same project.
Confirmed missing via a full ecosystem status audit: at least seven
other apps' own docs say some version of "trust Shell's unified
session" or "needs its own Shell tile/entry point" (VAGO_CLAUDE.md,
VXLLAGE_CLAUDE.md, VSAFE's own architecture doc) — none of them had
anywhere real to point at. This project is that real, missing piece.

**A real, deliberate choice: VACO does not reinvent auth.** A
working, shared session contract already existed before this project —
"Shield," mocked in `../venvs-mock-backend/server.js` and already
consumed live by both VDP and VENVS (each has its own `shieldAuth.js`
client). Building a second, competing session store here would have
been a real regression, not progress. This app instead becomes the
first real launcher UI *on top of* that existing service, proxying
`/api/session` straight through to Shield rather than inventing a new
contract — the same "reuse a real, already-proven service" posture
this session used for VACA (wired into VOKEN's existing endpoint) and
HVNTZ→Vavlt Stvdios (real injected client, not a new ledger).

**Three names, one real concept — "VACO" vs. "Shell" vs. "Shield"**:
this app is named VACO. The launcher/unified-session *idea* it
implements is what other apps' own docs call "Shell." The actual
session contract underneath is called "Shield" in the real, working
code. This is a real naming inconsistency across the source docs
themselves, not invented here — flagged directly rather than resolved
by silently picking one (the same kind of drift already documented
elsewhere this session for VACANCY→VACON-C and VOID MAGIC/Vvltvre
Touring & Tix).

Source docs found during the audit (no single "Shell" brief exists
anywhere — this project is built from what other apps' own docs say
they expect from it): `vago/VAGO_CLAUDE.md` ("needs its own entry
point in Vaco Shell," "Shell's shared agent layer"), `vxllage/VXLLAGE_CLAUDE.md`
("per Shell's unified-session decision"), `vsafe/UNIVERSAL_SAFETY_LAYER_VSAFE.md`
("identical to how V4 powers Shell's agent layer").

## Run
Three processes (a fourth, `v4-proxy`, is only needed for a real LLM
completion on top of the insight card — see "Not yet built"):
```
cd ../venvs-mock-backend && npm install && npm start   # localhost:8791 (the real Shield session backend)
cd ../vacon && npm install && npm start                 # localhost:8805 (the real agent-layer backend)
cd vaco-shell && npm install && npm start                # localhost:8789
```
Then open `http://localhost:8789` in a browser.

## Test
```
curl http://localhost:8789/api/health
curl http://localhost:8789/api/apps
curl -X POST http://localhost:8789/api/session -H "Content-Type: application/json" -d '{"userId":"demo-user"}'
curl "http://localhost:8789/api/insight?query=hunt%20sponsor%20budget"
```

## What's here
- `lib/registry.js` — the real app registry: 24 entries, each checked
  directly against that app's own `server.js`/README for its real dev
  port, not guessed. `url: null` for VACON-C specifically, since its
  own README says plainly it has real engine logic but zero HTTP
  routes yet — rendered as a disabled tile rather than a dead link.
- `lib/insight.js` — the real "shared agent layer" surface named
  directly in `VAGO_CLAUDE.md`'s own gap list ("needs a real call into
  Shell's shared agent layer (V4's Command Center / MIA), not a
  hardcoded string"). `getInsightCard` makes a real, live HTTP call
  into VACON's own `/api/route` — no hardcoded example string. If
  `invoke: true` is requested it also attempts a real completion via
  VACON's `/api/agents/:id/invoke`, surfacing a real, honest error
  (`completionError`) rather than a fabricated response when no
  `ANTHROPIC_API_KEY` is configured behind `v4-proxy` — confirmed live
  during testing: the real failure is v4-proxy refusing to start at
  all without one (`FATAL: ANTHROPIC_API_KEY is not set`), not
  something invented for this README.
- `server.js` — a real Express API (ESM): `/api/apps`, `/api/session`
  + `/api/session/:token`, `/api/register` + `/api/login` (all real
  proxies to Shield, not a new session store), `/api/insight`.
- `public/index.html` — a real, plain tile-launcher UI, no build step
  (same posture as `vaco-analytics`' own `wallboard.html`): log in via
  the real Shield session, see every app as a tile (consumer apps and
  infrastructure grouped separately), and an "Ask VACO" box that
  makes a real call through to VACON's routing engine. **Real password
  login (new)**: alongside the original claimed-userId quick login, a
  real Register/Log-in flow now calls Shield's own new `/api/shield/register`
  and `/api/shield/login` (`credentials.js`, real `scrypt` password
  verification) — the actual front door a human would sign up/log in
  through, not just an internal ecosystem SSO shortcut. Live-verified
  in a real browser: register, log out, log back in with the right
  password, real error on a wrong one.
- **The personal AI assistant — extracted into its own app, 15 Oct
  2026.** It was built here first (`lib/personalAssistant.js`, one
  profile per signed-in user, a real multi-turn chat relaying
  domain-specific questions to VACON's real specialists) because this
  was the only confirmed consumer. By direct decision it now lives in
  `../vaco-assistant/`, next to VACON and v4-proxy in the systems
  tier, so other apps can reach the same real assistant too — see
  that app's own README for the mechanism and how any app calls it.
  The five `/api/assistant/*` routes here are now a thin proxy:
  same relative paths, same frontend, but each one forwards the real
  request (Authorization header included) straight through to
  `vaco-assistant` and returns its real response. **Also fixed the
  same pass this was first built**: this page's own bespoke `api()`
  helper never attached the `Authorization: Bearer` header
  Shield-gated writes require — unlike every other app's shared
  `vaco-ui.js` kit, which already does this — so every existing
  authenticated write (merch orders, app installs) was silently
  401ing before that fix, not just the assistant routes.
- **The real SSO handoff, now genuinely closed on both ends**: once
  logged in, every tile's outbound link carries the current Shield
  session token as a `?shieldToken=` query param. VENVS and VDP (see
  their own READMEs) now both read that param on load, validate it
  against Shield's own real session-check endpoint, and adopt it as
  their own session — a real user clicking a tile lands already
  signed in as themselves, not a fresh, unrelated `demo-user`. Still
  one-directional (Shell → app, not a shared cookie domain or two-way
  sync) and per-app (each destination needed its own real change,
  which is now done for these two) — see "Not yet built" for what's
  still genuinely open.

## Verified
Live, with `venvs-mock-backend`, `vacon`, and `vaco-shell` all running
together: the real 24-app registry served and rendered as 24 tiles,
with VACON-C's own entry correctly shown disabled (no live server);
a real login round-tripping through this app's own `/api/session` into
Shield's real session store and back; the resulting Shield token
confirmed present on an outbound tile link exactly as
`?shieldToken=...`; a real insight-card query ("hunt sponsor budget")
confirmed routed by VACON's own engine to the correct real agent
(`leslie`), not a hardcoded response; the `invoke: true` path
confirmed attempting a real completion and surfacing a real, honest
failure once `v4-proxy` was confirmed (by running it directly, not
guessed) to refuse startup without a real `ANTHROPIC_API_KEY` — the
exact same "never fake an AI call" posture this session has held for
VACON's own MIA routing, HVNTZ's DREA, and every other agent gap.
Zero console/page errors across the whole pass.

The personal assistant proxy, separately: live end-to-end against
real running `shield`, `vacon`, `vaco-assistant` and `vaco-shell`
instances — a profile set through this app's own relative path and
confirmed landing in `vaco-assistant`'s own store when read back
directly from it; an anonymous caller refused with vaco-assistant's
real 401, forwarded faithfully rather than swallowed; the full
specialist-relay/general-chat behavior itself re-verified in
`vaco-assistant`'s own README and test suite, not re-tested here.

## Not yet built
- **Automatic cross-app data in the assistant's context** — per
  direct decision (carried over from when this lived here, unchanged
  by the extraction), `vaco-assistant` relays to VACON's specialists
  and personalizes on what a user explicitly tells it, but does not
  automatically pull live data from other apps (purchases from VENVS,
  bookings from VACAY, etc.) into context. Real, later work if wanted,
  not assumed here.
- Real cross-origin SSO for apps beyond VDP/VENVS — the `?shieldToken=`
  handoff itself is real, live-verified, and now genuinely read by
  VDP and VENVS (real browser pass: a real Shield session for
  `real-handoff-user-1`, not `demo-user`, landed correctly in both,
  with the token scrubbed from the visible URL afterward). Every
  other app now has a frontend, and each one adopts a `?shieldToken=`
  handed over on the link — `vaco-ui.js`'s `restoreSession()` does it
  once for every app rather than each page reimplementing it. A shared cookie domain or postMessage-based
  handoff would still be the real fix for true silent (no query-param)
  SSO; neither exists in this environment (no real custom
  domains).
- A persistent app registry — `lib/registry.js` is a real, static,
  in-process list, same posture as this session's other "no database
  needed yet" calls. Adding a new app means adding one real entry, not
  registering through an API.
- A real LLM completion behind the insight card — confirmed live as
  blocked on a real `ANTHROPIC_API_KEY`, which isn't configured
  anywhere in this environment. The real routing call it's built on
  works today; the completion layer is a real, separate gap already
  documented identically in VACON's own README for MIA.
- Auth/rate-limiting on this app's own endpoints — same posture as VACON
  and the rest of this prototype-stage ecosystem (no user accounts
  exist yet beyond the shared Shield session).
- A visible representation of VACON-C inside the launcher beyond a
  disabled tile — once VACON-C gets a real API layer (see its own
  README's own flagged, ready-to-do gap), its tile here should be
  updated to a real `url`, not rebuilt from scratch.

## Frontend coverage pass (31 Oct 2026)

A fresh audit against `server.js` found `public/index.html` already a
real, extensive client — identity/session (`/api/session`,
`/api/register`, `/api/login`), the App Store, Merch, Library,
Ecosystem launcher, Insight, the personal assistant proxy (including
its call flow), and Explore all make real calls already, each checked
against its own route and `lib/*.js` function rather than assumed.
What was genuinely missing: two real read routes with no frontend at
all, and one real write route the Library never called.

- **Earnings tab** — `GET /api/store/publishers/:publisherId`
  (App Store publisher payouts: listings, gross VCoin, store fees
  withheld, net to publisher) and `GET /api/merch/brands/:appBrandId/earnings`
  (merch brand payouts: orders, units sold, gross VCoin, fulfilment
  cost, brand payout, platform fees) had zero frontend exposure. Both
  are real, unauthenticated reads — there is no publisher or brand
  account system anywhere in this ecosystem (`lib/appStore.js`,
  `lib/merchStore.js` — a listing's `publisherId` and a merch
  product's `appBrandId` are plain strings, not logins) — so this is a
  direct id-in/numbers-out lookup, with the page saying plainly that
  the lookup itself is public, rather than a dashboard pretending to
  sit behind a sign-in that was never built. The brand dropdown is
  populated from the same `/api/merch/brands` list the Merch tab
  already fetches, so the two tabs cannot disagree about which brands
  exist. Live-verified against a running `vaco-shell` + `shield`: both
  routes answer with the real shapes this tab renders, including the
  real all-zero response for a publisher/brand id that owns nothing.
- **Library: Uninstall** — `POST /api/store/uninstall` had no
  frontend. `lib/appStore.js`'s own rule, held by
  `test/appStore.test.js`'s own "uninstalling is not refunding" case,
  is that uninstalling is bookkeeping only: access and any money paid
  both survive it. The new "Uninstall" button on an owned, accessible
  Library entry calls the real route and, once `uninstalledAt` comes
  back set, the card shows an "Uninstalled" badge *alongside* "Active"
  rather than hiding the entry or implying access was revoked — the
  honest reflection of what the backend actually does, confirmed live
  (install → uninstall → re-read the library: `access.allowed` stays
  `true` throughout).

**Also fixed in the same pass, found while booting a clean instance to
verify the above**: `lib/seedStore.js` had no pricing decision for
`vaco-assistant` or `cvllex`, so `seedStore()` threw on any fresh store
(no existing `data/store.json`) and the whole app refused every
request — caught by this app's own `scripts/test/store-pricing.test.mjs`,
which was already failing before this pass. `vaco-assistant` is now
priced `infrastructure` (a service other apps call, same bucket as
`v4-proxy`/`v4-search`); `cvllex` is priced `transacts` (it charges
real customers for real physical runs on its own routes, same bucket
as `voken`/`vulture-music`).

**Deliberately left for later, and why:**
- `GET /api/apps/:id`, `GET /api/store/listings/:appId`,
  `GET /api/bundles(/:name)`, `GET /api/constellations(/:name)`,
  `GET /api/merch/products/:productId`, `GET /api/merch/orders/:id`,
  `GET /api/store/access/:userId/:appId` are real but low-value as
  dedicated frontend surfaces: each answers a strict subset of data the
  page already renders from a list endpoint it calls (`/api/apps`,
  `/api/store/listings`, `/api/merch/products`, `/api/store/library`),
  so a one-off detail view would mostly restate what is already on
  screen.
- `POST /api/store/listings`, `DELETE /api/store/listings/:appId`,
  `POST /api/merch/products`, `DELETE /api/merch/products/:productId`,
  `POST /api/merch/orders/:id/submit`, `POST /api/merch/orders/:id/advance`,
  `POST /api/merch/products/:productId/physical-run` all require
  `requireCallingService()` — a trusted-service credential, not a
  Shield session. This frontend has no login for one, so a publisher-
  admin UI here would have to fake holding a credential it does not
  have; those stay real, working backend-only capabilities instead.
- `POST /api/store/refund` requires `requireOperator('vaco-shell:reversal')`
  — a separate vaco-operator credential this page's own session cannot
  satisfy. The Library's existing "Refund" button calls it anyway (pre-
  existing, not added this pass) and will 403 against a real deployment
  with that guard enforced; flagged here rather than silently left to be
  discovered, since fixing it is either a real operator-credential UI
  (this page has none) or a product decision about whether a user's own
  refund request should route through one, not a frontend gap to close
  by guessing.
