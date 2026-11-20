// server/namedGangPacks.js
//
// **Real, named, documented street gangs — an organizational fact,
// not an individual one — for the real cities this registry's own
// sources actually cover at this detail: Los Angeles, New York,
// Chicago, St. Louis and Miami (CLAUDE.md's hundred-and-fifty-first
// and hundred-and-fifty-third standing rules).**
//
// ---------------------------------------------------------------------
// Scope decision made directly with the user
// ---------------------------------------------------------------------
// A gang is a real, public, documented ORGANIZATION — court records,
// DOJ/FBI reporting, and peer-reviewed criminology (Brotherton &
// Barrios's 2004 study of the Almighty Latin King and Queen Nation is
// the clearest example) all name it the same way this registry
// already names real political parties, companies and denominations.
// That is a different and narrower thing than the real named
// INDIVIDUALS this project has repeatedly declined to model
// (CLAUDE.md's thirty-second/thirty-eighth standing rules) — nothing
// here is a roster of members, and no generated NPC is ever a real
// person by name.
//
// `gangPacks.js` already reads real ANONYMOUS counts and membership
// rates (OJJDP NYGS data) for any jurisdiction a pack names. This
// file is the real named layer gangPacks.js explicitly does not
// attempt: the GANG'S OWN NAME, where real documentation actually
// supports naming one, which it does for exactly two cities.
//
// ---------------------------------------------------------------------
// Why these cities and no others — the same shape as `crimeHotspotPacks.js`
// ---------------------------------------------------------------------
// FBI NGIC's National Gang Report series (most recently confirmed
// edition: 2015, NCJ 311089) names gang families and trends but not
// a per-city named roster at this grain. The real, citable, NAMED
// detail — a specific gang's real city of origin, real era, and real
// documented presence — exists at useful depth for Los Angeles
// (Crips, Bloods, 18th Street, MS-13), New York (the Almighty Latin
// King and Queen Nation, Trinitarios, United Blood Nation, Ñetas),
// Chicago (Vice Lords, Gangster Disciples, Black Disciples, Mickey
// Cobras), St. Louis (Cochran Crips, 55 Boyz) and Miami (Zoe Pound,
// Zoe Mafia Family). Checked and explicitly NOT built this round for
// lack of a citable source at this grain: a Haitian/Caribbean/African
// gang presence in New York specifically (real federal cases exist
// for Haiti-based groups like 400 Mawozo, but none confirm a
// structured NYC street presence), and a Houston "Hoover Criminals"
// chapter (real elsewhere, unconfirmed in Houston beyond one 2017
// incident). A pack covers ONE of these real cities, same as
// `crimeHotspotPacks.js`'s own LA/Chicago choice — a world generated
// for any other city gets no pack and is unaffected.
//
// ---------------------------------------------------------------------
// Disagreement is carried, never smoothed over
// ---------------------------------------------------------------------
// Real sources genuinely disagree on some of this — Trinitarios'
// founding date (1993 Rikers Island per the dominant account, versus
// a law-enforcement source suggesting 1970s roots), and gang
// membership counts generally (NYPD-linked figures cited 3x apart in
// different reports; the one LASD figure found carries no attributed
// year). Each entry's `originEra`/`membershipNote` says so explicitly
// rather than picking a side — the same "declare the uncertainty"
// discipline this registry already holds for NOI/MSTA membership and
// for the NYGS self-report undercount (`gangPacks.js`'s own
// `describeUndercountCaveat`).
//
// **One real, explicit correction a naive version of this would have
// missed**: the East Coast "Bloods" (United Blood Nation, 1993 Rikers
// Island, formed as self-protection against Latin King dominance in
// NYC jails) and the West Coast "Bloods" (Los Angeles, 1972) share a
// name and red iconography but are organizationally DISTINCT real
// lineages — this file keeps them as two separate entries under two
// separate cities rather than letting the shared name imply one
// organization operates both coasts.
//
// ---------------------------------------------------------------------
// Drug/firearms trafficking data as context, not as a precise number
// ---------------------------------------------------------------------
// ATF trace reporting and the NY Attorney General's "Target on
// Trafficking" work document the I-95 "Iron Pipeline" as the dominant
// real corridor for crime guns recovered in New York; DEA's National
// Drug Threat Assessment series documents cartel-to-local-gang supply
// structure and, since 2019, breaks gang presence out by DEA field
// division. Both are real and citable as to DIRECTION — this is
// genuinely why these two cities are the right real-world anchors —
// but the research behind this file could not confirm exact current
// percentages against the primary ATF/DEA tables, so `traffickingContext`
// below is a citation and a direction, never a number this file could
// not verify. Nothing downstream reads it as a multiplier.
//
// ---------------------------------------------------------------------
// §9 applies here exactly as everywhere else in this registry
// ---------------------------------------------------------------------
// A real gang's name, origin city and era are facts about an
// organization. Nothing here reads an NPC's own ethnicity, ancestry
// or any other demographic field to decide gang membership or
// behaviour — `worldgen.js`'s own existing `gangMembershipRate`/
// `factionCount` draw is completely unchanged; this file only ever
// supplies a real NAME for a faction that draw already created.

