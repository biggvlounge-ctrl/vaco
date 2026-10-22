// Vaco Assistant -- Stripe Issuing connector, TEST MODE ONLY.
//
// Real integration code against Stripe's real Issuing API -- creating
// a cardholder, issuing a virtual card, and simulating a purchase
// against it via Stripe's own real `test_helpers` endpoints. This is
// genuinely more than `assistantTasks.js`'s own honest "no connector
// exists" state, and genuinely less than real bill-pay capability --
// see the three-part caveat below before this is wired into anything
// user-facing.
//
// ---------------------------------------------------------------------
// The hard safety rail -- checked, not trusted
// ---------------------------------------------------------------------
// **This module refuses to run against anything but a real Stripe
// TEST key.** Stripe's own test/live split is determined entirely by
// which secret key is used (`sk_test_...` vs `sk_live_...`), not by a
// different base URL -- so a wrong key here would make a REAL charge
// against a REAL card. `assertTestKey` checks the key's own prefix
// before every single call in this module and throws rather than
// proceeding if it is not explicitly a test key. This is the single
// most important line in this file.
//
// ---------------------------------------------------------------------
// Three real reasons this still cannot pay a real bill, even once a
// real test key is configured
// ---------------------------------------------------------------------
// 1. **It is test mode.** A card issued here is a real Stripe object,
//    but it is not accepted by any real merchant -- Stripe's own test
//    cards only authorize against Stripe's own `test_helpers`
//    endpoints, not a real biller's real payment processor.
// 2. **Issuing itself needs account approval**, even in test mode.
//    Checked directly (Stripe's own testing docs): "Don't build a
//    full API integration until you've spoken to sales... your
//    account may need approval before the full API test flow is
//    available," and a test Issuing balance has to be funded before
//    any test transaction can run. A `sk_test_` key alone does not
//    guarantee these endpoints are even enabled for a given account.
// 3. **Moving to live mode is a business decision, not a code
//    change** -- swapping in a live key, real KYC/AML on the
//    cardholder, and a money transmitter license or BaaS partnership
//    (see `v3/VASH_BAAS_VCOIN_ADVANCEMENT.md`) all have to happen
//    first. Nothing in this file shortens that path; it only makes
//    the eventual integration a real, already-tested starting point
//    instead of a blank page.
//
// **This is why `assistantTasks.js`'s `connectorStatus('pay-bill')`
// is NOT changed to `available: true` by this module's existence.**
// A sandbox integration and a real bill-paying capability are
// different facts, and conflating them is exactly the kind of
// overclaim this whole ecosystem's discipline exists to avoid.

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

class StripeKeyError extends Error {}

// Stripe's own real prefix convention -- `sk_test_` for test mode,
// `sk_live_` for live. Anything else (missing, malformed, a
// publishable key used by mistake) is refused outright.
function assertTestKey(secretKey) {
  if (typeof secretKey !== 'string' || !secretKey.startsWith('sk_test_')) {
    throw new StripeKeyError(
      'stripeIssuingConnector: refusing to run -- STRIPE_SECRET_KEY must be a real Stripe TEST key '
      + '(starting with "sk_test_"). This module will not run against a live key.',
    );
  }
}

function authHeaders(secretKey) {
  assertTestKey(secretKey);
  return {
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
}

// Stripe's real API takes form-urlencoded bodies, not JSON -- this
// mirrors that exactly rather than sending a body Stripe's own API
// would reject.
function formBody(params) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

async function stripeRequest(secretKey, path, params, { fetchFn = fetch } = {}) {
  assertTestKey(secretKey);
  const res = await fetchFn(`${STRIPE_API_BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(secretKey),
    body: formBody(params),
  });
  const body = await res.json();
  if (!res.ok) {
    // Real, honest failure -- most likely cause, per Stripe's own
    // docs quoted above, is Issuing not yet being enabled on this
    // test account. Surfaced verbatim, never retried silently.
    throw new Error(body.error?.message || `Stripe Issuing request to ${path} failed (${res.status})`);
  }
  return body;
}

// Real cardholder creation -- Stripe requires one before any card can
// be issued to them. `type: 'individual'` is Stripe's own real,
// required field.
async function createTestCardholder(secretKey, options = {}) {
  const { name, email, phoneNumber, billing } = options;
  if (!name) throw new Error('createTestCardholder requires a name');
  if (!billing?.address?.line1 || !billing?.address?.city || !billing?.address?.postal_code) {
    throw new Error('createTestCardholder requires billing.address with at least line1, city, postal_code, country');
  }
  return stripeRequest(secretKey, '/issuing/cardholders', {
    type: 'individual',
    name,
    email,
    phone_number: phoneNumber,
    'billing[address][line1]': billing.address.line1,
    'billing[address][city]': billing.address.city,
    'billing[address][postal_code]': billing.address.postal_code,
    'billing[address][country]': billing.address.country || 'US',
    'billing[address][state]': billing.address.state,
  }, options);
}

// Real virtual-card issuance against a real cardholder. Activated at
// creation (Stripe's own real option for virtual cards, per its
// testing docs) rather than left in the inactive state a physical
// card would start in.
async function issueTestVirtualCard(secretKey, options = {}) {
  const { cardholderId, currency = 'usd', spendingLimitAmount = null } = options;
  if (!cardholderId) throw new Error('issueTestVirtualCard requires a cardholderId');
  const params = {
    cardholder: cardholderId,
    currency,
    type: 'virtual',
    status: 'active',
  };
  if (Number.isFinite(spendingLimitAmount)) {
    params['spending_controls[spending_limits][0][amount]'] = spendingLimitAmount;
    params['spending_controls[spending_limits][0][interval]'] = 'per_authorization';
  }
  return stripeRequest(secretKey, '/issuing/cards', params, options);
}

// Simulates a real purchase attempt against the test card via
// Stripe's own real `test_helpers` endpoint -- the honest substitute
// for "actually paying a real biller," which this card cannot do
// (see the header). A merchant category/amount is required because a
// real authorization always names both.
async function simulateTestAuthorization(secretKey, options = {}) {
  const { cardId, amount, merchantCategoryCode = '4900' } = options;
  if (!cardId) throw new Error('simulateTestAuthorization requires a cardId');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('simulateTestAuthorization requires a positive amount (in cents)');
  return stripeRequest(secretKey, '/test_helpers/issuing/authorizations', {
    card: cardId,
    amount,
    currency: 'usd',
    'merchant_data[category_code]': merchantCategoryCode,
  }, options);
}

module.exports = {
  StripeKeyError, assertTestKey,
  createTestCardholder, issueTestVirtualCard, simulateTestAuthorization,
};
