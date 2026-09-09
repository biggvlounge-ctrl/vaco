// VACAY -- Home section routes (Zillow's real estate model). Mounted
// at /api/home in server.js.

const express = require('express');
const {
  LISTING_PURPOSES, LISTING_STATUSES, createPropertyListing, getPropertyListing,
  listActiveListings, listListingsForAgent, markPending, markClosed,
} = require('./listings');
const {
  LEAD_STATUSES, LEAD_FEE, requestTour, getLeadForAgent, listLeadsForListing, purchaseLead,
} = require('./leads');

const { requireActor, requireSession } = require('../shieldAuth.cjs');

// A property listing belongs to the agent who created it. Moving it to
// pending or closed is a claim about a real transaction, so a rival
// agent must not be able to take somebody's listing off the market.
function requireListingAgent(getListing) {
  const session = requireSession();
  return (req, res, next) => session(req, res, () => {
    const listing = getListing(Number(req.params.id));
    if (!listing) return res.status(404).json({ error: `no listing with id ${req.params.id}` });
    if (listing.agentId !== req.sessionUserId) {
      return res.status(403).json({ error: "only the listing's own agent may change its status" });
    }
    return next();
  });
}

function createHomeRouter(deps) {
  const { store, transferVCoin } = deps;
  const router = express.Router();

  router.get('/meta', (_req, res) => {
    res.json({
      listingPurposes: LISTING_PURPOSES, listingStatuses: LISTING_STATUSES, leadStatuses: LEAD_STATUSES, leadFee: LEAD_FEE,
    });
  });

  router.post('/listings', requireActor('agentId'), (req, res) => {
    try {
      res.status(201).json(createPropertyListing(store, req.body || {}));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/listings/:id', (req, res) => {
    const listing = getPropertyListing(store, Number(req.params.id));
    if (!listing) return res.status(404).json({ error: `no listing with id ${req.params.id}` });
    res.json(listing);
  });

  router.get('/listings', (_req, res) => {
    res.json({ listings: listActiveListings(store) });
  });

  router.get('/agents/:agentId/listings', (req, res) => {
    res.json({ listings: listListingsForAgent(store, req.params.agentId) });
  });

  router.post('/listings/:id/pending', requireListingAgent((id) => getPropertyListing(store, id)), (req, res) => {
    try {
      res.json(markPending(store, Number(req.params.id)));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/listings/:id/closed', requireListingAgent((id) => getPropertyListing(store, id)), (req, res) => {
    try {
      res.json(markClosed(store, Number(req.params.id)));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/leads', requireActor('requesterId'), (req, res) => {
    try {
      res.status(201).json(requestTour(store, req.body || {}));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/leads/:id', (req, res) => {
    const agentId = req.query.agentId || null;
    const lead = getLeadForAgent(store, Number(req.params.id), agentId);
    if (!lead) return res.status(404).json({ error: `no lead with id ${req.params.id}` });
    res.json(lead);
  });

  router.get('/listings/:id/leads', (req, res) => {
    const agentId = req.query.agentId || null;
    res.json({ leads: listLeadsForListing(store, Number(req.params.id), agentId) });
  });

  router.post('/leads/:id/purchase', requireActor('agentId'), async (req, res) => {
    try {
      res.json(await purchaseLead(store, { ...req.body, leadId: Number(req.params.id), transferFn: transferVCoin }));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { createHomeRouter };
