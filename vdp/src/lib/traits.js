// VDP — the real trait sheet, pulled in from VACON-C per direct
// instruction (9 Oct 2026): "make sure you bring in all the traits,
// entrepreneurship, sneakiness, all the things we have from vacancy."
//
// **The real count, checked directly rather than guessed.** VACON-C's
// own `server/traits.js` was 20 families and 114 individual traits, not
// "hundreds or thousands" — its own header is explicit: "this file's
// TRAIT_FAMILIES is byte-identical to [the source doc], 20 families,
// 114 traits." It has since grown a real 21st family, `efficiency` (8
// traits, 9 Oct 2026) -- see that family's own comment below.
// `TRAIT_FAMILIES` below is copied verbatim from VACON-C's current
// state, with one deliberate exclusion:
//
// **The real 2,100-trait target, checked against the actual source
// docs rather than taken on memory.** `VACANCY_TRAIT_DATABASE_
// ATTACHMENT.md` (VACON-C's own trait spec) really does name "2,100+
// traits" as the full spec's target -- that is not a misremembered
// number. But it is a planning doc's rough, additive-data-entry
// STARTING ALLOCATION across six tiers (individual, family,
// organization, city, civilization, culture), not an implemented
// catalogue: its own prose says so twice ("the literal 2,100-entry
// catalogue does not exist in this material and must be generated").
// The individual tier is the one that genuinely scales by adding more
// named traits per family, which is what `efficiency` is an instance
// of. The other five tiers are each a SINGLE flat dimension per name
// (one `wealth` scalar, not fifty wealth-related traits) and in
// VACON-C's real, current code most of the spec's naively-listed
// tier-level dimensions already resolve to real existing columns or
// computed rollups -- inventing dozens of new named sub-dimensions
// under e.g. "wealth" to chase the 2,100 figure would be exactly the
// "two disagreeing answers to the same question" failure VACON-C's
// own CLAUDE.md names as a standing rule, not real progress toward it.
//
// **The `skills` family (16 traits) is NOT ported.** In VACON-C it is
// a static roll at generation — an innate aptitude, never practised up.
// VDP already has a real, separate, dynamic skill system
// (`skills.js`) for nearly the same named subjects (Business, Crafting,
// Construction, Communication, Management, Athletics, Art, Agriculture,
// Combat, Engineering) that starts at 0 and rises through real practice
// — working a job, reading a book, a relevant conversation. Carrying
// both would put two numbers named "Business" on the same person
// meaning two different things, which is exactly the "two disagreeing
// answers to the same question" failure VACON-C's own CLAUDE.md names
// as a standing rule. `skills.js`'s dynamic version is the one VDP
// keeps.
//
// **Not imported from VACON-C's own code.** Cross-app `require` is
// never done in this ecosystem — every app's own Docker build context
// is its own directory (`world-layer/`'s own header: "may not be
// imported across the directory boundary") — so this is a real, cited
// copy of DATA, the same posture `landmarkPacks.js` takes toward
// `world-layer/`'s region packs.
//
// **Archetypes are a read, never stored, same as VACON-C's own
// `archetypes.js`**: `tagsFor` computes tags live from a trait sheet
// every time it's asked. 23 of the 25 named tags below are copied
// verbatim from VACON-C's own list (its own header: "the tags are the
// document's; the thresholds are not" — HIGH=70/LOW=30 are its
// existing flagged-interpretive choice, kept here for the same reason
// VDP keeps its own flagged-interpretive numbers everywhere else: two
// different numbers for the same threshold would be a second guess,
// not a correction).
//
// **One exception, adapted rather than copied**: VACON-C's own
// 'Entrepreneur' tag reads `skills.Business`, which this file doesn't
// carry (see above). Re-pointed at `economic.Risk Appetite` +
// `economic.Barter Skill` — both real, both already present, and
// together they carry the same intent ("entrepreneurial" = risk-seeking
// and good at striking deals) without inventing a value for a family
// VDP deliberately excluded.
//
// **Two real additions, clearly marked as VDP's own**: 'Sneaky'
// (`criminal.Stealth` + `criminal.Deception`, both HIGH) is not one of
// VACON-C's 23 — the direct instruction named "sneakiness" by word, and
// the honest answer (given earlier, in chat) is that it maps to these
// two real criminal-family traits rather than being its own invented
// stat. 'Efficient' (`efficiency.Process Optimization` + `efficiency
// .Time Management`, both HIGH) is the same move for the new
// `efficiency` family. Adding both as real, derived tags makes those
// answers legible in
// the game itself instead of only in a conversation.

