// VACANCY — contest resolution, the sim engine.
//
// **What this closes.** Every NPC this engine has ever generated
// carries a `combat` family (Melee Skill, Weapon Mastery, Tactical
// Awareness, Composure Under Fire…) and a `sports` family (Speed,
// Coordination, Competitive Drive, Team Chemistry, Injury Resistance),
// and until 29 Aug 2026 **nothing anywhere read either one**. VDP's
// `combatSports.js` — the only sports code in the ecosystem — takes the
// winner as a parameter: `recordResult(match, winnerIds)`. Grep it for
// `trait`: zero hits. The ratings existed and decided nothing.
//
// Three properties matter more than the arithmetic, and each has its
// own section below:
//
//   1. **Determinism.** VAGO settles prediction markets on these
//      outcomes. A result nobody can reproduce is one somebody has to
//      be trusted about, so the same inputs must always give the same
//      winner — on any machine, forever.
//   2. **Upsets are possible.** A contest the favourite always wins is
//      a table, not a sport. The probability is capped below 1 on
//      purpose.
//   3. **The weights read real traits.** A misspelled trait name would
//      be skipped silently and the discipline would still return a
//      number — the wrong number. This is the flows.js dead-signal
//      failure, guarded before it can happen a second time.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const contest = require('../server/contest.js');
const engine = require('../server/engine.js');
const { getTraitId } = require('../server/traitDefinitions.js');

// A fighter with traits set by hand, so a test asserts on arithmetic it
// controls rather than on whatever random generation produced.
//
// **The row shape matters and guessing it cost four failing tests.** An
// entity_traits row is `{ entity_id, trait_id, current_value,
// base_value, ...modifiers }` — there is no `trait_name`, no
// `trait_family` and no `value` on it. The first version of this helper
// looked rows up by name and family, found none, and wrote nothing;
// because it did that behind an `if (row)`, every fighter came back
// with random traits and rated ~50, and the tests that asserted a
// strong fighter beats a weak one failed for a reason that had nothing
// to do with contest.js.
//
// So this version resolves the real `trait_id` through the definition
// catalog, and **throws** when a row is missing. A fixture that
// silently declines to set up its own fixture is worse than one that
// crashes: the assertions still run, against a world nobody arranged.
function setTrait(entityId, family, name, value) {
  const traitId = getTraitId(family, name);
  if (!traitId) throw new Error(`fixture names a trait that does not exist: ${family}.${name}`);
  const row = engine.WorldState.entityTraits.find(
    (r) => r.entity_id === entityId && r.trait_id === traitId,
  );
  if (!row) throw new Error(`entity ${entityId} carries no ${family}.${name} row to set`);
  // current_value is what getLiveEntity reads; base_value is kept level
  // with it so a later applyKeyModifier() recompute does not silently
  // undo the fixture.
  row.current_value = value;
  row.base_value = value;
  return row;
}

function fighter(overrides = {}) {
  const npc = engine.generateNPC();
  const sheet = engine.WorldState.npcs.find((n) => n.id === npc.id);
  for (const [family, traits] of Object.entries(overrides)) {
    for (const [name, value] of Object.entries(traits)) {
      setTrait(npc.id, family, name, value);
      // The generation-time snapshot on the stored NPC is a separate
      // copy. rateEntity does not read it, but leaving the two
      // disagreeing would mislead the next person who does.
      if (sheet.traits[family]) sheet.traits[family][name] = value;
    }
  }
  return npc;
}

// ---------------------------------------------------------------------------
// The weights are real
// ---------------------------------------------------------------------------

test('every trait the disciplines weight is a real trait in a real family', () => {
  // contest.js runs this at require time; running it here too means the
  // failure names the typo instead of crashing an unrelated suite.
  assert.doesNotThrow(() => contest.assertDisciplinesReadRealTraits());
});

test('the disciplines read the combat and sports families that nothing read before', () => {
  assert.ok(contest.DISCIPLINES.combat.combat['Melee Skill']);
  assert.ok(contest.DISCIPLINES.sport.sports.Speed);
  // Team Chemistry is worthless in a singles bout and decisive in a
  // team game — the two disciplines differ by more than a name.
  assert.equal(contest.DISCIPLINES.sport.sports['Team Chemistry'], undefined);
  assert.ok(contest.DISCIPLINES.teamSport.sports['Team Chemistry']);
});

