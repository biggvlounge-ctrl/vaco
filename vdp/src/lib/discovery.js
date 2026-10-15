// VDP — Discovery: the gameplay suggestion that a hidden civilization
// should not just sit there forever, permanently `secret`, with
// nothing for a real player to actually do about it. `civilizations.js`
// already carries the real vocabulary this needs --
// `GATEWAY_LEGAL_STATUSES`/`ROUTE_STATUSES` both already name
// `rediscovered` as a real state, and `TERRITORY_CONTROL_STATUSES`
// already separates a `claimed` land from one `actually-controlled` --
// this module is the real player-facing mechanic that makes those
// words mean something, rather than static flavor on a seed record.
//
// **The arc, concretely**: a hidden civilization starts secret. A
// real player investigates it (`recordClue`) -- the specific source of
// a clue (a smuggling lead, a rumor, a frontier sighting) is the
// caller's own business, not this module's; it only needs a real
// `investigatorId` and records the fact. Once enough real clues exist
// (`CLUES_TO_DISCOVER`, a flagged interpretive number -- no source
// document gives one), `attemptDiscovery` fires the real, one-way
// transition: every one of the civilization's own gateways and secret
// trade routes flips to `rediscovered`, and its territory flips from
// `independent` to `claimed` -- the host country now KNOWS the land
// exists, but does not yet actually control it, the same
// claimed-vs-actually-controlled distinction `civilizations.js`'s own
// header already draws. `actually-controlled` is deliberately NOT
// reached here -- that would be a real conquest/negotiation mechanic
// this module does not invent.
//
// `investigate()` is the one real entry point a server route should
// call -- it does both steps (`recordClue` then `attemptDiscovery`)
// and returns the real, current progress, so a caller can tell from
// one response whether this specific call was the one that tipped it
// over into discovered.

import {
  getCivilization, listGateways, updateGatewayStatus,
  listTerritories, updateTerritoryControl,
  listTradeRoutes, recordRouteEvent,
} from './civilizations.js';

export const CLUES_TO_DISCOVER = 5;

export function createDiscoveryStore() {
  return { progress: {} };
}

function ensureProgress(store, civilizationId) {
  if (!store.progress[civilizationId]) {
    store.progress[civilizationId] = { clues: [], discoveredAt: null };
  }
  return store.progress[civilizationId];
}

export function getDiscoveryProgress(store, civilizationId) {
  const progress = store.progress[civilizationId];
  return {
    civilizationId,
    clueCount: progress ? progress.clues.length : 0,
    threshold: CLUES_TO_DISCOVER,
    discovered: !!(progress && progress.discoveredAt),
    discoveredAt: progress ? progress.discoveredAt : null,
  };
}

// A real player action toward discovering a hidden civilization.
// Refuses a target that isn't actually hidden (nothing to discover
// about a mainland country everyone already knows is there) and
// refuses once already discovered -- a discovery is a one-way, real
// fact, not something to keep "finding" indefinitely.
export function recordClue(civStore, discoveryStore, civilizationId, { investigatorId, source, now = Date.now() } = {}) {
  if (!investigatorId) throw new Error('recordClue requires an investigatorId');
  const civ = getCivilization(civStore, civilizationId);
  if (!civ) throw new Error(`recordClue: no civilization ${civilizationId}`);
  if (civ.kind !== 'hidden-civilization') {
    throw new Error(`recordClue: "${civ.kind}" civilizations are not hidden -- nothing to discover`);
  }
  const progress = ensureProgress(discoveryStore, civilizationId);
  if (progress.discoveredAt) {
    throw new Error(`recordClue: ${civ.name} is already discovered`);
  }
  progress.clues.push({ investigatorId, source: source || null, at: now });
  return getDiscoveryProgress(discoveryStore, civilizationId);
}

// The real transition, fired once enough clues exist. Idempotent --
// calling this again after discovery, or before the threshold is
// met, is a real no-op, not a second transition or an error.
export function attemptDiscovery(civStore, discoveryStore, civilizationId, { now = Date.now() } = {}) {
  const progress = ensureProgress(discoveryStore, civilizationId);
  if (progress.discoveredAt) return getDiscoveryProgress(discoveryStore, civilizationId);
  if (progress.clues.length < CLUES_TO_DISCOVER) return getDiscoveryProgress(discoveryStore, civilizationId);

  const civ = getCivilization(civStore, civilizationId);
  if (!civ) throw new Error(`attemptDiscovery: no civilization ${civilizationId}`);

  for (const gatewayId of civ.gatewayIds) {
    const gateway = listGateways(civStore).find((g) => g.id === gatewayId);
    if (gateway && ['secret', 'restricted'].includes(gateway.legalStatus)) {
      updateGatewayStatus(civStore, gateway.id, {
        legalStatus: 'rediscovered', note: `${civ.name} discovered by real player investigation`, now,
      });
    }
  }
  for (const territoryId of civ.territoryIds) {
    const territory = listTerritories(civStore).find((t) => t.id === territoryId);
    if (territory && territory.controlStatus === 'independent') {
      updateTerritoryControl(civStore, territory.id, {
        controlStatus: 'claimed', note: `${civ.name}'s territory is now known to exist, not yet actually controlled`, now,
      });
    }
  }
  for (const route of listTradeRoutes(civStore)) {
    if (route.status === 'secret' && (route.createdBy === civ.name || route.name.includes(civ.name))) {
      recordRouteEvent(civStore, route.id, {
        status: 'rediscovered', note: `route exposed when ${civ.name} was discovered`, now,
      });
    }
  }

  progress.discoveredAt = now;
  return getDiscoveryProgress(discoveryStore, civilizationId);
}

// The one real entry point a server route should call -- records the
// clue, then checks whether this was the one that tipped discovery
// over the threshold, in a single real step.
export function investigate(civStore, discoveryStore, civilizationId, { investigatorId, source, now = Date.now() } = {}) {
  recordClue(civStore, discoveryStore, civilizationId, { investigatorId, source, now });
  return attemptDiscovery(civStore, discoveryStore, civilizationId, { now });
}