export const HIGH = 70;
export const LOW = 30;

export const TRAIT_FAMILIES = {
  physical: ['Strength', 'Endurance', 'Agility', 'Reflexes', 'Pain Tolerance',
             'Recovery Rate', 'Vision Acuity', 'Stamina'],
  mental: ['Intelligence', 'Memory', 'Focus', 'Problem Solving', 'Creativity',
           'Adaptability', 'Risk Assessment', 'Learning Speed', 'Curiosity'],
  emotional: ['Empathy', 'Volatility', 'Resilience', 'Optimism',
              'Attachment Style', 'Grief Processing'],
  psychological: ['Paranoia', 'Impulsivity', 'Narcissism', 'Trust Threshold',
                  'Delusion Susceptibility', 'Compulsiveness'],
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
  // VACON-C's own 21st family (added 9 Oct 2026, same instruction as
  // this file's: "add any traits... that would make it more
  // efficient"), ported verbatim -- see VACON-C's own `traits.js` for
  // why it's real and not filler: it has a real reader
  // (`economy.productivityOf`'s own efficiency modulator). VDP's own
  // skill-practice path (`skills.js`) and job payout (`jobs.js`) don't
  // yet read it -- flagged, not silently wired, since VDP's jobs
  // currently pay a flat per-shift wage with no skill/trait-based
  // scaling at all, and giving efficiency a real effect here would
  // mean building that scaling for every trait at once, not just this
  // one family. `tagsFor`'s own archetype layer already reads it
  // honestly: a perfectly neutral sheet earns no tag either way.
  efficiency: ['Time Management', 'Resourcefulness', 'Process Optimization',
               'Follow-Through', 'Multitasking', 'Delegation Skill',
               'Waste Reduction', 'Prioritization'],
};

// Same ~N(50, small variance) shape as VACON-C's own `randomTraitValue`
// (average of three uniforms), adapted to take an injectable `rng` --
// every other generator in this file/module uses one, for the same
// deterministic-test reason `skills.js`'s own `createSkills(seed)` does.
export function randomTraitValue(rng = Math.random) {
  const sample = (rng() + rng() + rng()) / 3;
  return Math.max(0, Math.min(100, Math.round(sample * 100)));
}

export function generateTraitSheet(rng = Math.random) {
  const sheet = {};
  for (const [family, names] of Object.entries(TRAIT_FAMILIES)) {
    sheet[family] = {};
    for (const name of names) {
      sheet[family][name] = randomTraitValue(rng);
    }
  }
  return sheet;
}

// Falls back to a neutral 50 for a missing family/trait, the same
// fallback `archetypes.js`'s own `tagsFor` uses -- an absent reading
// should never silently fail a HIGH/LOW gate as if it were a real 0.
export function readTrait(traits, family, name) {
  const raw = Number(traits?.[family]?.[name]);
  return Number.isFinite(raw) ? raw : 50;
}

export function bumpTrait(traits, family, name, amount) {
  const current = readTrait(traits, family, name);
  traits[family][name] = Math.max(0, Math.min(100, current + amount));
  return traits[family][name];
}

// The single highest-valued individual trait across the whole sheet --
// deterministic tie-break by object insertion order (families, then
// traits within a family), the same resolution `Array.prototype.reduce`
// already gave VDP's old flat 6-trait `topTrait`.
export function topIndividualTrait(traits) {
  let best = null;
  for (const [family, names] of Object.entries(TRAIT_FAMILIES)) {
    for (const name of names) {
      const value = readTrait(traits, family, name);
      if (!best || value > best.value) best = { family, name, value };
    }
  }
  return best;
}