test('Bloodlust is deliberately not weighted as combat skill', () => {
  // It describes appetite for violence, not skill at it. Weighting it
  // would let a bloodthirsty novice beat a disciplined professional.
  assert.equal(contest.DISCIPLINES.combat.combat.Bloodlust, undefined);
});

// ---------------------------------------------------------------------------
// Rating
// ---------------------------------------------------------------------------

test('the fixture actually sets the traits it claims to set', () => {
  // A guard on the helper, not on contest.js. `a.rating > b.rating`
  // would pass half the time on two random fighters, so every
  // comparison below rests on this: the numbers really are 95 and 10,
  // and a rating built from them lands near them rather than near the
  // ~50 that random generation gives.
  const f = fighter({
    combat: {
      'Melee Skill': 95, 'Weapon Mastery': 95, 'Tactical Awareness': 95, 'Composure Under Fire': 95,
    },
    physical: {
      Strength: 95, Agility: 95, Reflexes: 95, Endurance: 95, 'Pain Tolerance': 95,
    },
    mental: { Focus: 95 },
  });
  const rated = contest.rateEntity(engine.WorldState, f.id, 'combat');
  assert.equal(rated.rating, 95, 'every weighted trait was set to 95, so the mean is 95');
  for (const value of Object.values(rated.contributions)) assert.equal(value, 95);
  // And the helper refuses a trait that does not exist rather than
  // quietly setting up nothing.
  assert.throws(() => fighter({ combat: { 'Sword Wizardry': 99 } }), /does not exist/);
});

test('a better fighter rates higher', () => {
  const strong = fighter({
    combat: { 'Melee Skill': 95, 'Weapon Mastery': 90, 'Tactical Awareness': 90, 'Composure Under Fire': 90 },
    physical: { Strength: 90, Agility: 90, Reflexes: 90, Endurance: 90, 'Pain Tolerance': 90 },
  });
  const weak = fighter({
    combat: { 'Melee Skill': 10, 'Weapon Mastery': 10, 'Tactical Awareness': 10, 'Composure Under Fire': 10 },
    physical: { Strength: 20, Agility: 20, Reflexes: 20, Endurance: 20, 'Pain Tolerance': 20 },
  });

  const a = contest.rateEntity(engine.WorldState, strong.id, 'combat');
  const b = contest.rateEntity(engine.WorldState, weak.id, 'combat');
  assert.ok(a.rating > b.rating, `${a.rating} should beat ${b.rating}`);
  assert.ok(a.rating <= 100 && b.rating >= 0);
});

test('a rating shows its working', () => {
  // A settled market has to be checkable, and "trust the number" is not
  // checkable. Every trait that fed the rating comes back with it.
  const f = fighter({ combat: { 'Melee Skill': 77 } });
  const rated = contest.rateEntity(engine.WorldState, f.id, 'combat');
  assert.equal(rated.contributions['combat.Melee Skill'], 77);
  assert.ok(Object.keys(rated.contributions).length >= 8);
});

test('the same person rates differently at different disciplines', () => {
  const brawler = fighter({
    combat: { 'Melee Skill': 95, 'Weapon Mastery': 95, 'Tactical Awareness': 95, 'Composure Under Fire': 95 },
    sports: { Speed: 5, Coordination: 5, 'Competitive Drive': 5, 'Injury Resistance': 5 },
  });
  const asCombat = contest.rateEntity(engine.WorldState, brawler.id, 'combat').rating;
  const asSport = contest.rateEntity(engine.WorldState, brawler.id, 'sport').rating;
  assert.ok(asCombat > asSport, 'a knife fighter is not a sprinter');
});

test('an unknown discipline and an unknown entity are both refused', () => {
  const f = fighter();
  assert.throws(() => contest.rateEntity(engine.WorldState, f.id, 'chess'), /not a discipline/);
  assert.throws(() => contest.rateEntity(engine.WorldState, 999999, 'combat'), /no entity/);
});

test('an entity that carries none of a discipline\'s traits is refused, not scored zero', () => {
  // Not a hypothetical. An organization is a real entity with a real id
  // that getLiveEntity resolves, and it carries the `organization`
  // family and nothing else — no Melee Skill, no Speed. Rating it as a
  // fighter has to fail loudly.
  //
  // The alternative is the quiet one: with the guard gone, weightSum
  // stays 0, the rating comes back `0 / 0` — NaN, or 0 if somebody
  // "fixes" it — and a faction enters the card as the worst fighter
  // alive instead of being rejected at the door. **An entity with no
  // rating does not have a rating of zero.**
  const org = engine.generateOrganization({ name: 'Dockworkers Union', type: 'faction' });
  assert.throws(
    () => contest.rateEntity(engine.WorldState, org.id, 'combat'),
    /carries none of the traits/,
  );
  // And it cannot be smuggled in through a contest either.
  const f = fighter();
  assert.throws(
    () => contest.resolveContest(engine.WorldState, { participantIds: [f.id, org.id] }),
    /carries none of the traits/,
  );
});

