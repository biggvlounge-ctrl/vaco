# Plan — Phase 4: Stephanie, representing Vex Business (CALL)

## Request

User asked for a new AI agent, named Stephanie, that does real market/
competitor research for CALL (the futures-trading research platform)
— finding comparable products already in the trading market. The
agent should be placed under VACON "with all the rest of the business
programs," and its app identity should be "Vex Business" — CALL's
own internal, management-facing name (VEX being the ecosystem's
existing Robinhood-style trading app; "Vex Business" borrows that
name for CALL's internal identity, not a code rename).

Two points were genuinely ambiguous in the original (voice-transcribed)
request and were clarified directly with the user before building:
1. Stephanie's actual job — confirmed: market/competitor research, not
   literal call recording/transcription.
2. What "Vex Business" concretely is — confirmed: a rebrand of CALL's
   own internal identity, not a new standalone app and not a directory/
   package rename inside `call/`.

## What this phase adds

- `vacon/lib/agents.js`: a new agent record, `id: 'stephanie'`,
  `tier: 'business'` (same tier as QVAN/Leslie/Deskins — the existing
  internal-management-function agents), `app: 'Vex Business'`.
- `vacon/lib/orchestrator.js`: real `DOMAIN_KEYWORDS` for `stephanie`,
  drawn directly from her own role (competitor/comparable/market
  research terms), following the same pattern every other agent's
  keyword list already uses.
- `call/packages/research` (`call-research`): Stephanie's actual real
  content — genuine, sourced findings on comparable quant/algorithmic-
  trading platforms, served live at `GET /api/research/comparables`.
  See that package's own module docstrings and `call/README.md`'s new
  "Stephanie" section for the full account.

## Deliberately not built this pass

- No live, scheduled re-research — this is a real, dated snapshot
  compiled from one research pass, not a background service that
  re-scrapes the market on its own. Matches the user's own framing
  ("only use for management for now").
- No real LLM-backed invoke path exercised for Stephanie specifically
  beyond what already exists for every VACON agent (`POST
  /api/agents/:id/invoke`) — no new agent-specific behavior was added
  there; Stephanie uses the same generic invoke path as every other
  agent.
