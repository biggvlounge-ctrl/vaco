# Real-Time Media — Shared Infrastructure Scope

**Status: BUILT — control plane. `vaco-media`, port 8821.**

Sessions, per-participant join grants, capacity, expiry, revocation,
presence and lifecycle are real, tested (32 tests, every one watched
fail) and running. The **media plane is not**: carrying audio and video
needs an SFU process, `deploy/` does not run one yet, and the default
`loopback` transport approves joins while saying plainly that nothing
will connect.

That split is the honest one. The control plane is most of the work and
all of the security — a join credential is a bearer token for a live
room, and getting it wrong is the whole risk. The media plane is
bandwidth and a server, and it does not get safer by being written
carefully.

**To carry real media:** stand up LiveKit (self-hosted; `deploy/` is
where it belongs), then set `VACO_MEDIA_TRANSPORT=livekit` and point
`LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` at it. Nothing
else changes — the adapter already mints correctly-signed LiveKit
tokens with the documented claim shape, verified in
`test/transport.test.js`.

**All four consumers are wired**, plus three catalogue consumers:

| Consumer | Hook | Shape |
|---|---|---|
| VXLLAGE | joining a village room | `room` |
| CVNVO | scheduling a speed date | `call`, **never recordable** |
| Vavlt Stvdios | creating a screen session | `wall`, recordable |
| V4 | answering an agent call | `call` |
| Vvltvre Flix | marking a title streaming / claiming a stream slot | asset + playback grant |
| Vvltvre Pods | publishing an episode | audio asset |
| CHOPZ | creating a video | short asset |

Two of those are worth stating on their own:

- **CVNVO's speed dates are created not-recordable, and vaco-media
  refuses to make a session recordable after the fact.** Consent for a
  private conversation is given before it happens or not at all.
- **V4's `ring -> connected` is now a reported fact.** That file's own
  header recorded that there is no WebRTC and no audio, which is why
  `connected` was a state nobody could confirm and why the text
  fallback exists. The fallback stays -- this fails soft.

**Fail-soft, deliberately, and the opposite of the decision log.** If
vaco-media is down a speed date still schedules, a room still opens and
a title still goes streaming; each response carries
`media: { available: false, reason }`. A settlement that cannot be
recorded must not happen; an interaction that cannot show video is
degraded, not broken. Verified live: with the service stopped, marking
a title streaming returns `200` with `status: "streaming"` and
`media: { available: false }`.

*(Original scope below, kept because it is what was built and the
reasoning still holds.)*

---

**Status: scoped, not started. Deliberately not placed inside any app's
folder**, per decision. This document lives in the repo's own
`dev-docs/` because the thing it describes belongs to no single app —
the same reason V3 and VOID are top-level services rather than modules
inside their first consumer.

## Why this is shared infrastructure and not a feature

Four separate surfaces are queued behind the same missing piece, and
each one independently built a real session layer and then stopped at
the same wall:

| Consumer | What exists today | What it stops at |
|---|---|---|
| **VXLLAGE** — Live (Clubhouse) and Call (Zoom) | `lib/villageRooms.js`: real rooms with `roomType`, `ownerId`, `activeParticipants`, `scheduledRecurrence` | No transport. Its own gap list item 5. |
| **Vavlt Stvdios** — multi-screen sessions | `lib/screenSessions.js`: real sessions with `sessionType`, `ownerId`, `channelIds` | No transport. Streams are metadata. |
| **CVNVO** — all-facetime speed dating, BarBuddy | `lib/speedDating.js`: real slots with `format: 'all-facetime'`, `participants`, `durationSec`, real extension | Its own header records the deliberate non-dependency. |
| **V4** — agent call flow | `lib/agentCall.js`: ring → connected → ended, with animation state and text fallback | Header states plainly: no WebRTC, no SIP, no audio, no video. |