// ---------------------------------------------------------------------------
// Determinism — the settlement property
// ---------------------------------------------------------------------------

test('the same contest resolves the same way every time', () => {
  const a = fighter();
  const b = fighter();
  const opts = { participantIds: [a.id, b.id], contestId: 'title-bout' };

  const first = contest.resolveContest(engine.WorldState, opts);
  for (let i = 0; i < 20; i += 1) {
    const again = contest.resolveContest(engine.WorldState, opts);
    assert.equal(again.winnerId, first.winnerId);
    assert.equal(again.seed, first.seed);
    assert.equal(again.draw, first.draw);
  }
});

test('the result does not depend on the order the fighters were listed', () => {
  // Otherwise a market could settle twice and disagree with itself
  // depending on who typed the card.
  const a = fighter();
  const b = fighter();
  const forward = contest.resolveContest(engine.WorldState, { participantIds: [a.id, b.id], contestId: 'x' });
  const reversed = contest.resolveContest(engine.WorldState, { participantIds: [b.id, a.id], contestId: 'x' });
  assert.equal(forward.winnerId, reversed.winnerId);
  assert.equal(forward.seed, reversed.seed);
});

test('the same fighters in a different bout can get a different result', () => {
  // The contestId is part of the seed, so a rematch is a real rematch
  // rather than a replay.
  const a = fighter();
  const b = fighter();
  const draws = new Set();
  for (const id of ['bout-1', 'bout-2', 'bout-3', 'bout-4', 'bout-5']) {
    draws.add(contest.resolveContest(engine.WorldState, { participantIds: [a.id, b.id], contestId: id }).draw);
  }
  assert.ok(draws.size > 1, 'five different bouts should not all draw the same number');
});

test('a result can be verified by re-running it', () => {
  const a = fighter();
  const b = fighter();
  const result = contest.resolveContest(engine.WorldState, {
    participantIds: [a.id, b.id], contestId: 'audited',
  });

  const check = contest.verifyContest(engine.WorldState, result);
  assert.equal(check.reproduced, true);
  assert.equal(check.actual, result.winnerId);
});

test('a tampered result fails verification', () => {
  // The point of the whole seeded design: somebody reporting a winner
  // that the ratings and the seed do not produce is caught.
  const a = fighter();
  const b = fighter();
  const result = contest.resolveContest(engine.WorldState, {
    participantIds: [a.id, b.id], contestId: 'tampered',
  });

  const forged = { ...result, winnerId: result.ratings.find((r) => r.entityId !== result.winnerId).entityId };
  const check = contest.verifyContest(engine.WorldState, forged);
  assert.equal(check.reproduced, false);
});

// ---------------------------------------------------------------------------
// Upsets — a sport, not a table
// ---------------------------------------------------------------------------

test('the favourite is favoured but never certain', () => {
  const wide = contest.winProbability(90, 20);
  assert.ok(wide > 0.9, 'a huge gap should be a heavy favourite');
  assert.ok(wide < 1, 'and never a certainty — an unbeatable favourite is not a sport');
  assert.equal(contest.winProbability(50, 50), 0.5, 'equals are a coin flip');
  assert.ok(contest.winProbability(20, 90) < 0.1);
});

test('the cap is a real cap, not a shape the curve happens to stay under', () => {
  // Deleting `Math.min(0.97, Math.max(0.03, …))` outright broke none of
  // the assertions above: the logistic never quite reaches 1 on its
  // own, so `wide < 1` passed with no cap at all. The module header
  // says "the ceiling matters"; this is the test that makes that true.
  //
  // Asserted as EXACT equality at a gap wide enough that the raw curve
  // would round to 1.000 — 100 vs 0 is 8.3 scale-widths, p = 0.99976.
  assert.equal(contest.winProbability(100, 0), 0.97, 'the ceiling is 0.97 and it binds');
  assert.equal(contest.winProbability(0, 100), 0.03, 'and the floor mirrors it');
  // A 3-in-100 upset is the floor of the whole design: at any gap the
  // simulation can produce, the underdog keeps a live chance.
  assert.ok(contest.winProbability(1e6, 0) <= 0.97, 'no gap, however absurd, buys a certainty');
});

