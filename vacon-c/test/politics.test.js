// Politics — governments, laws, elections, opinion and regime change.
//
// **What this closes.** Six tables — `governments`, `elections`,
// `votes`, `laws`, `public_opinion`, `revolutions` — were all defined
// in the schema and **no engine module touched one of them.**
// `urbanSystems.js` marked Political `modelled` on the strength of
// those definitions alone, which was wrong in the way this repo keeps
// finding: nothing governed, elected, voted, legislated or revolted.
//
// Two of the six carry schema comments that are design instructions,
// and both are asserted here rather than taken on trust:
//
//   public_opinion  "Rollup from beliefs/entity_knowledge on a topic,
//                    not new source data"
//   revolutions     "Ties Public Opinion + Information Spread +
//                    Government into a real regime-change mechanic,
//                    not just a lower stability number."

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const politics = require('../server/politics.js');
const { getTraitId } = require('../server/traitDefinitions.js');

// Entities carry LIVE traits through `entity_traits` rows, not the
// denormalised sheet — so the fixtures build those rows, which is the
// only way `stanceOf` sees anything. A fixture that set `npc.traits`
// would test nothing: `getLiveEntity` rebuilds the sheet from
// `entity_traits` and would find it empty, and every stance would come
// back as the 50 fallback.
//
// **The first version of this fixture did exactly that by accident**,
// which is CLAUDE.md's sixth standing rule in miniature: build
// fixtures with the real generators or you are testing your own
// invention. Two mistakes, both silent — the rows carried `value`
// where `traitsToSheet` reads `current_value`, and they carried
// made-up sequential `trait_id`s, while `traitsToSheet` resolves each
// id through `getTraitId`'s real catalogue. Every stance came back as
// the 50 fallback and seven tests failed with plausible-looking
// numbers rather than errors. Hence `getTraitId` below: the ids are
// the engine's own.
function world({ npcs = 4, loyalty = 50, paranoia = 50, threshold = 50 } = {}) {
  const worldState = {
    tick: 10,
    npcs: Array.from({ length: npcs }, (_, i) => ({ id: i + 1 })),
    organizations: [
      { id: 100, type: 'government', leader_npc_id: null },
      { id: 200, type: 'government', leader_npc_id: null },
      { id: 300, type: 'business', leader_npc_id: null },
    ],
    families: [],
    entityTraits: [],
    entityKnowledge: [],
    memories: [],
    relationships: [],
    governments: [],
    elections: [],
    votes: [],
    laws: [],
    publicOpinion: [],
    revolutions: [],
  };

  const traits = [
    ['social', 'Group Loyalty', loyalty],
    ['psychological', 'Paranoia', paranoia],
    ['psychological', 'Trust Threshold', threshold],
  ];
  for (const npc of worldState.npcs) {
    for (const [family, name, value] of traits) {
      const traitId = getTraitId(family, name);
      assert.ok(traitId, `no trait definition for ${family}/${name} — the fixture is fictional`);
      worldState.entityTraits.push({
        entity_id: npc.id,
        trait_id: traitId,
        base_value: value,
        current_value: value,
        key_modifier: 0,
      });
    }
  }
  politics.reseedIds(worldState);
  return worldState;
}

// -- governments are organization subtypes ------------------------------

test('a government must be an existing organization of type government', () => {
  const w = world();
  // Standing rule 4, and the schema's own primary key: governments
  // keys off organizations(id). An organization of another type
  // becoming a government would leave two disagreeing answers to
  // "what kind of thing is this".
  assert.throws(() => politics.foundGovernment(w, {
    organizationId: 300, systemType: 'council',
  }), /is type "business"/);
  assert.throws(() => politics.foundGovernment(w, {
    organizationId: 999, systemType: 'council',
  }), /no organization 999/);
  assert.throws(() => politics.foundGovernment(w, {
    organizationId: 100, systemType: 'anarcho-syndicalist',
  }), /systemType must be one of/);

  const gov = politics.foundGovernment(w, { organizationId: 100, systemType: 'council' });
  assert.equal(gov.organization_id, 100);
  assert.equal(gov.system_type, 'council');
  assert.throws(() => politics.foundGovernment(w, {
    organizationId: 100, systemType: 'monarchy',
  }), /already a government/);
});

