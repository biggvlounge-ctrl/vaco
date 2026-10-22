// Vaco Assistant -- Plaid connector, SANDBOX ONLY.
//
// Real integration code against Plaid's real API -- creating a
// sandbox public token for a fake test institution, exchanging it for
// a real access token, and fetching real (fake) account data. This is
// the honest technical building block for "identify a recurring
// charge" (per Meta Muse's own real feature), without any of the
// three real gaps named in `stripeIssuingConnector.js`'s own header
// being any less real here: a Sandbox item is connected to a FAKE
// test institution, never a real bank, and nothing here can read or
// move money for a real person's real account.
//
// ---------------------------------------------------------------------
// The hard safety rail -- a hardcoded base URL, not a configurable one
// ---------------------------------------------------------------------
// Unlike Stripe (where test/live is determined by which key is used
// against one shared API host), Plaid's three environments --
// Sandbox, Development, Production -- are separate base URLs.
// `PLAID_BASE_URL` below is a hardcoded constant, not read from an
// environment variable and not a parameter any function here accepts
// -- there is no code path in this module that can be pointed at
// `production.plaid.com` by a misconfigured value. Reaching
// production is a conscious decision to write different code, not a
// typo away.

const PLAID_BASE_URL = 'https://sandbox.plaid.com';

function requireString(value, field, action) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${action} requires a non-empty ${field}`);
  }
  return value;
}

async function plaidRequest(path, body, { fetchFn = fetch } = {}) {
  const res = await fetchFn(`${PLAID_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const responseBody = await res.json();
  if (!res.ok) {
    // Real, honest failure -- surfaced verbatim (Plaid's own real
    // error_code/error_message), never retried silently.
    throw new Error(responseBody.error_message || `Plaid sandbox request to ${path} failed (${res.status})`);
  }
  return responseBody;
}

// Plaid's own real sandbox-only shortcut -- skips the Link UI
// entirely and returns a public_token for a fake named test
// institution (Plaid's own documented default is `ins_109508`,
// "First Platypus Bank"), with the products this token should cover.
async function createSandboxPublicToken(credentials, options = {}) {
  const { clientId, secret } = credentials;
  requireString(clientId, 'clientId', 'createSandboxPublicToken');
  requireString(secret, 'secret', 'createSandboxPublicToken');
  const { institutionId = 'ins_109508', products = ['transactions'] } = options;

  return plaidRequest('/sandbox/public_token/create', {
    client_id: clientId,
    secret,
    institution_id: institutionId,
    initial_products: products,
  }, options);
}

// The real production-style exchange step -- identical call shape
// Plaid's own standard (non-sandbox) flow uses, which is the point:
// everything downstream of this call is real integration code ready
// for a real Link session's own public_token, not sandbox-specific.
async function exchangePublicToken(credentials, options = {}) {
  const { clientId, secret } = credentials;
  requireString(clientId, 'clientId', 'exchangePublicToken');
  requireString(secret, 'secret', 'exchangePublicToken');
  const { publicToken } = options;
  requireString(publicToken, 'publicToken', 'exchangePublicToken');

  return plaidRequest('/item/public_token/exchange', {
    client_id: clientId,
    secret,
    public_token: publicToken,
  }, options);
}

// Real (fake-institution) account data -- the technical building
// block for "see a real balance/recurring charge," per Muse's own
// real feature list, scoped here to sandbox data only.
async function getSandboxAccounts(credentials, options = {}) {
  const { clientId, secret } = credentials;
  requireString(clientId, 'clientId', 'getSandboxAccounts');
  requireString(secret, 'secret', 'getSandboxAccounts');
  const { accessToken } = options;
  requireString(accessToken, 'accessToken', 'getSandboxAccounts');

  return plaidRequest('/accounts/get', {
    client_id: clientId,
    secret,
    access_token: accessToken,
  }, options);
}

module.exports = {
  PLAID_BASE_URL,
  createSandboxPublicToken, exchangePublicToken, getSandboxAccounts,
};
