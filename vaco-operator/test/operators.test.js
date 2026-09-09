// VACO OPERATOR — operator authority.
//
// **What these tests are protecting.** An authorization system fails in
// ways that leave everything looking correct:
//
//   - a self-grant, so one compromised credential becomes all of them
//   - a scope check that passes because the scope was never checked
//   - a revocation that takes effect on the next restart instead of now
//   - a credential sitting in plaintext in a store.json that gets
//     backed up off-host
//   - a route asking for a scope that does not exist, denied forever
//     and silently
//
// None of these throw. Every one of them is a green suite.
//
// Per `dev-docs/STANDING_INSTRUCTION_TEST_VERIFICATION.md`, each
// assertion here was watched fail against the specific bug it names
// before being trusted.

const test = require('node:test');
const assert = require('node:assert');

const { createOperatorStore } = require('../lib/store');
const {
  SCOPES, BOOTSTRAP_SCOPE, createOperator, getOperator, disableOperator,
  grantScope, revokeScope, scopesFor, verify, bootstrap, describeCoverage,
} = require('../lib/operators');

const NOW = Date.UTC(2026, 7, 27);

// Two operators, so that granting is always possible without a
// self-grant — which is itself a statement about the design: a system
// with exactly one operator cannot legitimately grant anything.
function seeded() {
  const store = createOperatorStore();
  const root = bootstrap(store, 'vop_test_bootstrap', { now: NOW });
  const { operator: ada, credential: adaCredential } = createOperator(store, {
    name: 'ada', createdBy: String(root.id), now: NOW,
  });
  return { store, root, ada, adaCredential };
}

// -- The rule the whole module exists for --------------------------------

test('an operator may not grant themselves a scope', () => {
  const { store, ada } = seeded();

  // Without this refusal, one compromised credential escalates to every
  // scope in the ecosystem in a single request — and the audit log
  // faithfully records them doing it.
  assert.throws(
    () => grantScope(store, { operatorId: ada.id, scope: 'vago:settle', grantedBy: ada.id }),
    /may not grant themselves/,
  );
  assert.deepStrictEqual(scopesFor(store, ada.id), []);
});

test('a self-grant is refused even when the id arrives as a string', () => {
  const { store, ada } = seeded();

  // Route params are strings; lib calls pass numbers. A comparison that
  // missed because 3 !== '3' would defeat the rule above entirely while
  // the test above still passed.
  assert.throws(
    () => grantScope(store, { operatorId: ada.id, scope: 'vago:settle', grantedBy: String(ada.id) }),
    /may not grant themselves/,
  );
  assert.throws(
    () => grantScope(store, { operatorId: String(ada.id), scope: 'vago:settle', grantedBy: ada.id }),
    /no operator with id|may not grant themselves/,
  );
});

test('an operator may not disable themselves', () => {
  const { store, ada } = seeded();
  assert.throws(
    () => disableOperator(store, {
      operatorId: ada.id, actingOperatorId: ada.id, disabledBy: String(ada.id),
    }),
    /may not disable themselves/,
  );
});

// -- Scopes are enumerated, never free text ------------------------------

test('an unknown scope cannot be granted', () => {
  const { store, root, ada } = seeded();
  // `vago:setle` is the failure this prevents: a typo becomes a
  // permission nobody can ever hold, and the route it guards is denied
  // forever with no error anywhere. Same class as a guard that silently
  // matches nothing.
  assert.throws(
    () => grantScope(store, { operatorId: ada.id, scope: 'vago:setle', grantedBy: root.id }),
    /unknown scope/,
  );
});

test('there is no wildcard scope', () => {
  // A `*` would be the master key this design exists to avoid, and it
  // would arrive as a convenience for the bootstrap account.
  for (const forbidden of ['*', 'all', 'admin', 'operator:*']) {
    assert.ok(!SCOPES.includes(forbidden), `${forbidden} must not be a scope`);
  }
});

test('the bootstrap operator can grant and can do nothing else', () => {
  const store = createOperatorStore();
  const root = bootstrap(store, 'vop_test_bootstrap', { now: NOW });

  // A seed, not an admin. If this ever holds a second scope it becomes
  // the account everybody uses, and the scoping above is decorative.
  assert.deepStrictEqual(scopesFor(store, root.id), [BOOTSTRAP_SCOPE]);
  assert.strictEqual(verify(store, { credential: 'vop_test_bootstrap', scope: 'vago:settle' }).ok, false);
  assert.strictEqual(verify(store, { credential: 'vop_test_bootstrap', scope: BOOTSTRAP_SCOPE }).ok, true);
});

