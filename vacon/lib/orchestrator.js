// VACON -- MIA's real routing logic.
// Real, deliberate design choice: deterministic keyword scoring
// against each agent's own domain, not a real ML/LLM classifier.
// Routing a request to the right one of 10 agents doesn't need its
// own model call -- burning an Anthropic call just to decide who
// should get the *next* Anthropic call would add real latency/cost
// for no real accuracy gain at this scale. Flagged plainly as real,
// genuinely-used routing logic that is not "intelligent" in the AI
// sense, the same honesty this session already applied to VENVS's
// own NPCs (real wander AI, not real conversation).

const { AGENTS } = require('./agents');

// Real domain keywords per agent, grounded directly in each agent's
// own systemPrompt/role/app in lib/agents.js -- not arbitrary, drawn
// from the actual responsibilities already written into the roster.
const DOMAIN_KEYWORDS = {
  qvan: ['security', 'fraud', 'breach', 'hack', 'identity theft', 'disaster recovery', 'threat', 'zero-trust', 'monitoring'],
  leslie: ['budget', 'forecast', 'treasury', 'vcoin', 'financial', 'finance', 'revenue', 'ledger', 'banking', 'compliance report'],
  deskins: ['contract', 'compliance', 'legal', 'terms of service', 'privacy', 'regulation', 'gambling', 'ip', 'intellectual property'],
  kevin: ['dating', 'match', 'convo', 'cvnvo', 'date plan', 'profile advice', 'conversation opener'],
  kay: ['travel', 'vacay', 'stay', 'itinerary', 'trip', 'experience booking', 'vacation'],
  gibson: ['ride', 'delivery', 'route', 'dispatch', 'void', 'navigation', 'driver', 'courier'],
  drea: ['ad', 'advertising', 'dreams', 'screen', 'billboard', 'traffic pricing', 'digital real estate'],
  anderson: ['event ticket', 'meet and greet', 'meet & greet', 'digital waiting room', 'void magic', 'ticketing', 'fan experience', 'check-in'],
  stephanie: ['competitor', 'comparable', 'market research', 'vex business', 'quantconnect', 'trendspider', 'trade ideas', 'backtesting platform', 'competitive intelligence'],
  ava: ['music discovery', 'new artist', 'vulture', 'playlist recommend', 'find new music'],
  autumn: ['production advice', 'release strategy', 'creator tools', 'studio', 'recording'],
  jacobi: ['distribution', 'playlist strategy', 'release planning', 'get in front of audience'],
  // Deliberately narrow, and deliberately multi-word where a single
  // word would collide. Bare 'script' and 'ad' would fight DREA and
  // Deskins; 'video script'/'ad script' route cleanly. Nothing here
  // touches gaming -- that work routes out of VENVM entirely.
  jake: ['video script', 'ad script', 'venvm', 'storyboard', 'production pipeline', 'reformat', 'aspect ratio', 'short-form video', 'creative brief'],
};

// Matching is on whole words, not substrings, and that distinction was
// a real live bug rather than a hypothetical one.
//
// This used to be `queryLower.includes(k)`. Deskins' domain includes
// the keyword `ip` (intellectual property), and `includes` matched it
// inside any word containing those two letters -- so "plan me a trip
// to Miami" scored Deskins as highly as Kay and won the tiebreak,
// "leave a tip for the driver" beat Gibson, and "where do I ship this
// package", "give me a recipe", and "what equipment do I need" all
// routed to the Chief Legal Officer. DREA's `ad` did the same thing to
// every "advice", "already", and "read". Both were silently wrong for
// as long as the router has existed; the failure is invisible because
// a misroute still returns a confident answer, just from the wrong
// executive.
//
// Word boundaries fix the whole class at once and cost nothing for
// multi-word keywords -- `\bmeet & greet\b` and `\bzero-trust\b` match
// exactly as before. Regexes are built once at module load rather than
// per query.
function keywordToRegex(keyword) {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i');
}

