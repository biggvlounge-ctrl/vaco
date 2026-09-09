# Plan — Phase 1: Profiles + Real Gale-Shapley Matching

## Goal
Build CVNVO's one non-negotiable engineering lift, called out explicitly
in the source docs themselves: "Gale-Shapley in practice requires real
preference-ranking data at scale... a genuine backend/algorithm build,
not a UI decision" (CVNVO_CORE_FEATURES.md). This phase is that real
build — a literal, verified stable-matching algorithm — plus the
Hinge-model profile shape that feeds it real signal instead of photos
alone.

## Design
- `lib/profiles.js`: `createUserProfile()` requires at least one real
  prompt with a non-empty answer (Hinge's real differentiator over
  Tinder's photo-only format, per the standing decision).
  `compatibilityInputs`'s exact shape isn't specified in any source
  doc beyond `{ ... }` — the shape here (age, interests, a mutual
  seeking-age range, lat/lng) is a real, flagged interpretive choice
  built specifically to feed `lib/compatibility.js`'s real scoring
  function.
- `lib/compatibility.js`: a real, deterministic, bounded [0,100] score
  combining real shared-interest overlap (Jaccard), a real MUTUAL
  age-preference check (both directions — the literal implementation
  of "who you'll like AND who's likely to like you back," not a
  one-directional filter), and real Haversine-based proximity. No
  exact formula is given in any doc; the weights are flagged
  interpretive choices, matching this session's established pattern.
- `lib/matching.js`: `stableMatch()` is the literal, textbook
  proposer-optimal Gale-Shapley algorithm over two explicit real
  preference-ranking sets. `runGaleShapley()` is the real CVNVO
  wrapper — it derives each side's actual preference ranking from the
  real compatibility score (not a swipe log), then runs the same
  verified core algorithm. `generateAndCreateMatches()` persists the
  result as real `Match` records with a real Bumble-model expiration
  (`DEFAULT_EXPIRATION_HOURS = 24`, explicitly flagged as tunable per
  CVNVO_CORE_FEATURES.md's own wording) and a real `unansweredCount`
  starting point for the later Your Turn Limits mechanic.

## Explicitly NOT in this task
- Which two groups get matched against each other (declared
  preference/orientation compatibility) is a real product-policy
  question above this algorithm, not invented here — `runGaleShapley`
  takes the two groups as an explicit input, not a derived one.
- Your Turn Limits (anti-ghosting), the "We Met" feedback loop, Yap,
  and every dating-format extension (Speed Dating, Blind Date, Long-
  Distance, Group, Gift Dating, BarBuddy, etc.) — all deliberately
  deferred; this phase is the foundational matching primitive only,
  matching this session's established "build the load-bearing piece
  first" discipline (VOID's stations, VOKEN's Cvltvre Card core,
  VAGO's currency split, VXLLAGE's Home feed).
- No VSAFE/VPLAN integration (neither exists as code anywhere in this
  session yet — flagged as an open gap in the original CVNVO
  synthesis, not silently built around).

## Verification approach
Plain-Node pass first (throwaway `.cjs` script, deleted after — 12
checks). The centerpiece: `stableMatch()` checked against a hand-
computed, worked-by-hand 3x3 preference case with a KNOWN correct
proposer-optimal result (A1-B1, A2-B2, A3-B3), plus a second, direct
stability proof — iterating every non-matched pair and confirming none
of them forms a blocking pair (both sides would have to prefer each
other over their current match). `computeCompatibilityScore` checked
against a real-world distance sanity check (NYC-LA ≈ 3,936km) and a
constructed case proving mutual age fit is genuinely bidirectional
(scores exactly 0.5, not 1.0, when only one side's preference is met).
`runGaleShapley` checked end-to-end deriving real rankings from real
scores. Then a live pass: `cvnvo/server.js` alone — real profiles
created, a live compatibility score confirmed, and a real 2v2 match
generation run against the actual server.

## A real, illustrative (not a bug) result surfaced during the live pass
Matching `{alice, carol}` against `{dave, bob}` produced `alice-dave`
(score 79.58) and `carol-bob` (score 0). This is correct, expected
Gale-Shapley behavior, not a defect: with only two candidates per
side and both alice and carol preferring dave, dave's own preference
determines who he's matched with, and the other is forced into the
only remaining option. Stability guarantees no blocking pair exists —
it does not guarantee every pairing is a good one, especially in a
small, unbalanced candidate pool. Worth keeping in mind for any future
UI/product framing (a genuinely small local pool can produce a real
bad match, same as it would in real life).

## Done when
- `stableMatch` produces the exact, hand-verified result on the
  textbook case, and independently proven stable via a direct
  blocking-pair check.
- Compatibility scoring is real, deterministic, and genuinely
  bidirectional on the mutual-fit component.
- `runGaleShapley`/`generateAndCreateMatches` correctly derive real
  rankings and persist real, expiring Match records.
- Live: the same behaviors confirmed against the actual running
  server.