test('bootstrap is a no-op when unset, and never runs twice', () => {
  // An authority service that invents its own first authority is not
  // one, so no credential means no operators at all.
  const empty = createOperatorStore();
  assert.strictEqual(bootstrap(empty, ''), null);
  assert.strictEqual(empty.operators.length, 0);

  // And a restart must not mint a second root against a populated store.
  const { store } = seeded();
  const before = store.operators.length;
  assert.strictEqual(bootstrap(store, 'vop_a_different_one'), null);
  assert.strictEqual(store.operators.length, before);
});

// -- Verification --------------------------------------------------------

test('verify answers the exact question a guarded route asks', () => {
  const { store, root, ada, adaCredential } = seeded();
  grantScope(store, { operatorId: ada.id, scope: 'vago:settle', grantedBy: root.id });

  const ok = verify(store, { credential: adaCredential, scope: 'vago:settle' });
  assert.strictEqual(ok.ok, true);
  assert.strictEqual(ok.operatorName, 'ada');

  // Holding one scope says nothing about another. This is the assertion
  // that fails if scopes are ever collapsed into a boolean.
  assert.strictEqual(verify(store, { credential: adaCredential, scope: 'void:vetting' }).ok, false);
});

test('a wrong credential is refused without naming anyone', () => {
  const { store, root, ada, adaCredential } = seeded();
  grantScope(store, { operatorId: ada.id, scope: 'vago:settle', grantedBy: root.id });

  const bad = verify(store, { credential: 'vop_not_a_real_one', scope: 'vago:settle' });
  assert.strictEqual(bad.ok, false);
  // Confirming a name to someone guessing turns one unknown into two.
  assert.ok(!('operatorName' in bad), 'a bad credential must not confirm an operator name');
  assert.ok(!JSON.stringify(bad).includes('ada'));

  assert.strictEqual(verify(store, { scope: 'vago:settle' }).ok, false, 'no credential at all');
  assert.strictEqual(verify(store, { credential: '', scope: 'vago:settle' }).ok, false);
});

test('a route asking for a scope that does not exist fails closed AND says so', () => {
  const { store, adaCredential } = seeded();
  const result = verify(store, { credential: adaCredential, scope: 'vago:nonexistent' });

  // Failing closed is necessary but not sufficient: denied-and-silent
  // is indistinguishable from "correctly not permitted", and the route
  // stays broken forever. The flag is what makes it findable.
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.misconfigured, true,
    'a route guarding on a nonexistent scope is a bug in the route, not a denied request');
});

test('revocation takes effect immediately, not on restart', () => {
  const { store, root, ada, adaCredential } = seeded();
  grantScope(store, { operatorId: ada.id, scope: 'vago:settle', grantedBy: root.id });
  assert.strictEqual(verify(store, { credential: adaCredential, scope: 'vago:settle' }).ok, true);

  revokeScope(store, { operatorId: ada.id, scope: 'vago:settle', revokedBy: root.id });

  // If verify ever caches, or reads a scope list built at startup, this
  // is the test that catches it.
  assert.strictEqual(verify(store, { credential: adaCredential, scope: 'vago:settle' }).ok, false,
    'a revoked scope must stop working on the very next request');
});

test('disabling an operator revokes everything at once', () => {
  const { store, root, ada, adaCredential } = seeded();
  grantScope(store, { operatorId: ada.id, scope: 'vago:settle', grantedBy: root.id });
  grantScope(store, { operatorId: ada.id, scope: 'vago:grade', grantedBy: root.id });

  disableOperator(store, { operatorId: ada.id, actingOperatorId: root.id, disabledBy: String(root.id) });

  // The whole-person switch, for a leaked credential. Scope-by-scope
  // revocation is too slow when what leaked is the credential itself.
  for (const scope of ['vago:settle', 'vago:grade']) {
    assert.strictEqual(verify(store, { credential: adaCredential, scope }).ok, false, scope);
  }
  assert.throws(
    () => grantScope(store, { operatorId: ada.id, scope: 'void:vetting', grantedBy: root.id }),
    /is disabled/,
  );
});

