// Vaco Shell -- the real "shared agent layer" surface named directly
// in VAGO_CLAUDE.md's own gap list: "Needs a real call into Shell's
// shared agent layer (V4's Command Center / MIA), not a hardcoded
// string." VACON is that real agent layer (its own README: "MIA +
// every named executive agent actually live here"). This module makes
// a real, live HTTP call into VACON's own `/api/route` -- no hardcoded
// example string, no fabricated recommendation.
//
// **Real, honest limit, same one VACON's own README already states**:
// `/api/route` returns real, deterministic keyword-based routing, not
// a model-generated recommendation -- MIA's routing is a real
// decision, just not an LLM call. A follow-up call to VACON's own
// `/api/agents/:id/invoke` would produce a real model completion, but
// that requires a real ANTHROPIC_API_KEY behind `v4-proxy`, which
// isn't configured anywhere in this environment. `getInsightCard`
// below performs the real routing call and, if `invoke: true` is
// requested, attempts the real completion too -- surfacing a clear
// error rather than a fabricated response when no key is configured.

const VACON_API_URL = process.env.VACON_API_URL || 'http://localhost:8805';

// Internal services (V3, VACA, Analytics, Notify, VACON) refuse an
// unauthenticated mutating call. This app calls them server-to-server
// with no end-user session, so it presents a service credential. See
// shared/serviceAuth.js.
const VACO_SERVICE_NAME = process.env.VACO_SERVICE_NAME || 'vaco-shell';
const VACO_SERVICE_TOKEN = process.env.VACO_SERVICE_TOKEN || '';
function serviceHeaders() {
  return VACO_SERVICE_TOKEN
    ? { 'X-Service-Name': VACO_SERVICE_NAME, 'X-Service-Token': VACO_SERVICE_TOKEN }
    : {};
}


export async function getInsightCard(options = {}) {
  const { query, invoke = false } = options;
  if (!query) throw new Error('getInsightCard requires a query');

  const routeRes = await fetch(`${VACON_API_URL}/api/route`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...serviceHeaders(), },
    body: JSON.stringify({ query }),
  });
  const routeBody = await routeRes.json();
  if (!routeRes.ok) {
    throw new Error(routeBody.error || `VACON routing failed (${routeRes.status})`);
  }

  const card = {
    query,
    matchedAgents: routeBody.matches || routeBody.agents || routeBody,
    loggedAs: routeBody.loggedAs,
    completion: null,
    completionError: null,
  };

  if (invoke) {
    const topAgentId = Array.isArray(card.matchedAgents) && card.matchedAgents[0]
      ? (card.matchedAgents[0].id || card.matchedAgents[0].agentId)
      : null;
    if (!topAgentId) {
      card.completionError = 'no matched agent to invoke';
    } else {
      try {
        const invokeRes = await fetch(`${VACON_API_URL}/api/agents/${topAgentId}/invoke`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...serviceHeaders(), },
          body: JSON.stringify({ messages: [{ role: 'user', content: query }] }),
        });
        const invokeBody = await invokeRes.json();
        if (!invokeRes.ok) throw new Error(invokeBody.error || `invoke failed (${invokeRes.status})`);
        card.completion = invokeBody;
      } catch (err) {
        // Real, expected failure mode in this environment: no
        // ANTHROPIC_API_KEY is configured anywhere behind v4-proxy.
        // Surfaced honestly, not swallowed into a fake completion.
        card.completionError = err.message;
      }
    }
  }

  return card;
}
