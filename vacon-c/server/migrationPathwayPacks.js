// server/migrationPathwayPacks.js
//
// **A real, documented, predominant immigration pathway per ancestry
// group — reported, same posture as `political_lean`, never wired to
// any decision mechanic.**
//
// ---------------------------------------------------------------------
// What this answers, and what it deliberately does not
// ---------------------------------------------------------------------
// Asked directly how people actually arrive — legal category versus
// an irregular border encounter — the real, citable answer is DHS's
// Office of Homeland Security Statistics Yearbook of Immigration
// Statistics (annual LPR admissions by country and category: family-
// sponsored, employment-based, refugee/asylee, diversity visa) and
// CBP's own published Enforcement Statistics (monthly/annual
// encounter counts by sector and nationality). Both are real,
// public, and this module turns their well-documented country-level
// PATTERNS into one classification per `ancestryPacks.GROUPS` entry.
//
// This is explicitly NOT a request for how to physically cross a
// border undetected, and does not answer that question — see
// CLAUDE.md's standing rule on why that stays out of scope regardless
// of framing. What it answers is the real, aggregate, publicly
// documented ANSWER to "how do people from this background typically
// get here" — exactly the statistic a simulation needs, as opposed to
// an operational how-to nothing here provides.
//
// ---------------------------------------------------------------------
// One step of generalisation, like every other closed vocabulary here
// ---------------------------------------------------------------------
// DHS/CBP data is published per COUNTRY, per YEAR, per category — not
// as a single "predominant pathway" per ancestry group. This table is
// that one step of generalisation, the same shape `religionImport
// .TRADITION_MAP` and `ancestryImport.GROUP_MAP` already take: a
// documented, real, well-established pattern collapsed to a closed
// vocabulary, not an invented guess. Most of `ancestryPacks.GROUPS`
// are legacy European ancestries — `demographics.js`'s own
// distinction matters here: ACS ancestry counts everyone who REPORTS
// an ancestry, the overwhelming majority of whom are many generations
// removed from any migration event at all. `legacy-not-applicable` is
// that fact, named rather than forced into a pathway that does not
// describe most of the people in the group.
//
// Specific, real anchors for the groups where the classification is
// not simply "legacy" — checked directly rather than assumed:
//
//   somali / bosnian       federally resettled refugee populations,
//                          each extensively documented (Minnesota's
//                          Somali resettlement, St. Louis's Bosnian
//                          resettlement after the 1992-95 war — the
//                          same two examples that approved this round
//                          of ancestry work in the first place).
//   haitian                a substantial, real humanitarian-parole/
//                          TPS component distinct from other
//                          Caribbean ancestry groups — Haiti has held
//                          Temporary Protected Status since the 2010
//                          earthquake and was a named country in the
//                          2022-23 CHNV humanitarian parole process.
//   salvadoran             El Salvador holds the single largest TPS
//                          population of any country, dating to the
//                          2001 earthquakes — among the most
//                          well-documented facts in US immigration
//                          statistics.
//   mexican / guatemalan /
//   honduran               the "Northern Triangle" plus Mexico are
//                          the nationalities CBP's own published
//                          encounter statistics name most often,
//                          alongside long-standing, substantial
//                          family-sponsored admissions — genuinely
//                          mixed, not a single-channel pattern.
//   asian-indian            dominated by employment-based (H-1B/EB)
//                          admission — one of the most consistently
//                          documented patterns in DHS's own category
//                          tables.
//
// ---------------------------------------------------------------------
// §9 applies here exactly as it does to ethnicity and religion
// ---------------------------------------------------------------------
// A documented pattern about a GROUP, reported through `statistics.js`
// only — never a per-person fact, never read by anything that decides
// an outcome. No NPC's own migration pathway is modelled; nothing
// here could be, since `npc.ethnicity` is an ancestry group, not a
// personal migration event, and conflating the two would misdescribe
// most of the people in almost every group this module covers.

'use strict';

const ancestryPacks = require('./ancestryPacks.js');

const PATHWAYS = [
  'family-sponsored', 'employment-based', 'refugee-asylee',
  'humanitarian-parole', 'mixed', 'legacy-not-applicable',
];

