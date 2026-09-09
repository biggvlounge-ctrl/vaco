# CVNVO — Core Feature Definition (v1)

CVNVO has real safety architecture (CVNVO_SAFETY_SYSTEM.md), Yap defined
inside it, and real matching-mechanics research (CVNVO_DATING_COMPARABLES.md)
— but no actual core dating feature set has been defined yet. This is
that definition, built directly from the Hinge/Tinder/Bumble research
already on record, not from scratch.

## Profile & Onboarding
- Identity verification (govt ID optional/required for verified badge,
  selfie + liveness check) — per the existing safety system, this is
  the front door, not an afterthought.
- Prompt-based profile (Hinge's real differentiator over Tinder's
  photo-only format) — a small set of required text prompts alongside
  photos, since prompt-based profiles are what actually feeds a
  compatibility algorithm meaningful signal, not just photos.
- Preference settings feed directly into the matching algorithm below
  (not just filters applied after the fact).

## Discovery & Matching — Gale-Shapley model, not swipe-volume
Per the standing decision: CVNVO models Hinge's mutual-compatibility
approach, not Tinder's ELO/volume model.
- Daily curated stack (not infinite swipe) — a bounded number of
  high-compatibility profiles per day, prioritizing *mutual* likelihood
  of interest over raw volume.
- Like-with-comment on a specific prompt (Hinge's real mechanic) as the
  primary interaction — a comment on what someone actually said, not a
  blind swipe.
- **Your Turn Limits equivalent**: once a user has a set number of
  unanswered conversations, new likes pause until they respond — a real
  anti-ghosting mechanic, not just a courtesy nudge.
- Compatibility score shown transparently (not a black box) — since
  CVNVO already leans into trust/safety as its differentiator, showing
  *why* two people were matched fits that positioning better than
  Tinder's opaque algorithm would.

## Messaging
- Matches expire after a set window if unused (Bumble's real 24-hour
  model, adapted — exact window is a tunable parameter, not necessarily
  24h) — creates real urgency without silent ghosting.
- Anonymous in-app calling/video before phone numbers are shared (per
  the existing safety system's Communication Controls).
- AI spam/scam filtering runs on every conversation (per the existing
  AI Safety Monitoring section) — this connects messaging directly to
  the Relationship Guardian AI already defined, not a separate system.

## The "We Met" feedback loop — the single most valuable mechanic here
Per the standing decision: this extends CVNVO's *existing* First Date
Safety check-in (the safety timer / "check on me" feature) rather than
being a separate ask. The same check-in that confirms a user is safe
after a date also asks whether the date happened and how it went — one
user action, two uses: safety data feeds the emergency-contact system,
match-quality data feeds back into the compatibility algorithm for
future matches. This is real, evidence-based product design (Hinge's
own real data shows this loop materially improves match quality over
time), not a bolted-on survey.

## How this connects to what's already built
- Matching engine output feeds directly into the existing First Date
  Safety flow once two users agree to meet.
- Yap (inside CVNVO) is a separate, parallel surface — a Yap
  green/red-flag review has no automatic effect on CVNVO's own matching
  algorithm; keeping these decoupled avoids a single anonymous report
  silently tanking someone's match visibility without due process,
  which would compound Yap's existing defamation-exposure risk.
- Verified badge status (from Identity Verification above) should be a
  visible signal in the discovery stack, not just a profile detail —
  consistent with how seriously CVNVO already treats trust relative to
  a typical dating app.

## Engineering flag
Gale-Shapley in practice requires real preference-ranking data at
scale (who each user likes AND who's likely to like them back) — this
is a genuine backend/algorithm build, not a UI decision, and was
already flagged as such in the comparables research. Worth scoping as
real engineering work in any Claude Code handoff, not assumed to be a
simple sort function.

---

## Implementation status (added when this file was placed into the repo)

**Built, with one half-finished loop.** Section by section against the
code.

**Profile & Onboarding.** `profiles.js` is real, prompts feed
`compatibility.js` rather than sitting decorative, and preferences are
genuine algorithm inputs — which is the specific thing this document
insisted on ("feed directly into the matching algorithm, not just
filters applied after"). Identity verification is real and lives where
it should: VACA attests the claim (`subjectType: 'cvnvo-user'`), and
CVNVO reads the result rather than running its own check.

**Discovery & Matching.** `matching.js` implements real Gale-Shapley
stable matching. Your Turn Limits is real — `unansweredCount` is
tracked across `matching.js` and `messages.js`, so new likes genuinely
pause. Compatibility scores are computed transparently from real
inputs (haversine distance, Jaccard similarity on interests, mutual
age fit), not a black box.

**The engineering flag at the bottom of this document was correct and
has been paid.** "Gale-Shapley in practice requires real preference-
ranking data at scale — a genuine backend/algorithm build, not a UI
decision." It was built as exactly that.

**Messaging.** Real: expiry, `messageSafety.js` for spam/scam
filtering, `messageSocket.js` for real WebSocket push rather than
polling, and `communicationControls.js` for anonymous contact before
phone numbers are exchanged. That last file is candid about its
ceiling — no real telephony or SIP relay exists behind it, which is
now tracked as shared infrastructure (task #106) rather than a CVNVO
gap.

**The "We Met" loop — the mechanic this document calls "the single
most valuable" — is fully built, capture and feedback.**

Capture is designed exactly as argued here: folded into the existing
safety check-in rather than asked as a separate question.
`confirmSafe()` takes `actuallyMet` (boolean) and `dateRating` (1–5,
validated), and `getUserDateReliability()` aggregates them from real
confirmed check-ins.

Feedback is real too, and it lives in `matching.js` rather than
`compatibility.js` — which is a meaningful distinction, not a
technicality. `computePreferenceList()` scales each candidate's
compatibility score by a reliability multiplier before Gale-Shapley
ranks them, so outcomes genuinely change who matches with whom.
`compatibility.js` itself stays pure profile math, which is what keeps
this document's "compatibility score shown transparently, not a black
box" promise true: the number a user sees still means what it says,
while reliability adjusts ranking behind it.

The formula's three safeguards are deliberate. A candidate with no
history gets **no** adjustment — lacking data is not evidence of
unreliability. It is bounded at 50–100% credit and never zeroes a
match out. And it uses `actuallyMet` rather than `dateRating`:
follow-through is a behavioral fact, whereas ranking people by others'
1–5 judgments would reintroduce the due-process problem the Yap
decoupling exists to prevent. `dateRating` is captured and
deliberately unused in matching.

Honest limitation: the rate is lifetime, so recovery from early
no-shows is slow. A recency window is not built.

**The two connection rules were both honored.** Matching output feeds
the First Date Safety flow. Yap remains a genuinely separate surface
with its own store, and `yap.js` cites the reasoning from this
document in its own header — no anonymous report can silently affect
match visibility without due process.

**Verified badge as a visible discovery signal** — the attestation is
real; whether the badge is surfaced in the stack is a frontend
question, and CVNVO's visible surface is VDP's Dating Village district.
