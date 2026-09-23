// What a person is for, on a named scale, and how much of it they got to.
//
// Two of these tests exist because the code failed them on a real world
// before it passed them, and both failures are the kind a fixture
// cannot see: they only appear when the whole population is measured.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const gifts = require('../server/gifts.js');
const { TRAIT_FAMILIES } = require('../server/traits.js');
const { getTraitId } = require('../server/traitDefinitions.js');

// ---------------------------------------------------------------------
// The vocabulary is real
// ---------------------------------------------------------------------

test('every trait a gift is built from actually exists', () => {
  // Standing rule 6. A support map naming a trait that does not exist
  // returns nothing forever and no fixture notices — this project has
  // hit that in flows.js, salvage.js and an importer already.
  for (const [skill, support] of Object.entries(gifts.SUPPORT)) {
    assert.ok(support.length > 0, `${skill} has no supporting traits`);
    for (const [family, trait] of support) {
      assert.ok(TRAIT_FAMILIES[family], `${skill} names family "${family}", which does not exist`);
      assert.ok(TRAIT_FAMILIES[family].includes(trait),
        `${skill} names ${family}.${trait}, which is not in TRAIT_FAMILIES`);
    }
  }
});

test('every skill in the skills family can be a gift', () => {
  // A skill with no support map can never be anybody's gift — it would
  // be in the vocabulary and unreachable, which is the eleventh rule's
  // shape pointed at a list.
  for (const skill of TRAIT_FAMILIES.skills) {
    assert.ok(gifts.SUPPORT[skill], `${skill} is a skill with no support map, so nobody can have it`);
  }
  assert.equal(gifts.SKILL_NAMES.length, TRAIT_FAMILIES.skills.length);
});

// ---------------------------------------------------------------------
// The scale is Hawkins', unmodified
// ---------------------------------------------------------------------

test('the published levels are the published values', () => {
  // These are Hawkins' numbers and names. If somebody edits one to make
  // a distribution look better, that is no longer his scale and the
  // file should stop claiming it is.
  const byName = Object.fromEntries(gifts.LEVELS.map((l) => [l.name, l.at]));
  assert.equal(byName.Shame, 20);
  assert.equal(byName.Fear, 100);
  assert.equal(byName.Courage, 200);
  assert.equal(byName.Reason, 400);
  assert.equal(byName.Love, 500);
  assert.equal(byName.Peace, 600);
  assert.equal(byName.Enlightenment, 700);
  assert.equal(gifts.LEVELS.length, 17);
  // Ascending, so levelFor can walk it once.
  for (let i = 1; i < gifts.LEVELS.length; i += 1) {
    assert.ok(gifts.LEVELS[i].at > gifts.LEVELS[i - 1].at);
  }
});

test('the pivot is Hawkins own 200 and has not been nudged', () => {
  // It failed its first measurement — every one of 149 people cleared
  // it — and the fix was upstream rather than moving this number. If a
  // later distribution looks wrong, fix the distribution.
  assert.equal(gifts.ESTABLISHED_AT, 200);
});

test('calibration spans the scale logarithmically', () => {
  assert.equal(gifts.calibrate(0), gifts.SCALE_MIN);
  assert.equal(gifts.calibrate(100), gifts.SCALE_MAX);
  // Log, not linear: the midpoint of the INPUT is nowhere near the
  // midpoint of the output range. That is the property the scale is
  // chosen for.
  const mid = gifts.calibrate(50);
  assert.ok(mid < 200, `50 should calibrate low on a log scale, got ${mid}`);
  assert.ok(mid > gifts.SCALE_MIN);
  // Monotonic.
  assert.ok(gifts.calibrate(60) > gifts.calibrate(40));
});

test('a calibration names the level at or below it, never above', () => {
  assert.equal(gifts.levelFor(200), 'Courage');
  assert.equal(gifts.levelFor(249), 'Courage');
  assert.equal(gifts.levelFor(250), 'Neutrality');
  assert.equal(gifts.levelFor(20), 'Shame');
  assert.equal(gifts.levelFor(999), 'Enlightenment');
});

// ---------------------------------------------------------------------
// Reading a person
// ---------------------------------------------------------------------

function world(traits) {
  // A world with one NPC whose live trait sheet is exactly what is
  // passed in. `getLiveEntity` builds its sheet from entity_traits, so
  // the fixture supplies those rather than npc.traits — reading the
  // frozen sheet is the ninth standing rule's failure.
  const w = {
    tick: 0, npcs: [{ id: 1, status: 'active' }], organizations: [], families: [],
    entityTraits: [],
  };
  // `trait_id` comes from the MODULE registry, not from worldState, and
  // `traitsToSheet` reads `current_value` — not `value`. Both were got
  // wrong first time here, which is the same shape as the bug the
  // fixture is testing for: a row that looks right and resolves to
  // nothing.
  for (const [family, values] of Object.entries(traits)) {
    for (const [trait, value] of Object.entries(values)) {
      w.entityTraits.push({
        entity_id: 1,
        trait_id: getTraitId(family, trait),
        base_value: value,
        key_modifier: 0,
        current_value: value,
      });
    }
  }
  return w;
}