test('upsets actually happen across many contests', () => {
  // The whole model would be decoration if the higher rating always won.
  let upsets = 0;
  const rounds = 200;
  for (let i = 0; i < rounds; i += 1) {
    const a = fighter();
    const b = fighter();
    if (contest.resolveContest(engine.WorldState, {
      participantIds: [a.id, b.id], contestId: `upset-${i}`,
    }).upset) upsets += 1;
  }
  assert.ok(upsets > rounds * 0.1, `only ${upsets}/${rounds} upsets — the draw is barely mattering`);
  assert.ok(upsets < rounds * 0.5, `${upsets}/${rounds} upsets — rating is barely mattering`);
});

test('a mismatch still favours the better fighter overwhelmingly', () => {
  let favouriteWins = 0;
  const rounds = 100;
  for (let i = 0; i < rounds; i += 1) {
    const strong = fighter({
      combat: { 'Melee Skill': 95, 'Weapon Mastery': 95, 'Tactical Awareness': 95, 'Composure Under Fire': 95 },
      physical: { Strength: 95, Agility: 95, Reflexes: 95, Endurance: 95, 'Pain Tolerance': 95 },
    });
    const weak = fighter({
      combat: { 'Melee Skill': 5, 'Weapon Mastery': 5, 'Tactical Awareness': 5, 'Composure Under Fire': 5 },
      physical: { Strength: 5, Agility: 5, Reflexes: 5, Endurance: 5, 'Pain Tolerance': 5 },
    });
    const r = contest.resolveContest(engine.WorldState, {
      participantIds: [strong.id, weak.id], contestId: `mismatch-${i}`,
    });
    if (r.winnerId === strong.id) favouriteWins += 1;
  }
  assert.ok(favouriteWins > rounds * 0.85, `favourite won only ${favouriteWins}/${rounds} of a total mismatch`);
});

// ---------------------------------------------------------------------------
// Boundaries
// ---------------------------------------------------------------------------

test('a contest needs at least two distinct entrants', () => {
  const a = fighter();
  assert.throws(() => contest.resolveContest(engine.WorldState, { participantIds: [a.id] }), /at least two/);
  assert.throws(
    () => contest.resolveContest(engine.WorldState, { participantIds: [a.id, a.id] }),
    /cannot compete against itself/,
  );
});

test('more than two entrants resolve to exactly one winner from the field', () => {
  const field = [fighter(), fighter(), fighter(), fighter()].map((f) => f.id);
  const r = contest.resolveContest(engine.WorldState, { participantIds: field, contestId: 'battle-royal' });
  assert.ok(field.includes(r.winnerId));
  assert.equal(r.ratings.length, 4);
});

test('resolving a contest changes nothing in the world', () => {
  // The engine decides who wins. Paying, booking and broadcasting
  // belong to VAGO, VDP and Vavlt Stvdios, and a second place that
  // moves money is how two systems start disagreeing.
  const a = fighter();
  const b = fighter();
  const before = JSON.stringify(engine.WorldState);
  contest.resolveContest(engine.WorldState, { participantIds: [a.id, b.id], contestId: 'inert' });
  assert.equal(JSON.stringify(engine.WorldState), before);
});

test('the engine exposes contests bound to its own WorldState', () => {
  const a = engine.generateNPC();
  const b = engine.generateNPC();
  const r = engine.resolveContest({ participantIds: [a.id, b.id], contestId: 'bound' });
  assert.ok([a.id, b.id].includes(r.winnerId));
  assert.equal(engine.verifyContest(r).reproduced, true);
  assert.ok(engine.rateEntity(a.id, 'sport').rating >= 0);
});

// ---------------------------------------------------------------------------
// The house games — precision and wits
// ---------------------------------------------------------------------------
// Added because a settlement that has rebuilt far enough to have a table
// in a room has a social life, and this engine could already resolve a
// knife fight and a footrace but not a game of pool.

