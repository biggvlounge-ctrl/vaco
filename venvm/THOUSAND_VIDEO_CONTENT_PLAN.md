# VENVM — Thousand-Video Content Plan (v1)

## Length tiers

| tier | range |
|---|---|
| Short | 5–19s |
| Medium | 20–59s |
| Long-form | 60–299s |
| Flagship | 300s+ |

*(Originally specified as 5–15s / 30–60s / 120–300s / 300s+. Made
contiguous 2026-08-28 — see the status section.)*

## Destination routing

| destination | videos |
|---|---|
| DREAMS / VMall | 350 |
| HVNTZ business content | 200 |
| Vvltvre Flix | 100 |
| VXLLAGE / CHOPZ social | 100 |

## Open gaps, named

Three real gaps, confirmed and still needing resolution:

1. **No owner for script/creative writing.** This becomes VENVM's real
   input — the pipeline has nothing to produce without it.
2. **No calculated production timeline** for throughput at this volume.
3. **No content review/compliance process** before publishing.

These are process decisions, not code — but worth deciding before this
content pipeline runs at scale.

---

## Implementation status — filed 2026-08-28; the structural half **built**

Filed per `VACO.md`'s filing form, under Vvltvre (parent #16) where
VENVM lives. Classified **CODE-BEARING**: the tiers and the routing are
rules a program can get wrong, not planning prose, and they now live in
`venvm/lib/contentRouting.js` with 24 tests and ten mutation-verified
rules.

### The arithmetic this plan does not do for itself

**350 + 200 + 100 + 100 = 750, against a planned 1,000.** 250 videos
are unassigned to any destination.

Two tidy-looking resolutions would both have been wrong. Scaling the
four numbers up to reach 1,000 invents an allocation nobody decided;
changing the total to 750 discards a quarter of the plan. So
`UNALLOCATED = 250` is a named constant, `describePlan()` reports it,
and a destination that hits its cap says so *and* points at the
unassigned pool — because "Vvltvre Flix is full" and "there are 250
videos with nowhere to go" are the same conversation.

When somebody decides where those 250 belong, there is one place to
put the decision.

### The gaps were surfaced, then closed by decision

The tiers as originally specified left 16–29s and 61–119s in no tier at
all. A classifier that snapped a 20-second video into "Short" would
always answer, and the answer would sometimes be invented — the same
too-loose-match failure this repo has now hit five times. So the gap was
reported rather than rounded away, and `classifyLength` refused those
durations with a reason saying which way they fell.

**Closed 2026-08-28 by direct decision**: extend the existing
boundaries rather than invent a fifth tier for the orphans. Short
5–19s, Medium 20–59s, Long-form 60–299s, Flagship 300s+. No gaps, no
invented middle tier.

`assertContiguous()` now proves the property structurally — it names
any hole between two tiers, and fails if the last tier stops being
open-ended. A second test walks every second from the floor to 400 and
asserts it matches exactly one tier, which catches overlaps as well as
holes. Both were mutation-verified: reopening a gap, overlapping two
tiers, and capping the last one all fail.

**The 5s floor stays, and is not a gap.** A 2-second clip is not a
Short. It is refused with `below the 5s floor … will not be rounded
up`, which is a real lower bound on the plan rather than a hole in the
middle of it.

### Tier/destination fit, because the routing is not just a count

Each destination declares which tiers suit it, and the pairing is
enforced rather than assumed:

- **DREAMS / VMall** takes short and medium. Screen content in a retail
  space is watched in passing; nothing long-form belongs on it.
- **HVNTZ business** takes medium and long-form.
- **Vvltvre Flix** takes long-form and flagship. A catalogue title is
  not fifteen seconds.
- **VXLLAGE / CHOPZ social** takes short and medium.

`assertRoutable` is wired into `createProductionJob`, so a video that
could never be routed is never produced — the same posture as the
likeness-consent gate that already sits there. Jobs predating the plan
keep working with no routing recorded, and destination/duration are
both-or-neither, because a half-declared routing sails through
unchecked.

### On VMall specifically

VMall has no app in this repo, and correctly should not: it is a
physical placement of the DREAMS screen network, not a separate
service. HVNTZ's own revenue-stack document puts it plainly —
"installed for DREAMS/VMall, just a new function on the same screen."
So `dreams-vmall` is one destination pointing at the real `dreams` app,
with that note recorded on the destination itself. Checked rather than
assumed: a test asserts every destination points at a directory that
actually exists.

### The three open gaps — unchanged, and deliberately not invented

Script ownership, production timeline, and the review/compliance
process remain **process decisions with no owner**, exactly as this
document states. Nothing was built for them and nothing should be:

- A **script owner** is a person or a team, not a module. `scriptEngine.js`
  already accepts requests; what it lacks is somebody to write them.
- A **timeline** for 1,000 videos depends on that owner's real
  throughput. Any number invented here would be fiction with a
  spreadsheet's authority.
- A **review/compliance process** is the one with teeth, and it stays
  a **human process by direct decision** — not code. VENVM already
  refuses to render without likeness consent (`likenessConsent.js`
  throws rather than warns, per standing instruction), but that is one
  specific check, not a review.

  **Nothing in this pipeline gates publishing on human review, and
  nothing should be built that pretends to.** An automated pass-through
  would look like a control and act like a rubber stamp — worse than
  the acknowledged gap, because it would stop anyone asking who is
  reviewing. This is a **staffing gap, tied to the still-open
  script/creative-writing hire**, not a middleware one. It stays
  flagged here until a person owns it.