test('somebody with no traits at all has no gift', () => {
  // Unknown is not a gift at the bottom of the scale. The corollary
  // this project shipped wrong once in moodFor, where an unobserved
  // person read as content.
  const w = world({});
  assert.equal(gifts.giftOf(w, 1), null);
  assert.equal(gifts.giftOf(w, 999), null, 'an entity that does not exist has no gift');
});

test('a gift is the skill somebody is born for, not the one they trained', () => {
  // **This is the fix that mattered.** Selecting on combined evidence
  // preferentially picks skills whose TRAINED value is high, which made
  // trained/natural land at or above 1 by construction — measured, 140
  // of 149 people read as "mastered". Selecting on natural aptitude
  // removes the bias and is the better model: a gift is what you are
  // for, mastery is what you did about it.
  const w = world({
    // Huge natural aptitude for Combat, never trained.
    combat: {
      'Melee Skill': 95, 'Ranged Skill': 95, 'Tactical Awareness': 95,
      'Composure Under Fire': 95, 'Weapon Mastery': 95,
    },
    // Modest aptitude for Science, heavily trained.
    mental: { Intelligence: 30, 'Problem Solving': 30, Curiosity: 30 },
    educational: { Literacy: 30, 'Technical Knowledge': 30 },
    skills: { Combat: 5, Science: 99 },
  });
  const gift = gifts.giftOf(w, 1);
  assert.equal(gift.skill, 'Combat', 'the gift should be the innate one, not the trained one');
  assert.ok(gift.mastery < 0.2, `an untrained gift should read as barely realised, got ${gift.mastery}`);
  assert.equal(gift.band, 'latent');
});

test('training a gift raises mastery without changing what the gift is', () => {
  const base = {
    combat: {
      'Melee Skill': 80, 'Ranged Skill': 80, 'Tactical Awareness': 80,
      'Composure Under Fire': 80, 'Weapon Mastery': 80,
    },
  };
  const untrained = gifts.giftOf(world({ ...base, skills: { Combat: 10 } }), 1);
  const trained = gifts.giftOf(world({ ...base, skills: { Combat: 80 } }), 1);
  assert.equal(untrained.skill, 'Combat');
  assert.equal(trained.skill, 'Combat', 'training changed which gift somebody has');
  assert.ok(trained.mastery > untrained.mastery);
  assert.ok(trained.calibration > untrained.calibration,
    'training should move you up the scale');
});

test('mastery is against your own ceiling, not against a hundred', () => {
  // Somebody modest who has trained to their limit has mastered their
  // gift. That is the request's own wording — "you pretty much mastered
  // who that NPC could be using all the traits".
  const modest = gifts.giftOf(world({
    sports: { Speed: 40, Coordination: 40, 'Competitive Drive': 40 },
    physical: { Stamina: 40, Agility: 40 },
    skills: { Athletics: 40 },
  }), 1);
  assert.equal(modest.skill, 'Athletics');
  assert.equal(modest.mastery, 1, 'trained exactly to aptitude is mastery of it');
  assert.equal(modest.band, 'mastered');
  // And they are still not highly calibrated — mastery and magnitude
  // are different questions and the scale keeps them apart.
  assert.ok(modest.calibration < 300);
});

test('a gift reports what it beat, so it is visibly a choice among sixteen', () => {
  const gift = gifts.giftOf(world({
    mental: { Creativity: 90, Focus: 90, Memory: 90, Curiosity: 90, Intelligence: 90 },
    skills: { Art: 50, Research: 50 },
  }), 1);
  assert.ok(Array.isArray(gift.runnersUp));
  assert.ok(gift.runnersUp.length > 0, 'a gift two points clear of the next is a different fact');
  for (const runner of gift.runnersUp) {
    assert.notEqual(runner.skill, gift.skill);
  }
});

test('a profile ranks every readable skill, best first', () => {
  const profile = gifts.profileOf(world({
    combat: { 'Melee Skill': 90, 'Ranged Skill': 90 },
    skills: { Combat: 90, Art: 10 },
  }), 1);
  assert.ok(profile.length > 1);
  for (let i = 1; i < profile.length; i += 1) {
    assert.ok(profile[i - 1].evidence >= profile[i].evidence, 'profile is not sorted');
  }
});

// ---------------------------------------------------------------------
// The guard can fail
// ---------------------------------------------------------------------

test('describeGifts reports an empty world as unread, not as uniform', () => {
  const report = gifts.describeGifts({ npcs: [] });
  assert.equal(report.read, 0);
  assert.equal(report.establishedShare, null, 'no people is not a share of zero');
  assert.equal(report.calibration.median, null);
});

test('the guard counts the things that would show the system is decorative', () => {
  // Twentieth standing rule: a guard that cannot fail is decoration.
  // These are the three ways gifts could be pointless — everyone has
  // the same one, nobody is established, or a skill is unreachable —
  // and the report has a field for each.
  const report = gifts.describeGifts({ npcs: [] });
  assert.ok('unreachedSkills' in report);
  assert.ok('bySkill' in report);
  assert.ok('establishedShare' in report);
  assert.ok('byBand' in report);
});
