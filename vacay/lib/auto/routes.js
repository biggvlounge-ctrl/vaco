// VACAY -- Auto section routes. Mounted at /api/auto in server.js.
// Three genuinely distinct real businesses share this one section,
// each its own real money model, none of them blended together:
// - /vehicles, /rentals            -- Turo peer rental (owner-earn split)
// - /for-sale-listings              -- CarGurus buy/sell (flat listing fee)
// - /fleet-vehicles, /fleet-rentals -- VACAY's own fleet (VACAY keeps 100%)

const express = require('express');
const {
  VEHICLE_TYPES, PROTECTION_PLANS, listVehicle, getVehicle, listVehiclesForOwner,
} = require('./vehicles');
const {
  VACAY_AUTO_ESCROW_ACCOUNT, bookRental, getRental, completeRental, cancelRental,
} = require('./rentals');
const {
  PRICE_RATINGS, LISTING_FEE, createForSaleListing, getForSaleListing, searchForSaleListings, markSold,
} = require('./carListings');
const {
  FLEET_VEHICLE_TYPES, addFleetVehicle, getFleetVehicle, searchFleetVehicles, bookFleetRental, getFleetRental, completeFleetRental, cancelFleetRental,
} = require('./fleetRentals');

const {
  requireActor, requireSession, requireCallingService,
} = require('../shieldAuth.cjs');

// **Both sides of a rental may end it, and that is a deliberate call.**
// A renter must be able to cancel; an owner must be able to close out a
// return. A guard that admitted only one of them would push the other
// into support, which is worse than the exposure it removes. What it
// still refuses is a stranger settling somebody else's escrow.
function rentalPartyGuard(getRental, getVehicleFor) {
  const session = requireSession();
  return (req, res, next) => session(req, res, () => {
    const rental = getRental(Number(req.params.id));
    if (!rental) return res.status(404).json({ error: `no rental with id ${req.params.id}` });
    const vehicle = getVehicleFor(rental);
    const parties = [rental.renterId, vehicle && vehicle.ownerId].filter(Boolean);
    if (!parties.includes(req.sessionUserId)) {
      return res.status(403).json({ error: 'only the renter or the vehicle owner may settle this rental' });
    }
    return next();
  });
}

function requireListingSeller(getListing) {
  const session = requireSession();
  return (req, res, next) => session(req, res, () => {
    const listing = getListing(Number(req.params.id));
    if (!listing) return res.status(404).json({ error: `no listing with id ${req.params.id}` });
    if (listing.sellerId !== req.sessionUserId) {
      return res.status(403).json({ error: 'only the seller may mark this listing sold' });
    }
    return next();
  });
}

function createAutoRouter(deps) {
  const { store, settleVCoin } = deps;
  const router = express.Router();

  const requireRentalParty = () => rentalPartyGuard(
    (id) => getRental(store, id),
    (rental) => getVehicle(store, rental.vehicleId),
  );
  // A fleet vehicle has no owner-user -- VACAY owns it -- so the renter
  // is the only party.
  const requireFleetRentalParty = () => rentalPartyGuard(
    (id) => getFleetRental(store, id),
    () => null,
  );

  router.get('/meta', (_req, res) => {
    res.json({
      vehicleTypes: VEHICLE_TYPES, protectionPlans: PROTECTION_PLANS, escrowAccount: VACAY_AUTO_ESCROW_ACCOUNT, priceRatings: PRICE_RATINGS, listingFee: LISTING_FEE, fleetVehicleTypes: FLEET_VEHICLE_TYPES,
    });
  });

  // -- Turo (peer rental) --
  router.post('/vehicles', requireActor('ownerId'), (req, res) => {
    try {
      res.status(201).json(listVehicle(store, req.body || {}));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/vehicles/:id', (req, res) => {
    const vehicle = getVehicle(store, Number(req.params.id));
    if (!vehicle) return res.status(404).json({ error: `no vehicle with id ${req.params.id}` });
    res.json(vehicle);
  });

  // Every rentable vehicle. Only per-owner and per-id lookups existed,

  // so a renter could not see what was available at all.

  router.get('/vehicles', (_req, res) => {

    res.json({ vehicles: store.vehicles });

  });


  router.get('/owners/:ownerId/vehicles', (req, res) => {
    res.json({ vehicles: listVehiclesForOwner(store, req.params.ownerId) });
  });

  router.post('/rentals', requireActor('renterId'), async (req, res) => {
    try {
      res.status(201).json(await bookRental(store, { ...req.body, settleFn: settleVCoin }));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/rentals/:id', (req, res) => {
    const rental = getRental(store, Number(req.params.id));
    if (!rental) return res.status(404).json({ error: `no rental with id ${req.params.id}` });
    res.json(rental);
  });

  router.post('/rentals/:id/complete', requireRentalParty(), async (req, res) => {
    try {
      res.json(await completeRental(store, { rentalId: Number(req.params.id), settleFn: settleVCoin }));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/rentals/:id/cancel', requireRentalParty(), async (req, res) => {
    try {
      res.json(await cancelRental(store, { rentalId: Number(req.params.id), settleFn: settleVCoin }));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // -- CarGurus (buy/sell) --
  router.post('/for-sale-listings', requireActor('sellerId'), async (req, res) => {
    try {
      res.status(201).json(await createForSaleListing(store, { ...req.body, settleFn: settleVCoin }));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/for-sale-listings/:id', (req, res) => {
    const listing = getForSaleListing(store, Number(req.params.id));
    if (!listing) return res.status(404).json({ error: `no for-sale listing with id ${req.params.id}` });
    res.json(listing);
  });

  router.get('/for-sale-listings', (req, res) => {
    res.json({ listings: searchForSaleListings(store, { make: req.query.make, model: req.query.model }) });
  });

  router.post('/for-sale-listings/:id/sold', requireListingSeller((id) => getForSaleListing(store, id)), (req, res) => {
    try {
      res.json(markSold(store, Number(req.params.id)));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // -- VACAY's own fleet --
  // VACAY's own fleet: inventory, not a user's property. There is no
  // actor whose session could own this write, so it is an operator
  // surface guarded as a service call until VACAY has a staff role.
  router.post('/fleet-vehicles', requireCallingService(), (req, res) => {
    try {
      res.status(201).json(addFleetVehicle(store, req.body || {}));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/fleet-vehicles/:id', (req, res) => {
    const vehicle = getFleetVehicle(store, Number(req.params.id));
    if (!vehicle) return res.status(404).json({ error: `no fleet vehicle with id ${req.params.id}` });
    res.json(vehicle);
  });

  router.get('/fleet-vehicles', (req, res) => {
    res.json({ vehicles: searchFleetVehicles(store, { location: req.query.location }) });
  });

  router.post('/fleet-rentals', requireActor('renterId'), async (req, res) => {
    try {
      res.status(201).json(await bookFleetRental(store, { ...req.body, settleFn: settleVCoin }));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/fleet-rentals/:id', (req, res) => {
    const rental = getFleetRental(store, Number(req.params.id));
    if (!rental) return res.status(404).json({ error: `no fleet rental with id ${req.params.id}` });
    res.json(rental);
  });

  router.post('/fleet-rentals/:id/complete', requireFleetRentalParty(), async (req, res) => {
    try {
      res.json(await completeFleetRental(store, { rentalId: Number(req.params.id), settleFn: settleVCoin }));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/fleet-rentals/:id/cancel', requireFleetRentalParty(), async (req, res) => {
    try {
      res.json(await cancelFleetRental(store, { rentalId: Number(req.params.id), settleFn: settleVCoin }));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { createAutoRouter };