const KEYWORD_PATTERNS = Object.fromEntries(
  Object.entries(DOMAIN_KEYWORDS).map(([agentId, keywords]) => [
    agentId, keywords.map(keywordToRegex),
  ]),
);

// A match on a multi-word keyword is stronger evidence than a match on
// a single common word, so matches are weighted by the keyword's own
// word count rather than counted flat.
//
// The concrete case that forced this: "write me a video script for a
// coffee shop ad" matches Jake's `video script` and DREA's `ad` -- one
// each under flat counting, so the tie broke on roster order and the
// ad-inventory executive answered a scriptwriting request. The query
// is genuinely about both, but "video script" identifies the ask and
// "ad" only describes its subject. Weighting by specificity says that
// without special-casing either agent.
//
// This is a ranking heuristic, not a claim of correctness. A tie that
// survives weighting still breaks on roster order, and `matches`
// carries the matched keywords so a wrong route is diagnosable instead
// of mysterious.
function matchesFor(agentId, queryLower) {
  const patterns = KEYWORD_PATTERNS[agentId] || [];
  const keywords = DOMAIN_KEYWORDS[agentId] || [];
  const matched = keywords.filter((_, i) => patterns[i].test(queryLower));
  const score = matched.reduce((sum, k) => sum + k.split(/\s+/).length, 0);
  return { matched, score };
}

function scoreAgent(agentId, queryLower) {
  return matchesFor(agentId, queryLower).score;
}

// Real, deterministic routing: scores every non-MIA agent against the
// query's own text, returns them ranked highest-first. A query that
// matches nothing routes to MIA herself -- a real, honest fallback:
// her own role is "answer directly when a request doesn't belong to
// one of the specialists," not a forced guess.
function routeQuery(query) {
  if (typeof query !== 'string' || !query.trim()) {
    throw new Error('routeQuery requires a non-empty query string');
  }
  const queryLower = query.toLowerCase();

  const scored = AGENTS
    .map((a) => {
      const { matched, score } = matchesFor(a.id, queryLower);
      return { agentId: a.id, score, keywords: matched };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return { routedTo: 'mia', matches: [], fallback: true };
  }
  return { routedTo: scored[0].agentId, matches: scored, fallback: false };
}

// Records a real routing decision into the store so MIA's own
// history is genuinely inspectable via GET /api/route/history, not
// just a one-shot stateless function.
function recordRouting(store, query, result, now = Date.now()) {
  const entry = {
    id: store.nextRoutingLogId++, query, routedTo: result.routedTo, fallback: result.fallback, createdAt: now,
  };
  store.routingLog.push(entry);
  return entry;
}

function getRoutingHistory(store) {
  return [...store.routingLog].sort((a, b) => b.createdAt - a.createdAt);
}

// **Bounded, because this one grows with traffic.** `routingLog` grows
// with queries a human typed; this grows every time any service asks
// any agent anything, which at scale is unbounded memory in a process
// that persists its whole store to disk on every write. Ten thousand
// is enough to answer "who has been calling Kevin lately" and small
// enough that the store stays a file rather than a database.
const MAX_INVOCATION_LOG = 10000;

function recordInvocation(store, details, now = Date.now()) {
  const entry = { id: store.nextInvocationLogId++, ...details, at: now };
  store.invocationLog.push(entry);
  if (store.invocationLog.length > MAX_INVOCATION_LOG) store.invocationLog.shift();
  return entry;
}

function getInvocationHistory(store) {
  return [...store.invocationLog].sort((a, b) => b.at - a.at);
}

module.exports = {
  DOMAIN_KEYWORDS, KEYWORD_PATTERNS, matchesFor, scoreAgent, routeQuery, recordRouting, getRoutingHistory,
  MAX_INVOCATION_LOG, recordInvocation, getInvocationHistory,
};
