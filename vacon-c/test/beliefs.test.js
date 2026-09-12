// Beliefs — and the loop they close in public opinion.
//
// **Why this is a politics test as much as a beliefs one.** Building
// politics left one gap on purpose: `public_opinion`'s schema comment
// asks for a rollup from "beliefs/entity_knowledge", `beliefs` was a
// dead table, so approval was derived from live traits and the module
// recorded the cost — **approval did not depend on what a law said.**
//
// That note also guessed at the fix: a `valence` column on
// `entity_knowledge`. It was wrong, and the way it was wrong is worth
// a test. `beliefs.strength` is already a valenced position on a named
// subject; the field existed and the table was simply unbuilt.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const beliefs = require('../server/beliefs.js');
const politics = require('../server/politics.js');
const { getTraitId } = require('../server/traitDefinitions.js');

// Same fixture shape as politics.test.js, with real trait ids — a
// hand-made `entity_traits` row with an invented `trait_id` resolves
// to no definition and every stance silently becomes the 50 fallback.
function world({ npcs = 4, loyalty = 50, paranoia = 50, threshold = 50 } = {}) {
  const worldState = {
    tick: 10,
    npcs: Array.from({ length: npcs }, (_, i) => ({ id: i + 1 })),
    organizations: [
      { id: 100, type: 'government', leader_npc_id: null },
      { id: 300, type: 'business', leader_npc_id: null },
    ],
    families: [],
    entityTraits: [],
    entityKnowledge: [],
    beliefs: [],
    governments: [],
    elections: [],
    votes: [],
    laws: [],
    publicOpinion: [],
    revolutions: [],
  };
  for (const npc of worldState.npcs) {
    for (const [family, name, value] of [
      ['social', 'Group Loyalty', loyalty],
      ['psychological', 'Paranoia', paranoia],
      ['psychological', 'Trust Threshold', threshold],
    ]) {
      worldState.entityTraits.push({
        entity_id: npc.id,
        trait_id: getTraitId(family, name),
        base_value: value,
        current_value: value,
        key_modifier: 0,
      });
    }
  }
  beliefs.reseedIds(worldState);
  politics.reseedIds(worldState);
  return worldState;
}

// -- the table's own vocabulary ----------------------------------------

test('the six belief types are the schema\'s own list', () => {
  assert.deepEqual(beliefs.BELIEF_TYPES, [
    'religious', 'philosophical', 'political', 'scientific', 'cultural', 'personal',
  ]);
  const w = world();
  assert.throws(() => beliefs.adoptBelief(w, {
    entityId: 1, beliefType: 'economic', beliefName: 'markets clear',
  }), /beliefType must be one of/);
});

test('a belief is adopted once and changed by shifting, not re-adopting', () => {
  // A second row for the same named belief is two simultaneous
  // positions on one question, and a rollup averaging them reports a
  // person as ambivalent when they are not.
  const w = world();
  const held = beliefs.adoptBelief(w, {
    entityId: 1, beliefType: 'religious', beliefName: 'the river provides', strength: 70,
  });
  assert.equal(held.strength, 70);
  assert.throws(() => beliefs.adoptBelief(w, {
    entityId: 1, beliefType: 'religious', beliefName: 'the river provides', strength: 20,
  }), /already holds/);
  assert.equal(w.beliefs.length, 1);
});

test('strength is clamped, and a non-finite strength is refused', () => {
  const w = world();
  assert.equal(beliefs.adoptBelief(w, {
    entityId: 1, beliefType: 'personal', beliefName: 'a', strength: 500,
  }).strength, 100);
  assert.equal(beliefs.adoptBelief(w, {
    entityId: 2, beliefType: 'personal', beliefName: 'b', strength: -80,
  }).strength, 0);
  for (const strength of [Number.NaN, Number.POSITIVE_INFINITY, '70']) {
    assert.throws(() => beliefs.adoptBelief(w, {
      entityId: 3, beliefType: 'personal', beliefName: 'c', strength,
    }), /finite strength/, `strength ${String(strength)} was accepted`);
  }
});

