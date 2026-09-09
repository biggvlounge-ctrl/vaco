// VACO MCP — the tool registry.
//
// **Every tool here is an HTTP call to a route that already exists and
// is already guarded.** That is the whole design, and it is the reason
// this was built after the authorization pass rather than before it.
//
// An MCP server is a way to let an agent act. Building one over an
// unguarded API would have handed agents a surface with no
// authorization on it — which is exactly what `v4-proxy` was before
// serviceAuth was mounted on its twenty-eight routes. Doing it in that
// order would have been handing out keys to a building with no locks.
//
// So this process holds one credential, presents it on every call, and
// is refused by the same middleware that refuses anything else:
//
//   agent -> MCP client -> this process -> serviceAuth -> the route
//
// It has no privileged path. If a route would refuse `vaco-mcp`, the
// tool fails, and that is correct behaviour rather than a bug to work
// around.
//
// **Two things it deliberately does not expose.**
//
//   - Anything that moves money. V3 transfers, VOKEN purchases, VAGO
//     settlements. Those are `decisionLog` routes with a human or an
//     operator behind them, and an agent reaching them through a tool
//     list is a category error, not a feature.
//   - `POST /api/agent`. That is V4's pass-through to the model. An
//     agent calling it would be an agent calling itself through two
//     network hops, and the loop is more likely than the use.
//
// What is left is the read and coordination surface: where things are,
// who the agents are, what surfaces exist, and the call flow.

/**
 * @typedef {object} Tool
 * @property {string}  name         MCP tool name, `noun.verb`.
 * @property {string}  description  Shown to the model — says what it does AND what it will not do.
 * @property {object}  inputSchema  JSON Schema, the MCP contract.
 * @property {string}  service      Which env var holds the base URL.
 * @property {string}  method       HTTP verb.
 * @property {string|Function} path Route, or a function of the args.
 * @property {boolean} [body]       Send the args as a JSON body.
 */

const str = (description) => ({ type: 'string', description });
const num = (description) => ({ type: 'number', description });