test('the nine system types are the schema\'s own list, not a longer one', () => {
  // Taken verbatim from `governments.system_type`'s enumeration
  // comment. Inventing a tenth would be inventing a political model no
  // source document specifies.
  assert.deepEqual(politics.SYSTEM_TYPES, [
    'democracy', 'monarchy', 'council', 'corporate', 'tribal',
    'technocracy', 'military', 'religious', 'hybrid',
  ]);
  assert.equal(politics.LAW_CATEGORIES.length, 9);
});

// -- laws, and the spread they create -----------------------------------

test('enacting a law records it and tells the population a government exists', () => {
  // **This is the load-bearing connection.** Without a broadcast,
  // `computeApproval` would read `entity_knowledge` for a topic nothing
  // ever writes and return null forever — standing rule 6, a signal
  // reading a field that does not exist.
  const w = world({ npcs: 4 });
  politics.foundGovernment(w, { organizationId: 100, systemType: 'council' });

  const law = politics.enactLaw(w, {
    category: 'property', description: 'salvage claims register',
    governmentOrganizationId: 100, jurisdictionCityId: 7, tick: 11,
  });

  assert.equal(law.status, 'active');
  assert.equal(law.category, 'property');
  assert.equal(law.enacted_tick, 11);
  assert.equal(w.entityKnowledge.length, 4, 'every NPC should have heard about it');
  assert.ok(w.entityKnowledge.every((k) => k.fact_content.startsWith('government:100')));
  assert.ok(w.entityKnowledge.every((k) => k.subject_entity_id === 100));

  assert.throws(() => politics.enactLaw(w, { category: 'nonsense' }), /category must be one of/);
  assert.throws(() => politics.enactLaw(w, {
    category: 'criminal', governmentOrganizationId: 300,
  }), /is not a government/);
});

test('a law can be enacted with no government, and then tells nobody', () => {
  // §63's first stage is informal rules, which predate any government.
  // A law with no government attached is that case, and it must not
  // invent a broadcast from an institution that does not exist.
  const w = world();
  politics.enactLaw(w, { category: 'criminal', description: 'no raiding the mill' });
  assert.equal(w.laws.length, 1);
  assert.equal(w.entityKnowledge.length, 0);
});

test('a law is repealed, not deleted, and only once', () => {
  const w = world();
  const law = politics.enactLaw(w, { category: 'trade' });
  politics.repealLaw(w, { lawId: law.id });
  assert.equal(law.status, 'repealed');
  assert.equal(w.laws.length, 1, 'a repealed law is history, not a deletion');
  assert.equal(politics.listLaws(w).length, 0, 'listLaws defaults to active');
  assert.equal(politics.listLaws(w, { status: 'repealed' }).length, 1);
  assert.throws(() => politics.repealLaw(w, { lawId: law.id }), /is repealed/);
});

// -- opinion is a rollup, and unknown is not zero -----------------------

test('nobody informed means approval is unknown, not zero', () => {
  // **Zero would mean total disapproval and would trigger a revolution
  // against a government nobody has heard of.** Same distinction
  // `moodFor()` got wrong when `Number(null)` made an unobserved value
  // read as a real zero, so a person nobody had observed read as
  // "content".
  const w = world();
  politics.foundGovernment(w, { organizationId: 100, systemType: 'council' });
  const opinion = politics.computeApproval(w, { topic: politics.topicForGovernment(100) });
  assert.equal(opinion.approval, null);
  assert.equal(opinion.informed, 0);
  assert.equal(opinion.spread, 0);
});