'use strict';

const SOURCES = ['fbi-ngic-doj-academic', 'sample'];

//: `world-layer/` (if this pack is ever exported from there) would
//: name the same two real cities `crimeHotspotPacks.js` already uses
//: for an unrelated real source — kept as its own list here because
//: the two registries are not guaranteed to cover the same cities
//: forever, and a cross-reference would be the eighteenth standing
//: rule's own trap (two modules trusting one undeclared constant).
const CITIES = ['los-angeles', 'new-york', 'chicago', 'st-louis', 'miami'];

// **`'current-activity-only'`, added for Chicago/St. Louis/Miami
// (CLAUDE.md's hundred-and-fifty-third standing rule).** Different
// from `'disputed-founding'`: that tier means multiple real sources
// name CANDIDATE founding dates that disagree. This tier means no
// source found during this round's research names ANY founding date
// at all — only a real, current, DOJ/court-documented existence and
// prosecution record. Declaring the gap honestly (standing rule
// twenty-five's own "a declared gap beats a fabricated number") beats
// inventing an era to satisfy the schema.
const CONFIDENCE_LEVELS = [
  'well-sourced', 'disputed-era', 'disputed-founding', 'current-activity-only',
];

function validatePack(pack) {
  const problems = [];
  if (!pack || typeof pack !== 'object') return ['a pack must be an object'];
  if (!pack.region) problems.push('pack.region is required — a pack is per-region by definition');
  if (!SOURCES.includes(pack.source)) {
    problems.push(`pack.source must be one of: ${SOURCES.join(', ')}`);
  }
  if (!CITIES.includes(pack.city)) {
    problems.push(`pack.city must be one of: ${CITIES.join(', ')} — a pack covers one real city`);
  }
  if (!Array.isArray(pack.gangs) || pack.gangs.length === 0) {
    problems.push('pack.gangs must be a non-empty array');
    return problems;
  }

  pack.gangs.forEach((g, i) => {
    const where = `gangs[${i}]${g?.name ? ` (${g.name})` : ''}`;
    if (!g?.name) problems.push(`${where}: name is required`);
    if (!g?.originCity) problems.push(`${where}: originCity is required`);
    if (!g?.originEra) problems.push(`${where}: originEra is required`);
    if (g.confidence !== undefined && !CONFIDENCE_LEVELS.includes(g.confidence)) {
      problems.push(`${where}: confidence must be one of: ${CONFIDENCE_LEVELS.join(', ')}`);
    }
  });
  return problems;
}

function assertPack(pack) {
  const problems = validatePack(pack);
  if (problems.length > 0) {
    throw new Error(`named gang pack is not usable:\n  - ${problems.join('\n  - ')}`);
  }
  return pack;
}

function packFor(worldState) {
  return worldState?.namedGangPack ?? null;
}

// The real gang for a faction at this position, cycling if there are
// fewer real gangs than factions drawn for the city — null when there
// is no pack, which keeps the caller's own invented "Surname Crew"
// name as the fallback it already is.
function gangFor(pack, position) {
  if (!pack || !Array.isArray(pack.gangs) || pack.gangs.length === 0) return null;
  const index = ((position % pack.gangs.length) + pack.gangs.length) % pack.gangs.length;
  return pack.gangs[index];
}

