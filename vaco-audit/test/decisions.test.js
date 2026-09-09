// VACO AUDIT — the decision log.
//
// **What these tests are protecting.** An audit log has one job and
// fails at it in ways that leave a healthy-looking system behind:
//
//   - a record that cannot name a decider (the whole point, absent)
//   - a record that quietly captured a credential and can never
//     un-capture it, because the store is append-only
//   - a record silently truncated, so it reads as complete
//   - a decider field that defaults to something plausible instead of
//     refusing, which manufactures false comfort
//
// None of those throw. All of them are only visible if something
// asserts on them, which is what this file is for.

const test = require('node:test');
const assert = require('node:assert');

const { createAuditStore } = require('../lib/store');
const {
  OUTCOME_KINDS, MAX_INPUT_BYTES, recordDecision, getDecision,
  queryDecisions, historyFor, describeCoverage,
} = require('../lib/decisions');

const NOW = Date.UTC(2026, 7, 27);
const HOUR = 3600000;

function settlement(overrides = {}) {
  return {
    app: 'vago',
    route: 'POST /api/sports/events/:eventId/settle',
    outcomeKind: 'settlement',
    subjectType: 'sportsEvent',
    subjectId: 'E1',
    decidedBy: 'vago-ops',
    inputs: { winningOutcomeId: 'home' },
    now: NOW,
    ...overrides,
  };
}

// -- The point of the whole module ---------------------------------------

test('a decision that cannot name a decider is refused, not defaulted', () => {
  const store = createAuditStore();

  // The tempting implementation defaults `decidedBy` to the calling
  // service, or to 'system'. Both produce a log that looks complete and
  // answers nothing — which is worse than no log, because someone will
  // trust it.
  assert.throws(
    () => recordDecision(store, { ...settlement(), decidedBy: undefined }),
    /requires a non-empty decidedBy/,
  );
  assert.throws(
    () => recordDecision(store, { ...settlement(), decidedBy: '   ' }),
    /requires a non-empty decidedBy/,
  );
  assert.strictEqual(store.decisions.length, 0, 'nothing may be recorded without a decider');
});

test('every identifying field is required — a record with holes is not evidence', () => {
  const store = createAuditStore();
  for (const field of ['app', 'route', 'subjectType']) {
    assert.throws(
      () => recordDecision(store, { ...settlement(), [field]: undefined }),
      new RegExp(`requires a non-empty ${field}`),
      `${field} must be required`,
    );
  }
  assert.strictEqual(store.decisions.length, 0);
});

test('the outcome vocabulary is closed — free text would make the log unqueryable', () => {
  const store = createAuditStore();
  assert.throws(
    () => recordDecision(store, settlement({ outcomeKind: 'settled-it' })),
    /outcomeKind must be one of/,
  );
  for (const kind of OUTCOME_KINDS) {
    assert.ok(recordDecision(store, settlement({ outcomeKind: kind })).id);
  }
});

// -- Redaction: irreversible, so it happens on the way IN ------------------

test('a credential in the inputs is redacted before it is stored', () => {
  const store = createAuditStore();
  const record = recordDecision(store, settlement({
    inputs: {
      winningOutcomeId: 'home',
      'X-Service-Token': 'dev-abc123',
      serviceToken: 'dev-abc123',
      password: 'hunter2',
      apiKey: 'k-1',
      nested: { authorization: 'Bearer xyz', keep: 'this' },
    },
  }));

  // Redacting on read would be too late: the store is append-only, so a
  // captured secret can never be taken back out.
  const raw = JSON.stringify(store.decisions[0]);
  assert.ok(!raw.includes('dev-abc123'), 'a service token reached the store');
  assert.ok(!raw.includes('hunter2'), 'a password reached the store');
  assert.ok(!raw.includes('Bearer xyz'), 'an auth header reached the store nested');
  assert.strictEqual(record.inputs.nested.keep, 'this', 'non-secret fields must survive');
  assert.strictEqual(record.inputs.winningOutcomeId, 'home');
});

test('oversized inputs are refused, not truncated', () => {
  const store = createAuditStore();
  // A truncated record reads as complete. Refusing is the honest
  // failure: the caller should record identifiers, not payloads.
  assert.throws(
    () => recordDecision(store, settlement({ inputs: { blob: 'x'.repeat(MAX_INPUT_BYTES + 1) } })),
    /exceed \d+ bytes/,
  );
  assert.strictEqual(store.decisions.length, 0);
});

test('a circular input is refused rather than throwing somewhere unhelpful', () => {
  const store = createAuditStore();
  const circular = { a: 1 };
  circular.self = circular;
  assert.throws(() => recordDecision(store, settlement({ inputs: circular })), Error);
});

// -- Append-only ----------------------------------------------------------

test('the store only grows — ids are never reused', () => {
  const store = createAuditStore();
  const first = recordDecision(store, settlement());
  const second = recordDecision(store, settlement({ subjectId: 'E2' }));

  assert.strictEqual(first.id, 1);
  assert.strictEqual(second.id, 2);
  assert.strictEqual(store.decisions.length, 2);

  // There is deliberately no update and no delete in the module's
  // surface. If one is ever added, this is the test that should have
  // stopped it.
  const surface = Object.keys(require('../lib/decisions'));
  for (const forbidden of ['updateDecision', 'deleteDecision', 'amendDecision', 'purge']) {
    assert.ok(!surface.includes(forbidden), `${forbidden} must not exist on an audit log`);
  }
});