test('approval reads live trait rows, not the denormalised sheet', () => {
  // Standing rule 9: `npc.traits` is built once at generation and
  // never refreshed, so a signal reading it returns the birth value
  // forever — a plausible frozen number, which is far harder to spot
  // than a null. This fixture writes only `entity_traits`, so a
  // stance that came from `npc.traits` would be the 50 fallback and
  // both cases below would read 50.
  const loyal = world({ loyalty: 90, paranoia: 10, threshold: 20 });
  politics.foundGovernment(loyal, { organizationId: 100, systemType: 'council' });
  politics.enactLaw(loyal, { category: 'property', governmentOrganizationId: 100 });
  const high = politics.computeApproval(loyal, { topic: politics.topicForGovernment(100) });

  const hostile = world({ loyalty: 10, paranoia: 90, threshold: 80 });
  politics.foundGovernment(hostile, { organizationId: 100, systemType: 'council' });
  politics.enactLaw(hostile, { category: 'property', governmentOrganizationId: 100 });
  const low = politics.computeApproval(hostile, { topic: politics.topicForGovernment(100) });

  assert.ok(high.approval > 60, `a loyal, trusting population approved only ${high.approval}`);
  assert.ok(low.approval < 40, `a paranoid, disloyal population approved ${low.approval}`);
  assert.notEqual(high.approval, low.approval);
  assert.equal(high.informed, 4);
  assert.equal(high.spread, 1);
});

test('a low-confidence rumour produces a weaker opinion than verified knowledge', () => {
  const hostile = () => {
    const w = world({ loyalty: 10, paranoia: 90, threshold: 80 });
    politics.foundGovernment(w, { organizationId: 100, systemType: 'council' });
    return w;
  };
  const sure = hostile();
  politics.enactLaw(sure, {
    category: 'property', governmentOrganizationId: 100, confidence: 1,
  });
  const vague = hostile();
  politics.enactLaw(vague, {
    category: 'property', governmentOrganizationId: 100, confidence: 0.1,
  });

  const sureApproval = politics.computeApproval(sure, { topic: 'government:100' }).approval;
  const vagueApproval = politics.computeApproval(vague, { topic: 'government:100' }).approval;
  // Damped toward neutral, so a barely-believed rumour moves opinion
  // less than a confirmed fact rather than the same amount.
  assert.ok(vagueApproval > sureApproval, `${vagueApproval} should sit closer to 50 than ${sureApproval}`);
  assert.ok(Math.abs(vagueApproval - 50) < Math.abs(sureApproval - 50));
});

test('two tellings of the same subject are one person\'s opinion, not two', () => {
  const w = world({ npcs: 2, loyalty: 10, paranoia: 90 });
  politics.foundGovernment(w, { organizationId: 100, systemType: 'council' });
  politics.enactLaw(w, { category: 'property', governmentOrganizationId: 100, confidence: 0.2 });
  politics.enactLaw(w, { category: 'trade', governmentOrganizationId: 100, confidence: 0.9 });

  const opinion = politics.computeApproval(w, { topic: 'government:100' });
  assert.equal(opinion.informed, 2, 'four knowledge rows across two people counted as four');
  assert.equal(opinion.spread, 1);
});

test('a snapshot is history; the live value stays computed', () => {
  // Standing rule 3 forbids STORING a rollup as a second source of
  // truth — Reemergence, Property Value, Community Health and Family
  // Wealth have no tables for that reason. `public_opinion` has one,
  // keyed (city_id, topic, tick), which makes it a time series like
  // `individual_finances`: the current answer is always
  // `computeApproval`, and these rows are what it was.
  const w = world({ loyalty: 90, paranoia: 10 });
  politics.foundGovernment(w, { organizationId: 100, systemType: 'council' });
  politics.enactLaw(w, { category: 'property', governmentOrganizationId: 100 });

  politics.snapshotPublicOpinion(w, 11, { cityId: 7 });
  politics.snapshotPublicOpinion(w, 12, { cityId: 7 });
  assert.equal(w.publicOpinion.length, 2);
  assert.deepEqual(w.publicOpinion.map((r) => r.tick), [11, 12]);
  assert.equal(politics.latestOpinion(w, 'government:100').tick, 12);

  // A government nobody knows about writes no row at all, rather than
  // a row saying zero.
  politics.foundGovernment(w, { organizationId: 200, systemType: 'monarchy' });
  politics.snapshotPublicOpinion(w, 13);
  assert.equal(w.publicOpinion.filter((r) => r.topic === 'government:200').length, 0);
});

