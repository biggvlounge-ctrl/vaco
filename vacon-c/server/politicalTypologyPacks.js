// server/politicalTypologyPacks.js
//
// **The real, nonpartisan substitute for "different types of American
// politicians... neocons, Republicans, different organizations" —
// Pew Research Center's Political Typology, reported per person,
// same §9 firewall `npc.ethnicity`/`npc.islamicSect` already hold.**
//
// ---------------------------------------------------------------------
// Why this instead of naming "neocons" or current parties directly
// ---------------------------------------------------------------------
// "Neocon" has no survey behind it. It is a journalistic/polemical
// label with no agreed definition and no polling organisation that
// measures who is or is not one — unlike Sunni/Shia or Reform/
// Conservative/Orthodox, which this registry already reports from
// real national surveys (Pew 2007/2020). Naming current parties or
// factions directly would also be the same mistake `countryPacks.js`
// already declined for "specific political parties" globally: a
// party or faction label goes stale at the next election and cannot
// be verified with confidence.
//
// What IS real, rigorous and durable is Pew's own Political Typology
// — now in its ninth edition, dividing the American public into named
// groups from 30 questions on social/political values (not party
// registration, not self-described ideology label). That is the
// actual, citable answer to "what are the real identifiable political
// groups among Americans."
//
// ---------------------------------------------------------------------
// The CURRENT wave, checked directly — not the one most people would
// recall from memory
// ---------------------------------------------------------------------
// Pew published a fully revised ninth edition on 10 June 2026,
// "Beyond Red vs. Blue: The Political Typology" (survey of 10,357 U.S.
// adults, 17-30 Nov 2025), replacing the 2021 eighth edition's nine
// groups (Faith and Flag Conservatives, Progressive Left, Democratic
// Mainstays, and so on — different names, a different wave). This
// module reports the 2026 groups. The 2021 names are deliberately NOT
// used here, the same discipline this project already applies to a
// stale statistic anywhere else (`countryPacks.js`'s El Salvador note,
// `gangPacks.js`'s self-report caveat): using the superseded wave
// would misreport the current state exactly the way a stale vote
// share would.
//
// ---------------------------------------------------------------------
// Why this is a national constant, not a geographic pack
// ---------------------------------------------------------------------
// Same shape as `islamicSectPacks.js`/`jewishObservancePacks.js`: Pew's
// typology is published at the national level only, with no state or
// county breakdown to assign by §88 position. No `validatePack`/
// `assertPack`/`packFor` here, only a cited constant and a weighted-
// pick function mirroring `religionPacks.religionFor`'s own mechanism.
//
// Unlike `islamicSect`/`jewishObservance`, this has no upstream real
// field to condition on (there is no `npc.religion === 'muslim'`
// equivalent for "is American") — it is drawn unconditionally, the
// same way `npc.religion` and `npc.ethnicity` themselves are, which is
// an honest limitation stated plainly rather than hidden: this reports
// the U.S. adult public's distribution for every generated person,
// which would misdescribe a world explicitly built as a non-U.S.
// region. `demographics.js` reports it the same report-only way as
// every other composition field in this registry.
//
// ---------------------------------------------------------------------
// §9 applies here exactly as it does to npc.religion and npc.ethnicity
// ---------------------------------------------------------------------
// `npc.politicalTypology` is measured by `demographics.compositionOf`
// and read by nothing that decides an outcome — enforced the same way
// `test/ethnicity.test.js` enforces it for `npc.ethnicity`, see
// `test/political-typology-packs.test.js`.
//
// **Known, stated limitation: in-memory only.** `npcs` has no
// `political_typology` column in `VACANCY_POSTGRESQL_SCHEMA.sql`, same
// posture as `npc.ethnicity`/`npc.islamicSect` themselves.

'use strict';

const GROUPS = [
  'leftward-progressives', 'loyal-liberals', 'left-out-left', 'order-and-opportunity-left',
  'tuned-out-middle', 'pragmatic-and-polite-right', 'unconventional-right',
  'faith-first-conservatives', 'no-apologies-right',
];

//: Pew Research Center, "Beyond Red vs. Blue: The Political
//: Typology" (published 10 June 2026; survey of 10,357 U.S. adults,
//: 17-30 Nov 2025; the typology's ninth edition since it began nearly
//: 40 years ago). Shares sum to ~1.01 in Pew's own published figures
//: (rounding in the source, not an error introduced here).
const PEW_REFERENCE = {
  source: 'pew-research-political-typology-2026',
  title: 'Beyond Red vs. Blue: The Political Typology',
  publishedAt: '2026-06-10',
  surveyDates: '2025-11-17 to 2025-11-30',
  sampleSize: 10357,
  editionNumber: 9,
  checkedAt: null,
  shares: {
    'leftward-progressives': 0.07,
    'loyal-liberals': 0.11,
    'left-out-left': 0.12,
    'order-and-opportunity-left': 0.18,
    'tuned-out-middle': 0.09,
    'pragmatic-and-polite-right': 0.11,
    'unconventional-right': 0.12,
    'faith-first-conservatives': 0.12,
    'no-apologies-right': 0.09,
  },
  note: 'Supersedes the 2021 eighth-edition groups (Faith and Flag Conservatives, '
    + 'Progressive Left, Democratic Mainstays, Outsider Left, etc.) — that superseded '
    + 'wave is deliberately not reported by this module.',
};

// Cumulative cut points for a weighted pick, mirroring
// `islamicSectPacks.cutsFor`/`religionPacks.cutsFor`.
function cutsFor(shares) {
  let running = 0;
  return GROUPS.map((key) => {
    running += Number(shares[key]) || 0;
    return running;
  });
}

// Which group a unit draw (0..1) falls into, against the real
// national reference shares. Returns the last vocabulary entry if the
// draw lands past the end of the stated shares (rounding headroom,
// same handling as `islamicSectPacks.sectFor`).
function groupFor(unit) {
  const cuts = cutsFor(PEW_REFERENCE.shares);
  const total = cuts[cuts.length - 1];
  if (total <= 0) return null;
  const scaled = unit * total;
  for (let i = 0; i < GROUPS.length; i += 1) {
    if (scaled < cuts[i]) return GROUPS[i];
  }
  return GROUPS[GROUPS.length - 1];
}

function describeGroup(key) {
  if (!GROUPS.includes(key)) return null;
  return { key, shareOfPublic: PEW_REFERENCE.shares[key] ?? null };
}

module.exports = {
  GROUPS,
  PEW_REFERENCE,
  groupFor,
  describeGroup,
};
