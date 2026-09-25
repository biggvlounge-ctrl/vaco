// HVNTZ — Connected Network Growth Analytics, §18.
// Source: `dev-docs/on-deck/HVNTZ_CONNECTED_NETWORK_FREEZE.md`, scoped
// by its own §40 audit. §18 names thirteen metrics: network size,
// active nodes, active creators, active streams, viewers, watch time,
// Hunt participation, conversions, subscriptions, advertising,
// sponsorship, revenue, and revenue attributed to each node.
//
// **Real, deterministic aggregation over Phases 1-4's own real data —
// same shape as `lib/screenAnalytics.js`'s existing rollup, no
// invented mechanic.** Six of the thirteen are built here because
// Phases 1-4 actually record the underlying data: network size and
// active-node counts (`lib/networkConnections.js`'s own Nodes),
// active creators/streams (a Node's real `vavltChannelId` reference —
// §4's own framing is that a Node WITH a connected stream is the
// creator), Hunt participation (real checkpoints with a `networkId`,
// real `hunt.participations`), total revenue and revenue attributed to
// each node (real `revenueDistributions`, `lib/
// revenueShareAgreements.js`).
//
// **The other seven are honestly absent, not approximated.** Viewer
// counts and watch time are not tracked anywhere in Vault Studios;
// subscriptions/advertising/sponsorship are not wired to a Network
// anywhere; "conversions" has no defined meaning in this codebase.
// §18's own text warns against exactly this trap — "network size
// alone must NOT automatically guarantee revenue" — so this file does
// not synthesize a number for a metric with no real source, which
// would be the same dishonesty in the other direction.

'use strict';

const { findNetwork, nodesForNetwork } = require('./networkConnections');
const { distributionsForNetwork } = require('./revenueShareAgreements');

function round(n) {
  return Math.round(n * 100) / 100;
}

// Real Hunt participation attributed to this Network — every
// checkpoint across every hunt whose own `networkId` names it, summed
// by real check-ins (`lib/hunts.js`'s own `hunt.participations`).
function huntParticipationForNetwork(store, networkId) {
  let count = 0;
  for (const hunt of store.hunts) {
    for (const checkpoint of hunt.checkpoints) {
      if (checkpoint.networkId === networkId) {
        count += hunt.participations.filter((p) => p.checkpointId === checkpoint.id).length;
      }
    }
  }
  return count;
}

function networkGrowthAnalytics(store, networkId) {
  const network = findNetwork(store, networkId);
  if (!network) throw new Error(`networkGrowthAnalytics: no network with id ${networkId}`);

  const nodes = nodesForNetwork(store, networkId);
  const activeNodes = nodes.filter((n) => n.status === 'active');
  // A Node's own real stream reference IS the creator/stream signal —
  // no separate "creator" concept exists to double-count against.
  const activeStreamNodes = activeNodes.filter((n) => n.vavltChannelId !== null);

  const distributions = distributionsForNetwork(store, networkId);
  const totalRevenueDistributed = round(distributions.reduce((sum, d) => sum + d.totalAmount, 0));
  const revenueByPayee = {};
  for (const distribution of distributions) {
    for (const leg of distribution.legs) {
      revenueByPayee[leg.payeeId] = round((revenueByPayee[leg.payeeId] || 0) + leg.amount);
    }
  }

  return {
    networkId,
    networkSize: nodes.length,
    activeNodeCount: activeNodes.length,
    activeCreatorCount: activeStreamNodes.length,
    activeStreamCount: activeStreamNodes.length,
    huntParticipationCount: huntParticipationForNetwork(store, networkId),
    distributionCount: distributions.length,
    totalRevenueDistributed,
    revenueByPayee,
  };
}

module.exports = { networkGrowthAnalytics };
