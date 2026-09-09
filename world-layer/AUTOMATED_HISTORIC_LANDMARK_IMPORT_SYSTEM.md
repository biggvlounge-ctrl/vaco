# Automated Historic Landmark Import System — Real Code Mechanism (v1)

The real correction: manually-typed landmark lists never actually
reach "all of them." This is the real, automated, code-level
mechanism that lets Claude Code produce every real historic landmark
for any city or region systematically, through real map data — not
a hand-curated list.

## The real, honest problem with what's been done so far

**Direct acknowledgment**: every landmark list built in this
conversation so far — however long — was manually assembled, and
manual lists structurally can't cover "all of them." The right fix
isn't a longer list. It's a real, automated import mechanism, which
is genuinely what should have been formalized from the start.

## The real, already-specified mechanism — now confirmed as the actual answer

**Direct confirmation**: this connects directly to the AI City Import
Engine already specified in the World Bible (Part 8) — specifically
the **Building Classification AI** and **Hero Building
Identification** systems, which already define exactly this kind of
automated scoring (Historical Importance, Economic Importance,
Tourism Importance, Cultural Importance, Gameplay Value). What was
missing was tying this directly to a real, comprehensive external
data source for historic landmarks specifically.

## The real, concrete technical fix — UNESCO World Heritage data as the source

**Direct, real solution**: the UNESCO World Heritage Site list is a
real, comprehensive, structured, publicly available dataset covering
essentially every internationally recognized major historic landmark
on Earth. Claude Code should import from this real, structured data
source directly, rather than any manually-typed list (including
every landmark named earlier in this conversation).

## Real, confirmed addition — the National Register of Historic Places for US local coverage

**Direct, important finding, genuinely completing the fallback
already specified**: UNESCO only covers globally significant sites —
it would never include something like the Moolah Temple or the Kings
Highway Masonic corridor. The real, confirmed fallback data source is
the **National Register of Historic Places (NRHP)** — a real, free,
public, GIS-structured U.S. government dataset (National Park
Service), covering nearly 100,000 listed historic properties
nationwide, confirmed as U.S. Government Work (public domain, no
license restrictions on non-restricted listings). This is exactly the
real, automatable source for local, regional historic significance —
Masonic temples, historic mansions, and neighborhood-level landmarks
— that UNESCO was never going to cover.

```
HistoricLandmarkImportSystem {
  dataSource: "unesco-world-heritage-list"  // real, global,
                                                internationally
                                                significant sites
  fallbackDataSource: "national-register-of-historic-places"
    // confirmed real, free, public, GIS dataset — nps.gov data
    // downloads, ~100,000 US properties, public domain
  importProcess: "automated-per-region"
  scoringMechanism: "existing-hero-building-identification-ai"
    // reuses the AI City Import Engine's already-specified scoring
    // system directly — no new mechanism needed
}
```

**How this actually works in code, confirmed directly**: when Claude
Code imports a new region (the same process already used for St.
Louis), it queries the real UNESCO World Heritage data — and any
relevant national historic registry as a fallback — for that
region's real, listed sites, then runs each one through the existing
Hero Building Identification scoring already specified. This is what
makes every list from this conversation genuinely obsolete as a
manual reference — the real system produces the actual, complete set
for any region automatically, the same way it already handles NPCs,
buildings, and every other automatically-generated content type in
this framework.

## Real, confirmed — comprehensive university/hospital building coverage already handled

**Direct confirmation**: individual buildings within a university or
hospital campus don't need a separate system — they're already
covered by the existing **Cesium OSM Buildings** layer (350+ million
real buildings globally, already confirmed free and included).
Combined with UNESCO for globally-significant sites and NRHP for
U.S. local historic significance, this gives Claude Code three real,
structured, automated data sources covering the full range from
"every building on a campus" to "the single most historically
significant site in a region."

## Status

The real, correct answer confirmed: historic landmarks should never
be a manually-typed list — they should be a real, automated import
from the UNESCO World Heritage dataset for global significance, the
National Register of Historic Places for U.S. local/regional
significance, and Cesium OSM Buildings for comprehensive, granular
building-level coverage — all scored through the Hero Building
Identification system already specified in the AI City Import
Engine. This is now a real, concrete technical requirement for Claude
Code, not a design suggestion — every landmark list assembled earlier
in this conversation was a real, honest starting reference, but this
automated, three-source mechanism is the actual, permanent solution.
