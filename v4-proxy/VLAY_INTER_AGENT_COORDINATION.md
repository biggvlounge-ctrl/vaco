# VLAY — Inter-Agent Coordination (v1, proposed)

> **Naming decided: VLAY.** When this file was first placed, its name
> was flagged as colliding with an existing, different system —
> `void/VOID_MASTER_FREEZE.md` already defines **VLAY** as the physical
> drone/ground/autonomous *delivery* relay. An interim rename to "VLA"
> was applied and then corrected by the founder: **VLA was a typo. The
> name is VLAY.**
>
> So VLAY deliberately names two things, and this is the definitive
> statement of which is which:
>
> | | Domain | What it relays |
> |---|---|---|
> | **VLAY** (VOID) | Physical logistics | Packages, hub-to-hub, across drone/ground/autonomous legs |
> | **VLAY** (V4) | Agent coordination | Messages between AI agents |
>
> They share a name because they share a concept — both are relays.
> Disambiguate by app, the same way any overloaded term in this
> ecosystem is read in context. When precision matters in code or
> conversation, say *VLAY delivery relay* or *VLAY agent relay*.

Closes a real gap: VACO's independent AI agents (MIA/V4's roster,
DREA, HVNTER, Gibson, Kevin, QVAN) each operate well within their own
domain, but nothing connects them to each other or reports combined
activity in one place.

**The gap**: MIA coordinates V4's roster. DREA, HVNTER, Gibson, Kevin,
QVAN each operate independently within their own app. No agent
facilitates cross-agent communication — e.g., Gibson's dispatch could
benefit from knowing what DREA knows about a location, or HVNTER's
break recommendation should factor in a QVAN safety flag, but there's
no path for that. No unified reporting view exists across all agents
at once.

**Proposed solution: VLAY** (founder's own name for this function),
two jobs:

1. **Inter-agent coordination** — a lightweight message-passing layer
   letting agents share relevant information without needing direct
   knowledge of every other agent's internal logic.
2. **Unified reporting** — a single dashboard aggregating activity
   across every agent: what each is doing, performance metrics,
   errors/anomalies, cross-agent interactions.

```
RelayMessage {
  id, sourceAgent: "mia" | "drea" | "hvnter" | "gibson" | "kevin" | "qvan"
  targetAgent: "mia" | "drea" | "hvnter" | "gibson" | "kevin" | "qvan"
  messageType: string, payload: object, timestamp: timestamp
}

RelayReportingDashboard {
  agentId, activitySummary: string, performanceMetrics: object,
  anomaliesDetected: [string], crossAgentInteractionCount: number
}
```

**Why real, not theoretical**: as more agents get added, the risk of
true isolation grows — genuine missed opportunities and genuine blind
spots. VLAY is the structural fix for both, before the agent roster
grows large enough to become a harder problem to retrofit.

**Status**: proposed addition, open to founder's preference on the
name, same as VSAFE and VPLAN were proposed as placeholders.

---

## Implementation status (added when this file was placed into the repo)

**Genuinely unbuilt.** `vacon/lib/` holds `agents.js`, `orchestrator.js`,
`persistence.js`, and `store.js` — no relay, no message passing, no
agent-to-agent path of any kind. Confirmed by direct search.

**The gap this document describes is real, and narrower than it
sounds.** What already exists is *vertical* routing: MIA receives a
request and routes it to whichever agent owns it (`POST /api/route`,
`POST /api/agents/:id/invoke`, with `GET /api/route/history` recording
what was routed where). What genuinely does not exist is *lateral*
communication — one agent handing something to another without a human
request initiating it. The roster is also larger than this document
assumes: 13 real agents, not the 6 listed in `RelayMessage`'s union
(it omits `leslie`, `deskins`, `kay`, `anderson`, `stephanie`, `ava`,
`autumn`, `jacobi`). Any real implementation should derive the agent
list from `agents.js` rather than hardcoding a union that is already
out of date.

**Unified reporting partially overlaps something real.**
`vaco-analytics/intelligence.js` already implements a proactive
Data Collection → Pattern Learning → Notification & Response loop with
real anomaly detection and alert routing — and it already routes
alerts to named agents (`financial: 'Leslie'`, `compliance: 'Deskins'`,
`security: 'Qvan'`). That is meaningfully close to
`RelayReportingDashboard`'s "anomaliesDetected" plus routing. A real
VLAY agent relay should extend that rather than build a second,
competing monitoring layer.

## Naming — settled

**The same name genuinely covers two systems, by decision.**
`void/VOID_MASTER_FREEZE.md` line 440 defines **"MULTI-MODAL VLAY —
chaining drone, ground, and autonomous legs together"** — a physical
delivery relay, where a package hops hub-to-hub by drone and hands off
to ground or autonomous transport when the next leg exceeds drone
range. That system is built and working in `void/lib/multiModalRelay.js`.

This document names the other one: a relay for *messages between
agents* rather than *packages between vehicles*.

**Decision (founder, final):** both are **VLAY**. The shared name is
intentional — they are the same idea applied in two domains. Nothing
in VOID changes; nothing here gets a different name. Where ambiguity
would actually cost something, qualify it: *VLAY delivery relay* vs.
*VLAY agent relay*.

An earlier pass in this repo renamed this file to `VLA_...` on the
assumption that the collision needed resolving. That was reverted —
recorded here so the git history reads sensibly rather than looking
like an unexplained flip-flop.