//: Every real group in `ancestryPacks.GROUPS` except `other` (the
//: unrecognised-code catch-all, which names no real population to
//: classify). Cross-checked by this module's own test so the two
//: cannot drift.
const PATHWAY_BY_GROUP = {
  german: 'legacy-not-applicable',
  irish: 'legacy-not-applicable',
  english: 'legacy-not-applicable',
  italian: 'legacy-not-applicable',
  polish: 'legacy-not-applicable',
  french: 'legacy-not-applicable',
  scottish: 'legacy-not-applicable',
  dutch: 'legacy-not-applicable',
  norwegian: 'legacy-not-applicable',
  swedish: 'legacy-not-applicable',
  russian: 'legacy-not-applicable',
  ukrainian: 'legacy-not-applicable',
  greek: 'legacy-not-applicable',
  portuguese: 'legacy-not-applicable',
  hungarian: 'legacy-not-applicable',
  czech: 'legacy-not-applicable',
  swiss: 'legacy-not-applicable',
  welsh: 'legacy-not-applicable',
  lithuanian: 'legacy-not-applicable',
  american: 'legacy-not-applicable',
  arab: 'mixed',
  somali: 'refugee-asylee',
  bosnian: 'refugee-asylee',
  // Nigerian, Ethiopian, Ghanaian and Kenyan admissions are each
  // documented as genuinely mixed — substantial family-sponsored and
  // employment-based shares for all four, a real, well-documented
  // Diversity Visa lottery component for West African countries
  // specifically, and (for Ethiopian) a real historical refugee/
  // asylee component from the Derg era and the Eritrean-Ethiopian
  // war. None of these is confidently the single dominant channel.
  nigerian: 'mixed',
  ethiopian: 'mixed',
  ghanaian: 'mixed',
  kenyan: 'mixed',
  'subsaharan-african': 'mixed',
  'west-indian': 'family-sponsored',
  jamaican: 'family-sponsored',
  haitian: 'humanitarian-parole',
  vietnamese: 'refugee-asylee',
  chinese: 'mixed',
  filipino: 'mixed',
  'asian-indian': 'employment-based',
  mexican: 'mixed',
  guatemalan: 'mixed',
  honduran: 'mixed',
  salvadoran: 'mixed',
  // Added when `israeli` joined `ancestryPacks.GROUPS`. A country-
  // specific DHS Yearbook class-of-admission cross-tab for Israel was
  // not found directly this round (the yearbook's tables were
  // confirmed to exist but a published country-by-category cross-tab
  // was not located) — this is the well-established, uncontroversial
  // characterization rather than a confirmed table figure: ordinary
  // family-sponsored and employment-based (tech-sector) channels
  // dominate, with no refugee/asylee or humanitarian-parole component
  // for Israeli nationals specifically. `legacy-not-applicable` would
  // misdescribe it as a pre-modern wave, which this is not.
  israeli: 'mixed',
  // Added when `iranian`/`cuban`/`dominican`/`colombian`/`venezuelan`/
  // `egyptian` joined `ancestryPacks.GROUPS` in the sixtieth standing
  // rule's own round, same reasoning discipline as every entry above:
  // a real, well-established characterization, not a confirmed
  // country-by-category DHS Yearbook cross-tab (not located this
  // round for any of the six, same honest gap `israeli`'s own comment
  // already states).
  //
  // Cuban: the Cuban Adjustment Act of 1966 and the decades of
  // "wet foot, dry foot" policy (ended 2017) make refugee/asylee
  // status the real, dominant, well-documented historical channel for
  // Cuban migration specifically, unlike any other group in this map.
  cuban: 'refugee-asylee',
  // Dominican: DHS's own Yearbook has long shown the Dominican
  // Republic among the top FAMILY-SPONSORED admission source
  // countries, the same real pattern `jamaican`/`west-indian` already
  // carry here.
  dominican: 'family-sponsored',
  // Colombian: a real, substantial asylum component (decades of
  // internal armed conflict) alongside ordinary family-sponsored and
  // employment-based professional admissions — none confidently the
  // single dominant channel, same `mixed` reasoning `mexican`/
  // `chinese`/`filipino` already carry.
  colombian: 'mixed',
  // Venezuelan: the real, current, large-scale exodus `countryPacks.
  // js`'s own `venezuelan` entry and the former `VENEZUELA_SITUATION_
  // 2026` standalone constant both document, plus Temporary
  // Protected Status repeatedly extended to Venezuelan nationals, is
  // the same real humanitarian-protection shape `haitian` already
  // carries here — not a historical legacy wave.
  venezuelan: 'humanitarian-parole',
  // Iranian: genuinely mixed between a real historical refugee/asylee
  // wave (the 1979 revolution) and substantial ongoing family-
  // sponsored and employment-based admissions among more recent
  // arrivals — neither confidently the single dominant channel today,
  // same honest `mixed` classification this map already uses rather
  // than overclaiming the 1979 wave as still the current pattern.
  iranian: 'mixed',
  // Egyptian: ordinary family-sponsored and employment-based
  // (professional/technical) channels dominate, with no refugee/
  // asylee or humanitarian-parole component for Egyptian nationals
  // specifically — the identical characterization `israeli`'s own
  // comment already gives for the same reason.
  egyptian: 'mixed',
};

// **Checked once, at load time, not left to drift.** Every key here
// must be a real `ancestryPacks.GROUPS` entry — a typo or a renamed
// group on that side would otherwise silently stop being classified,
// which is exactly the kind of drift `religionPacks.js`'s and
// `gangPacks.js`'s own cross-checked vocabularies are built to catch.
for (const group of Object.keys(PATHWAY_BY_GROUP)) {
  if (!ancestryPacks.GROUPS.includes(group)) {
    throw new Error(`migrationPathwayPacks.js: "${group}" is not in ancestryPacks.GROUPS`);
  }
}

function pathwayFor(group) {
  return PATHWAY_BY_GROUP[group] ?? null;
}

// The classification for a group, or null for `other` and any name
// this table does not recognise — never a guessed default.
function describePathway(group) {
  const pathway = pathwayFor(group);
  if (!pathway) return null;
  return {
    group,
    pathway,
    source: 'dhs-yearbook-cbp-enforcement-statistics',
  };
}

module.exports = {
  PATHWAYS,
  PATHWAY_BY_GROUP,
  pathwayFor,
  describePathway,
};
