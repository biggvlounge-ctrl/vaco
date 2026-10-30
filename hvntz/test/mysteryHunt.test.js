// HVNTZ — Mystery Hunts: a real Clue-style deduction layer over the
// checkpoint/check-in mechanic. See lib/mysteryHunt.js's own header.

'use strict';

const test = require('node:test');
const assert = require('node:assert');

const {
  createHvntzStore, registerBusiness, registerLocation,
} = require('../lib/revenueStack');
const { createHunt, addCheckpoint, checkInAtCheckpoint } = require('../lib/hunts');
const {
  SLOTS, createMysteryTeam, teamFor, setMysterySolution, addMysteryClue,
  revealCluesFor, knownFacts, makeAccusation, mysteryStatus,
} = require('../lib/mysteryHunt');

function recorder() {
  const legs = [];
  const fn = async (settlementLegs) => { legs.push(...settlementLegs); return { ok: true }; };
  fn.legs = legs;
  return fn;
}

function hostBusinessAndLocation(store, suffix = '1') {
  const business = registerBusiness(store, { name: `Business ${suffix}`, ownerId: `owner-${suffix}` });
  const location = registerLocation(store, {
    businessId: business.id, locationType: 'hub', address: `${suffix} Rooftop Way, St. Louis, MO`, lat: 38.62, lng: -90.19,
  });
  return { business, location };
}

function huntWithCheckpoints(store, count = 3) {
  const hunt = createHunt(store, { title: 'Downtown Mystery Crawl', sponsorId: 'sponsor-1', totalBudget: 500 });
  const checkpoints = [];
  for (let i = 0; i < count; i += 1) {
    const { business, location } = hostBusinessAndLocation(store, String(i + 1));
    checkpoints.push(addCheckpoint(store, {
      huntId: hunt.id, businessId: business.id, locationId: location.id,
      bountyAmount: 10, hostFee: 4, clue: `Clue text ${i + 1}`,
    }));
  }
  return { hunt, checkpoints };
}

// ---------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------

test('createMysteryTeam requires a non-empty name and member list', () => {
  const store = createHvntzStore();
  const { hunt } = huntWithCheckpoints(store, 1);
  assert.throws(() => createMysteryTeam(store, { huntId: hunt.id, memberUserIds: ['a'] }), /name/);
  assert.throws(() => createMysteryTeam(store, { huntId: hunt.id, name: 'Sleuths', memberUserIds: [] }), /memberUserIds/);
});

test('a real person cannot be on two teams for the same hunt', () => {
  const store = createHvntzStore();
  const { hunt } = huntWithCheckpoints(store, 1);
  createMysteryTeam(store, { huntId: hunt.id, name: 'Team A', memberUserIds: ['sam'] });
  assert.throws(
    () => createMysteryTeam(store, { huntId: hunt.id, name: 'Team B', memberUserIds: ['sam'] }),
    /already on a team/,
  );
});

test('teamFor finds a real team, and is null for a solo player', () => {
  const store = createHvntzStore();
  const { hunt } = huntWithCheckpoints(store, 1);
  const team = createMysteryTeam(store, { huntId: hunt.id, name: 'Team A', memberUserIds: ['sam', 'bo'] });
  assert.strictEqual(teamFor(store, hunt.id, 'sam').id, team.id);
  assert.strictEqual(teamFor(store, hunt.id, 'solo-user'), null);
});

// ---------------------------------------------------------------------
// The hidden solution
// ---------------------------------------------------------------------

test('setMysterySolution requires all three real slots', () => {
  const store = createHvntzStore();
  const { hunt } = huntWithCheckpoints(store, 1);
  assert.throws(() => setMysterySolution(store, { huntId: hunt.id, who: 'Ava', what: 'Map' }), /where/);
});

test('setMysterySolution is refused once real clues or accusations exist', () => {
  const store = createHvntzStore();
  const { hunt, checkpoints } = huntWithCheckpoints(store, 1);
  setMysterySolution(store, { huntId: hunt.id, who: 'Ava', what: 'Map', where: 'The Arch' });
  addMysteryClue(store, { huntId: hunt.id, checkpointId: checkpoints[0].id, slot: 'who', value: 'Ava', isRedHerring: false });
  assert.throws(
    () => setMysterySolution(store, { huntId: hunt.id, who: 'Bea', what: 'Map', where: 'The Arch' }),
    /already has real clues/,
  );
});