test('pool is won by a good eye, not by a strong back', () => {
  // **The point of a separate discipline.** Endurance and Strength are
  // deliberately absent from `precision`, so a frail person with a
  // steady hand beats a powerful one who cannot see the shot. Rating
  // them under `combat` would have inverted that.
  const sharp = fighter({
    physical: { 'Vision Acuity': 95, Reflexes: 80, Agility: 60, Strength: 10, Endurance: 10 },
    sports: { Coordination: 90 },
    mental: { Focus: 85 },
  });
  const strong = fighter({
    physical: { 'Vision Acuity': 15, Reflexes: 30, Agility: 40, Strength: 95, Endurance: 95 },
    sports: { Coordination: 25 },
    mental: { Focus: 20 },
  });

  const precisionRating = contest.rateEntity(engine.WorldState, sharp.id, 'precision');
  const strongRating = contest.rateEntity(engine.WorldState, strong.id, 'precision');
  assert.ok(precisionRating.rating > strongRating.rating,
    `sharp ${precisionRating.rating} should beat strong ${strongRating.rating} at pool`);

  // **Distinctness asserted structurally, not by a second rating.**
  // The first version compared the same two fighters under `combat`
  // and expected the strong one to win — and `combat` weights four
  // combat-family traits at 9 of its ~14 total, which `fighter()`
  // leaves randomly generated. The comparison was noise wearing an
  // assertion's clothes, which is CLAUDE.md's eighth standing rule:
  // a test whose subject is randomly generated is not testing what it
  // says.
  //
  // What actually matters is that the two disciplines read different
  // traits, and that is deterministic.
  const combatReads = Object.keys(
    contest.rateEntity(engine.WorldState, strong.id, 'combat').contributions,
  );
  const precisionReads = Object.keys(precisionRating.contributions);
  assert.ok(combatReads.includes('physical.Strength'), 'combat should read Strength');
  assert.equal(precisionReads.includes('physical.Strength'), false,
    'precision reads Strength — a powerful player would win at pool for the wrong reason');
  assert.equal(precisionReads.includes('physical.Endurance'), false);
});

test('Vision Acuity was a dead trait and now decides something', () => {
  // Generated on every NPC and read by nothing, which is the exact
  // pattern `contest.js` was originally written to fix for `combat`
  // and `sports`. `precision` is the only discipline that reads it.
  const contributions = Object.keys(
    contest.rateEntity(engine.WorldState, fighter().id, 'precision').contributions,
  );
  assert.ok(contributions.includes('physical.Vision Acuity'));

  for (const discipline of ['combat', 'sport', 'teamSport', 'wits']) {
    const other = Object.keys(
      contest.rateEntity(engine.WorldState, fighter().id, discipline).contributions,
    );
    assert.equal(other.includes('physical.Vision Acuity'), false,
      `${discipline} also reads Vision Acuity — precision is not distinct`);
  }
});

test('cards are won by nerve and memory, and read no physical trait at all', () => {
  const player = fighter({
    mental: {
      'Risk Assessment': 90, Memory: 85, Focus: 80, 'Problem Solving': 75,
    },
    social: { Charisma: 70 },
  });
  const rating = contest.rateEntity(engine.WorldState, player.id, 'wits');
  assert.ok(rating.rating > 60);

  // A card game is not athletics. If a physical trait ever appears
  // here, somebody has made `wits` a general-purpose discipline.
  for (const key of Object.keys(rating.contributions)) {
    assert.equal(key.startsWith('physical.'), false, `wits reads ${key}`);
    assert.equal(key.startsWith('sports.'), false, `wits reads ${key}`);
  }
});

test('a house game resolves and re-verifies like any other contest', () => {
  // The whole reason to express pool as a discipline rather than as a
  // new subsystem: everything `resolveContest` already guarantees —
  // a seeded, replayable, re-verifiable result — comes free.
  const a = fighter({ physical: { 'Vision Acuity': 90 }, sports: { Coordination: 85 } });
  const b = fighter({ physical: { 'Vision Acuity': 30 }, sports: { Coordination: 35 } });

  const result = contest.resolveContest(engine.WorldState, {
    contestId: 'pool-1', participantIds: [a.id, b.id], discipline: 'precision',
  });
  assert.ok([a.id, b.id].includes(result.winnerId));
  assert.equal(contest.verifyContest(engine.WorldState, result).reproduced, true,
    'a house game result cannot be re-verified');

  const again = contest.resolveContest(engine.WorldState, {
    contestId: 'pool-1', participantIds: [a.id, b.id], discipline: 'precision',
  });
  assert.equal(again.winnerId, result.winnerId, 'the same game played out differently');
});
