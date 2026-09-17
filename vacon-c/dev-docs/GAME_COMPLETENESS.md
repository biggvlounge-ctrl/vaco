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

## 91.4% complete

```
██████████████████░░  91.4%   304.45 of 333
```

| axis | complete | score | what it measures |
|---|---|---|---|
| systems | **71.1%** | 28.45/40 | urban systems with mechanics |
| tables | **90.9%** | 60/66 | schema tables a built world fills |
| statistics | **89.8%** | 88/98 | statistics a world can answer |
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

### systems — 21 open

The forty systems §7 names, at `server/urbanSystems.js`'s own four levels (modelled 1, partial 0.5, slot 0.15, absent 0).

| item | state | worth |
|---|---|---|
| `5. Education` | partial | +0.5 |
| `7. Transportation` *(deferred by scope)* | slot | +0.85 |
| `9. Energy` | partial | +0.5 |
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

### tables — 7 open

Every `CREATE TABLE` in the schema and its extensions. A table a built world fills scores 1; one the engine writes but no world has ever used scores 0.5; one with no store at all scores 0.

| item | state | worth |
|---|---|---|
| `revolutions` | written, but unreached — assessRevolutions runs every tick; no generated world has fallen below approval 35 with 25% of the population informed | +0.5 |
| `investments` | no store | +1 |
| `trade_routes` | no store | +1 |
| `economy_snapshots` | no store | +1 |
| `analytics_snapshots` | no store | +1 |
| `vault_studios_links` | no store | +1 |
| `court_cases` | empty in a built world | +0.5 |

### statistics — 10 open

The `server/statistics.js` catalogue, scored on whether a world can produce the number in any area at all.

| item | state | worth |
|---|---|---|
| `teenage_birth_share` | silent | +1 |
| `body_composition` | declared gap | +1 |
| `informal_economy_share` | declared gap | +1 |
| `conviction_rate` | silent | +1 |
| `unlegislated_crime_share` | silent | +1 |
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