// ---------------------------------------------------------------------
// The two real packs this file actually carries
// ---------------------------------------------------------------------
const LOS_ANGELES_PACK = {
  region: 'us-los-angeles',
  source: 'fbi-ngic-doj-academic',
  city: 'los-angeles',
  gangs: [
    {
      name: 'Crips',
      originCity: 'Los Angeles (South Central)',
      originEra: 'late 1960s, commonly dated 1968-69',
      confidence: 'well-sourced',
      note: 'DOJ/FBI materials and academic/journalistic histories '
        + '(BlackPast, Stanford) concur on origin city and era.',
    },
    {
      name: 'Bloods',
      originCity: 'Los Angeles',
      originEra: 'early 1970s, commonly dated 1972',
      confidence: 'well-sourced',
      note: 'Formed explicitly as a response/protection network against '
        + 'Crips expansion. Organizationally distinct from the later, '
        + 'separate East Coast "United Blood Nation" lineage (see the '
        + 'New York pack) despite the shared name and red iconography.',
    },
    {
      name: '18th Street',
      originCity: 'Los Angeles (Rampart District)',
      originEra: 'a split from the Clanton 14 gang; sources disagree on the '
        + 'decade (1960s per some accounts, took its modern multi-ethnic '
        + 'form in the 1980s per InSight Crime)',
      confidence: 'disputed-era',
      note: 'One of the largest multi-ethnic street gangs in Los Angeles. '
        + 'Later became a bitter rival of MS-13 as both spread via '
        + 'deportation into Central America.',
    },
    {
      name: 'MS-13 (Mara Salvatrucha)',
      originCity: 'Los Angeles',
      originEra: '1980s',
      confidence: 'well-sourced',
      note: 'Formed by Salvadoran immigrant youth, initially in parallel/'
        + 'rivalry with 18th Street rather than as a splinter of it '
        + '(InSight Crime).',
    },
  ],
  traffickingContext: 'ATF trace reporting documents the I-95 "Iron '
    + 'Pipeline" corridor as the dominant real source of crime guns in '
    + 'New York specifically, not Los Angeles -- cited here for honesty '
    + 'about scope: this pack carries no trafficking-corridor claim for '
    + 'Los Angeles, only the real gang roster above. DEA National Drug '
    + 'Threat Assessment editions since 2019 document cartel-to-local-gang '
    + 'supply structure feeding West Coast street distribution generally, '
    + 'directionally real but not reduced to a number here.',
};

const NEW_YORK_PACK = {
  region: 'us-new-york',
  source: 'fbi-ngic-doj-academic',
  city: 'new-york',
  gangs: [
    {
      name: 'Almighty Latin King and Queen Nation (ALKQN)',
      originCity: 'New York City (parent Latin Kings organization founded '
        + '1954 in Chicago)',
      originEra: 'NYC chapter founded 1986',
      confidence: 'well-sourced',
      note: 'Documented in Brotherton & Barrios (2004), "Globalization and '
        + 'the Almighty Latin King and Queen Nation" (Columbia University '
        + 'Press), and Berardi & Bucerius (2020, Canadian Journal of '
        + 'Sociology). The Chicago-founded parent organization is a '
        + 'distinct real fact from the NYC chapter named here.',
    },
    {
      name: 'Trinitarios',
      originCity: 'New York City (Rikers Island)',
      originEra: 'commonly dated 1993, formed by Dominican inmates; one '
        + 'law-enforcement source (a 2018 Telemundo interview with an NYPD '
        + 'detective) disputes this, suggesting 1970s roots',
      confidence: 'disputed-founding',
      note: 'Reported founding partly as protection against rival groups, '
        + 'including the Latin Kings, in NYC jails.',
    },
    {
      name: 'United Blood Nation (UBN)',
      originCity: 'New York City (Rikers Island, George Motchan Detention '
        + 'Center)',
      originEra: '1993',
      confidence: 'well-sourced',
      note: 'Formed as self-protection against Latin King dominance in NYC '
        + 'jails, later spreading to NYC streets and other East Coast '
        + 'states. Organizationally DISTINCT from the Los Angeles-origin '
        + '"Bloods" (see the Los Angeles pack) despite the shared name and '
        + 'iconography -- a real, separate lineage, not a branch office.',
      membershipNote: 'Estimated roughly 7,000-15,000, dated and '
        + 'approximate -- carried as a range, not a point estimate.',
    },
    {
      name: 'Ñetas',
      originCity: 'Puerto Rico',
      originEra: 'real, documented New York City presence; shifted toward '
        + 'a less violent, more community/advocacy-oriented posture in '
        + 'NYC in the mid-1990s',
      confidence: 'well-sourced',
      note: 'The mid-1990s posture shift is documented in academic '
        + 'conference work (Lamotte); current relations with other named '
        + 'groups are reported only in lower-confidence sources and are '
        + 'deliberately not carried here.',
    },
  ],
  traffickingContext: 'ATF trace reporting and the New York Attorney '
    + 'General\'s 2016 "Target on Trafficking" report document the I-95 '
    + '"Iron Pipeline" (Georgia/Florida/the Carolinas/Virginia/'
    + 'Pennsylvania) as the dominant real corridor for crime guns '
    + 'recovered in New York City -- real and directionally citable, but '
    + 'the exact current percentage could not be verified against a '
    + 'primary ATF table in the research behind this file, so no number '
    + 'is carried, only the citation and the direction.',
  membershipCountCaveat: 'NYPD-linked gang-membership figures for New York '
    + 'City have been cited as far apart as roughly 1,200 and roughly '
    + '3,200 in different reports -- carried here as a real, documented '
    + 'disagreement, not resolved to one number.',
};