// ---------------------------------------------------------------------
// Clues — the consistency check is the whole point
// ---------------------------------------------------------------------

test('addMysteryClue requires a mystery solution to already be set', () => {
  const store = createHvntzStore();
  const { hunt, checkpoints } = huntWithCheckpoints(store, 1);
  assert.throws(
    () => addMysteryClue(store, { huntId: hunt.id, checkpointId: checkpoints[0].id, slot: 'who', value: 'Ava', isRedHerring: false }),
    /no mystery solution set/,
  );
});

test('a true value cannot be declared a red herring', () => {
  const store = createHvntzStore();
  const { hunt, checkpoints } = huntWithCheckpoints(store, 1);
  setMysterySolution(store, { huntId: hunt.id, who: 'Ava', what: 'Map', where: 'The Arch' });
  assert.throws(
    () => addMysteryClue(store, { huntId: hunt.id, checkpointId: checkpoints[0].id, slot: 'who', value: 'Ava', isRedHerring: true }),
    /IS the real who/,
  );
});

test('a false value must be declared a red herring', () => {
  const store = createHvntzStore();
  const { hunt, checkpoints } = huntWithCheckpoints(store, 1);
  setMysterySolution(store, { huntId: hunt.id, who: 'Ava', what: 'Map', where: 'The Arch' });
  assert.throws(
    () => addMysteryClue(store, { huntId: hunt.id, checkpointId: checkpoints[0].id, slot: 'who', value: 'Bea', isRedHerring: false }),
    /is NOT the real who/,
  );
});

test('a correctly-labelled true clue and red herring both attach cleanly', () => {
  const store = createHvntzStore();
  const { hunt, checkpoints } = huntWithCheckpoints(store, 2);
  setMysterySolution(store, { huntId: hunt.id, who: 'Ava', what: 'Map', where: 'The Arch' });
  const trueClue = addMysteryClue(store, { huntId: hunt.id, checkpointId: checkpoints[0].id, slot: 'who', value: 'Ava', isRedHerring: false });
  const herring = addMysteryClue(store, { huntId: hunt.id, checkpointId: checkpoints[1].id, slot: 'who', value: 'Bea', isRedHerring: true });
  assert.strictEqual(trueClue.isRedHerring, false);
  assert.strictEqual(herring.isRedHerring, true);
});

test('addMysteryClue only accepts one of the three real slots', () => {
  const store = createHvntzStore();
  const { hunt, checkpoints } = huntWithCheckpoints(store, 1);
  setMysterySolution(store, { huntId: hunt.id, who: 'Ava', what: 'Map', where: 'The Arch' });
  assert.throws(
    () => addMysteryClue(store, { huntId: hunt.id, checkpointId: checkpoints[0].id, slot: 'when', value: 'Ava', isRedHerring: false }),
    new RegExp(`one of ${SLOTS.join(', ')}`),
  );
});

// ---------------------------------------------------------------------
// Revealing — the real sharing mechanic
// ---------------------------------------------------------------------

test('revealCluesFor shares a checkpoint\'s clue with the checking-in user\'s whole real team', () => {
  const store = createHvntzStore();
  const { hunt, checkpoints } = huntWithCheckpoints(store, 1);
  createMysteryTeam(store, { huntId: hunt.id, name: 'Team A', memberUserIds: ['sam', 'bo'] });
  setMysterySolution(store, { huntId: hunt.id, who: 'Ava', what: 'Map', where: 'The Arch' });
  addMysteryClue(store, { huntId: hunt.id, checkpointId: checkpoints[0].id, slot: 'who', value: 'Ava', isRedHerring: false });

  revealCluesFor(store, { huntId: hunt.id, checkpointId: checkpoints[0].id, userId: 'sam' });
  // bo never checked in anywhere, but shares sam's real team.
  const boFacts = knownFacts(store, { huntId: hunt.id, userId: 'bo' });
  assert.strictEqual(boFacts.length, 1);
  assert.strictEqual(boFacts[0].value, 'Ava');
});

