// server/traits.js
//
// Trait data and trait-generation logic, extracted from engine.js as
// locked Day 1 step 1 (see dev-docs/phase-1-trait-split/). The base
// extraction — TRAIT_FAMILIES, randomTraitValue(), and
// generateTraitSheet() — is unchanged from the engine.js versions.
//
// The Skills family below is step 3 (locked Day 1 order), added here
// out of strict order because step 2 (Postgres trait_definitions
// migration, which normally comes between steps 1 and 3) is blocked
// pending VACANCY_POSTGRESQL_SCHEMA.sql. Skills data itself has no DB
// dependency, so adding it doesn't conflict with step 2 landing later
// — but step 2's migration still needs to happen before this is
// considered fully "in order."
//
// Verified against VACANCY_TRAIT_DATABASE_ATTACHMENT.md (Document 7,
// full handoff): this file's TRAIT_FAMILIES was byte-identical to that
// doc's literal object, including skills — 20 families, 114 traits.
// The "18 families, 92 traits" / "19 families, 98 traits" language
// elsewhere (including in that same doc's own prose) undercounts its
// own listed array by one family; that's a pre-existing off-by-one in
// the docs' summary text, not a data mismatch — the literal data was
// correct here all along.
//
// 120 traits as of 26 Sep 2026: two added to `psychological`
// (`Manipulation`, `Substance Dependency`) and four more to `emotional`
// (`Libido`, `Fidelity`, `Gender Expression`, `Sexuality`), none of
// them in the source document, all owner-requested — see each family
// definition below for why.
// Historical "114"/"44 of 114" measurements elsewhere in this
// codebase (barter.js, economy.js, trait-families.test.js) describe a
// specific measurement taken before that date and are left as the
// measurement they were, not restated.

'use strict';

// ---------------------------------------------------------------------------
// TRAIT_FAMILIES — individual tier only.
// physical..personality copied verbatim from VACANCY_TRAIT_DATABASE_
// ATTACHMENT.md (Document 7) via engine.js. skills copied verbatim from
// dev-docs/phase-1-trait-split/context.md (step 3, added here).
// ---------------------------------------------------------------------------
const TRAIT_FAMILIES = {
  physical: ['Strength', 'Endurance', 'Agility', 'Reflexes', 'Pain Tolerance',
             'Recovery Rate', 'Vision Acuity', 'Stamina'],
  mental: ['Intelligence', 'Memory', 'Focus', 'Problem Solving', 'Creativity',
           'Adaptability', 'Risk Assessment', 'Learning Speed', 'Curiosity'],
  // `Libido` and `Fidelity` added 26 Sep 2026 at the owner's direct
  // request, alongside the partnership/infidelity mechanic wired into
  // `births.js`'s existing bond system — see that file's own header.
  // Neither is from a source document; both sit beside `Attachment
  // Style` because they modulate the same mechanic it does.
  // `Gender Expression` and `Sexuality` added 26 Sep 2026 at the
  // owner's direct request, alongside `births.js`'s attraction
  // mechanic — see that file's own header. Both are continuous (0-100)
  // rather than a categorical field: `Gender Expression` is where
  // somebody sits on a spectrum, purely descriptive and never read by
  // the fertility/bearing-parent logic, which stays exactly what it
  // was ("no sex or gender field is invented" there, and that decision
  // is untouched — this is a relational-attraction trait, not a
  // reproductive one). `Sexuality` is the Expression somebody is drawn
  // to, on the same scale, which is what makes the whole spectrum —
  // straight, gay, bisexual, and everything between — one continuum
  // rather than an enum with cases to enumerate.
  emotional: ['Empathy', 'Volatility', 'Resilience', 'Optimism',
              'Attachment Style', 'Grief Processing', 'Libido', 'Fidelity',
              'Gender Expression', 'Sexuality'],
  // `Manipulation` and `Substance Dependency` added 26 Sep 2026 at the
  // owner's direct request, for the exploitative-negotiation behavior
  // wired into `meetings.js` and the drug-addiction mechanic wired into
  // `crime.js`/`traitDrift.js` — see those files' own headers. Neither
  // is from a source document; both are new, same standing as the
  // landmark categories added the same day.
  psychological: ['Paranoia', 'Impulsivity', 'Narcissism', 'Trust Threshold',
                  'Delusion Susceptibility', 'Compulsiveness', 'Manipulation',
                  'Substance Dependency'],
  behavioral: ['Aggression', 'Patience', 'Honesty', 'Discipline',
               'Recklessness', 'Conformity'],
  social: ['Charisma', 'Persuasion', 'Network Reach', 'Reputation',
           'Group Loyalty', 'Social Mobility'],
  economic: ['Greed', 'Frugality', 'Risk Appetite', 'Barter Skill',
             'Resource Hoarding', 'Debt Tolerance'],
  educational: ['Literacy', 'Technical Knowledge', 'Historical Knowledge',
                'Self-Taught Aptitude'],
  criminal: ['Stealth', 'Deception', 'Black Market Ties', 'Heat Tolerance',
             'Crew Loyalty'],
  combat: ['Melee Skill', 'Ranged Skill', 'Tactical Awareness', 'Bloodlust',
           'Composure Under Fire', 'Weapon Mastery'],
  sports: ['Speed', 'Coordination', 'Competitive Drive', 'Team Chemistry',
           'Injury Resistance'],
  health: ['Immune Response', 'Nutrition Status', 'Chronic Conditions',
           'Sleep Quality'],
  technology: ['Machinery Aptitude', 'Electronics Repair',
               'Signal/Comms Literacy', 'Salvage Engineering'],
  environmental: ['Weather Tolerance', 'Wilderness Survival',
                  'Urban Navigation', 'Contamination Resistance'],
  leadership: ['Command Presence', 'Strategic Vision', 'Delegation',
               'Crisis Composure', 'Vision', 'Corruption Risk'],
  reputation: ['Fear Factor', 'Trustworthiness', 'Notoriety',
               'Faction Standing'],
  faction: ['Ideological Alignment', 'Defection Risk', 'Recruitment Draw',
            'Territorial Instinct'],
  special: ['Artifact Sensitivity', 'Signal Perception', 'Anomaly Resistance'],
  personality: ['Confidence', 'Teaching Ability'],
  skills: ['Communication', 'Leadership', 'Engineering', 'Medicine',
           'Science', 'Technology', 'Art', 'Music', 'Business', 'Agriculture',
           'Construction', 'Combat', 'Athletics', 'Crafting', 'Research',
           'Management'],
};

// ---------------------------------------------------------------------------
// Trait value generation
// ---------------------------------------------------------------------------
// trait_definitions.min_value/max_value/default_value default to 0/100/50
// in the schema. Generate around that default with natural-looking spread
// (average of three uniforms, a cheap approximation of a normal curve)
// rather than flat uniform random, then clamp to [0, 100].
function randomTraitValue() {
  const sample = (Math.random() + Math.random() + Math.random()) / 3; // ~N(0.5, small variance)
  const value = Math.round(sample * 100);
  return Math.max(0, Math.min(100, value));
}

// Generate a full trait sheet across every family in TRAIT_FAMILIES.
// Shape: { physical: { Strength: 62, Endurance: 40, ... }, mental: {...}, ... }
function generateTraitSheet() {
  const sheet = {};
  for (const [family, traitNames] of Object.entries(TRAIT_FAMILIES)) {
    sheet[family] = {};
    for (const traitName of traitNames) {
      sheet[family][traitName] = randomTraitValue();
    }
  }
  return sheet;
}

module.exports = {
  TRAIT_FAMILIES,
  randomTraitValue,
  generateTraitSheet,
};