test('a belief moves from where it was, so conviction is not flipped by one event', () => {
  const w = world();
  beliefs.adoptBelief(w, {
    entityId: 1, beliefType: 'political', beliefName: 'government:100', strength: 90,
  });
  beliefs.shiftBelief(w, {
    entityId: 1, beliefType: 'political', beliefName: 'government:100', delta: -25, tick: 11,
  });
  assert.equal(beliefs.beliefStrength(w, 1, 'government:100'), 65);

  // Clamped at the ends rather than wrapping or going negative.
  beliefs.shiftBelief(w, {
    entityId: 1, beliefType: 'political', beliefName: 'government:100', delta: -200,
  });
  assert.equal(beliefs.beliefStrength(w, 1, 'government:100'), 0);
  assert.throws(() => beliefs.shiftBelief(w, {
    entityId: 1, beliefType: 'political', beliefName: 'government:100', delta: Number.NaN,
  }), /finite delta/);
});

test('shifting a belief nobody holds adopts it at neutral first', () => {
  // Starting from 50 rather than from the delta is what makes "no
  // view" and "no strong view" behave the same, instead of one event
  // installing an absolute position.
  const w = world();
  const shifted = beliefs.shiftBelief(w, {
    entityId: 1, beliefType: 'political', beliefName: 'government:100', delta: 10,
  });
  assert.equal(shifted.strength, beliefs.NEUTRAL_STRENGTH + 10);
  assert.equal(shifted.strength, 60);
});

test('having no view reads as null, not as zero', () => {
  // Zero means total opposition. Collapsing the two here would take
  // the distinction away from every caller at once — and the spread
  // floor in politics.js is built on exactly that difference.
  const w = world();
  assert.equal(beliefs.beliefStrength(w, 1, 'government:100'), null);
  const summary = beliefs.summariseBelief(w, 'government:100');
  assert.equal(summary.mean, null);
  assert.equal(summary.holders, 0);
  assert.equal(summary.share, 0);
});

test('a rollup reports the mean and the share who hold it', () => {
  const w = world({ npcs: 4 });
  beliefs.adoptBelief(w, {
    entityId: 1, beliefType: 'religious', beliefName: 'the river provides', strength: 80,
  });
  beliefs.adoptBelief(w, {
    entityId: 2, beliefType: 'religious', beliefName: 'the river provides', strength: 40,
  });
  const summary = beliefs.summariseBelief(w, 'the river provides');
  assert.equal(summary.mean, 60);
  assert.equal(summary.holders, 2);
  assert.equal(summary.share, 0.5);
});

test('beliefs are filterable by type, which is what makes religion a system', () => {
  const w = world();
  beliefs.adoptBelief(w, { entityId: 1, beliefType: 'religious', beliefName: 'r', strength: 70 });
  beliefs.adoptBelief(w, { entityId: 1, beliefType: 'political', beliefName: 'p', strength: 30 });
  assert.equal(beliefs.getBeliefs(w, 1).length, 2);
  assert.equal(beliefs.getBeliefs(w, 1, { beliefType: 'religious' }).length, 1);
  assert.equal(beliefs.getBeliefs(w, 1, { beliefType: 'religious' })[0].belief_name, 'r');
  assert.equal(beliefs.getBeliefs(w, 2).length, 0);
});

// -- the loop this closes ----------------------------------------------

test('a law with a declared favourability moves what the population believes', () => {
  // **The gap politics.js left open.** Without a favourability, a law
  // is news and nothing more — the original behaviour, kept. With one,
  // the population's view of the government moves, and how far is the
  // caller's number rather than this engine's judgement of the law.
  const w = world({ npcs: 4 });
  politics.foundGovernment(w, { organizationId: 100, systemType: 'council' });

  politics.enactLaw(w, { category: 'property', governmentOrganizationId: 100 });
  assert.equal(w.beliefs.length, 0, 'a law with no declared favourability shifted a belief');

  politics.enactLaw(w, {
    category: 'criminal', governmentOrganizationId: 100, favourability: -30, tick: 11,
  });
  assert.equal(w.beliefs.length, 4, 'every NPC should have moved');
  assert.equal(beliefs.beliefStrength(w, 1, 'government:100'), 20);
  assert.ok(w.beliefs.every((b) => b.belief_type === 'political'));

  assert.throws(() => politics.enactLaw(w, {
    category: 'trade', governmentOrganizationId: 100, favourability: 'a lot',
  }), /favourability must be a finite number/);
});