Two of those four say so in their own source comments —
`cvnvo/lib/communicationControls.js` ("No real media/SIP/WebRTC relay
is built here") and `v4-proxy/lib/agentCall.js`. This was never hidden;
it was correctly deferred four separate times.

**The consequence worth stating plainly:** whichever app builds this
first inside its own folder makes the other three depend on it, and
`vxllage/VXLLAGE_CLAUDE.md` already warned against exactly that
("likely worth sharing infrastructure with Vavlt Stvdios rather than
building a second media stack"). Building it in VXLLAGE would not be a
shortcut — it would make VXLLAGE a dependency of CVNVO, Vavlt Stvdios,
and V4, which is architecturally backwards.

## What the service owns, and what it does not

The four consumers above already own everything domain-specific: who is
allowed in a room, how long a speed date runs, whether an agent may
ring a user, what a screen session contains. **None of that moves.**

The shared service owns exactly one thing they all need and none of
them should implement: **establishing and tearing down a real media
session between named participants, and reporting its state.**

Concretely in scope:

- **Rooms/sessions as transport objects** — created on request by a
  consuming app, addressed by that app's own id so nothing is
  duplicated.
- **Join tokens** — short-lived, per-participant, scoped to one room.
  This is the security boundary; it must come from the server, never
  the client.
- **Signalling** — the offer/answer/ICE exchange, or the equivalent
  handed to whichever vendor is chosen.
- **Presence and participant state** — joined, left, muted, connection
  quality — reported back so consumers can react.
- **Recording hooks** — start/stop plus where the artifact lands.
  Needed by Vavlt Stvdios; must be opt-in and consent-gated.
- **Session lifecycle events** — so a consumer learns a call actually
  connected rather than assuming it did.

Explicitly **out** of scope, and each for a real reason:

- **Authorization decisions.** Shield says who the user is; the
  consuming app says whether that user may join. The media service
  enforces the token it was handed and makes no policy of its own.
- **Domain rules.** Speed-date duration belongs to CVNVO. Ring timeout
  belongs to V4. Do not migrate them here.
- **Content moderation.** QVAN's domain.
- **Being a second identity system.** The failure mode this whole
  ecosystem keeps avoiding.

## The vendor decision, and why it is the first decision

**Real media transport cannot be written from scratch here, and should
not be.** SFU implementations are genuinely hard — congestion control,
simulcast, NAT traversal, TURN relay fallback — and it is not the kind
of hard that rewards a first attempt.

Four real options, with the tradeoff that actually distinguishes them:

| Option | Shape | Real tradeoff |
|---|---|---|
| **LiveKit** | Open-source SFU, self-hostable or cloud | Best fit for this repo's posture: you can run it yourself, so no vendor holds the sessions hostage. Heaviest ops burden if self-hosted. |
| **Daily** | Managed API | Fastest to a working call. Per-minute pricing that scales with success. |
| **Twilio Video** | Managed, mature | Broadest track record; check current product status before committing, as this line has changed shape before. |
| **mediasoup** | SFU library, not a product | Most control, most work. Only correct if media handling becomes a differentiator, which it is not here. |

**Recommendation: LiveKit**, on one specific ground rather than
general preference — it is the only option that lets the same code run
against a self-hosted instance and a managed one. That matters because
this repo already made the same call twice: `deploy/` self-hosts
everything, and `v3/lib/cryptoAgility.js` exists precisely so an
algorithm choice is config rather than architecture. A media layer
behind an adapter interface, defaulting to LiveKit, follows the pattern
already established.

**Per `dev-docs/STANDING_INSTRUCTION_ONGOING_EVALUATION.md`: re-check
this list at build time rather than treating it as settled.** This
category moves, and the recommendation above is a starting point for an
evaluation, not its conclusion.

## Naming — a decision, not an assumption

This document deliberately does not create a directory. Every
top-level service in this ecosystem has a real name chosen by the
founder, and inventing one here would put a placeholder into the app
registry, `start-ecosystem.sh`, `docker-compose.yml`, and nginx — the
exact "placeholder becomes load-bearing" failure that
`voken/lib/cardTypes.js` is currently living with.

The name is needed before the directory. Once chosen, it needs a real
entry in `start-ecosystem.sh` (which is canonical — `docker-compose.yml`
and the nginx conf are generated from it) and a real port.

## Build phases

**Phase 1 — session and token layer, no media.** Rooms, participants,
short-lived join tokens, lifecycle events, and an adapter interface
with no implementation behind it. Fully testable in plain Node with no
network, matching how every other service here was built. This is
genuinely the majority of the surface area and none of the vendor
risk.

**Phase 2 — one real adapter.** Implement against the chosen vendor.
Prove it with the simplest consumer: V4's agent call, which already
has a complete session machine and needs only transport underneath it.

**Phase 3 — cut consumers over, one at a time.** CVNVO's all-facetime
format next (two participants, bounded duration), then VXLLAGE's Live
rooms (many participants, one speaker), then Vavlt Stvdios' multi-screen
sessions (hardest — many simultaneous streams, and the only one needing
recording).

That ordering is by participant topology, not by app importance: 1:1,
then 1:many, then many:many. Each phase exercises something the
previous one did not.

## Two things to get right at the start

**Join tokens must be server-issued and short-lived.** A client that
can mint its own room token can join any room. This is the one place
in the design where a shortcut is a security hole rather than technical
debt.

**Recording is consent-bearing.** Vavlt Stvdios needs it; CVNVO
absolutely must not have it silently. Recording a dating call without
both parties knowing is a legal problem in every two-party-consent
jurisdiction, and it is the same class of problem
`venvm/lib/likenessConsent.js` was built to prevent — a capability
whose harm lands on someone who is not the one enabling it. Recording
should be off by default, per-room explicit, and visible to every
participant while active.

## Not started

Nothing has been built. This document exists so that when it is, it
starts in the right place with the boundary already drawn.