// ---------------------------------------------------------------------
// Three more real cities (CLAUDE.md's hundred-and-fifty-third standing
// rule) -- by direct instruction to extend this beyond LA/NY, checked
// city by city rather than assumed. Two real findings changed what got
// built here from what was asked for by name:
//
// - **No live, official gang-territory map exists for Chicago either**
//   (CPD does not release one -- the thirty-third standing rule's own
//   finding, re-confirmed). `territoryNote` says so on the pack rather
//   than inventing turf boundaries.
// - **St. Louis's "62"/"Six-Deuce"/"Six-O" (Hoover Crips) could not be
//   verified by any source stronger than an informal community map.**
//   Two OTHER St. Louis gangs genuinely are DOJ/EDMO-documented --
//   Cochran Crips and 55 Boyz -- and this pack carries those instead
//   of fabricating a "62" founding/presence this round's research
//   could not confirm.
// ---------------------------------------------------------------------
const CHICAGO_PACK = {
  region: 'us-chicago',
  source: 'fbi-ngic-doj-academic',
  city: 'chicago',
  gangs: [
    {
      name: 'Vice Lords',
      originCity: 'Chicago (14th Street Clovers, organized while '
        + 'incarcerated at the St. Charles Reformatory for Boys)',
      originEra: 'late 1950s',
      confidence: 'well-sourced',
      note: 'Multiple convergent historical accounts. Real documented '
        + 'branches exist (Conservative Vice Lords, Traveling Vice '
        + 'Lords) -- carried as a note, not as separate roster entries, '
        + 'since this pack names organizations, not internal factions.',
    },
    {
      name: 'Gangster Disciples',
      originCity: 'Chicago (Englewood/South Side)',
      originEra: 'disputed -- real sources place founding anywhere from '
        + '1963 to 1969',
      confidence: 'disputed-founding',
      note: 'Real, historically documented founders: Larry Hoover and '
        + 'David Barksdale (named here as a historical/citation fact '
        + 'about the organization, same as Noble Drew Ali for MSTA -- '
        + 'neither is modeled as a simulated NPC; see the generic '
        + 'incarcerated-leader archetype for the structural role '
        + 'instead). The 1969 "Lords, Stones and Disciples" (LSD) peace '
        + 'alliance with the Vice Lords and Black P Stones is a real, '
        + 'named, citable historical event.',
    },
    {
      name: 'Black Disciples',
      originCity: 'Chicago (South Side)',
      originEra: 'split from the Gangster Disciples after David '
        + "Barksdale's death in 1991 (his killing is itself documented "
        + 'as carried out by Gangster Disciples)',
      confidence: 'well-sourced',
      note: 'The split and the 1991 killing are independently '
        + 'documented facts about the organizations, not about any '
        + 'individual modeled here.',
    },
    {
      name: 'Mickey Cobras',
      originCity: 'Chicago',
      originEra: 'disputed and weakly sourced -- one account places '
        + 'origin in 1954 as the "Egyptian Cobras" under James Cogwell; '
        + 'another holds the "Mickey Cobra Nation" name dates to a 1966 '
        + 'renaming after Henry "Mickey" Cogwell (d. 1977)',
      confidence: 'disputed-founding',
      note: 'The weakest-sourced entry in this pack -- most available '
        + 'material is Wikipedia-mirror tier rather than a primary DOJ/'
        + 'academic source. Carried at low-moderate confidence rather '
        + 'than omitted, same as this registry\'s other thin-but-real '
        + 'findings (e.g. `countryPacks.js`\'s secondary-estimate tier).',
    },
  ],
  territoryNote: 'No live, official city gang-territory dataset exists '
    + 'for Chicago -- CPD has stated it does not release gang-boundary '
    + 'data (the thirty-third standing rule\'s own finding, '
    + 're-confirmed this round). No turf/boundary claim is carried '
    + 'here.',
  culturalContext: 'Forrest Stuart\'s Ballad of the Bullet (Princeton '
    + 'University Press, 2020) is real, peer-reviewed ethnographic work '
    + 'documenting Chicago drill music as a real territorial signal -- '
    + 'hearing a rival set\'s drill track in a neighborhood indicates '
    + 'whose turf it is. Corroborated by later peer-reviewed/academic '
    + 'work (a 2025 AoIR conference paper on driller reputation '
    + 'management; a Northwestern University thesis coding drill '
    + 'lyrics\' place-references). Carried as a citation about a real '
    + 'phenomenon, never naming or modeling any real recording artist.',
};