// -- elections ----------------------------------------------------------

test('an election runs scheduled, open, closed, and tallies its votes', () => {
  const w = world({ npcs: 4 });
  politics.foundGovernment(w, { organizationId: 100, systemType: 'democracy' });
  const election = politics.scheduleElection(w, { organizationId: 100, electionType: 'council' });
  assert.equal(election.status, 'scheduled');

  // A vote before the election opens is refused — otherwise ballots
  // arrive before the contest exists and the tally is whatever order
  // they landed in.
  assert.throws(() => politics.castVote(w, {
    electionId: election.id, voterEntityId: 1, candidateEntityId: 3,
  }), /is scheduled, not open/);

  politics.openElection(w, { electionId: election.id });
  politics.castVote(w, { electionId: election.id, voterEntityId: 1, candidateEntityId: 3 });
  politics.castVote(w, { electionId: election.id, voterEntityId: 2, candidateEntityId: 3 });
  politics.castVote(w, { electionId: election.id, voterEntityId: 4, candidateEntityId: 1 });

  const result = politics.closeElection(w, { electionId: election.id, tick: 12 });
  assert.equal(result.winnerId, 3);
  assert.equal(result.tied, false);
  assert.equal(result.turnout, 0.75, '3 of 4 NPCs voted');
  assert.deepEqual(result.tally, [{ candidateId: 3, votes: 2 }, { candidateId: 1, votes: 1 }]);
  assert.equal(election.status, 'closed');
  assert.equal(election.end_tick, 12);

  // The winner takes the organization's leadership — the point of
  // holding an election.
  assert.equal(w.organizations.find((o) => o.id === 100).leader_npc_id, 3);
});

test('one vote per voter per election, because that is the primary key', () => {
  // `votes` is keyed (election_id, voter_entity_id). A second vote is
  // not a second row, it is a constraint violation waiting for the
  // next migration — refused here where it can be explained.
  const w = world();
  politics.foundGovernment(w, { organizationId: 100, systemType: 'democracy' });
  const e = politics.scheduleElection(w, { organizationId: 100 });
  politics.openElection(w, { electionId: e.id });
  politics.castVote(w, { electionId: e.id, voterEntityId: 1, candidateEntityId: 2 });
  assert.throws(() => politics.castVote(w, {
    electionId: e.id, voterEntityId: 1, candidateEntityId: 3,
  }), /has already voted/);
  assert.equal(w.votes.length, 1);
});

test('a tied election elects nobody rather than the first candidate found', () => {
  // A leader installed by sort order is indistinguishable from one the
  // world chose, which is the kind of silent arbitrariness that reads
  // as a decision.
  const w = world();
  politics.foundGovernment(w, { organizationId: 100, systemType: 'democracy' });
  const e = politics.scheduleElection(w, { organizationId: 100 });
  politics.openElection(w, { electionId: e.id });
  politics.castVote(w, { electionId: e.id, voterEntityId: 1, candidateEntityId: 3 });
  politics.castVote(w, { electionId: e.id, voterEntityId: 2, candidateEntityId: 4 });

  const result = politics.closeElection(w, { electionId: e.id });
  assert.equal(result.tied, true);
  assert.equal(result.winnerId, null);
  assert.equal(w.organizations.find((o) => o.id === 100).leader_npc_id, null,
    'a tie installed a leader anyway');
});

