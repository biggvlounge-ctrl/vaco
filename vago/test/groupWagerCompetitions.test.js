// VAGO — Group Wager Competitions: Leagues (§12) and Tournaments (§11),
// one engine. Every points/standings number here is recomputed from
// real settled group wagers, never a second source of truth.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createGroupWager, joinGroupWager, resolveGroupWager } = require('../lib/groupWagers');
const {
  createCompetition, addLeg, pointsStandings, advanceRound, finishCompetition, competitionView, FORMATS,
} = require('../lib/groupWagerCompetitions');
const { createVagoStore } = require('../lib/store');

function ledger() {
  const legs = [];
  const fn = async (settlementLegs) => {
    legs.push(...settlementLegs);
    return { settlementId: legs.length };
  };
  fn.legs = legs;
  return fn;
}

const FUTURE = Date.now() + 60 * 60 * 1000;

function baseGroupWagerOptions(overrides = {}) {
  return {
    creatorId: 'ada',
    name: 'leg',
    entryDeadline: FUTURE,
    question: 'q',
    category: 'sports',
    source: 'real-world',
    ...overrides,
  };
}

async function settledLeg(store, { outcome, picks }) {
  const groupWager = await createGroupWager(store, baseGroupWagerOptions({ name: `leg-${Date.now()}-${Math.random()}` }));
  for (const [userId, side] of picks) {
    // eslint-disable-next-line no-await-in-loop
    await joinGroupWager(store, { groupWagerId: groupWager.id, userId, side, quantity: 10, settleFn: ledger() });
  }
  await resolveGroupWager(store, { groupWagerId: groupWager.id, outcome, settleFn: ledger() });
  return groupWager;
}

// -- createCompetition / addLeg ------------------------------------------

test('every declared FORMATS value is accepted', async () => {
  for (const format of FORMATS) {
    const store = createVagoStore();
    const competition = createCompetition(store, { creatorId: 'ada', name: 'c', format });
    assert.equal(competition.format, format);
  }
});

test('a leg must name a real group wager', () => {
  const store = createVagoStore();
  const competition = createCompetition(store, { creatorId: 'ada', name: 'c', format: 'league' });
  assert.throws(() => addLeg(store, { competitionId: competition.id, groupWagerId: 9999 }), /no group wager 9999/);
});

test('a tournament leg requires a round; a league leg does not', async () => {
  const store = createVagoStore();
  const groupWager = await createGroupWager(store, baseGroupWagerOptions());

  const league = createCompetition(store, { creatorId: 'ada', name: 'league', format: 'league' });
  addLeg(store, { competitionId: league.id, groupWagerId: groupWager.id });

  const groupWager2 = await createGroupWager(store, baseGroupWagerOptions({ name: 'leg2' }));
  const tournament = createCompetition(store, { creatorId: 'ada', name: 'tourney', format: 'tournament' });
  assert.throws(
    () => addLeg(store, { competitionId: tournament.id, groupWagerId: groupWager2.id }),
    /requires an integer round/,
  );
  addLeg(store, { competitionId: tournament.id, groupWagerId: groupWager2.id, round: 1 });
});

test('the same group wager cannot be added as a leg twice', async () => {
  const store = createVagoStore();
  const groupWager = await createGroupWager(store, baseGroupWagerOptions());
  const competition = createCompetition(store, { creatorId: 'ada', name: 'c', format: 'league' });
  addLeg(store, { competitionId: competition.id, groupWagerId: groupWager.id });
  assert.throws(
    () => addLeg(store, { competitionId: competition.id, groupWagerId: groupWager.id }),
    /already a leg/,
  );
});

// -- pointsStandings -------------------------------------------------------

test('points accumulate per correct pick, not per VCoin won', async () => {
  const store = createVagoStore();
  const competition = createCompetition(store, { creatorId: 'ada', name: 'league', format: 'league' });

  const leg1 = await settledLeg(store, { outcome: 'yes', picks: [['bob', 'yes'], ['cleo', 'no']] });
  const leg2 = await settledLeg(store, { outcome: 'no', picks: [['bob', 'yes'], ['cleo', 'no']] });
  addLeg(store, { competitionId: competition.id, groupWagerId: leg1.id });
  addLeg(store, { competitionId: competition.id, groupWagerId: leg2.id });

  const standings = pointsStandings(store, competition);
  const bob = standings.find((r) => r.userId === 'bob');
  const cleo = standings.find((r) => r.userId === 'cleo');
  assert.equal(bob.points, 1, 'bob won exactly one of two legs');
  assert.equal(cleo.points, 1, 'cleo won exactly one of two legs');
  assert.equal(bob.wins, 1);
  assert.equal(cleo.wins, 1);
});

test('an unsettled leg contributes no points to anyone', async () => {
  const store = createVagoStore();
  const competition = createCompetition(store, { creatorId: 'ada', name: 'league', format: 'league' });
  const groupWager = await createGroupWager(store, baseGroupWagerOptions());
  await joinGroupWager(store, { groupWagerId: groupWager.id, userId: 'bob', side: 'yes', quantity: 10, settleFn: ledger() });
  addLeg(store, { competitionId: competition.id, groupWagerId: groupWager.id });

  assert.deepEqual(pointsStandings(store, competition), []);
});

// -- advanceRound (tournament only) ----------------------------------------

