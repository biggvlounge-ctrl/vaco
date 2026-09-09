# AI Human Twin — Scope, Resolved

This document closes a question that had been open long enough to
block three separate features: *what is the AI Human Twin, and what
does building it actually mean?*

## The reason it was unanswerable: three things share the name

"Twin" is used across this project for three genuinely different
things. Any plan that treated them as one thing was going to be wrong,
which is why the scope question kept coming back instead of resolving.

| # | Name in the docs | What it actually is | Where it lives |
|---|---|---|---|
| 1 | AI Human Twin (VENVM ad generation) | A synthetic presenter inside a **generated video ad** — pre-rendered, non-interactive | VENVM's production pipeline |
| 2 | AI Human Twin / full-body avatar | A **real-time visible embodiment of a VACON agent** on a live surface | V4 — built, see below |
| 3 | Digital Twin Level | A **business completeness tier** (Level 3 unlocks "AI Business Intelligence") | HVNTZ |

**#3 is the one that caused the most confusion**, because HVNTZ's own
revenue-stack document gates agent features behind "the already-
established Digital Twin Level system." That reads like an agent-twin
dependency and is not one — it has nothing to do with a human, a face,
or an avatar. It is a tier number on a business record. (It is also
not implemented: `digitalTwinLevel` appears nowhere in any `.js` file.)

**#1 and #2 are both real and genuinely different products.** A
synthetic presenter in a rendered ad is a video-production concern:
it happens once, offline, and the output is a file. A presenter twin
on a live surface is a session concern: it happens in real time,
responds to a conversation, and the output is a stream of state. They
share a visual vocabulary and nothing else. Building one does not
advance the other.

**Only #2 was ever blocking anything**, and #2 is what was built.

## What was actually missing — and it was not rendering

Three separate documents in this repo describe V4's presentation
surfaces as already built and inherit them for free:

- `hvntz/HVNTZ_COMPLETE_REVENUE_STACK.md`: "they automatically inherit
  V4's existing **FaceTime-style agent call flow (ring → live call →
  text fallback)** … No new capability needs to be built — this is
  confirming an existing V4 feature applies here too, not adding
  something new."
- `cvnvo/CVNVO_DATING_COMPARABLES.md`: "Kevin is already established as
  V4's Dating/Convo-focused agent personality, with FaceTime-style
  calling **already built into V4's Agent Command Center**."
- `v4-proxy/QVAN_LESLIE_DESKINS_TECH_AVATAR.md`: "All three agents use
  the same real, **already-built** V4 surfaces."

None of it existed. Before this work, `v4-proxy/server.js` was 106
lines containing one route — a pass-through to the Anthropic API — and
the strings `carplay`, `tv play`, and `call flow` appeared in no `.js`
file anywhere in the repository.

So three features had been scoped against a foundation that was never
there, each one reasonably assuming the previous had built it. That is
the real reason this stayed blocked, and it is worth recording as a
pattern rather than a one-off: **a document asserting that something is
already built is not evidence that it is.**

## What is built now

All server-side, in `v4-proxy/lib/`:

**`twinProfiles.js` — profiles and the animation state machine.**
Six states (`absent`, `idle`, `listening`, `thinking`, `speaking`,
`gesturing`) with a real transition table that rejects illegal moves,
driven by real conversation events (`user-started-speaking`,
`agent-emphasis`, `call-ended`) rather than by state names. Emits
contract clip names (`idle_breathing`, `talking_gesture_medium`) chosen
so a stock Mixamo/AccuRIG library satisfies them without custom motion
capture — per `vacon-c/CHARACTER_MODEL_ANIMATION_PIPELINE.md`'s
division of labor, which assigns exactly this piece to code and assigns
the model and motion data elsewhere.

Illegal transitions throw rather than clamp. The reason is practical:
an avatar driven by streamed events receives them out of order fairly
often, and a "speech ended" arriving after the next "speech started" is
routine — rejecting the impossible move keeps the figure out of a pose
the conversation is not in.

