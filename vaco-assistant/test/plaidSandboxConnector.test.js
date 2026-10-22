// Plaid Sandbox connector -- the hard safety rail here is that
// PLAID_BASE_URL is a hardcoded constant nothing in this module can
// override, never a value read from input.
//
// Every assertion was watched failing against a reintroduced bug
// before being trusted, per
// `dev-docs/STANDING_INSTRUCTION_TEST_VERIFICATION.md`.

const test = require('node:test');
const assert = require('node:assert');

const {
  PLAID_BASE_URL, createSandboxPublicToken, exchangePublicToken, getSandboxAccounts,
} = require('../lib/plaidSandboxConnector');

function fakePlaidFetch(responses) {
  const calls = [];
  const fn = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    const response = responses.shift() || { status: 200, body: {} };
    return { ok: response.status < 400, status: response.status, json: async () => response.body };
  };
  fn.calls = calls;
  return fn;
}

const CREDS = { clientId: 'client-abc', secret: 'secret-xyz' };

// -- The hard safety rail ------------------------------------------------

test('PLAID_BASE_URL is the real sandbox host, never production or development', () => {
  assert.equal(PLAID_BASE_URL, 'https://sandbox.plaid.com');
});

test('every real call in this module targets PLAID_BASE_URL, never a caller-supplied host', async () => {
  const fetchFn = fakePlaidFetch([{ status: 200, body: { public_token: 'public-sandbox-1' } }]);
  await createSandboxPublicToken(CREDS, { fetchFn, baseUrl: 'https://production.plaid.com' }); // an attempted override
  assert.equal(fetchFn.calls[0].url, 'https://sandbox.plaid.com/sandbox/public_token/create',
    'a caller-supplied baseUrl must have no effect -- this module has no such parameter');
});

// -- Real request shape --------------------------------------------------

test('createSandboxPublicToken sends real client_id/secret and defaults to a real named test institution', async () => {
  const fetchFn = fakePlaidFetch([{ status: 200, body: { public_token: 'public-sandbox-1' } }]);
  const result = await createSandboxPublicToken(CREDS, { fetchFn });

  assert.equal(result.public_token, 'public-sandbox-1');
  const [call] = fetchFn.calls;
  assert.equal(call.body.client_id, 'client-abc');
  assert.equal(call.body.secret, 'secret-xyz');
  assert.equal(call.body.institution_id, 'ins_109508');
  assert.deepEqual(call.body.initial_products, ['transactions']);
});

test('createSandboxPublicToken requires real credentials, not silently defaulted', async () => {
  await assert.rejects(createSandboxPublicToken({ clientId: '', secret: 's' }), /requires a non-empty clientId/);
  await assert.rejects(createSandboxPublicToken({ clientId: 'c', secret: '' }), /requires a non-empty secret/);
});

test('exchangePublicToken sends the real public_token and returns a real access_token', async () => {
  const fetchFn = fakePlaidFetch([{ status: 200, body: { access_token: 'access-sandbox-1', item_id: 'item-1' } }]);
  const result = await exchangePublicToken(CREDS, { publicToken: 'public-sandbox-1', fetchFn });

  assert.equal(result.access_token, 'access-sandbox-1');
  assert.equal(fetchFn.calls[0].body.public_token, 'public-sandbox-1');
});

test('exchangePublicToken requires a publicToken', async () => {
  await assert.rejects(exchangePublicToken(CREDS, {}), /requires a non-empty publicToken/);
});

test('getSandboxAccounts sends the real access_token and returns real account data', async () => {
  const fetchFn = fakePlaidFetch([{ status: 200, body: { accounts: [{ account_id: 'acc-1', balances: { available: 100 } }] } }]);
  const result = await getSandboxAccounts(CREDS, { accessToken: 'access-sandbox-1', fetchFn });

  assert.equal(result.accounts[0].account_id, 'acc-1');
  assert.equal(fetchFn.calls[0].body.access_token, 'access-sandbox-1');
});

test('getSandboxAccounts requires an accessToken', async () => {
  await assert.rejects(getSandboxAccounts(CREDS, {}), /requires a non-empty accessToken/);
});

// -- Honest failure --------------------------------------------------

test('a real Plaid error response surfaces its own real error_message', async () => {
  const fetchFn = fakePlaidFetch([{ status: 400, body: { error_code: 'INVALID_CREDENTIALS', error_message: 'invalid client_id or secret provided' } }]);
  await assert.rejects(createSandboxPublicToken(CREDS, { fetchFn }), /invalid client_id or secret provided/);
});