test('an election with no votes closes cleanly and elects nobody', () => {
  const w = world();
  politics.foundGovernment(w, { organizationId: 100, systemType: 'democracy' });
  const e = politics.scheduleElection(w, { organizationId: 100 });
  politics.openElection(w, { electionId: e.id });
  const result = politics.closeElection(w, { electionId: e.id });
  assert.equal(result.winnerId, null);
  assert.equal(result.turnout, 0);
  assert.deepEqual(result.tally, []);
});

test('an election needs a government to belong to', () => {
  const w = world();
  assert.throws(() => politics.scheduleElection(w, { organizationId: 300 }), /is not a government/);
});

// -- revolutions: opinion AND spread ------------------------------------

test('a hated government faces revolution once enough people know of it', () => {
  const w = world({ npcs: 4, loyalty: 5, paranoia: 95, threshold: 90 });
  politics.foundGovernment(w, { organizationId: 100, systemType: 'monarchy' });
  politics.enactLaw(w, { category: 'criminal', governmentOrganizationId: 100, confidence: 1 });

  const { started, events } = politics.assessRevolutions(w, 11);
  assert.equal(started.length, 1);
  assert.equal(started[0].target_government_organization_id, 100);
  assert.equal(started[0].outcome, 'pending');
  assert.equal(events[0].type, 'revolution_triggered');
  assert.ok(events[0].approval < politics.REVOLUTION_APPROVAL_FLOOR);
  assert.equal(events[0].spread, 1);

  // One pending uprising per government. A second would be two
  // simultaneous revolutions against the same target.
  const again = politics.assessRevolutions(w, 12);
  assert.equal(again.started.length, 0);
  assert.equal(w.revolutions.length, 1);
});

test('a government almost nobody has heard of is not overthrown by four people', () => {
  // **The spread floor, and the artefact it exists to prevent.**
  // Without it, one informed and disapproving citizen out of a hundred
  // gives 0% approval among the informed, and the government falls on
  // a sample of one — unrest that is a measurement artefact rather
  // than unrest.
  const w = world({ npcs: 100, loyalty: 5, paranoia: 95, threshold: 90 });
  politics.foundGovernment(w, { organizationId: 100, systemType: 'monarchy' });
  // Tell four of the hundred, by hand rather than by broadcasting.
  for (const entityId of [1, 2, 3, 4]) {
    w.entityKnowledge.push({
      entity_id: entityId,
      subject_entity_id: 100,
      fact_type: 'known',
      fact_content: 'government:100 law 1 (criminal) enacted',
      confidence_level: 1,
      acquired_tick: 10,
    });
  }

  const opinion = politics.computeApproval(w, { topic: 'government:100' });
  assert.ok(opinion.approval < politics.REVOLUTION_APPROVAL_FLOOR,
    'the four who know should disapprove');
  assert.equal(opinion.spread, 0.04);

  const { started } = politics.assessRevolutions(w, 11);
  assert.equal(started.length, 0, '4 of 100 informed was enough to topple a government');

  // Tell everyone, and it goes.
  politics.broadcastGovernmentKnowledge(w, {
    governmentOrganizationId: 100, factContent: 'law 1 (criminal) enacted', confidence: 1,
  });
  assert.equal(politics.assessRevolutions(w, 12).started.length, 1);
});

test('a popular government is left alone however widely it is known', () => {
  const w = world({ npcs: 8, loyalty: 95, paranoia: 5, threshold: 10 });
  politics.foundGovernment(w, { organizationId: 100, systemType: 'council' });
  politics.enactLaw(w, { category: 'property', governmentOrganizationId: 100, confidence: 1 });
  assert.equal(politics.assessRevolutions(w, 11).started.length, 0);
  assert.equal(w.revolutions.length, 0);
});

