// VACO -- "your VACO" cross-app explore page. Two real views on one
// signed-in user, pulled from apps that already track this data --
// no new infrastructure, no push-based events, just real reads
// aggregated in one place.
//
// **Why this exists.** 37 apps, one login, and until now nothing tying
// a person's presence across them into one page -- a VXLLAGE post
// count, a VOKEN referral tier, a VAGO fantasy entry, and a VCoin
// balance were each only visible by opening that one app. This is the
// "explore page, but for your own apps" the owner asked for directly.
//
// **Fail-soft per source, on purpose.** One app being down must not
// blank the whole page -- each section reports its own `ok`/`error`
// independently, same posture `VACO.resolvePlayback` already holds
// client-side for media. A person who can't reach VAGO right now
// should still see their VCoin balance.
//
// **Reads only, no service credential needed.** Every route called
// here is a GET, and `serviceAuth`'s own `MUTATING` set
// (POST/PUT/PATCH/DELETE) never includes GET -- confirmed directly
// against each app's own serviceAuth middleware, not assumed. So this
// is a plain fetch, server-to-server, same as the wallet/insight
// proxies already in server.js.

const V3_API_URL = process.env.V3_API_URL || 'http://localhost:8811';
const VXLLAGE_API_URL = process.env.VXLLAGE_API_URL || 'http://localhost:8796';
const VOKEN_API_URL = process.env.VOKEN_API_URL || 'http://localhost:8794';
const VAGO_API_URL = process.env.VAGO_API_URL || 'http://localhost:8795';

// The one real network call every source below goes through --
// injectable as a whole for tests, same pattern `getInsightCard`'s
// own `invoke` call already uses. Never throws: a source that is down
// or errors comes back as `{ ok: false, error }`, which is what makes
// "fail soft per source" possible rather than aspirational.
export async function fetchJson(url) {
  try {
    const res = await fetch(url);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: body.error || `${url} failed (${res.status})` };
    return { ok: true, data: body };
  } catch (err) {
    return { ok: false, error: `unreachable: ${err.message}` };
  }
}

// One real cross-app summary -- four sources, fetched in parallel,
// each reporting its own success independently. Each section names its
// own `app` key only; the frontend already holds every app's real URL
// from the registry it loads on startup (`state.apps`), so no URL is
// threaded through the backend here.
export async function getProfileSummary(userId, options = {}) {
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

// The real activity feed: V3's own transaction history, which already
// carries a human-readable `reason` for nearly everything that happens
// ecosystem-wide, because nearly everything settles through V3. No
// second data source needed -- this is the real settlement log, not a
// fabricated event stream standing in for one.
export async function getRecentActivity(userId, options = {}) {
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
