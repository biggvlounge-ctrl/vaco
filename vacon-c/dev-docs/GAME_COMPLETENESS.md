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

## 83% complete

```
█████████████████░░░  83%   249.75 of 301
```

| axis | complete | score | what it measures |
|---|---|---|---|
| systems | **55.6%** | 22.25/40 | urban systems with mechanics |
| tables | **63.8%** | 41.5/65 | schema tables a built world fills |
| statistics | **86.6%** | 58/67 | statistics a world can answer |
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

### systems — 26 open

The forty systems §7 names, at `server/urbanSystems.js`'s own four levels (modelled 1, partial 0.5, slot 0.15, absent 0).

| item | state | worth |
|---|---|---|
| `5. Education` | partial | +0.5 |
| `7. Transportation` *(deferred by scope)* | slot | +0.85 |
| `9. Energy` | slot | +0.85 |
| `10. Food Supply` | partial | +0.5 |
| `11. Water` | partial | +0.5 |
| `12. Waste` | slot | +0.85 |
| `13. Law Enforcement` | partial | +0.5 |
| `15. Gang` | partial | +0.5 |
| `16. Organized Crime` | partial | +0.5 |
| `17. Court` | partial | +0.5 |
| `18. Prison` | absent | +1 |
| `20. Government Services` | absent | +1 |
| `21. Fire & Emergency` | slot | +0.85 |
| `22. Communication` | partial | +0.5 |
| `23. Media` | absent | +1 |
| `24. Social Media` | absent | +1 |
| `26. Religion` | partial | +0.5 |
| `28. Business` | partial | +0.5 |
| `30. Construction` | partial | +0.5 |
| `32. Weather` | partial | +0.5 |
| `33. Disaster` | partial | +0.5 |
| `34. Supply Chain` *(deferred by scope)* | slot | +0.85 |
| `35. Military / National Guard` | absent | +1 |
| `36. Tourism` | absent | +1 |
| `38. Migration` | partial | +0.5 |
| `39. Reputation` | partial | +0.5 |

### tables — 32 open

Every `CREATE TABLE` in the schema and its extensions. A table a built world fills scores 1; one the engine writes but no world has ever used scores 0.5; one with no store at all scores 0.

| item | state | worth |
|---|---|---|
| `keys_log` | no store | +1 |
| `values_db` | no store | +1 |
| `preferences` | no store | +1 |
| `archetypes` | no store | +1 |
| `needs` | no store | +1 |
| `goals` | no store | +1 |
| `households` | no store | +1 |
| `governments` | empty in a built world | +0.5 |
| `elections` | empty in a built world | +0.5 |
| `votes` | empty in a built world | +0.5 |
| `laws` | empty in a built world | +0.5 |
| `public_opinion` | empty in a built world | +0.5 |
| `revolutions` | empty in a built world | +0.5 |
| `investments` | no store | +1 |
| `market_listings` | empty in a built world | +0.5 |
| `trade_routes` | no store | +1 |
| `migration_events` | no store | +1 |
| `economy_snapshots` | no store | +1 |
| `regions` | no store | +1 |
| `civilizations` | empty in a built world | +0.5 |
| `technology_eras` | empty in a built world | +0.5 |
| `civilization_technology_progress` | empty in a built world | +0.5 |
| `environment_state` | no store | +1 |
| `artifacts` | empty in a built world | +0.5 |
| `missions` | empty in a built world | +0.5 |
| `analytics_snapshots` | no store | +1 |
| `players` | empty in a built world | +0.5 |
| `cultures` | empty in a built world | +0.5 |
| `culture_memberships` | empty in a built world | +0.5 |
| `flow_templates` | empty in a built world | +0.5 |
| `vault_studios_links` | no store | +1 |
| `inventory` | empty in a built world | +0.5 |

### statistics — 9 open

The `server/statistics.js` catalogue, scored on whether a world can produce the number in any area at all.

| item | state | worth |
|---|---|---|
| `teenage_birth_share` | silent | +1 |
| `migration_rate` | declared gap | +1 |
| `race_and_ethnicity_composition` | declared gap | +1 |
| `informal_economy_share` | declared gap | +1 |
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