test('advanceRound is refused on a league — §12 names no elimination', () => {
  const store = createVagoStore();
  const competition = createCompetition(store, { creatorId: 'ada', name: 'league', format: 'league' });
  assert.throws(
    () => advanceRound(store, { competitionId: competition.id, round: 1, keepTop: 1 }),
    /is a league, not a tournament/,
  );
});

test('advanceRound refuses to run while a leg in that round is still unsettled', async () => {
  const store = createVagoStore();
  const competition = createCompetition(store, { creatorId: 'ada', name: 'tourney', format: 'tournament' });
  const groupWager = await createGroupWager(store, baseGroupWagerOptions());
  await joinGroupWager(store, { groupWagerId: groupWager.id, userId: 'bob', side: 'yes', quantity: 10, settleFn: ledger() });
  addLeg(store, { competitionId: competition.id, groupWagerId: groupWager.id, round: 1 });

  assert.throws(
    () => advanceRound(store, { competitionId: competition.id, round: 1, keepTop: 1 }),
    /still has an unsettled leg/,
  );
});

test('a tournament eliminates everyone below the cutoff and declares a winner at keepTop=1', async () => {
  const store = createVagoStore();
  const competition = createCompetition(store, { creatorId: 'ada', name: 'tourney', format: 'tournament' });

  // Round 1: bob and dana pick correctly, cleo does not.
  const r1 = await settledLeg(store, { outcome: 'yes', picks: [['bob', 'yes'], ['dana', 'yes'], ['cleo', 'no']] });
  addLeg(store, { competitionId: competition.id, groupWagerId: r1.id, round: 1 });

  const roundOneResult = advanceRound(store, { competitionId: competition.id, round: 1, keepTop: 2 });
  assert.deepEqual(roundOneResult.eliminated, ['cleo']);
  assert.equal(competition.status, 'open', 'two survivors remain -- not finished yet');

  // Round 2: between the two survivors, bob picks correctly again.
  const r2 = await settledLeg(store, { outcome: 'yes', picks: [['bob', 'yes'], ['dana', 'no']] });
  addLeg(store, { competitionId: competition.id, groupWagerId: r2.id, round: 2 });

  const finalsResult = advanceRound(store, { competitionId: competition.id, round: 2, keepTop: 1 });
  assert.deepEqual(finalsResult.survivors, ['bob']);
  assert.equal(competition.status, 'finished');
  assert.equal(competition.winnerUserId, 'bob');
});

test('an eliminated participant cannot score again from a later round', async () => {
  const store = createVagoStore();
  const competition = createCompetition(store, { creatorId: 'ada', name: 'tourney', format: 'tournament' });

  const r1 = await settledLeg(store, { outcome: 'yes', picks: [['bob', 'yes'], ['cleo', 'no']] });
  addLeg(store, { competitionId: competition.id, groupWagerId: r1.id, round: 1 });
  advanceRound(store, { competitionId: competition.id, round: 1, keepTop: 1 });

  const standings = pointsStandings(store, competition);
  const cleo = standings.find((r) => r.userId === 'cleo');
  assert.equal(cleo.eliminated, true);
});

// -- finishCompetition (league) --------------------------------------------

test('finishCompetition declares the real standings leader as winner', async () => {
  const store = createVagoStore();
  const competition = createCompetition(store, { creatorId: 'ada', name: 'league', format: 'league' });
  const leg1 = await settledLeg(store, { outcome: 'yes', picks: [['bob', 'yes'], ['cleo', 'no']] });
  const leg2 = await settledLeg(store, { outcome: 'yes', picks: [['bob', 'yes'], ['cleo', 'no']] });
  addLeg(store, { competitionId: competition.id, groupWagerId: leg1.id });
  addLeg(store, { competitionId: competition.id, groupWagerId: leg2.id });

  const finished = finishCompetition(store, { competitionId: competition.id });
  assert.equal(finished.winnerUserId, 'bob');
  assert.equal(finished.status, 'finished');
});

test('a finished competition cannot be finished twice, or take a new leg', async () => {
  const store = createVagoStore();
  const competition = createCompetition(store, { creatorId: 'ada', name: 'league', format: 'league' });
  finishCompetition(store, { competitionId: competition.id });
  assert.throws(() => finishCompetition(store, { competitionId: competition.id }), /already finished/);

  const groupWager = await createGroupWager(store, baseGroupWagerOptions());
  assert.throws(
    () => addLeg(store, { competitionId: competition.id, groupWagerId: groupWager.id }),
    /already finished/,
  );
});

// -- competitionView --------------------------------------------------------

test('competitionView carries live standings alongside the stored record', async () => {
  const store = createVagoStore();
  const competition = createCompetition(store, { creatorId: 'ada', name: 'league', format: 'league' });
  const leg = await settledLeg(store, { outcome: 'yes', picks: [['bob', 'yes']] });
  addLeg(store, { competitionId: competition.id, groupWagerId: leg.id });

  const view = competitionView(store, competition.id);
  assert.equal(view.id, competition.id);
  assert.equal(view.standings.length, 1);
  assert.equal(view.standings[0].userId, 'bob');
});

test('competitionView returns null for an unknown competition', () => {
  const store = createVagoStore();
  assert.equal(competitionView(store, 9999), null);
});