test('approval follows the belief, so it now depends on what a law was', () => {
  // The whole point. Two identical populations — same traits, same
  // knowledge — diverge because one government passed something the
  // caller declared popular and the other did not.
  const build = (favourability) => {
    const w = world({ npcs: 4, loyalty: 50, paranoia: 50, threshold: 50 });
    politics.foundGovernment(w, { organizationId: 100, systemType: 'council' });
    politics.enactLaw(w, {
      category: 'criminal', governmentOrganizationId: 100, favourability, confidence: 1,
    });
    return politics.computeApproval(w, { topic: 'government:100' }).approval;
  };

  const resented = build(-40);
  const welcomed = build(40);
  assert.equal(resented, 10);
  assert.equal(welcomed, 90);
  assert.ok(welcomed > resented,
    'approval is identical either way — the belief path is not being read');
});

test('a belief outranks the trait-derived stance for the people who hold one', () => {
  // Precedence, and it has to be this way round: a belief is a view
  // somebody actually formed, a trait stance is an inference about
  // somebody who has not. A hostile population that came to trust its
  // government must read as trusting.
  const w = world({ npcs: 4, loyalty: 5, paranoia: 95, threshold: 90 });
  politics.foundGovernment(w, { organizationId: 100, systemType: 'council' });
  politics.enactLaw(w, {
    category: 'property', governmentOrganizationId: 100, confidence: 1,
  });

  const byTraits = politics.computeApproval(w, { topic: 'government:100' }).approval;
  assert.ok(byTraits < 20, `a hostile population approved ${byTraits} on traits alone`);

  beliefs.shiftPopulationBelief(w, {
    beliefType: 'political', beliefName: 'government:100', delta: 35,
  });
  const byBelief = politics.computeApproval(w, { topic: 'government:100' }).approval;
  assert.equal(byBelief, 85, 'the trait stance is still winning over a held belief');
});

test('a belief is not damped by how confidently the news arrived', () => {
  // The trait path is damped by confidence, because an inference from
  // disposition should be weaker on hearsay. A belief is not: it IS
  // the view, and damping it would record somebody who firmly
  // distrusts a government on rumour as neutral.
  const w = world({ npcs: 2 });
  politics.foundGovernment(w, { organizationId: 100, systemType: 'council' });
  politics.enactLaw(w, {
    category: 'property', governmentOrganizationId: 100, confidence: 0.05, favourability: -45,
  });
  assert.equal(politics.computeApproval(w, { topic: 'government:100' }).approval, 5);
});

test('a belief with no matching knowledge row is not counted', () => {
  // Spread still gates participation: `computeApproval` walks
  // `entity_knowledge` first, so somebody who holds a view but has
  // heard nothing this world recorded does not vote in the rollup.
  // Otherwise the spread floor stops meaning anything.
  const w = world({ npcs: 4 });
  politics.foundGovernment(w, { organizationId: 100, systemType: 'council' });
  beliefs.adoptBelief(w, {
    entityId: 1, beliefType: 'political', beliefName: 'government:100', strength: 5,
  });
  const opinion = politics.computeApproval(w, { topic: 'government:100' });
  assert.equal(opinion.approval, null);
  assert.equal(opinion.informed, 0);
});

test('id counters survive a reseed', () => {
  const w = world();
  const held = beliefs.adoptBelief(w, {
    entityId: 1, beliefType: 'personal', beliefName: 'a', strength: 50,
  });
  assert.equal(beliefs.reseedIds(w).nextBeliefId, held.id + 1);
  assert.notEqual(beliefs.adoptBelief(w, {
    entityId: 2, beliefType: 'personal', beliefName: 'a', strength: 50,
  }).id, held.id);
});

test('values_db is deliberately untouched, and says so', () => {
  // The other half of this schema section. No column defaults, and no
  // source document gives value distributions, priorities or influence
  // weights — so a generator would be fifteen invented numbers per
  // person, and CRUD nothing calls would turn a visibly dead table
  // into one that looks alive and holds nothing.
  //
  // This asserts the restraint rather than the absence: if somebody
  // builds values, they should delete this test rather than discover
  // the claim in a comment that stopped being true.
  const source = require('node:fs').readFileSync(
    require.resolve('../server/beliefs.js'), 'utf8',
  );
  assert.match(source, /`values_db` is deliberately still untouched/);
  const code = source.replace(/^\s*\/\/.*$/gm, '').replace(/^\s*\/\/:.*$/gm, '');
  assert.equal(/valuesDb|values_db/.test(code), false,
    'beliefs.js touches values_db — the note in its header is no longer true');
});