// -- The record ----------------------------------------------------------

test('a revoked grant is marked, not deleted', () => {
  const { store, root, ada } = seeded();
  grantScope(store, { operatorId: ada.id, scope: 'vago:settle', grantedBy: root.id });
  revokeScope(store, { operatorId: ada.id, scope: 'vago:settle', revokedBy: root.id, now: NOW + 1 });

  // "Who could settle events last March" is exactly the question an
  // audit has to answer, and a deleted row answers it wrongly and
  // confidently.
  const adaGrants = store.grants.filter((g) => g.operatorId === ada.id);
  assert.strictEqual(adaGrants.length, 1, 'revoking must not remove the row');
  const [grant] = adaGrants;
  assert.strictEqual(grant.revokedAt, NOW + 1);
  assert.strictEqual(grant.revokedBy, String(root.id));
  assert.strictEqual(grant.grantedBy, String(root.id), 'provenance survives revocation');
});

test('every grant records who granted it', () => {
  const { store, root, ada } = seeded();
  const grant = grantScope(store, { operatorId: ada.id, scope: 'vago:settle', grantedBy: root.id });
  assert.strictEqual(grant.grantedBy, String(root.id));

  assert.throws(
    () => grantScope(store, { operatorId: ada.id, scope: 'vago:grade' }),
    /requires a non-empty grantedBy/,
    'an unattributable grant is the failure this whole service exists to end',
  );
});

test('granting the same scope twice does not create a second grant', () => {
  const { store, root, ada } = seeded();
  const first = grantScope(store, { operatorId: ada.id, scope: 'vago:settle', grantedBy: root.id });
  const second = grantScope(store, { operatorId: ada.id, scope: 'vago:settle', grantedBy: root.id });
  assert.strictEqual(first.id, second.id);
  assert.strictEqual(store.grants.filter((g) => g.scope === 'vago:settle').length, 1);
});

// -- The credential itself -----------------------------------------------

test('a credential is never stored in the clear', () => {
  const { store, adaCredential } = seeded();

  // This store is written to data/store.json and copied off-host by
  // backup-stores.mjs. A plaintext operator credential in a backup is
  // the same class of problem as a token in the audit log.
  const raw = JSON.stringify(store);
  assert.ok(!raw.includes(adaCredential), 'the operator credential reached the store in plaintext');
  assert.ok(!raw.includes('vop_test_bootstrap'), 'the bootstrap credential reached the store');
  assert.ok(store.operators[1].credentialDigest.length === 64);
});

test('a credential is issued, not chosen, and returned exactly once', () => {
  const store = createOperatorStore();
  const root = bootstrap(store, 'vop_test_bootstrap', { now: NOW });
  const { operator, credential } = createOperator(store, { name: 'grace', createdBy: String(root.id) });

  assert.match(credential, /^vop_[0-9a-f]{64}$/, 'issued, and long enough to be unguessable');
  // Not recoverable afterwards: only the digest is kept.
  assert.ok(!('credential' in operator));
  assert.ok(!JSON.stringify(getOperator(store, operator.id)).includes(credential));
});

test('two operators cannot share a name', () => {
  const { store, root } = seeded();
  assert.throws(
    () => createOperator(store, { name: 'ada', createdBy: String(root.id) }),
    /already exists/,
  );
});

test('creating an operator requires naming who created them', () => {
  const store = createOperatorStore();
  assert.throws(() => createOperator(store, { name: 'mallory' }), /requires a non-empty createdBy/);
});

// -- Coverage ------------------------------------------------------------

test('coverage names the scopes nobody holds', () => {
  const { store, root, ada } = seeded();
  grantScope(store, { operatorId: ada.id, scope: 'vago:settle', grantedBy: root.id });

  const coverage = describeCoverage(store);
  assert.strictEqual(coverage.operators, 2);
  assert.strictEqual(coverage.activeGrants, 2, 'ada:vago:settle plus the bootstrap grant');
  // A scope with no holder is a group-2 route nobody can operate — a
  // real outage, discovered at the worst possible moment unless
  // something surfaces it first.
  assert.ok(coverage.unheldScopes.includes('void:vetting'));
  assert.ok(!coverage.unheldScopes.includes('vago:settle'));
});
