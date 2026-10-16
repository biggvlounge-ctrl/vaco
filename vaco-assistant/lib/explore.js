// Vaco Assistant -- the same real cross-app reads "your VACO" (the
// Explore tab in vaco-shell) already pulls, so your assistant can
// answer with them directly instead of only knowing your VCoin
// balance. Copied from `vaco-shell/lib/explore.js` rather than
// required across the app boundary -- same reason every other copy in
// this ecosystem exists: zero cross-app `require()`s, so Docker can
// build each app from its own directory. If the real source shape
// changes, fix it in both copies.
//
// **Fail-soft per source, on purpose.** One app being down must not
// block an answer about the others -- each section reports its own
// `ok`/`error` independently, same posture the Explore tab holds.
//
// **Reads only, no service credential needed.** Every route called
// here is a GET, and `serviceAuth`'s own `MUTATING` set
// (POST/PUT/PATCH/DELETE) never includes GET -- confirmed directly
// against each app's own serviceAuth middleware, not assumed.

const V3_API_URL = process.env.V3_API_URL || 'http://localhost:8811';
const VXLLAGE_API_URL = process.env.VXLLAGE_API_URL || 'http://localhost:8796';
const VOKEN_API_URL = process.env.VOKEN_API_URL || 'http://localhost:8794';
const VAGO_API_URL = process.env.VAGO_API_URL || 'http://localhost:8795';

// The one real network call every source below goes through --
// injectable as a whole for tests. Never throws: a source that is
// down or errors comes back as `{ ok: false, error }`.
async function fetchJson(url) {
  try {
    const res = await fetch(url);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: body.error || `${url} failed (${res.status})` };
    return { ok: true, data: body };
  } catch (err) {
    return { ok: false, error: `unreachable: ${err.message}` };
  }
}

async function getProfileSummary(userId, options = {}) {
  const { fetchFn = fetchJson } = options;

  const [balance, articles, subscribers, referrals, fantasy] = await Promise.all([
    fetchFn(`${V3_API_URL}/api/vcoin/balance/${encodeURIComponent(userId)}`),
    fetchFn(`${VXLLAGE_API_URL}/api/authors/${encodeURIComponent(userId)}/articles`),
    fetchFn(`${VXLLAGE_API_URL}/api/authors/${encodeURIComponent(userId)}/subscribers`),
    fetchFn(`${VOKEN_API_URL}/api/referrals/${encodeURIComponent(userId)}/progress`),
    fetchFn(`${VAGO_API_URL}/api/fantasy/users/${encodeURIComponent(userId)}/entries`),
  ]);

  const vxllageOk = articles.ok && subscribers.ok;

  return {
    userId,
    wallet: {
      app: 'v3', label: 'VCoin balance',
      ok: balance.ok,
      balance: balance.ok ? balance.data.balance : null,
      error: balance.ok ? null : balance.error,
    },
    vxllage: {
      app: 'vxllage', label: 'VXLLAGE',
      ok: vxllageOk,
      articleCount: articles.ok ? articles.data.articles.length : null,
      subscriberCount: subscribers.ok ? subscribers.data.subscribers.length : null,
      error: vxllageOk ? null : (articles.error || subscribers.error),
    },
    voken: {
      app: 'voken', label: 'VOKEN referrals',
      ok: referrals.ok,
      referralCount: referrals.ok ? referrals.data.referralCount : null,
      error: referrals.ok ? null : referrals.error,
    },
    vago: {
      app: 'vago', label: 'VAGO fantasy',
      ok: fantasy.ok,
      entryCount: fantasy.ok ? fantasy.data.entries.length : null,
      error: fantasy.ok ? null : fantasy.error,
    },
  };
}

async function getRecentActivity(userId, options = {}) {
  const { fetchFn = fetchJson, limit = 20 } = options;

  const result = await fetchFn(`${V3_API_URL}/api/vcoin/transactions/${encodeURIComponent(userId)}`);
  if (!result.ok) return { ok: false, error: result.error, items: [] };

  const items = (result.data.transactions || [])
    .slice()
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit)
    .map((t) => ({
      id: t.id,
      direction: t.toUserId === userId ? 'in' : 'out',
      counterparty: t.toUserId === userId ? t.fromUserId : t.toUserId,
      amount: t.amount,
      reason: t.reason,
      timestamp: t.timestamp,
    }));

  return { ok: true, items };
}

module.exports = { fetchJson, getProfileSummary, getRecentActivity };
