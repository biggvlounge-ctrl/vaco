// VACON -- regression tests for MIA's routing.
//
// Why this file exists, specifically. Routing bugs here do not throw
// and do not log. A misroute returns a confident, well-formed answer
// from the wrong executive, which is exactly the failure mode nobody
// notices in manual testing. Every case below is a real misroute that
// was live in this repo, not an invented scenario.

const test = require('node:test');
const assert = require('node:assert');

const { routeQuery, matchesFor, DOMAIN_KEYWORDS } = require('../lib/orchestrator');
const { ALL_AGENTS, getAgent } = require('../lib/agents');

// -- The substring bug ------------------------------------------------
//
// `queryLower.includes('ip')` matched Deskins' intellectual-property
// keyword inside trip / tip / ship / recipe / equipment. The Chief
// Legal Officer was intercepting travel and delivery queries.

test('a word merely containing "ip" does not route to Deskins', () => {
  for (const query of [
    'plan me a trip to Miami',
    'where do I ship this package',
    'give me a recipe',
    'what equipment do I need',
  ]) {
    const { routedTo } = routeQuery(query);
    assert.notStrictEqual(routedTo, 'deskins', `"${query}" wrongly routed to Deskins`);
  }
});

test('"ip" as an actual word still routes to Deskins', () => {
  assert.strictEqual(routeQuery('who owns the IP on this').routedTo, 'deskins');
  assert.strictEqual(routeQuery('review this intellectual property clause').routedTo, 'deskins');
});

test('a travel query reaches Kay, and a driver query reaches Gibson', () => {
  assert.strictEqual(routeQuery('plan me a trip to Miami').routedTo, 'kay');
  assert.strictEqual(routeQuery('leave a tip for the driver').routedTo, 'gibson');
});

// -- Specificity weighting --------------------------------------------

test('a two-word keyword outranks a one-word keyword on the same query', () => {
  // "video script" (Jake) vs "ad" (DREA). Under flat counting this tied
  // and broke on roster order, handing scriptwriting to ad inventory.
  const result = routeQuery('write me a video script for a coffee shop ad');
  assert.strictEqual(result.routedTo, 'jake');
  const drea = result.matches.find((m) => m.agentId === 'drea');
  assert.ok(drea, 'DREA should still appear as a weaker match, not vanish');
  assert.ok(result.matches[0].score > drea.score);
});

test('a query that is genuinely only about ads still reaches DREA', () => {
  assert.strictEqual(routeQuery('run an ad campaign on your screens').routedTo, 'drea');
});

test('matches carry the keywords that fired, so a misroute is diagnosable', () => {
  const { matches } = routeQuery('check for a security breach');
  assert.strictEqual(matches[0].agentId, 'qvan');
  assert.deepStrictEqual(matches[0].keywords.sort(), ['breach', 'security']);
});

// -- Jake's registration ----------------------------------------------

test('Jake is on the roster and represents VENVM', () => {
  const jake = getAgent('jake');
  assert.ok(jake, 'jake should be registered in VACON');
  assert.strictEqual(jake.app, 'VENVM');
  assert.ok(jake.systemPrompt.length > 0);
});

test('production queries reach Jake', () => {
  assert.strictEqual(routeQuery('what stage is my production pipeline job at').routedTo, 'jake');
  assert.strictEqual(routeQuery('how do I reformat for aspect ratio').routedTo, 'jake');
});

// -- Structural invariants --------------------------------------------

test('every agent with keywords is a real agent on the roster', () => {
  const ids = new Set(ALL_AGENTS.map((a) => a.id));
  for (const agentId of Object.keys(DOMAIN_KEYWORDS)) {
    assert.ok(ids.has(agentId), `${agentId} has keywords but is not on the roster`);
  }
});

test('MIA has no keywords of her own -- she is the fallback, not a competitor', () => {
  assert.ok(!DOMAIN_KEYWORDS.mia, 'MIA should not compete for routing');
  const { routedTo, fallback } = routeQuery('what is the weather like today');
  assert.strictEqual(routedTo, 'mia');
  assert.strictEqual(fallback, true);
});

test('an empty or non-string query throws rather than silently routing', () => {
  assert.throws(() => routeQuery(''), /non-empty/);
  assert.throws(() => routeQuery('   '), /non-empty/);
  assert.throws(() => routeQuery(null), /non-empty/);
});

test('scoring is case-insensitive', () => {
  assert.strictEqual(routeQuery('BUDGET FORECAST').routedTo, 'leslie');
  assert.strictEqual(matchesFor('leslie', 'budget forecast').score, 2);
});