test('a solo player\'s reveal is never shared with anyone else', () => {
  const store = createHvntzStore();
  const { hunt, checkpoints } = huntWithCheckpoints(store, 1);
  setMysterySolution(store, { huntId: hunt.id, who: 'Ava', what: 'Map', where: 'The Arch' });
  addMysteryClue(store, { huntId: hunt.id, checkpointId: checkpoints[0].id, slot: 'who', value: 'Ava', isRedHerring: false });

  revealCluesFor(store, { huntId: hunt.id, checkpointId: checkpoints[0].id, userId: 'solo-sam' });
  assert.strictEqual(knownFacts(store, { huntId: hunt.id, userId: 'solo-sam' }).length, 1);
  assert.strictEqual(knownFacts(store, { huntId: hunt.id, userId: 'someone-else' }).length, 0);
});

test('revealCluesFor returns null, honestly, for a checkpoint with no mystery clue', () => {
  const store = createHvntzStore();
  const { hunt, checkpoints } = huntWithCheckpoints(store, 1);
  const result = revealCluesFor(store, { huntId: hunt.id, checkpointId: checkpoints[0].id, userId: 'sam' });
  assert.strictEqual(result, null);
});

test('revealCluesFor is idempotent -- a repeat call never double-reveals', () => {
  const store = createHvntzStore();
  const { hunt, checkpoints } = huntWithCheckpoints(store, 1);
  setMysterySolution(store, { huntId: hunt.id, who: 'Ava', what: 'Map', where: 'The Arch' });
  addMysteryClue(store, { huntId: hunt.id, checkpointId: checkpoints[0].id, slot: 'who', value: 'Ava', isRedHerring: false });
  revealCluesFor(store, { huntId: hunt.id, checkpointId: checkpoints[0].id, userId: 'sam' });
  revealCluesFor(store, { huntId: hunt.id, checkpointId: checkpoints[0].id, userId: 'sam' });
  assert.strictEqual(knownFacts(store, { huntId: hunt.id, userId: 'sam' }).length, 1);
});

test('knownFacts never includes the hidden solution itself, only revealed clues', () => {
  const store = createHvntzStore();
  const { hunt, checkpoints } = huntWithCheckpoints(store, 2);
  setMysterySolution(store, { huntId: hunt.id, who: 'Ava', what: 'Map', where: 'The Arch' });
  addMysteryClue(store, { huntId: hunt.id, checkpointId: checkpoints[0].id, slot: 'who', value: 'Ava', isRedHerring: false });
  addMysteryClue(store, { huntId: hunt.id, checkpointId: checkpoints[1].id, slot: 'what', value: 'Map', isRedHerring: false });
  // Only the first checkpoint was actually visited.
  revealCluesFor(store, { huntId: hunt.id, checkpointId: checkpoints[0].id, userId: 'sam' });
  const facts = knownFacts(store, { huntId: hunt.id, userId: 'sam' });
  assert.strictEqual(facts.length, 1, 'the unvisited checkpoint\'s clue must not be known yet');
  assert.strictEqual(facts[0].slot, 'who');
});

// ---------------------------------------------------------------------
// Accusation
// ---------------------------------------------------------------------

function soloSolvedHunt(store) {
  const { hunt, checkpoints } = huntWithCheckpoints(store, 1);
  setMysterySolution(store, { huntId: hunt.id, who: 'Ava', what: 'Map', where: 'The Arch' });
  return { hunt, checkpoints };
}

test('a correct accusation solves the mystery for that real identity', () => {
  const store = createHvntzStore();
  const { hunt } = soloSolvedHunt(store);
  const accusation = makeAccusation(store, {
    huntId: hunt.id, userId: 'sam', guess: { who: 'Ava', what: 'Map', where: 'The Arch' },
  });
  assert.strictEqual(accusation.correct, true);
  assert.strictEqual(mysteryStatus(store, hunt.id).solved, true);
});

test('a wrong accusation eliminates the accusing team from winning, but the mystery stays open', () => {
  const store = createHvntzStore();
  const { hunt } = soloSolvedHunt(store);
  createMysteryTeam(store, { huntId: hunt.id, name: 'Wrong Guessers', memberUserIds: ['sam'] });
  const accusation = makeAccusation(store, {
    huntId: hunt.id, userId: 'sam', guess: { who: 'Bea', what: 'Map', where: 'The Arch' },
  });
  assert.strictEqual(accusation.correct, false);
  assert.strictEqual(teamFor(store, hunt.id, 'sam').eliminatedFromMystery, true);
  assert.strictEqual(mysteryStatus(store, hunt.id).solved, false);
});

