# V4 — Orientation Brief

V4 is the AI operating system layer of the VACO ecosystem — the
intelligence surface above every other app. Rather than each app
having its own separate assistant, V4 presents a single Agent Command
Center: a hierarchy of named AI agents (VACON → MIA → agents) scoped
to different domains or sibling apps.

This repo is a mobile-first frontend prototype, single-file
(V4Prototype, ~1,600 lines). Unlike most other VACO prototypes, this
one has real, working AI — the agent chat and call flows make live
calls to the Anthropic API. Everything else is mocked sample data.

App boundaries: V4 owns login, home dashboard, Agent Command Center,
and a set of ecosystem "preview" screens (Wallet, VOKEN, Marketplace,
Hunts, Predictions, Automation, Timeline, Messages, Business Search)
standing in for what VASH, VOKEN, HVNTZ, VACAY, VOID, Convo, and
DREAMS will eventually provide natively. These preview screens are NOT
V4 features long-term — treat every non-agent screen as "V4's window
into another app," not a V4-owned feature to build out independently.

Tech stack: React 18, hooks only, no router (single screen state
string), lucide-react icons. Mixed styling — earlier screens use
inline style objects, Agent Command Center uses Tailwind classNames
(happened because Command Center was built in a later pass — needs
reconciling).

The Agent hierarchy — the actual core of this app: ten agents across
three tiers. Business Executive — QVAN (Security & Fraud), Mr. Leslie
(Financial), Mr. Deskins (Legal & Compliance). User-Facing — Kevin
(Dating/Convo), Kay (Travel/VACAY), Gibson (Routing/VOID), DREA (Ad
Intelligence/DREAMS). Vvltvre Media — Ava (Discovery), Autumn (Creator
Tools), Jacobi (Distribution). Governance: every agent reports upward
through MIA (intelligence aggregation), which reports to VACON
(ecosystem's master governance/routing layer). This VACON → MIA →
agent structure is canonical — reuse it, don't redefine it.

callAgent() — real API integration: does a real fetch to
api.anthropic.com/v1/messages with the agent's system prompt and
message history. Genuine, working AI integration, not mocked.
Production gap: no API key attached in this code — correct for the
sandbox context, but a real deployment needs a thin backend proxy
holding the key server-side. Don't ship the client-side fetch as-is.

Orchestration view: VACON node → MIA node → three labeled rows
(Business Executive/User-Facing/Vvltvre Media), each a scrollable rail
of tappable agent avatars. Agent grid: flat 2-column grid, same tap-
to-open behavior. Agent interaction flow — three-phase state machine:
ringing (FaceTime-style incoming call), call (full call UI, live
timer, caption bubble, mute toggle visual-only, inline text input
wired to real callAgent()), chat (standard thread UI, also wired to
real callAgent()). Both call and chat phases hit the real API — same
underlying conversation, two UI presentations.

Cross-device surfaces: AgentTVPlay (mock "agent on screen" panel, list
of user-facing agents), AgentCarPlay (mock "Listening…" waveform
centered on Gibson, 4 static capability chips). Both are visual
mockups of the surface, but correctly route into the same real agent-
call machinery once tapped through.

Other screens (all mocked, ecosystem-preview): Login (any email/
password "works," no real account), Home (search bar doesn't actually
search), Business Search (illustrative static map), Notifications/
Messages (static, call buttons visual-only, independent of real agent
call flow), Profile, Hunts (mock HVNTZ-style list), Admin Dashboard
(static stats), Predictions (4 static canned cards), Wallet (static
VASH-style balance), VOKEN (static list), Marketplace (placeholder
rows), Automation (real local state — toggles flip but nothing
downstream executes), Timeline (static log).

Design system: background #14141A outer / #0A0E17 Command Center,
card surfaces #1E1E27 / #121826, primary accent indigo #5B5FEF /
#8B8FFF, per-tier agent colors — Business Executive #E8927C (coral),
User-Facing #A78BFA (violet), Vvltvre Media #7DD3E8 (cyan).

Explicit gaps, priority order: (0) backend proxy for the Anthropic API
key — highest priority; (1) reconcile the two styling systems; (2)
split the single file; (3) resolve the app-boundary question (Wallet/
VOKEN/Hunts/Messages/Marketplace stay as V4 "preview" screens or get
removed once real apps exist); (4) real audio/video for the call flow;
(5) auth; (6) persistence (no conversation history survives refresh);
(7) Admin Dashboard/Predictions need real data sources; (8) Automation
needs an actual rule engine.

---

## Implementation status (added when this file was placed into the repo)

**This document was cited in working code before it existed here.**
`V4Prototype.jsx` line 101 carries the comment *"This closes
V4_CLAUDE.md §7 gap 0"* — referring to this file's own numbered gap
list, while the file itself was never saved into the repo. Same
pattern found repeatedly in this audit: a document shapes real code,
and only the citation survives.

`V4Prototype.jsx` now lives in `v4-proxy/` alongside this brief. It
previously sat loose at the repository root, which made it the only
application source file in the repo not filed under the app that owns
it. Moved with `git mv`, so history is preserved.

### Gap 0 — closed, and it changed the architecture

The highest-priority gap was the client-side Anthropic key. It is
closed, and the fix went further than a thin proxy:

- `v4-proxy/server.js` holds the key server-side. The frontend never
  touches `api.anthropic.com` and never sees a key.
- Calls route through **VACON** (`/api/agents/:id/invoke`), not
  `v4-proxy` directly. That reflects the layering this document itself
  describes: VACON owns each agent's real identity and system prompt;
  V4 stays the interface layer holding the key.

The consequence, recorded in the prototype's own comment: the local
`AGENTS` array is now **display-only** — icons and tier grouping. The
`systemPrompt` a real call actually uses lives in
`vacon/lib/agents.js`.

### Roster drift — found and fixed when this file was placed

"Ten agents across three tiers" was accurate when written and had gone
stale. VACON's registry holds **12 domain agents plus MIA**;
`V4Prototype.jsx` listed 10. Missing: **Anderson** (Live Events, VOID
MAGIC) and **Stephanie** (Market Research, Vex Business), both added
to VACON after this prototype was written.

Because the local array drives which agents the Command Center
*renders*, two agents VACON could invoke were **unreachable from V4's
interface entirely**. Both were added, with prompts copied verbatim
from VACON so the two stay matched, and VACON remains the authority.
Verified: the array parses, 12 entries, no missing fields, tiers
intact.

That is the recurring hazard of a display-only mirror of an
authoritative list. The durable fix is to fetch `GET /api/agents` from
VACON rather than maintain a copy — the same argument
`VLAY_INTER_AGENT_COORDINATION.md` makes against its own hardcoded
six-agent union. Not done here, because this file has no build and the
change is unverifiable in a live browser.

### The rest of the gap list

| # | Gap | Status |
|---|---|---|
| 0 | Backend proxy for the API key | **Closed** — `v4-proxy/server.js`, routed via VACON |
| 1 | Reconcile the two styling systems | **Open** |
| 2 | Split the single file | **Open** |
| 3 | App-boundary question | **Answered by events** — see below |
| 4 | Real audio/video for the call flow | **Open, and reclassified** — task #106 |
| 5 | Auth | **Available, not wired here** — Shield is real and used by other apps |
| 6 | Persistence | **Open for conversations** — V4's call store is deliberately in-memory |
| 7 | Admin Dashboard / Predictions data | **Sources now exist** — VACO Analytics is real; the screens are not wired |
| 8 | Automation rule engine | **Open** |

**Gap 3 resolved itself.** The question was whether Wallet, VOKEN,
Hunts, Messages, and Marketplace stay as previews or get removed once
real apps exist. The real apps now exist — V3, VOKEN, HVNTZ, CVNVO,
CHOPZ, and VENVS are all running services with real routes. This
document's own instruction ("treat every non-agent screen as V4's
window into another app") is now the operative answer: those screens
should read from the real services or be dropped, not built out.

**Gap 4 is no longer a V4 problem.** Real audio/video is now scoped as
shared infrastructure with four consumers queued behind it — see
`dev-docs/REALTIME_MEDIA_SHARED_INFRASTRUCTURE.md` and task #106. V4's
call flow is one of them.

### What was built beyond this document

The three-phase state machine described here (ringing → call → chat)
now has a real server-side counterpart in `v4-proxy/lib/agentCall.js`
— ring → connected → ended, with swept timeouts and a text fallback
for unanswered calls. `lib/twinProfiles.js` adds a real animation
state machine, and `lib/surfaces.js` gives TV Play, CarPlay, and
FaceTime real capability definitions rather than visual mockups —
including a hard rule that a moving vehicle never gets video. See
`v4-proxy/AI_HUMAN_TWIN_SCOPE.md`.

### The design system is worth keeping

The palette recorded above (`#14141A` / `#0A0E17` grounds, `#5B5FEF`
indigo accent, per-tier `#E8927C` / `#A78BFA` / `#7DD3E8`) is one of
only a handful of concrete per-app visual identities written down
anywhere in this project. `vaco-shell/VISUAL_DESIGN_COHESION_DIRECTIVE.md`
notes that almost no app has one recorded and that VACAY's cited
palette exists in no file at all. This one should survive into
whatever design-token work happens.