Profiles are presentation config only. They deliberately do not restate
an agent's name, role, or prompt — those live in `vacon/lib/agents.js`,
and duplicating them would create a second roster to drift out of sync,
which is exactly the failure `VLAY_INTER_AGENT_COORDINATION.md`'s own
status note identified in its hardcoded six-agent union.

Not every agent is embodied. DREA scores ad inventory and Gibson
computes routes; neither is a presenter, and both are marked
`embodied: false`. Placing a video call from one is refused rather than
quietly rendering an empty frame.

**`surfaces.js` — TV Play, CarPlay, FaceTime (plus web and text).**
Each surface declares what it may show, and a request for more is
clamped down rather than rejected, so a caller can ask for its ideal
framing everywhere and get the best legal answer per surface.

Framing ceilings are real design constraints, not arbitrary limits:
**TV Play** allows full-body, and is the only surface where full-body
reads at viewing distance — this is the honest home for the full-body
request. **FaceTime** caps at head-and-shoulders because a video call
frames a face; a full-body figure in a call window reads as a broadcast
rather than a conversation. **CarPlay** caps at a static avatar.

**The one rule in this system that is not a preference:** a moving
vehicle never gets video. Automotive head units prohibit video and
animated content while the vehicle is in motion because the driver is
the audience — a full-body animated presenter on a dashboard is
precisely what that rule exists to prevent. It is encoded as a ceiling
on the surface itself rather than a check a call site might forget, it
is applied after every other clamp so it can override them, and an
*absent* vehicle-motion value is treated as moving rather than as
"no" — on a driver-facing surface the unknown state is the dangerous
one, so the safe assumption is the default rather than something a
caller must remember to pass.

**`agentCall.js` — ring → live call → text fallback.** The flow those
three documents assert exists. Ringing expires on a swept timeout
(deterministic and testable, and a restart cannot strand a call because
a timer was lost), and an unanswered or declined call always leaves a
real text fallback message behind — a call that just vanishes is worse
than no call, because the agent had something to say and the user never
learns it.

## Honest limits

**There is no media and no rendering.** No WebRTC, no SIP, no audio, no
video, no mesh, no rig, no client display code. What is real is every
decision *around* the media: whether a call may ring, what the callee's
surface may display while it does, what happens when nobody answers,
and what artifact remains. A client wired to real media and obeying
this contract would behave correctly; nothing here pretends to be a
renderer or a phone.

**Call sessions are not persisted, deliberately.** Every sibling app in
this ecosystem pairs its store with a disk flush; this one does not. A
`ringing` call restored from disk is ringing at nobody. The one
artifact that genuinely should outlive a restart is the text fallback
message, and today it does not — it is marked `durable: false` rather
than quietly treated as permanent, and it belongs in a messaging store
once one exists.

**#1 and #3 remain out of scope and unbuilt.** VENVM's ad-generation
twin is a video-pipeline concern, and note that
`venvm/VIDEO_LIBRARY_INFLUENCER_DISTRIBUTION_STRATEGY.md` raises the
serious constraint attached to it: generating synthetic video of a
real, identifiable person requires explicit written consent covering
the actual generated output, and that belongs in the pipeline as a hard
gate rather than a warning. HVNTZ's Digital Twin Level is an unrelated
tiering concept that is also unimplemented.

**No twin here is a likeness of any real person.** Every profile
belongs to a fictional agent persona in this ecosystem. Nothing in this
layer generates, stores, or reproduces a real individual's face or
voice.

## Verified live

Boot-tested against a running server, not asserted: full-body held on
TV Play; full-body clamped to head-and-shoulders on FaceTime; CarPlay
stopped → static avatar; CarPlay moving → audio-only with
`degradedForSafety: true`; CarPlay with motion omitted → audio-only
with `assumedMoving: true`; unknown surface → 404; a complete
FaceTime call from ring through five conversation events to end, with
the state machine producing the right clip at each step; ring-out →
`missed` + fallback message, and answering afterward refused; decline →
fallback message; DREA refused on a video surface and permitted on
text; an illegal transition rejected with the legal options named.
