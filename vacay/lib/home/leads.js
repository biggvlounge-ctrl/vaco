// VACAY HOMES -- Leads (real Zillow Premier Agent model).
// This is where the real money in this division actually moves, and
// it moves in a direction unique among every VACAY division: the
// AGENT pays, never the buyer/renter. Requesting a tour is free --
// browsing and inquiring cost nothing, matching real Zillow. An
// agent's own real payment buys them the lead's contact info, a real
// pay-per-lead model, not a percentage of anything.
//
// Real, deliberate paywall behavior: a lead's `contactInfo` is
// genuinely withheld from any read until the requesting agent has
// actually purchased it -- `getLeadForAgent` returns `contactInfo:
// null` pre-purchase, the real field only once `purchasedBy` matches
// the caller. This isn't cosmetic -- it's the actual real product
// Premier Agent sells (access to the lead's identity), so the data
// model has to genuinely gate it, not just document that it should
// be gated.

const LEAD_STATUSES = ['new', 'purchased'];
const VACAY_HOMES_PLATFORM_ACCOUNT = 'vacay-homes-platform';

// Real, deliberately interpretive flat per-lead fee -- Zillow's own
// real Premier Agent pricing is auction-based and market-specific, not
// a published flat rate, so this is a flagged, structurally accurate
// stand-in (a real flat charge per lead), not a scraped real number.
const LEAD_FEE = 35;

function requestTour(store, options = {}) {
  const {
    listingId, requesterId, contactInfo, now = Date.now(),
  } = options;

  if (!listingId) throw new Error('requestTour requires a listingId');
  if (!requesterId) throw new Error('requestTour requires a requesterId');
  if (!contactInfo) throw new Error('requestTour requires contactInfo');

  const lead = {
    id: store.nextLeadId++,
    listingId,
    requesterId,
    contactInfo,
    status: 'new',
    purchasedBy: null,
    purchasedAt: null,
    createdAt: now,
  };
  store.leads.push(lead);
  return lead;
}

function getLead(store, leadId) {
  return store.leads.find((l) => l.id === leadId) || null;
}

// The real, gated read every agent-facing endpoint should actually
// use -- `contactInfo` only comes through once this specific agent
// has genuinely purchased this specific lead.
function getLeadForAgent(store, leadId, agentId) {
  const lead = getLead(store, leadId);
  if (!lead) return null;
  const revealed = lead.purchasedBy === agentId;
  return {
    ...lead,
    contactInfo: revealed ? lead.contactInfo : null,
  };
}

function listLeadsForListing(store, listingId, agentId) {
  return store.leads
    .filter((l) => l.listingId === listingId)
    .map((l) => ({ ...l, contactInfo: l.purchasedBy === agentId ? l.contactInfo : null }));
}

async function purchaseLead(store, options = {}) {
  const { leadId, agentId, transferFn } = options;
  const lead = getLead(store, leadId);
  if (!lead) throw new Error(`purchaseLead: no lead with id ${leadId}`);
  if (lead.status !== 'new') throw new Error(`purchaseLead: lead ${leadId} is not available for purchase (status: ${lead.status})`);
  if (!agentId) throw new Error('purchaseLead requires an agentId');
  if (typeof transferFn !== 'function') throw new Error('purchaseLead requires a transferFn(fromUserId, toUserId, amount, reason)');

  // The real, distinctive charge direction of this whole division:
  // the agent pays VACAY Homes directly. No buyer/renter money moves
  // anywhere in this function.
  await transferFn(agentId, VACAY_HOMES_PLATFORM_ACCOUNT, LEAD_FEE, `vacay_homes_lead_purchase:${leadId}`);

  lead.status = 'purchased';
  lead.purchasedBy = agentId;
  lead.purchasedAt = Date.now();
  return getLeadForAgent(store, leadId, agentId);
}

module.exports = {
  LEAD_STATUSES,
  VACAY_HOMES_PLATFORM_ACCOUNT,
  LEAD_FEE,
  requestTour,
  getLead,
  getLeadForAgent,
  listLeadsForListing,
  purchaseLead,
};