test('an eliminated team cannot make a second accusation -- the real board-game rule', () => {
  const store = createHvntzStore();
  const { hunt } = soloSolvedHunt(store);
  createMysteryTeam(store, { huntId: hunt.id, name: 'Wrong Guessers', memberUserIds: ['sam'] });
  makeAccusation(store, { huntId: hunt.id, userId: 'sam', guess: { who: 'Bea', what: 'Map', where: 'The Arch' } });
  assert.throws(
    () => makeAccusation(store, { huntId: hunt.id, userId: 'sam', guess: { who: 'Ava', what: 'Map', where: 'The Arch' } }),
    /already made a wrong accusation/,
  );
});

test('a different team can still win after another team\'s elimination', () => {
  const store = createHvntzStore();
  const { hunt } = soloSolvedHunt(store);
  createMysteryTeam(store, { huntId: hunt.id, name: 'Wrong Guessers', memberUserIds: ['sam'] });
  createMysteryTeam(store, { huntId: hunt.id, name: 'Right Guessers', memberUserIds: ['bo'] });
  makeAccusation(store, { huntId: hunt.id, userId: 'sam', guess: { who: 'Bea', what: 'Map', where: 'The Arch' } });
  const winning = makeAccusation(store, { huntId: hunt.id, userId: 'bo', guess: { who: 'Ava', what: 'Map', where: 'The Arch' } });
  assert.strictEqual(winning.correct, true);
});

test('no further accusation is accepted once the mystery is already solved', () => {
  const store = createHvntzStore();
  const { hunt } = soloSolvedHunt(store);
  makeAccusation(store, { huntId: hunt.id, userId: 'sam', guess: { who: 'Ava', what: 'Map', where: 'The Arch' } });
  assert.throws(
    () => makeAccusation(store, { huntId: hunt.id, userId: 'bo', guess: { who: 'Ava', what: 'Map', where: 'The Arch' } }),
    /already been solved/,
  );
});

// ---------------------------------------------------------------------
// mysteryStatus never leaks the hidden solution
// ---------------------------------------------------------------------

test('mysteryStatus reports hasMystery: false for a hunt with no mystery set up', () => {
  const store = createHvntzStore();
  const { hunt } = huntWithCheckpoints(store, 1);
  assert.deepStrictEqual(mysteryStatus(store, hunt.id), { huntId: hunt.id, hasMystery: false });
});

test('mysteryStatus never includes the real solution', () => {
  const store = createHvntzStore();
  const { hunt } = soloSolvedHunt(store);
  const status = mysteryStatus(store, hunt.id);
  assert.strictEqual(JSON.stringify(status).includes('Ava'), false);
  assert.strictEqual(JSON.stringify(status).includes('Arch'), false);
});

// ---------------------------------------------------------------------
// A real check-in through the existing hunt mechanic, with a mystery
// clue shared on top of it
// ---------------------------------------------------------------------

test('checking in at a checkpoint reveals its real mystery clue to the hunter\'s own team', async () => {
  const store = createHvntzStore();
  const { hunt, checkpoints } = huntWithCheckpoints(store, 1);
  createMysteryTeam(store, { huntId: hunt.id, name: 'Team A', memberUserIds: ['sam', 'bo'] });
  setMysterySolution(store, { huntId: hunt.id, who: 'Ava', what: 'Map', where: 'The Arch' });
  addMysteryClue(store, { huntId: hunt.id, checkpointId: checkpoints[0].id, slot: 'where', value: 'The Arch', isRedHerring: false });

  const settleFn = recorder();
  await checkInAtCheckpoint(store, { huntId: hunt.id, checkpointId: checkpoints[0].id, userId: 'sam', settleFn });
  const clue = revealCluesFor(store, { huntId: hunt.id, checkpointId: checkpoints[0].id, userId: 'sam' });
  assert.strictEqual(clue.value, 'The Arch');
  // Shared with bo too, who never checked in anywhere themselves.
  assert.strictEqual(knownFacts(store, { huntId: hunt.id, userId: 'bo' }).length, 1);
});
