# QVAN / Leslie / Deskins — Technology Stacks & Full-Body Avatar (v1)

Real, current 2026 best-in-class tools for each agent's domain, plus
TV Play/CarPlay/FaceTime confirmation and full-body avatar capability.

## Deskins (Legal & Compliance)

**Spellbook** is the top-recommended AI tool for compliance lawyers in
2026 — Microsoft Word integration, real regulatory benchmarking,
strong enterprise data privacy. **ComplyAdvantage** adds AML/KYC
screening with live risk monitoring, relevant given VCoin's
real-money-adjacent elements.

```
DeskinsTechnologyStack { primaryTool: "spellbook", amlKycLayer: "complyadvantage" }
```

## Leslie (Financial)

**Ascent** leads for regulatory intelligence and obligation management
— real-time tracking of regulation changes across jurisdictions.
**Workiva** adds compliance workflow and reporting automation.

```
LeslieTechnologyStack { primaryTool: "ascent", reportingLayer: "workiva" }
```

## Qvan

Existing scope already built on real, current platforms — no change
needed, already confirmed current.

## TV Play, CarPlay, FaceTime

All three agents use the same real, already-built V4 surfaces — same
infrastructure already proven for Jake and every other named agent.

## Full-body avatar capability — genuine new addition

Beyond a face/likeness twin, a full-body avatar visible head to foot,
real posture and movement, for TV Play and CarPlay display. Same
digital-twin technology category as the existing AI Human Twin work,
extended to full-body rendering.

```
FullBodyAvatarCapability {
  displaySurfaces: ["tv-play", "carplay"]
  avatarType: "full-body-visible-head-to-foot"
  realTechnologyBasis: "same-digital-twin-category-as-ai-human-twin"
  applicableAgents: ["jake", "qvan", "leslie", "deskins",
    "every-other-named-agent"]
}
```

---

## Implementation status (added when this file was placed into the repo)

**All three agents are real.** `vacon/lib/agents.js` holds a real
14-agent roster — `mia`, `qvan`, `leslie`, `deskins`, `kevin`, `kay`,
`gibson`, `drea`, `anderson`, `stephanie`, `ava`, `autumn`, `jacobi`,
`jake` —
each with a real system prompt, reachable through real routes
(`GET /api/agents`, `POST /api/agents/:id/invoke`, `POST /api/route`
for MIA's routing). Roles match this document exactly: QVAN is Chief
Security Officer, Leslie is CFO (app: V3), Deskins is Chief Legal &
Compliance Officer.

**Tool stacks — now applied.** When this file was first placed, the
stacks above were absent from the agents: grepping `vacon/lib/agents.js`
for Spellbook, ComplyAdvantage, Ascent, and Workiva returned zero
matches. That change was held for a decision rather than made
unilaterally, since it alters live agent behavior; the decision came
back to proceed, and the stacks are now in Leslie's and Deskins'
prompts.

They follow QVAN's existing restrained pattern rather than inventing a
new one: QVAN's prompt names Rubrik, Cohesity, and Zerto (from
`QVAN_SECURITY_RESILIENCE_SCOPE.md`) and instructs it to reference
tooling "only when it's actually relevant, never as name-dropping."
Leslie and Deskins now do the same with theirs.

**Full-body avatar and the three surfaces — the server-side half is
now built.** This section previously recorded both as unbuildable
here, blocked on an unbuilt AI Human Twin foundation. That block is
resolved: the foundation was the thing missing, and it now exists.

What is real in `v4-proxy/lib/`:

- `twinProfiles.js` — twin presentation profiles per agent and a real
  animation state machine (six states, rejected illegal transitions,
  conversation events mapped onto states, contract clip names a rigged
  model must satisfy).
- `surfaces.js` — the three surfaces as real capability definitions.
  **TV Play** is the only one that permits full-body, which is the
  honest answer to this document's request: full-body reads at
  television viewing distance and does not read in a call window or on
  a dashboard. **FaceTime** caps at head-and-shoulders because a video
  call frames a face. **CarPlay** caps at a static avatar and drops to
  audio-only whenever the vehicle is moving.
- `agentCall.js` — the ring → live call → text fallback flow, which
  three documents across this repo describe as already built and which
  did not exist.

**The correction this document needed, kept rather than deleted**:
"same digital-twin technology category as the existing AI Human Twin
work" overstated what existed at the time. There was no AI Human Twin
to extend. What was actually needed first was a scope clarification —
three different things in this project are called "twin" — and that is
now recorded in `v4-proxy/AI_HUMAN_TWIN_SCOPE.md`.

**Still not built, and correctly so**: rendering. No mesh, rig, motion
data, or client display code exists in this repository, and per
`vacon-c/CHARACTER_MODEL_ANIMATION_PIPELINE.md`'s own division of
labor, none should. What is real here is every decision a renderer
needs handed to it.

**One factual correction to the agent list above.** `applicableAgents`
names `"jake"`. No agent named Jake exists in VACON's roster —
`vacon/README.md` already resolved this: the only real "Jake" in the
project is VENVM's production-stack lead, a different thing entirely.
The claim that these surfaces are "already proven for Jake" therefore
rested on an agent that was never there.
