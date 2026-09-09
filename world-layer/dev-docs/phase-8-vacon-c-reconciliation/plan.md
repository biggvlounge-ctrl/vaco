# Plan — Phase 8: VACON-C reconciliation decision

## The open question, closed
Phases 2 through 7 all flagged the same unresolved question: does
`world_npcs` (and `world_locations`, `world_businesses`, etc.) replace
VACON-C's own `entities`/`npcs`/`organizations` tables, feed into
them, or run in parallel? This document makes that call.

## Decision: linked, not replaced
`world-layer`'s tables stay a **separate, shared layer**.
VACON-C's `entities`/`npcs`/`organizations`/`factions` remain the
authoritative data for VACON-C's own simulation, untouched by anything
in `world-layer`. No `world-layer` code writes to VACON-C's schema, no
VACON-C code reads from `world-layer`'s tables, as of this decision.

## Why not "replace"
VACON-C's NPC/trait/tick system is not a prototype — it's a complete,
tested, working pipeline: 128 trait definitions, 7 Key resolvers, an
11-phase tick, a real Postgres migration proven end-to-end (see
`vacon-c/dev-docs/phase-9-postgres/`), and a locked, already-completed
Day 1 scope with its own Definition of Done (the drought cascade test).
`world_npcs` (Phase 2 of this project) is, by contrast, nine fields
with no trait system, no relationships depth, no economy, and a
Postgres schema that's never been run against a live database.
Replacing the former with the latter would mean discarding real,
verified work to adopt something structurally thinner — not a
reasonable trade without an explicit request to make exactly that
trade. `vacon-c/CLAUDE.md`'s own standing rule 5 ("Ecosystem apps...
are linked to, never rebuilt") is written about VENVS/HVNTZ/etc., but
the same caution applies here by the same logic: don't casually
rebuild a working, tested system underneath itself.

## Why not silently "feed into" either
Auto-syncing VACON-C-generated NPCs into `world_npcs` (or vice versa)
was considered and rejected for now, for a narrower reason: the two
systems don't share an identity scheme. VACON-C's NPCs live under
`entities.id`; `world_npcs` has its own `id` sequence. Building a sync
would require picking how those ids map (a new join table? overloading
one as canonical?) — a real design decision with real failure modes
(what happens when a VACON-C NPC's traits change — does `world_npcs`
go stale?), not something to bolt on speculatively without a concrete
reason to write to `world_npcs` in the first place.

## What this decision actually enables
`world-layer` is free to keep developing as VACON-C's neighbor, used
by whichever app (VENVS, HVNTZ, a future VACON-C feature) actually
needs shared location/commerce/transportation/propagation/asset data,
without any risk to VACON-C's already-locked, already-verified Day 1
scope. If a real, specific feature later needs VACON-C NPCs to be
visible in `world_npcs` (e.g. a VACON-C citizen appearing in a shared
map view another app renders), that's a scoped integration task with
its own plan — not something to speculatively half-build now.

## Status
Closed. No code changes to VACON-C. No code changes to `world-layer`
beyond this document — Phases 1-7's code already reflects "linked, not
replaced" by construction (neither side references the other's
tables), this document just makes that implicit fact an explicit,
recorded decision instead of an open question.