/** @type {Tool[]} */
export const TOOLS = [
  // -- V4 maps: where things are ----------------------------------------
  {
    name: 'maps.describe',
    description: 'Summarise V4\'s shared map layer: how many places and sightings it holds, its '
      + 'defaults, and its stated limitations. Read-only.',
    inputSchema: { type: 'object', properties: {} },
    service: 'V4_PROXY_URL', method: 'GET', path: '/api/maps',
  },
  {
    name: 'maps.nearby',
    description: 'Find registered places within a radius of a coordinate. Returns places, not people.',
    inputSchema: {
      type: 'object',
      properties: {
        lat: num('latitude'), lng: num('longitude'),
        radiusKm: num('search radius in kilometres, default 25'),
        kind: str('optional place kind to filter on'),
      },
      required: ['lat', 'lng'],
    },
    service: 'V4_PROXY_URL', method: 'POST', path: '/api/maps/nearby', body: true,
  },
  {
    name: 'maps.distance',
    description: 'Great-circle distance and estimated travel time between two coordinates. '
      + 'Not road routing — V4 says so itself and this repeats it rather than implying otherwise.',
    inputSchema: {
      type: 'object',
      properties: {
        fromLat: num('origin latitude'), fromLng: num('origin longitude'),
        toLat: num('destination latitude'), toLng: num('destination longitude'),
        speedKmh: num('assumed average speed, default 50'),
      },
      required: ['fromLat', 'fromLng', 'toLat', 'toLng'],
    },
    service: 'V4_PROXY_URL', method: 'POST', path: '/api/maps/distance', body: true,
  },
  {
    name: 'maps.route',
    description: 'Order a set of stops into a route with leg distances and times.',
    inputSchema: {
      type: 'object',
      properties: { stops: { type: 'array', description: 'stops, each { lat, lng }', items: { type: 'object' } } },
      required: ['stops'],
    },
    service: 'V4_PROXY_URL', method: 'POST', path: '/api/maps/route', body: true,
  },

  // -- V4 presentation: how an agent appears ----------------------------
  {
    name: 'surfaces.list',
    description: 'The five display surfaces an agent can be presented on — TV Play, CarPlay, '
      + 'FaceTime, web and text — with what each permits.',
    inputSchema: { type: 'object', properties: {} },
    service: 'V4_PROXY_URL', method: 'GET', path: '/api/surfaces',
  },
  {
    name: 'twins.list',
    description: 'The AI human twin presentation profiles: which agent, preferred framing, animation state.',
    inputSchema: { type: 'object', properties: {} },
    service: 'V4_PROXY_URL', method: 'GET', path: '/api/twins',
  },
  {
    name: 'twins.get',
    description: 'One twin profile by agent id.',
    inputSchema: {
      type: 'object',
      properties: { agentId: str('agent id, e.g. qvan or kevin') },
      required: ['agentId'],
    },
    service: 'V4_PROXY_URL', method: 'GET',
    path: (a) => `/api/twins/${encodeURIComponent(a.agentId)}`,
  },

  // -- V4 call flow -----------------------------------------------------
  {
    name: 'calls.list',
    description: 'Calls this service credential may see. Scoped by the caller, not by the query — '
      + 'asking for another user\'s calls does not return them.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: str('whose calls, when asking on their behalf'),
        agentId: str('filter to one agent'),
        status: str('ringing, connected, ended, declined or missed'),
      },
    },
    service: 'V4_PROXY_URL', method: 'GET',
    path: (a) => `/api/calls?${new URLSearchParams(
      Object.entries(a).filter(([, v]) => v !== undefined && v !== null),
    )}`,
  },
  {
    name: 'calls.place',
    description: 'Ring an agent for a user, on a surface. Creates a ringing call; it does not carry '
      + 'audio — the media plane is LiveKit and is separate.',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: str('which agent to ring'),
        userId: str('who the call is for'),
        surfaceId: str('tv-play, carplay, facetime, web or text; default web'),
        topic: str('optional subject line'),
      },
      required: ['agentId', 'userId'],
    },
    service: 'V4_PROXY_URL', method: 'POST', path: '/api/calls', body: true,
  },

  // -- VACON: who the agents are ----------------------------------------
  {
    name: 'agents.list',
    description: 'The named VACON agents — who they are, which app each speaks for, and their tier.',
    inputSchema: {
      type: 'object',
      properties: { tier: str('filter by tier'), app: str('filter to the app an agent represents') },
    },
    service: 'VACON_URL', method: 'GET',
    path: (a) => `/api/agents?${new URLSearchParams(
      Object.entries(a).filter(([, v]) => v !== undefined && v !== null),
    )}`,
  },
  {
    name: 'agents.route',
    description: 'Ask MIA which agent a question belongs to. Returns the routing decision and why, '
      + 'without invoking anybody.',
    inputSchema: {
      type: 'object',
      properties: { query: str('the question to route') },
      required: ['query'],
    },
    service: 'VACON_URL', method: 'POST', path: '/api/route', body: true,
  },
  {
    name: 'agents.invocations',
    description: 'Recent agent invocations: which agent, which calling service, when. The attribution '
      + 'record, readable only with a service credential.',
    inputSchema: { type: 'object', properties: {} },
    service: 'VACON_URL', method: 'GET', path: '/api/agents/invocations',
  },

  // -- the system's own state -------------------------------------------
  {
    name: 'system.health',
    description: 'Health of one VACO service by name: its mode, its guards, and whether its adapters '
      + 'are configured. Use this before concluding a service is broken.',
    inputSchema: {
      type: 'object',
      properties: { service: str('v4, vacon, v3, shield, media, audit, notify, operator or analytics') },
      required: ['service'],
    },
    service: 'BY_NAME', method: 'GET', path: '/api/health',
  },
];

// `system.health` can reach any of these and nothing else. An open
// host parameter would make this tool an SSRF primitive with a
// service credential attached, which is a much worse thing than a
// convenience is worth.
export const HEALTH_TARGETS = {
  v4: 'V4_PROXY_URL',
  vacon: 'VACON_URL',
  v3: 'V3_API_URL',
  shield: 'SHIELD_API_URL',
  media: 'VACO_MEDIA_URL',
  audit: 'VACO_AUDIT_URL',
  notify: 'VACO_NOTIFY_URL',
  operator: 'VACO_OPERATOR_URL',
  analytics: 'VACO_ANALYTICS_URL',
};

export const DEFAULT_URLS = {
  V4_PROXY_URL: 'http://localhost:8787',
  VACON_URL: 'http://localhost:8805',
  V3_API_URL: 'http://localhost:8811',
  SHIELD_API_URL: 'http://localhost:8812',
  VACO_MEDIA_URL: 'http://localhost:8821',
  VACO_AUDIT_URL: 'http://localhost:8819',
  VACO_NOTIFY_URL: 'http://localhost:8818',
  VACO_OPERATOR_URL: 'http://localhost:8820',
  VACO_ANALYTICS_URL: 'http://localhost:8790',
};

export function toolByName(name) {
  return TOOLS.find((t) => t.name === name) || null;
}

/** The MCP wire shape: name, description, inputSchema and nothing else. */
export function describeTools() {
  return TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
}
