# Character Model & Animation Pipeline (v1)

Locks in the real, confirmed workflow for how visible, animated
characters get built — applies to both VACANCY and VDP. Claude Code
writes character/animation logic but does not produce 3D character
models or animation data itself.

Division of responsibility: Claude Code writes the trait/Key resolver
engine, the animation state-machine code, and the logic connecting a
character model to that behavior. Claude Code does NOT produce the
actual 3D character model or animation data.

Real confirmed tools, mostly free: Mixamo (Adobe) — free as of July
2026, 2,000+ professional motion-capture animations, licensed for
commercial game use, real auto-rigging (any humanoid model animation-
ready in under a minute), direct UE5 compatibility via FBX export.
Honest caveat: Adobe hasn't meaningfully updated Mixamo in years, had a
multi-day outage June 2025 — aging but functional.

AccuRIG (Reallusion) — a real, actively-maintained free alternative,
same auto-rigging job with more current support. Recommended as
primary tool, Mixamo as fallback/supplementary library.

Real complete pipeline: (1) source real 3D character models from Fab/
marketplace packs; (2) run through AccuRIG or Mixamo auto-rigging;
(3) apply real Mixamo animations (walking, gestures, talking); (4)
export FBX, import to UE5, retarget with IK Retargeter if needed; (5)
Claude Code's animation state-machine takes over from there.

Direct fit: same "real existing tools plus Claude Code's logic"
pattern already established for environment art and interior/prop
dressing.

---

## Implementation status (added when this file was placed into the repo)

**This document's division of responsibility was followed literally,
and step 5 now exists.** It is the clearest statement of scope in this
whole project, so it is worth naming what it produced.

**Step 5 — built.** `v4-proxy/lib/twinProfiles.js` implements a real
animation state machine: six states (`absent`, `idle`, `listening`,
`thinking`, `speaking`, `gesturing`), a transition table that rejects
illegal moves, and a mapping from real conversation events
(`user-started-speaking`, `agent-emphasis`, `call-ended`) onto those
states. It emits contract clip names — `idle_breathing`,
`talking_gesture_medium` — that a rigged model must satisfy.

Those clip names were chosen against this document's own tool list:
deliberately generic and few, so a stock Mixamo or AccuRIG library
satisfies them without commissioning custom motion capture. That is
the pipeline above, honored at the seam.

**Steps 1–4 — not done, and correctly not done here.** No 3D model,
mesh, rig, or motion data exists in this repository, and none should.
Sourcing from Fab, auto-rigging through AccuRIG, and retargeting with
UE5's IK Retargeter are asset-production work that happens outside
this codebase, exactly as stated.

**One real qualification about where step 5 landed.** This document
scopes the pipeline to "both VACANCY and VDP" — the 3D worlds. The
state machine was actually built for V4's agent presenter twins (TV
Play, CarPlay, FaceTime), which is a different surface than either.

That is not a mismatch so much as a broader application than the
document anticipated: the logic is the same either way. A character
who breathes when idle, attends while listening, and gestures on
emphasis is the same state machine whether the figure stands in a
walkable world or appears on a television. If VACANCY or VDP later
need character animation, they should import this rather than write a
second one — the same "don't build a competing layer" argument
`VLAY_INTER_AGENT_COORDINATION.md` makes about monitoring.

**The trait/Key resolver — separate, and genuinely unbuilt here.**
This document pairs the animation state machine with a "trait/Key
resolver engine," which belongs to VACANCY's trait system (see
`VACANCY_TRAIT_DATABASE_ATTACHMENT.md`), not to V4's presenter twins.
An agent twin has a fixed persona and needs no trait resolution; a
civ-sim population does. That half remains unbuilt, and VACON-C is
paused, so it stays that way for now — recorded so the two halves of
this document are not assumed to have shipped together.
