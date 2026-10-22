# Vaco Assistant

One personal AI assistant per signed-in user, personalized to how they
describe themselves, with a real connection into VACON's own 14 named
executive agents for anything domain-specific.

**Extracted out of `vaco-shell` on 15 Oct 2026, by direct decision.**
It was built into vaco-shell first because that was the only confirmed
consumer. The whole point of an assistant that "connects to all of
Vaco's and Vacon's AI system" is that it has to be reachable from more
than one dashboard — so this sits next to VACON and v4-proxy in the
systems tier (same shape as VACA and Shield sitting next to V3), and
`vaco-shell` is its first caller now, not its only one.

Port **8828**, parent **V4**.

```bash
npm install
npm start
curl http://localhost:8828/api/health
npm test
```

## What it does

Every message is routed through VACON's real keyword router first. A
real domain match (security, finance, legal, dating, travel,
logistics, advertising, production, market research, or music
discovery/creator tools/distribution) is handed to the VACON
specialist who actually owns it — "connects to Vacon's AI system" is
this, literally, not a metaphor. Anything general is answered by a
real v4-proxy completion carrying this one user's own name/tone/
lifestyle in its system prompt: the same question gets a different
system prompt for every user, grounded in what they actually told it
about themselves, never a generic chatbot prompt shared by everyone.

Never fabricates a reply either way — a real completion failure (no
`ANTHROPIC_API_KEY` behind v4-proxy, v4-proxy or VACON unreachable)
surfaces as a real error.

## Muse-style agentic features — what's real, and the one real gap

Per a direct instruction to check this app against Meta's own Muse
(a personal AI agent that pays real bills — even ones outside its own
ecosystem — via one-time-use Link by Stripe cards, inside a dedicated
secure browser VM, plus booking appointments and cancelling
subscriptions), added 22 Oct 2026:

- **Real**: `lib/assistantTasks.js` — a goal/task framework, real
  user-maintained subscription tracking with real cancellation-request
  status, real reminders, and real proactive suggestions pulled
  straight from a person's own stored data (no model call).
- **The one gap, named rather than faked**: this ecosystem has *no*
  real external money-movement infrastructure anywhere (`v3/VASH_BAAS_
  VCOIN_ADVANCEMENT.md` says so in its own words — no bank account, no
  card issuance, no payment rail). A goal that genuinely needs one
  (`pay-bill`, `book-appointment`, `make-purchase`,
  `cancel-external-subscription`) starts `blocked-no-connector` with
  the real reason attached, and `sendMessage` intercepts a payment/
  booking/purchase-sounding message *before* it can ever reach a
  completion that might hallucinate "I paid it" — the single most
  safety-critical check in `lib/personalAssistant.js`.
- Browser automation itself (what actually lets Muse act on arbitrary
  external sites) is a separate, large, security-sensitive engineering
  effort and is not attempted here.

## API

| Route | Guard | What it does |
|---|---|---|
| `GET /api/assistant/tones` | open | The four tone options. |
| `GET /api/assistant/profile/:userId` | `requireParamActor('userId')` | This user's own profile, or the honest default if they never set one. |
| `POST /api/assistant/profile` | `requireActor('userId')` | Set name/tone/lifestyle. |
| `GET /api/assistant/history/:userId` | `requireParamActor('userId')` | Real multi-turn chat history. |
| `POST /api/assistant/chat` | `requireActor('userId')` | Send a message, get the real routed-or-personalized reply (or an honest connector-unavailable reply for a payment/booking/purchase-sounding message). |
| `GET /api/assistant/goals/:userId` | `requireParamActor('userId')` | This user's own goals. |
| `POST /api/assistant/goals` | `requireActor('userId')` | Create a goal — starts `blocked-no-connector` automatically if its `kind` needs a real connector. |
| `POST /api/assistant/goals/:id/complete` | own-record check | Mark a non-blocked goal done. Refuses a blocked one. |
| `POST /api/assistant/goals/:id/cancel` | own-record check | Cancel a goal. |
| `GET /api/assistant/subscriptions/:userId` | `requireParamActor('userId')` | This user's own tracked subscriptions. |
| `POST /api/assistant/subscriptions` | `requireActor('userId')` | Add a subscription to track (user-entered — not auto-discovered). |
| `POST /api/assistant/subscriptions/:id/request-cancellation` | own-record check | Flags it for cancellation and opens a real blocked goal — does not cancel anything. |
| `POST /api/assistant/reminders` | `requireActor('userId')` | Create a reminder. |
| `GET /api/assistant/reminders/:userId/due` | `requireParamActor('userId')` | This user's own due, unacknowledged reminders. |
| `POST /api/assistant/reminders/:id/acknowledge` | own-record check | Acknowledge a reminder. |
| `GET /api/assistant/suggestions/:userId` | `requireParamActor('userId')` | Real proactive suggestions — due reminders, blocked goals, pending cancellations. |

`requireParamActor`/`requireActor` both demand a real, live Shield
session belonging to the named user — nobody else's profile or chat
history is readable, including another signed-in user. The goal/
subscription/reminder mutation routes above take an id in the path
rather than a userId, so ownership is checked the same real way
`requireOwnCall` already checks a call — against the record's own
stored `userId`, not a route parameter that isn't there.

## How another app reaches it

Don't call this app directly from a browser with the user's own
Shield Bearer token — `vaco-ui.js`'s `VACO.api` deliberately only
attaches that token to same-origin (relative) requests, on purpose
("a session token is not something to hand out by default"). The
correct shape, and the one `vaco-shell/server.js` itself uses: proxy
through your own app's server, forwarding the real
`Authorization` header you were called with —

```js
const ASSISTANT_API_URL = process.env.ASSISTANT_API_URL || 'http://localhost:8828';

app.post('/api/assistant/chat', (req, res) => {
  fetch(`${ASSISTANT_API_URL}/api/assistant/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization },
    body: JSON.stringify(req.body),
  })
    .then((r) => r.json().then((body) => res.status(r.status).json(body)))
    .catch((err) => res.status(502).json({ error: err.message }));
});
```

Your own frontend then calls your own relative path exactly as it
would any other route, and `VACO.api` attaches the token automatically
— no special handling needed on the frontend side. This is the exact
pattern `vulture-pods` already uses to reach `vulture-music` and
`vavlt-stvdios`.

## What it already has

- **Persistence** — `lib/persistence.js`, synced from the canonical
  copy. `durable(store)` commits to disk before responding on 2xx
  mutating requests.
- **Auth** — `lib/shieldAuth.cjs`, synced. `requireActor(field)`/
  `requireParamActor(field)` prove a live Shield session *and* that it
  belongs to the acting user. See `dev-docs/AUTH_HARDENING.md`.
- **Design system** — `public/vaco-design.css` + `vaco-ui.js`, synced.
  Accent `#8674dc`, registered in `vaco-shell/VACO_PALETTE_REGISTER.md`
  at hue 250°, between Shield and Vavlt Stvdios.
- **Registered** — the ecosystem manifest, the shell registry, both
  sync scripts, and the generated `docker-compose.yml` and nginx
  config.
- **A frontend of its own** — `public/index.html`, the same
  profile-and-chat UI that used to live in vaco-shell's "Assistant"
  tab, now served directly by this app too.

## Not yet built

- **Automatic cross-app data in the assistant's context** — per direct
  decision, the assistant relays to VACON's specialists and
  personalizes on what a user explicitly tells it, but does not
  automatically pull live data from other apps (purchases from VENVS,
  bookings from VACAY, etc.) into context. Real, later work if wanted,
  not assumed here. Carried over unchanged from when this lived in
  vaco-shell.