const INDIVIDUAL_ARCHETYPES = [
  { name: 'Natural Leader', when: (t) => t('leadership', 'Command Presence') >= HIGH && t('social', 'Charisma') >= HIGH },
  { name: 'Strategic Thinker', when: (t) => t('leadership', 'Strategic Vision') >= HIGH && t('mental', 'Problem Solving') >= HIGH },
  { name: 'Charismatic', when: (t) => t('social', 'Charisma') >= HIGH && t('social', 'Persuasion') >= HIGH },
  { name: 'Independent', when: (t) => t('behavioral', 'Conformity') <= LOW && t('social', 'Group Loyalty') <= LOW },
  { name: 'Disciplined', when: (t) => t('behavioral', 'Discipline') >= HIGH && t('behavioral', 'Recklessness') <= LOW },
  { name: 'Creative', when: (t) => t('mental', 'Creativity') >= HIGH },
  { name: 'Risk Taker', when: (t) => t('economic', 'Risk Appetite') >= HIGH && t('behavioral', 'Recklessness') >= HIGH },
  { name: 'Cautious', when: (t) => t('mental', 'Risk Assessment') >= HIGH && t('economic', 'Risk Appetite') <= LOW },
  { name: 'Trustworthy', when: (t) => t('reputation', 'Trustworthiness') >= HIGH && t('behavioral', 'Honesty') >= HIGH },
  { name: 'Unreliable', when: (t) => t('behavioral', 'Honesty') <= LOW && t('behavioral', 'Discipline') <= LOW },
  { name: 'Diplomatic', when: (t) => t('social', 'Persuasion') >= HIGH && t('behavioral', 'Patience') >= HIGH },
  { name: 'Aggressive', when: (t) => t('behavioral', 'Aggression') >= HIGH },
  { name: 'Generous', when: (t) => t('economic', 'Greed') <= LOW && t('emotional', 'Empathy') >= HIGH },
  { name: 'Selfish', when: (t) => t('economic', 'Greed') >= HIGH && t('emotional', 'Empathy') <= LOW },
  // Adapted: `skills.Business` -> `economic.Barter Skill` (see header).
  { name: 'Entrepreneur', when: (t) => t('economic', 'Risk Appetite') >= HIGH && t('economic', 'Barter Skill') >= HIGH },
  { name: 'Investor', when: (t) => t('economic', 'Frugality') >= HIGH && t('economic', 'Resource Hoarding') >= HIGH },
  { name: 'Worker Mentality', when: (t) => t('behavioral', 'Discipline') >= HIGH && t('economic', 'Risk Appetite') <= LOW },
  { name: 'Innovator', when: (t) => t('mental', 'Creativity') >= HIGH && t('technology', 'Machinery Aptitude') >= HIGH },
  { name: 'Prepared', when: (t) => t('environmental', 'Wilderness Survival') >= HIGH && t('mental', 'Risk Assessment') >= HIGH },
  { name: 'Adaptive', when: (t) => t('mental', 'Adaptability') >= HIGH && t('mental', 'Learning Speed') >= HIGH },
  { name: 'Fearless', when: (t) => t('combat', 'Composure Under Fire') >= HIGH && t('psychological', 'Paranoia') <= LOW },
  { name: 'Paranoid', when: (t) => t('psychological', 'Paranoia') >= HIGH && t('psychological', 'Trust Threshold') >= HIGH },
  { name: 'Community Focused', when: (t) => t('social', 'Group Loyalty') >= HIGH && t('emotional', 'Empathy') >= HIGH },
  // VDP's own additions -- not one of VACON-C's original 23.
  { name: 'Sneaky', when: (t) => t('criminal', 'Stealth') >= HIGH && t('criminal', 'Deception') >= HIGH },
  { name: 'Efficient', when: (t) => t('efficiency', 'Process Optimization') >= HIGH && t('efficiency', 'Time Management') >= HIGH },
];

// Every family/trait pair an archetype predicate reads, parsed out of
// its own source text rather than by calling it -- the same technique
// VACON-C's own `citedTraits` uses and the same reason: `&&`
// short-circuits, so calling the predicate with a probe would miss
// whichever operand never gets evaluated. Used by this module's own
// test to assert no archetype cites a trait that doesn't exist.
export function citedTraits() {
  const cited = [];
  for (const archetype of INDIVIDUAL_ARCHETYPES) {
    const source = archetype.when.toString();
    for (const m of source.matchAll(/t\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/g)) {
      cited.push([m[1], m[2]]);
    }
  }
  return cited;
}

// A read, never a write -- computed fresh from a trait sheet every
// call, same discipline as VACON-C's own `tagsFor`.
export function tagsFor(traits) {
  const tags = [];
  for (const archetype of INDIVIDUAL_ARCHETYPES) {
    const seen = [];
    const read = (family, name) => {
      const value = readTrait(traits, family, name);
      seen.push({ family, name, value });
      return value;
    };
    if (!archetype.when(read)) continue;
    tags.push({ name: archetype.name, derivedFrom: seen });
  }
  return tags;
}
