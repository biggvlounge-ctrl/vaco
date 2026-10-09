// VDP — what a migrant did for a living in the old world.
//
// Per direct instruction (9 Oct 2026): "make sure you also do what
// type of jobs, use some type of statistic to do all jobs in the old
// world from vacancy, and how those will be the skills of the people
// that come over." VACON-C's own real `server/occupations.js` is that
// statistic -- a real, named taxonomy (its own header: "the taxonomy
// is the spec's, not an invented one"), seven real tiers with real
// counts (4, 8, 10, 8, 6, 3, 2 -- 41 occupations total), each one a
// real `skill`/`source` pair, not a guessed-at list.
//
// VDP's own `skills.js` carries a deliberately SCOPED subset of
// VACON-C's full skill sheet (11 names, not 16 -- see that file's own
// header). `OCCUPATIONS` below is the same scoping applied to
// VACON-C's occupations: every occupation whose real `skill` is one
// VDP actually has, ported verbatim (tier/skill/source unchanged),
// and nothing else -- 27 of VACON-C's 41, not a re-invented list.
// `mechanic`/`navigator` (Technology), `librarian`/`linguist`/
// `researcher` (Research), `scientist`/`polymath` (Science) are the
// 14 real exclusions, for the same reason `skills.js` never carries
// Technology/Research/Science: VDP has no district or job built
// around any of those three skills.
//
// **"Depending on their location and where they're from" is
// deliberately NOT modeled by region.** Checked directly: VACON-C's
// own occupations.js has no per-region weighting at all -- it is a
// civilization-scale taxonomy with no concept of "the old world's
// regions" (that is VDP's own `demographics.js` invention, for
// migration flavor only). Inventing a region-to-occupation statistic
// here would be exactly the kind of guessed-at fact this project
// refuses to assert. The one real, already-existing economic signal
// that DOES vary per arrival is `immigration.js`'s own `wealthTier`
// ("the people who start to come early are the people who are most
// affluent") -- `pickOldWorldOccupation` biases its real tier range
// by that field instead, flagged interpretive below for the exact
// tier cutoffs, since no document ties a wealth tier to a numbered
// occupation tier.

export const OCCUPATIONS = {
  // ---- Tier 1: everyday skills ----
  labourer: { tier: 1, skill: 'Construction', source: 'tool usage' },
  cook: { tier: 1, skill: 'Crafting', source: 'cooking' },
  trader: { tier: 1, skill: 'Business', source: 'basic barter' },

  // ---- Tier 2: basic trades ----
  carpenter: { tier: 2, skill: 'Construction', source: 'carpentry' },
  tailor: { tier: 2, skill: 'Crafting', source: 'sewing' },
  fisher: { tier: 2, skill: 'Agriculture', source: 'fishing' },
  hunter: { tier: 2, skill: 'Combat', source: 'hunting' },
  farmer: { tier: 2, skill: 'Agriculture', source: 'farming' },
  enforcer: { tier: 2, skill: 'Combat', source: 'organizations.type gang' },
  athlete: { tier: 2, skill: 'Athletics', source: 'organizations.type sports' },

  // ---- Tier 3: intermediate professions ----
  plumber: { tier: 3, skill: 'Engineering', source: 'plumbing' },
  electrician: { tier: 3, skill: 'Engineering', source: 'electrical' },
  preserver: { tier: 3, skill: 'Crafting', source: 'food preservation' },
  teacher: { tier: 3, skill: 'Communication', source: 'implied' },
  orderly: { tier: 3, skill: 'Medicine', source: 'implied' },
  preacher: { tier: 3, skill: 'Communication', source: 'organizations.type religion' },
  reporter: { tier: 3, skill: 'Communication', source: 'organizations.type media' },

  // ---- Tier 4: professional knowledge ----
  physician: { tier: 4, skill: 'Medicine', source: 'medicine' },
  engineer: { tier: 4, skill: 'Engineering', source: 'engineering' },
  financier: { tier: 4, skill: 'Business', source: 'finance' },
  manager: { tier: 4, skill: 'Management', source: 'business' },
  agronomist: { tier: 4, skill: 'Agriculture', source: 'agriculture science' },
  curator: { tier: 4, skill: 'Art', source: 'implied' },

  // ---- Tier 5: advanced technical/strategic ----
  architect: { tier: 5, skill: 'Construction', source: 'architecture' },
  logistician: { tier: 5, skill: 'Management', source: 'logistics' },
  officer: { tier: 5, skill: 'Combat', source: 'military tactics' },
  diplomat: { tier: 5, skill: 'Communication', source: 'diplomacy' },
};

export const OCCUPATION_NAMES = Object.keys(OCCUPATIONS);

function occupationsInTierRange(minTier, maxTier) {
  return OCCUPATION_NAMES.filter((name) => {
    const tier = OCCUPATIONS[name].tier;
    return tier >= minTier && tier <= maxTier;
  });
}

// Flagged interpretive -- no document ties a real wealth tier to a
// numbered occupation tier. 'affluent' draws from the two most
// advanced real tiers ("the people who are most affluent" bringing
// professional/strategic trades); 'general' draws from the three
// everyday/basic/intermediate tiers; 'family-sponsored' (and any
// unrecognized tier) draws from the full real range -- no real signal
// either way for someone admitted on a sponsor's own standing.
const TIER_RANGE_BY_WEALTH_TIER = {
  affluent: [4, 5],
  general: [1, 3],
};

export function pickOldWorldOccupation({ wealthTier, rng = Math.random } = {}) {
  const [minTier, maxTier] = TIER_RANGE_BY_WEALTH_TIER[wealthTier] || [1, 5];
  const pool = occupationsInTierRange(minTier, maxTier);
  const name = pool[Math.floor(rng() * pool.length)];
  return { name, ...OCCUPATIONS[name] };
}

// Flagged interpretive -- no document gives a real starting skill
// level for someone who actually practised a real trade in the old
// world; 55 reads as "competent, not yet expert," the honest middle
// of `skills.js`'s own 0-100 scale rather than starting them at 0
// (which would make having had a real old-world trade meaningless)
// or maxing them out (which no new arrival, however skilled, should
// start at).
export const OLD_WORLD_SKILL_LEVEL = 55;

// The real seed `server.cjs` hands to `skills.createSkills` for an
// arrival who didn't already supply their own real `oldWorldSkills`
// -- one real occupation, one real skill, one flagged-interpretive
// level, never a guess at every skill an occupation might plausibly
// touch.
export function oldWorldSkillsFor({ wealthTier, rng = Math.random } = {}) {
  const occupation = pickOldWorldOccupation({ wealthTier, rng });
  return { occupation, skills: { [occupation.skill]: OLD_WORLD_SKILL_LEVEL } };
}
