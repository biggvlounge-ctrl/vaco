# World Change → News Propagation

Confirms that any significant law, government, or territorial control
change genuinely propagates outward as real news, using the same
Information Spread mechanism already built for danger alerts — now
extended to cover all meaningful world changes.

```
WorldChangeNewsEvent {
  eventId
  eventType: "law-enacted" | "government-change"
           | "organization-territorial-acquisition" | "control-key-capture"
  originLocationId
  newsContent: string
  propagationSpeed: number   // derived from the existing Information
                             // Spread Key — connectivity, distance,
                             // trust between locations, same as danger alerts
  eventuallyReachesPlayer: true  // given enough real in-world time, this
                                 // genuinely reaches the player through
                                 // word-of-mouth or available physical
                                 // media, not instantly
}
```

Example confirmed exactly as described: an organization takes over a
skyscraper and starts a business — a real control-key-capture event,
propagating outward through the same word-of-mouth network, reaching
the player eventually at a real, honest delay determined by actual
distance and connectivity.

Status: confirmed and extended — any real, significant change to laws,
government, or territorial control genuinely becomes real, in-world
news, propagating exactly like a danger alert, through the same word-
of-mouth Information Spread Key, eventually and honestly reaching the
player rather than being instant or silent.

---

## Implementation status (added when this file was placed into the repo)

**Already satisfied — and satisfied by construction rather than by a
later change.** This is the cleanest outcome a document in this corpus
can have.

`world-layer/propagation.js` implements the Information Propagation
Engine, and its header states the design decision that makes this
document a no-op:

> "Used for rumors, disasters, laws, business openings, wars,
> discoveries, and player reputation — one system, not separate
> mechanisms per event type. **`eventType` is therefore a free-form
> string here, not a fixed enum — the whole point is that the
> mechanism doesn't branch on it.**"

So all four event types this document names — `law-enacted`,
`government-change`, `organization-territorial-acquisition`,
`control-key-capture` — already work. Not because they were added, but
because the engine was deliberately built not to care. Passing any of
them to `originateEvent()` propagates identically to a danger alert,
which is precisely what this document asks for.

That is the difference between a system that *supports* an extension
and one that *required* one. This needed no code.

**What is real:** `originateEvent()`, `calculatePropagation()`,
`propagateEvent()`, `getInformationEvent()`, and a
`DISTANCE_DECAY_CONSTANT` governing falloff.

**One honest limit, already flagged in the code rather than hidden.**
The propagation formula is a *placeholder*. Its own header says so:

> "No formula for spreadProbability/timeDelay is specified in any
> source doc. The one implemented here is a real, deterministic,
> testable placeholder."

`DISTANCE_DECAY_CONSTANT = 50` carries the comment "arbitrary; larger
= slower falloff with distance." So the *mechanism* is real and the
*tuning* is invented. This document's claim that delay is "determined
by actual distance and connectivity" is true structurally — distance
and connectivity are genuinely the inputs — but the curve mapping them
to a delay is not derived from anything and would need real play
testing before it feels right.

**The field this document adds that the engine does not have:**
`newsContent`. `originateEvent()` takes an optional `description`,
which is close, but there is no notion of the *story* a propagating
event carries as distinct from its type — no headline, no
word-of-mouth distortion as it travels. Real rumour systems degrade
information with distance; this one propagates it intact. Worth
knowing, since "word-of-mouth" implies the former and the code
implements the latter.

**`eventuallyReachesPlayer: true` is an assertion, not a guarantee.**
With distance decay, spread probability can fall low enough that an
event never reaches a distant player in practice. Whether the engine
should floor that — guaranteeing eventual arrival at some very long
delay — is a real design question this document assumes away.

**Filed in `world-layer/` rather than under VACON-C** because that is
where the code and the parent architecture document both live.
`world-layer` is a shared data module, not a nineteenth app home.