// -- The claim vs the fact ------------------------------------------------

test('decidedBy is a claim, recordedByService is a fact, and both are kept', () => {
  const store = createAuditStore();
  const record = recordDecision(store, settlement({
    decidedBy: 'someone-else',
    recordedByService: 'vago',
  }));

  // The body can say anything about who decided. The credential that
  // carried the record cannot be forged the same way, so keeping both
  // means a mismatch is findable later even though only one is trusted
  // today.
  assert.strictEqual(record.decidedBy, 'someone-else');
  assert.strictEqual(record.recordedByService, 'vago');
});

// -- Querying, in the shapes a dispute actually arrives in ----------------

test('history for a subject reads oldest-first, as a timeline', () => {
  const store = createAuditStore();
  recordDecision(store, settlement({ outcomeKind: 'state-change', now: NOW + 2 * HOUR }));
  recordDecision(store, settlement({ now: NOW }));
  recordDecision(store, settlement({ outcomeKind: 'reversal', now: NOW + 4 * HOUR }));
  recordDecision(store, settlement({ subjectId: 'OTHER', now: NOW + HOUR }));

  const history = historyFor(store, 'sportsEvent', 'E1');
  assert.deepStrictEqual(history.map((d) => d.outcomeKind),
    ['settlement', 'state-change', 'reversal'],
    'a dispute is read forwards, and must not include another subject');
});

test('a numeric subjectId and its string form are the same subject', () => {
  const store = createAuditStore();
  recordDecision(store, settlement({ subjectType: 'raffle', subjectId: 7 }));

  // Route params arrive as strings and lib functions hand back numbers.
  // A log that files those separately silently splits one thing's
  // history in two.
  assert.strictEqual(historyFor(store, 'raffle', 7).length, 1);
  assert.strictEqual(historyFor(store, 'raffle', '7').length, 1);
  assert.strictEqual(queryDecisions(store, { subjectType: 'raffle', subjectId: 7 }).length, 1);
});

test('queries filter on every recorded dimension', () => {
  const store = createAuditStore();
  recordDecision(store, settlement({ now: NOW }));
  recordDecision(store, settlement({ app: 'void', route: 'POST /api/provider/:id/vetting', outcomeKind: 'credential', subjectType: 'provider', subjectId: 'p1', decidedBy: 'void-ops', now: NOW + HOUR }));

  assert.strictEqual(queryDecisions(store, { app: 'void' }).length, 1);
  assert.strictEqual(queryDecisions(store, { outcomeKind: 'credential' }).length, 1);
  assert.strictEqual(queryDecisions(store, { decidedBy: 'vago-ops' }).length, 1);
  assert.strictEqual(queryDecisions(store, { since: NOW + HOUR }).length, 1);
  assert.strictEqual(queryDecisions(store, { until: NOW }).length, 1);
  assert.strictEqual(queryDecisions(store, {}).length, 2);
  assert.strictEqual(queryDecisions(store, {})[0].app, 'void', 'newest first');
});

test('an absurd limit is refused rather than returning the whole store', () => {
  const store = createAuditStore();
  assert.throws(() => queryDecisions(store, { limit: 0 }), /between 1 and 1000/);
  assert.throws(() => queryDecisions(store, { limit: 100000 }), /between 1 and 1000/);
});

// -- The migration metric -------------------------------------------------

test('coverage reports how much is still attributed to a service, not a person', () => {
  const store = createAuditStore();
  recordDecision(store, settlement());
  recordDecision(store, settlement({ app: 'void', decidedBy: 'ada', decidedByKind: 'operator' }));

  const coverage = describeCoverage(store);
  assert.strictEqual(coverage.totalDecisions, 2);
  assert.strictEqual(coverage.attributedToOperator, 1);
  assert.strictEqual(coverage.attributedToService, 1);
  assert.strictEqual(coverage.operatorCoveragePercent, 50);
  assert.deepStrictEqual(coverage.reportingApps, ['vago', 'void']);
});

test('coverage on an empty log is 0%, not NaN', () => {
  // A NaN here would render as "NaN%" on the health endpoint and be
  // read as a broken service rather than an empty one.
  const coverage = describeCoverage(createAuditStore());
  assert.strictEqual(coverage.operatorCoveragePercent, 0);
  assert.strictEqual(coverage.totalDecisions, 0);
});

test('decidedByKind is closed to operator and service', () => {
  const store = createAuditStore();
  assert.throws(
    () => recordDecision(store, settlement({ decidedByKind: 'admin' })),
    /must be 'operator' or 'service'/,
  );
});

test('a recorded decision is retrievable by id', () => {
  const store = createAuditStore();
  const record = recordDecision(store, settlement());
  assert.deepStrictEqual(getDecision(store, record.id), record);
  assert.strictEqual(getDecision(store, 999), null);
});