test('a successful revolution needs a named successor', () => {
  const w = world({ loyalty: 5, paranoia: 95, threshold: 90 });
  politics.foundGovernment(w, { organizationId: 100, systemType: 'monarchy' });
  politics.enactLaw(w, { category: 'criminal', governmentOrganizationId: 100, confidence: 1 });
  const [revolution] = politics.assessRevolutions(w, 11).started;

  assert.throws(() => politics.resolveRevolution(w, {
    revolutionId: revolution.id, outcome: 'succeeded',
  }), /requires a newGovernmentOrganizationId/);
  assert.throws(() => politics.resolveRevolution(w, {
    revolutionId: revolution.id, outcome: 'succeeded', newGovernmentOrganizationId: 300,
  }), /is not a government/);
  assert.throws(() => politics.resolveRevolution(w, {
    revolutionId: revolution.id, outcome: 'pending',
  }), /must be "succeeded" or "failed"/);

  politics.foundGovernment(w, { organizationId: 200, systemType: 'council' });
  politics.resolveRevolution(w, {
    revolutionId: revolution.id, outcome: 'succeeded', newGovernmentOrganizationId: 200,
  });

  assert.equal(revolution.outcome, 'succeeded');
  assert.equal(revolution.new_government_organization_id, 200);
  // The deposed government stops governing; its organization survives.
  assert.equal(politics.getGovernment(w, 100), null);
  assert.ok(w.organizations.some((o) => o.id === 100),
    'the deposed organization was deleted, taking its employment records and history with it');
  assert.throws(() => politics.resolveRevolution(w, {
    revolutionId: revolution.id, outcome: 'failed',
  }), /already succeeded/);
});

test('a failed revolution leaves the government in place', () => {
  const w = world({ loyalty: 5, paranoia: 95, threshold: 90 });
  politics.foundGovernment(w, { organizationId: 100, systemType: 'monarchy' });
  politics.enactLaw(w, { category: 'criminal', governmentOrganizationId: 100, confidence: 1 });
  const [revolution] = politics.assessRevolutions(w, 11).started;
  politics.resolveRevolution(w, { revolutionId: revolution.id, outcome: 'failed' });
  assert.equal(revolution.outcome, 'failed');
  assert.ok(politics.getGovernment(w, 100), 'a failed revolution deposed the government anyway');

  // And the same conditions can trigger a fresh one, because the first
  // is no longer pending.
  assert.equal(politics.assessRevolutions(w, 12).started.length, 1);
});

// -- the phase hook and ids ---------------------------------------------

test('runPolitics snapshots before it assesses', () => {
  // Assessing first would test this tick's opinion against a record
  // that does not yet contain it, so the numbers in the event and the
  // numbers on disk would disagree by one tick.
  const w = world({ loyalty: 5, paranoia: 95, threshold: 90 });
  politics.foundGovernment(w, { organizationId: 100, systemType: 'monarchy' });
  politics.enactLaw(w, { category: 'criminal', governmentOrganizationId: 100, confidence: 1 });

  const result = politics.runPolitics(w, 11);
  assert.equal(result.opinions, 1);
  assert.equal(result.revolutions, 1);
  const snapshot = politics.latestOpinion(w, 'government:100');
  assert.equal(snapshot.tick, 11);
  assert.equal(snapshot.approval_score, result.events[0].approval,
    'the snapshot and the event disagree about the same tick');
});

test('id counters survive a reseed, which is what a restore calls', () => {
  const w = world();
  politics.foundGovernment(w, { organizationId: 100, systemType: 'democracy' });
  const law = politics.enactLaw(w, { category: 'trade' });
  const election = politics.scheduleElection(w, { organizationId: 100 });

  const seeded = politics.reseedIds(w);
  assert.equal(seeded.nextLawId, law.id + 1);
  assert.equal(seeded.nextElectionId, election.id + 1);
  assert.equal(seeded.nextRevolutionId, 1, 'no revolutions yet, so the counter starts at 1');

  // A counter that does not survive hands out a duplicate primary key
  // on the next write.
  assert.notEqual(politics.enactLaw(w, { category: 'family' }).id, law.id);
  assert.notEqual(politics.scheduleElection(w, { organizationId: 100 }).id, election.id);
});