const ST_LOUIS_PACK = {
  region: 'us-st-louis',
  source: 'fbi-ngic-doj-academic',
  city: 'st-louis',
  gangs: [
    {
      name: 'Cochran Crips',
      originCity: 'St. Louis',
      originEra: 'not confirmed by the research behind this pack -- real '
        + 'DOJ press releases (Eastern District of Missouri) document '
        + 'current activity and federal prosecutions, not a founding '
        + 'date, and none is invented here to fill the gap',
      confidence: 'current-activity-only',
      note: 'Real and DOJ-documented at the prosecution level. The '
        + 'commonly-repeated "62"/"Six-Deuce"/"Six-O" Hoover Crips claim '
        + 'for St. Louis could not be verified by this round\'s research '
        + 'beyond an informal, non-official community map, and is '
        + 'deliberately NOT carried here -- this entry replaces it with '
        + 'what is actually citable.',
    },
    {
      name: '55 Boyz',
      originCity: 'St. Louis',
      originEra: 'not confirmed by the research behind this pack -- same '
        + 'real DOJ/EDMO prosecution-record basis as Cochran Crips, no '
        + 'founding date fabricated',
      confidence: 'current-activity-only',
      note: 'Real and DOJ-documented (Eastern District of Missouri).',
    },
  ],
  territoryNote: 'No official city-released gang-territory dataset was '
    + 'found for St. Louis either -- same posture as Chicago and Los '
    + 'Angeles/New York before it.',
};

const MIAMI_PACK = {
  region: 'us-miami',
  source: 'fbi-ngic-doj-academic',
  city: 'miami',
  gangs: [
    {
      name: 'Zoe Pound',
      originCity: 'Miami',
      originEra: '1990, founded by Haitian immigrants, originally '
        + 'self-defense-oriented',
      confidence: 'well-sourced',
      note: 'No DOJ indictment naming "Zoe Pound" as an entity was '
        + 'found in this round\'s research -- its real documented '
        + 'offshoot (see next entry) carries the federal prosecution '
        + 'record instead.',
    },
    {
      name: 'Zoe Mafia Family (ZMF)',
      originCity: 'Miami',
      originEra: 'not confirmed by the research behind this pack -- '
        + 'real federal racketeering/firearms convictions (USAO-SDFL) '
        + 'establish current documented existence, not a founding date',
      confidence: 'current-activity-only',
      note: 'Real, documented offshoot of Zoe Pound with real federal '
        + 'racketeering and firearms convictions.',
    },
  ],
  historicalContext: 'Cuban-American organized crime in Miami (the '
    + '"Cocaine Cowboys" era -- the 1979 Dadeland Mall shootout; Willy '
    + 'Falcon and Sal Magluta\'s real multi-decade cocaine network; '
    + 'T.J. English\'s The Corporation/The Last Kilo) is real and '
    + 'well-documented history, but law enforcement itself does not '
    + 'track it as a structured organization the way Zoe Pound or La '
    + 'Cosa Nostra are tracked -- "Cuban mafia" is journalistic '
    + 'shorthand, not a real org chart. Carried here as historical '
    + 'context only, deliberately NOT as a named "gang" entry, since '
    + 'building one would assert a structure this round\'s research '
    + 'found no real source documenting. Colombian cartels are reported '
    + 'to have partially displaced Cuban-American dominance from ~1975 '
    + 'on.',
};

module.exports = {
  CITIES,
  CONFIDENCE_LEVELS,
  validatePack,
  assertPack,
  packFor,
  gangFor,
  LOS_ANGELES_PACK,
  NEW_YORK_PACK,
  CHICAGO_PACK,
  ST_LOUIS_PACK,
  MIAMI_PACK,
};
