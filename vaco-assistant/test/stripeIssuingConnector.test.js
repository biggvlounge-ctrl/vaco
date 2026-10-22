// Stripe Issuing connector -- the hard safety rail is the one thing
// this file exists to prove: nothing here can run against a live
// key, by construction, not by convention.
//
// Every assertion was watched failing against a reintroduced bug
// before being trusted, per
// `dev-docs/STANDING_INSTRUCTION_TEST_VERIFICATION.md`.

const test = require('node:test');
const assert = require('node:assert');

const {
  StripeKeyError, assertTestKey,
  createTestCardholder, issueTestVirtualCard, simulateTestAuthorization,
} = require('../lib/stripeIssuingConnector');

function fakeStripeFetch(responses) {
  const calls = [];
  const fn = async (url, options) => {
    calls.push({ url, options });
    const response = responses.shift() || { status: 200, body: {} };
    return {
      ok: response.status < 400,
      status: response.status,
      json: async () => response.body,
    };
  };
  fn.calls = calls;
  return fn;
}

const VALID_BILLING = { address: { line1: '1 Main St', city: 'Austin', postal_code: '78701', country: 'US' } };

// -- The hard safety rail ------------------------------------------------

test('assertTestKey accepts a real sk_test_ key and refuses everything else', () => {
  assert.doesNotThrow(() => assertTestKey('sk_test_abc123'));
  assert.throws(() => assertTestKey('sk_live_abc123'), StripeKeyError);
  assert.throws(() => assertTestKey('pk_test_abc123'), StripeKeyError, 'a publishable key must also be refused');
  assert.throws(() => assertTestKey(undefined), StripeKeyError);
  assert.throws(() => assertTestKey(''), StripeKeyError);
});

test('createTestCardholder refuses a live key before making any real network call', async () => {
  const fetchFn = fakeStripeFetch([]);
  await assert.rejects(
    createTestCardholder('sk_live_realmoney', { name: 'Ada', billing: VALID_BILLING, fetchFn }),
    StripeKeyError,
  );
  assert.equal(fetchFn.calls.length, 0, 'a live key must never reach the network');
});

test('issueTestVirtualCard refuses a live key before making any real network call', async () => {
  const fetchFn = fakeStripeFetch([]);
  await assert.rejects(
    issueTestVirtualCard('sk_live_realmoney', { cardholderId: 'ich_123', fetchFn }),
    StripeKeyError,
  );
  assert.equal(fetchFn.calls.length, 0);
});

test('simulateTestAuthorization refuses a live key before making any real network call', async () => {
  const fetchFn = fakeStripeFetch([]);
  await assert.rejects(
    simulateTestAuthorization('sk_live_realmoney', { cardId: 'ic_123', amount: 1000, fetchFn }),
    StripeKeyError,
  );
  assert.equal(fetchFn.calls.length, 0);
});

// -- Real request shape, against an injected fetch ----------------------

test('createTestCardholder sends real, form-encoded Stripe fields with a Bearer test key', async () => {
  const fetchFn = fakeStripeFetch([{ status: 200, body: { id: 'ich_test1', object: 'issuing.cardholder' } }]);
  const result = await createTestCardholder('sk_test_abc', { name: 'Ada Lovelace', email: 'ada@example.com', billing: VALID_BILLING, fetchFn });

  assert.equal(result.id, 'ich_test1');
  const [call] = fetchFn.calls;
  assert.equal(call.url, 'https://api.stripe.com/v1/issuing/cardholders');
  assert.equal(call.options.headers.Authorization, 'Bearer sk_test_abc');
  assert.ok(call.options.body.includes('type=individual'));
  assert.ok(call.options.body.includes('name=Ada%20Lovelace'));
  assert.ok(call.options.body.includes('billing%5Baddress%5D%5Bcity%5D=Austin'));
});

test('createTestCardholder requires a complete billing address', async () => {
  await assert.rejects(
    createTestCardholder('sk_test_abc', { name: 'Ada', billing: { address: { line1: '1 Main St' } } }),
    /requires billing.address/,
  );
});

test('issueTestVirtualCard requests a virtual, active card against a real cardholder id', async () => {
  const fetchFn = fakeStripeFetch([{ status: 200, body: { id: 'ic_test1', object: 'issuing.card', last4: '4242' } }]);
  const result = await issueTestVirtualCard('sk_test_abc', { cardholderId: 'ich_test1', fetchFn });

  assert.equal(result.id, 'ic_test1');
  const [call] = fetchFn.calls;
  assert.ok(call.options.body.includes('type=virtual'));
  assert.ok(call.options.body.includes('status=active'));
  assert.ok(call.options.body.includes('cardholder=ich_test1'));
});

test('issueTestVirtualCard requires a cardholderId', async () => {
  await assert.rejects(issueTestVirtualCard('sk_test_abc', {}), /requires a cardholderId/);
});

test('simulateTestAuthorization sends a real amount and merchant category against a real card id', async () => {
  const fetchFn = fakeStripeFetch([{ status: 200, body: { id: 'iauth_test1', approved: true } }]);
  const result = await simulateTestAuthorization('sk_test_abc', { cardId: 'ic_test1', amount: 5000, fetchFn });

  assert.equal(result.approved, true);
  const [call] = fetchFn.calls;
  assert.ok(call.options.body.includes('card=ic_test1'));
  assert.ok(call.options.body.includes('amount=5000'));
});

test('simulateTestAuthorization requires a positive amount', async () => {
  await assert.rejects(simulateTestAuthorization('sk_test_abc', { cardId: 'ic_1', amount: 0 }), /positive amount/);
});

// -- Honest failure, never silently retried ------------------------

test('a real Stripe error response surfaces its own real message, not a generic one', async () => {
  const fetchFn = fakeStripeFetch([{
    status: 402,
    body: { error: { message: 'Issuing is not enabled for this account. Contact Stripe sales to get started.' } },
  }]);
  await assert.rejects(
    createTestCardholder('sk_test_abc', { name: 'Ada', billing: VALID_BILLING, fetchFn }),
    /Issuing is not enabled for this account/,
  );
});
