# Plan — Phase 20: Backdrop simulation, and the shared-schema alignment

## Goal
The two code-bearing pieces from the pair of documents filed with this
phase: `BackdropAreaSimulation` + the expansion trigger, and the
"don't build a parallel schema" instruction made enforceable.

## Real investigation before any code
Both documents were checked against the code first, and this time the
central premise held. `vacon-c/VACANCY_POSTGRESQL_SCHEMA.sql` is real —
760 lines, 60+ tables — and `vacon-c/server/` is a real engine that
`server.js` requires.

The qualification: `server/db.js` says in its own header that
converting the engine to query Postgres "is explicitly flagged as NOT
done in this pass." The engine still reads an in-memory WorldState.
So there is a schema, an engine and a one-way migration, and no live
table anything reads from — meaning "real rows in the same tables" is
not yet true of anything, VACANCY's own data included.

`WorldExpansionTrigger`, described as "already established," appears
nowhere in the repo. Recorded rather than absorbed.

## Design
- **Simulation must not branch on visual detail.** The document's
  central claim, asserted directly rather than assumed: identical
  samples into a backdrop area and a playable area must produce
  identical population, activity, growth and sample count.
- **`realGrowthSignal` derived, never assigned.** It decides where
  $3,000–$5,000 of art goes; a settable field is one anyone can use to
  justify a spend. Same shape as `isTableOpen` being derived from a
  dealer standing at the table.
- **`null`, not `0`, with no history.** "No signal" and "no growth" are
  different facts and lead to different decisions.
- **The trigger reports, it does not spend.** Expansion is "funded by
  real, proven revenue"; an automatic commitment would misread that.
- **Schema alignment is declared and checked, not pretended.** VDP
  declares which existing table each object belongs to; a test fails if
  any name is not a real table, and fails again if `engine.js` starts
  requiring `db.js` — the signal that the mapping should stop being
  declaration-only.

## What the mutation pass caught
The growth threshold was unreachable: every "cold" fixture also failed
population and activity, so the module could have ignored growth
entirely and stayed green. A big, busy, flat area is now its own test.

One mutation was a no-op and proved nothing; redone as a real bug
shape (validate after recording). One test was written so it could
never pass — it matched a prose phrase that wraps across two comment
lines — and was rewritten as a structural check.
