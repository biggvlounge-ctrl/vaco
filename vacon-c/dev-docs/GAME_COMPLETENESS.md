# VACON-C — how much of a complete game exists

**Generated. Do not edit.** `node vacon-c/scripts/completeness.mjs`
regenerates it and `test/completeness.test.js` fails if this file and the
code disagree.

Every number here is measured — from the source tree, or from a world that was
actually generated and run for 200 ticks (seed `complete`). Nothing in this
document is a checklist somebody ticked. That distinction is the whole reason
the file exists: this project's own status claims have been wrong every single
time they were checked — `CLAUDE.md`'s "foundation already running" list in
three places, a spec section's "roughly 25 of the 40", a catalogue of 67
statistics that a real world answered 36 of, and seven trait families generated
on every NPC and read by nothing.

## 90.8% complete

```
██████████████████░░  90.8%   321.45 of 354
```

| axis | complete | score | what it measures |
|---|---|---|---|
| systems | **72.4%** | 28.95/40 | urban systems with mechanics |
| tables | **90.2%** | 59.5/66 | schema tables a built world fills |
| statistics | **88.2%** | 105/119 | statistics a world can answer |
| traits | **100%** | 114/114 | traits something reads |
| traitDepth | **85.7%** | 6/7 | trait columns a life actually changes |
| habits | **100%** | 8/8 | habit and routine depth |

The total is weighted by item count — one statistic counts the same as one
table counts as one trait. Any other weighting is a judgement about which half
of a game matters more, and no document in this package makes that judgement,
so inventing one would put a made-up number at the top of a report whose whole
purpose is that its numbers are not made up. The per-axis figures are here so a
reader can weight them differently and say so.

## What it takes to reach 100%

Everything below is a measured gap, grouped by axis and named exactly as the
measurement names it. This is the work list.

### systems — 20 open

The forty systems §7 names, at `server/urbanSystems.js`'s own four levels (modelled 1, partial 0.5, slot 0.15, absent 0).

| item | state | worth |
|---|---|---|
| `5. Education` | partial | +0.5 |
| `7. Transportation` *(deferred by scope)* | slot | +0.85 |
| `10. Food Supply` | partial | +0.5 |
| `12. Waste` | partial | +0.5 |
| `15. Gang` | partial | +0.5 |
| `16. Organized Crime` | partial | +0.5 |
| `18. Prison` | partial | +0.5 |
| `20. Government Services` | partial | +0.5 |
| `21. Fire & Emergency` | slot | +0.85 |
| `22. Communication` | partial | +0.5 |
| `24. Social Media` | partial | +0.5 |
| `26. Religion` | partial | +0.5 |
| `28. Business` | partial | +0.5 |
| `30. Construction` | partial | +0.5 |
| `32. Weather` | partial | +0.5 |
| `33. Disaster` | partial | +0.5 |
| `34. Supply Chain` *(deferred by scope)* | slot | +0.85 |
| `35. Military / National Guard` | partial | +0.5 |
| `36. Tourism` | partial | +0.5 |
| `39. Reputation` | partial | +0.5 |

### tables — 8 open

Every `CREATE TABLE` in the schema and its extensions. A table a built world fills scores 1; one the engine writes but no world has ever used scores 0.5; one with no store at all scores 0.

| item | state | worth |
|---|---|---|
| `revolutions` | written, but unreached — assessRevolutions runs every tick; no generated world has fallen below approval 35 with 25% of the population informed | +0.5 |
| `investments` | no store — Genuinely unbuilt rather than deferred — economy.js names it alongside trade_routes and is explicit that only trade_routes is closed by the Transportation deferral. No mechanism anywhere creates, values or settles one. | +1 |
| `trade_routes` *(deferred by scope)* | no store — Transportation is on CLAUDE.md's explicit do-not-touch list, and economy.js records this table as closed scope rather than a gap for that reason. | +1 |
| `migration_events` | empty in a built world | +0.5 |
| `economy_snapshots` | no store — A TIME SERIES, which is not the same thing as a rollup, and the distinction is the open question. The third standing rule forbids storing what is computable — but supply, demand and price at tick 300 are NOT computable at tick 900, because the past is gone. So this is a real design decision nobody has made rather than a rule-3 violation: either the engine keeps a history or it accepts that only the present is answerable. `urbanSystems.js` marks it schemaOnly, which records the state without deciding it. | +1 |
| `analytics_snapshots` | no store — The same open question as economy_snapshots, one tier up: population, gdp, crime, birth and death rates and two indices, per tick. Every column is answerable about the present by `statistics.js` and none is answerable about the past. `scripts/playtest.mjs` samples its own arc precisely because nothing persists one. | +1 |
| `vault_studios_links` *(deferred by scope)* | no store — CLAUDE.md defers this twice — the fifth standing rule says ecosystem apps (Vavlt Stvdios among them) are linked to, never rebuilt, and the explicit do-not-touch list names subscription tiers and ecosystem link-outs. Its three columns are a creator id and a tier, which is the link-out and the tier verbatim. Building it would break scope in two places at once. | +1 |
| `court_cases` | empty in a built world | +0.5 |

### statistics — 14 open

The `server/statistics.js` catalogue, scored on whether a world can produce the number in any area at all.

| item | state | worth |
|---|---|---|
| `teenage_birth_share` | silent | +1 |
| `body_composition` | declared gap | +1 |
| `knowledge_stock` | declared gap | +1 |
| `informal_economy_share` | declared gap | +1 |
| `resource_stock` | declared gap | +1 |
| `conviction_rate` | silent | +1 |
| `unlegislated_crime_share` | silent | +1 |
| `state_declined_share` | silent | +1 |
| `group_answered_share` | silent | +1 |
| `camera_coverage` | declared gap | +1 |
| `street_lighting` | declared gap | +1 |
| `private_security_presence` | declared gap | +1 |
| `pollution` | declared gap | +1 |
| `terrain_and_water` | declared gap | +1 |

### traits — complete

### traitDepth — 1 open

The seven contributing columns on `entity_traits`, scored on whether a real run ever moves them. A column nothing writes means people cannot change.

| item | state | worth |
|---|---|---|
| `entity_traits.permanent_modifier` | written, but nothing distinguishes an event somebody walks away from unchanged from one that marks them — see server/traitDrift.js | +1 |

### habits — complete

## How to read a gap

**"empty in a built world" is the most actionable state in this report.** It
means the mechanism is built, tested and green, and `worldgen.js` never calls
it — so every world this engine has ever run had no such thing in it. That is
the eleventh standing rule, and it is the same finding that produced
`worldgen.js` in the first place: a generator nothing calls is indistinguishable
from a generator that does not exist. Those are half-credit because the hard
half is done.

**"no store" means the table is a shape in the schema and nothing more.** No
array, no code, no rows — full credit available.

**"never moves" on a trait column means people cannot change.** The column
exists, is migrated and is restored; nothing writes it.

