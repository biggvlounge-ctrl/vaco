# AI 3D Asset Generation — Cost Reduction (v1)

A genuine, significant addition to cost-reduction techniques — real,
current AI tools generating game-ready 3D assets directly from text or
images.

Real current tools: Meshy AI — industry-standard text-to-3D and image-
to-3D, real PBR texturing, auto-rigging, direct export to GLB/FBX/OBJ,
30-60 second generation per asset. Tripo AI — fastest option, ~8-
second average generation, automatically optimized topology for game
engines, built-in character rigging. 3D AI Studio — a real multi-model
aggregator (Tripo, Meshy, Rodin) with a real REST API for programmatic,
automated generation.

Real quantified impact: traditional 3D modeling takes 20-40 hours per
character. These tools compress initial generation to minutes — though
hero-tier close-up assets still benefit from 1-4 hours of real manual
refinement afterward.

Where this applies in the existing tier system: filler-tier content
(homes, generic props, background vehicles, crowd NPC models) —
genuinely strong fit, exactly the repetitive content the templating
system exists for. Standard-tier content (hospitals, shopping
centers, office buildings) — a reasonable fit with some manual
refinement expected. Hero-tier content (Gateway Arch, Cahokia Mounds,
named landmarks) — NOT a good fit for pure AI generation, should
remain real dedicated human-artist work.

Real cost implication: doesn't necessarily cut the quoted rate
directly, but is a real efficiency multiplier — same tiers could
produce a larger template library in the same time, freeing budget for
more hero-tier polish elsewhere.

Worth a direct next step: ask the 3D artists directly whether they
already use tools like these, or would factor them into a revised bulk
quote for the expanded scope.

---

## Implementation status (added when this file was placed into the repo)

**Nothing to build, and this is a document about how work gets
commissioned rather than how software behaves.** It belongs with
VACON-C's existing freelancer briefs (the real 3D art brief and sound
design brief already produced for Fiverr sourcing), which is why it is
placed here.

**The tier system it references is real.** Hero / standard / filler
tiering already governs VACON-C's asset planning, and the document's
tier-by-tier judgment holds up: repetitive filler content is exactly
what generative tools are good at, and named landmarks are exactly what
they are bad at. Gateway Arch and Cahokia Mounds are recognizable
specific structures — a text-to-3D model produces something
arch-shaped, not *the* Arch, and the gap is obvious to anyone who has
seen the real thing. Keeping hero tier on human artists is right.

**One correction worth making to the cost framing.** The document says
this "doesn't necessarily cut the quoted rate directly, but is a real
efficiency multiplier." That understates a real risk in the other
direction: if a freelancer is quoting per-asset and adopts these tools,
the same quote now buys work that took them minutes rather than hours.
The "worth a direct next step" instinct is therefore the important
line in the document — and the question to ask is sharper than whether
they *use* these tools. It is whether the quote is priced per asset or
per hour, because generative tooling changes what those two mean
relative to each other.

**On the "real REST API for programmatic generation" (3D AI Studio) —
the one item here that could become code, and should not yet.** An
automated generation pipeline is buildable in principle. It would be
premature for two reasons: VACON-C is paused, and more fundamentally
this repo has no 3D asset pipeline at all to feed — no importer, no
asset registry, nowhere for a generated GLB to go. Building generation
before there is a consumer would produce files nothing reads.

**Relationship to the other pipeline document placed alongside this
one.** `CHARACTER_MODEL_ANIMATION_PIPELINE.md` covers *characters*
(source → auto-rig → animate → engine); this covers *environment and
prop assets*. They are complementary halves of the same asset strategy
and share the same division of labor: real external tools produce the
assets, code produces the logic that drives them. Neither implies the
other has shipped.
