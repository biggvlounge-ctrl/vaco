# Standing Instruction — Ongoing Evaluation

A real, standing directive for Claude Code: don't just implement the
spec as written — actively evaluate whether better tools, libraries,
or approaches exist at the moment of building, and flag anything this
whole design process didn't catch.

The real, direct instruction: as implementation proceeds, Claude Code
should actively check — is there a better, more current library, tool,
or pattern than what this specification calls for? Has something
changed since this package was written that makes a different approach
genuinely stronger? This mirrors the same practice already used
throughout the whole design process — real, current research checked
against existing assumptions, not just executing a fixed plan blindly.

```
OngoingEvaluationDirective {
  duringImplementation: true
  checkFor: [
    "newer-or-better-libraries-than-specified",
    "current-best-practices-that-changed-since-design",
    "simpler-alternatives-to-what-was-specified",
    "real-tools-not-caught-during-the-design-phase"
  ]
  whenFound: "flag-directly-with-reasoning-before-substituting"
}
```

Where this applies most directly: the database migration specifically
— if a better Postgres tooling approach exists by the time Phase 1
reaches that step, flag it. The AI 3D asset generation pipeline — if a
stronger, cheaper, or faster generation service exists than what's
referenced, flag it. Any of the free datasets already bundled (Cesium,
UNESCO, Overture Maps) — if access terms, better alternatives, or
newer versions exist by the time this is actually built, flag it
rather than assume the research from this design phase is still
current.

The real, important boundary — **flag, don't silently replace**: this
isn't permission to quietly deviate from the locked Phase 1 scope or
swap out core architectural decisions without surfacing them first.
The instruction is to notice and raise — the same way this whole
design process worked, where new findings got proposed with real
reasoning and cross-referenced against what already existed, not
simply substituted in unannounced.

Status: A real, standing instruction confirmed for the actual
implementation phase — Claude Code should keep evaluating for better
tools, libraries, and approaches as it builds, surfacing anything
genuinely better rather than treating the current specification as
permanently fixed and beyond reconsideration.

---

## Implementation status (added when this file was placed into the repo)

**Placed at the repository's own `dev-docs/` rather than inside any
app**, because it governs all of them. It is a process instruction,
not a feature.

**This is the one document in this batch that has already been
followed**, repeatedly and before it was ever written down here.
Concrete instances, each traceable to a file:

- **PQC algorithms verified against the actual runtime rather than
  assumed.** `v3/lib/cryptoAgility.js` registers ML-DSA (FIPS 204) as
  a real named slot with `available: false`, because Node 22 does not
  ship it. The specification's ambition was correct; the runtime check
  was the thing the design phase could not have known. It refuses
  rather than silently downgrading.
- **Hash guidance corrected downward in alarm, not upward.** The same
  file states plainly that Grover gives only a quadratic speedup, so
  SHA-256 retains ~128-bit effective security — rather than implying
  it is broken. That is checking a claim instead of repeating it.
- **A stale architectural premise caught before building on it.**
  `voken/VEX_VADO_RESTRUCTURING.md` asserts VEX is a VOKEN division;
  it had since been extracted into a standalone app. Flagged in place
  rather than acted on.
- **An asserted-but-absent foundation caught three times.** V4's
  "FaceTime-style agent call flow" was described as already built by
  three separate documents and did not exist; VLAY's inter-agent relay
  is described as "already built" by
  `vaco-analytics/CORPORATE_COMMAND_CENTER.md` and does not exist.
  Both were verified by direct search, not taken on the document's
  word.
- **Tool caveats carried through rather than dropped.**
  `vacon-c/CHARACTER_MODEL_ANIMATION_PIPELINE.md`'s own note that
  Mixamo is "aging but functional" is exactly this directive working
  during the design phase, and it shaped a real decision: clip names
  were kept generic and few so either Mixamo or AccuRIG satisfies them.

**The "flag, don't silently replace" boundary has been respected, and
one case is worth naming** because it is the closest call. The Leslie
and Deskins tool stacks were identified as a small, obviously-correct
change — and were deliberately *not* made when first found, because
they alter live agent behavior. They were held, flagged, and applied
only after a decision came back. That is the boundary working as
intended rather than as a formality.

**Where the directive's own examples stand today:**

| Example it names | Status |
|---|---|
| Postgres migration tooling | Migration itself still unstarted — see `v3/V3_FIRST_PROMPT.md`. Nothing to evaluate yet, and it remains V3's highest-value open item. |
| AI 3D asset generation service | Research placed at `vacon-c/AI_3D_ASSET_GENERATION_COST_REDUCTION.md`. VACON-C is paused; revisit at build time, as instructed. |
| Bundled datasets (Cesium, UNESCO, Overture) | None are integrated in this repo. Access terms genuinely should be rechecked before use — they are the kind of thing that changes quietly. |

**One addition this directive should absorb, learned the hard way
across this project.** The four `checkFor` items are all about
*external* things — newer libraries, changed practices, better tools.
The most expensive misses here have been *internal*: documents
asserting that a capability is already built when it is not. That
failure mode has now recurred at least four times, and each time it
led to real work being scoped against a foundation that did not exist.

Worth treating as a fifth check, phrased as a rule rather than a
sentiment: **a document claiming something is already built is not
evidence that it is — verify by search before scoping on top of it.**
The verification costs one grep. Not doing it has repeatedly cost
whole plans.
