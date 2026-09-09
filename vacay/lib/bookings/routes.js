// VACAY -- Bookings section routes (Airbnb-style stays + Booking.com-
// style professional inventory via hostType, Airbnb Experiences, and
// the VOID integrations). Mounted at /api/bookings in server.js.
//
// Per explicit instruction, "Booking and stay should be the same
// thing" -- there is no separate "reservation" resource nested under
// this section. A booking (of a stay) lives directly at this
// section's own root: `POST /api/bookings` creates one, `GET
// /api/bookings/:id` reads one back. The section name and the
// resource name are deliberately the same word, not two different
// ones invented to avoid the repetition.
//
// Route registration order matters here in exactly one real way,
// worth flagging directly rather than leaving implicit: `GET
// /experiences` (list) and `GET /:id` (a booking) are both one-
// segment GET routes, so a request for the literal path
// `/api/bookings/experiences` would ambiguously match either pattern.
// Express resolves ties by registration order, so `/experiences` is
// registered before the generic `/:id` below -- every other route
// pair in this file has a distinct enough shape (a literal segment in
// a different position, or a different segment count) that no such
// care is needed.

const express = require('express');
const {
  LISTING_TYPES, HOST_TYPES, createListing, getListing,
} = require('./listings');
const {
  VACAY_ESCROW_ACCOUNT, FEE_PERCENT, createBooking, getBooking, completeStay, cancelBooking,
} = require('./bookings');
const {
  EXPERIENCE_STATUSES, createExperience, getExperience, discoverExperiences,
} = require('./experiences');
const {
  bookExperience, getExperienceBooking, completeExperienceBooking, cancelExperienceBooking,
} = require('./experienceBookings');
const {
  VOID_SERVICE_TYPES, requestVoidService, getVoidServiceRequest, listVoidServiceRequests,
} = require('./voidServices');
const {
  requestSightseeing, getSightseeingRequest, listSightseeingRequests,
} = require('./voidHourly');

const { requireActor, requireSession } = require('../shieldAuth.cjs');

// A stay has two parties: the guest who paid and the host who is owed.
// Either may complete or cancel it -- the same reasoning as a car
// rental, and for the same reason: a settlement only one side can reach
// turns the other side's problem into a support ticket.
function stayPartyGuard(getBooking, getListingFor) {
  const session = requireSession();
  return (req, res, next) => session(req, res, () => {
    const booking = getBooking(Number(req.params.id));
    if (!booking) return res.status(404).json({ error: `no booking with id ${req.params.id}` });
    const listing = getListingFor(booking);
    const parties = [booking.guestId, listing && listing.hostId].filter(Boolean);
    if (!parties.includes(req.sessionUserId)) {
      return res.status(403).json({ error: 'only the guest or the host may settle this booking' });
    }
    return next();
  });
}

// Add-ons attach to a stay and are billed to the guest, so the guest is
// the only party -- a host must not be able to order a ride or a tour
// onto somebody else's bill.
function requireGuest(getBooking, label) {
  const session = requireSession();
  return (req, res, next) => session(req, res, () => {
    const booking = getBooking(Number(req.params.id));
    if (!booking) return res.status(404).json({ error: `no ${label} with id ${req.params.id}` });
    if (booking.guestId !== req.sessionUserId) {
      return res.status(403).json({ error: `only the guest on this ${label} may add to it` });
    }
    return next();
  });
}

function createBookingsRouter(deps) {
  const {
    store, transferVCoin, requestVoidJob, requestVoidHourlyBooking,
  } = deps;
  const router = express.Router();

  const requireStayParty = () => stayPartyGuard(
    (id) => getBooking(store, id),
    (booking) => getListing(store, booking.listingId),
  );
  // An experience booking's counterpart is the experience's host.
  const requireExperienceParty = () => stayPartyGuard(
    (id) => getExperienceBooking(store, id),
    (booking) => getExperience(store, booking.experienceId),
  );

  router.get('/meta', (_req, res) => {
    res.json({
      listingTypes: LISTING_TYPES, hostTypes: HOST_TYPES, feePercent: FEE_PERCENT, escrowAccount: VACAY_ESCROW_ACCOUNT, experienceStatuses: EXPERIENCE_STATUSES, voidServiceTypes: VOID_SERVICE_TYPES,
    });
  });

  router.post('/listings', requireActor('hostId'), (req, res) => {
    try {
      res.status(201).json(createListing(store, req.body || {}));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Listing stays. They could be created and fetched by id, but never
  // enumerated — so a guest had no way to browse. Registered before
  // '/:id' would ever see it, since '/listings' is a literal path.
  router.get('/listings', (_req, res) => {
    res.json({ listings: store.listings });
  });

  router.get('/listings/:id', (req, res) => {
    const listing = getListing(store, Number(req.params.id));
    if (!listing) return res.status(404).json({ error: `no listing with id ${req.params.id}` });
    res.json(listing);
  });

  router.post('/experiences', requireActor('hostId'), (req, res) => {
    try {
      res.status(201).json(createExperience(store, req.body || {}));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/experiences/:id', (req, res) => {
    const experience = getExperience(store, Number(req.params.id));
    if (!experience) return res.status(404).json({ error: `no experience with id ${req.params.id}` });
    res.json(experience);
  });

  // Registered before the generic GET /:id below -- see this file's
  // own header for why the order here specifically matters.
  router.get('/experiences', (_req, res) => {
    res.json({ experiences: discoverExperiences(store, {}) });
  });

  router.post('/experience-bookings', requireActor('guestId'), async (req, res) => {
    try {
      res.status(201).json(await bookExperience(store, { ...req.body, transferFn: transferVCoin }));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/experience-bookings/:id', (req, res) => {
    const booking = getExperienceBooking(store, Number(req.params.id));
    if (!booking) return res.status(404).json({ error: `no experience booking with id ${req.params.id}` });
    res.json(booking);
  });

  router.post('/experience-bookings/:id/complete', requireExperienceParty(), async (req, res) => {
    try {
      res.json(await completeExperienceBooking(store, { bookingId: Number(req.params.id), transferFn: transferVCoin }));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/experience-bookings/:id/cancel', requireExperienceParty(), async (req, res) => {
    try {
      res.json(await cancelExperienceBooking(store, { bookingId: Number(req.params.id), transferFn: transferVCoin }));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/void-services/:id', (req, res) => {
    const request = getVoidServiceRequest(store, Number(req.params.id));
    if (!request) return res.status(404).json({ error: `no void service request with id ${req.params.id}` });
    res.json(request);
  });

  router.get('/sightseeing/:id', (req, res) => {
    const request = getSightseeingRequest(store, Number(req.params.id));
    if (!request) return res.status(404).json({ error: `no sightseeing request with id ${req.params.id}` });
    res.json(request);
  });

  // -- The booking resource itself: same word as the section, no
  // separate nested path, per the explicit "same thing" instruction.
  router.post('/', requireActor('guestId'), async (req, res) => {
    try {
      res.status(201).json(await createBooking(store, { ...req.body, transferFn: transferVCoin }));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/:id', (req, res) => {
    const booking = getBooking(store, Number(req.params.id));
    if (!booking) return res.status(404).json({ error: `no booking with id ${req.params.id}` });
    res.json(booking);
  });

  router.post('/:id/complete', requireStayParty(), async (req, res) => {
    try {
      res.json(await completeStay(store, { bookingId: Number(req.params.id), transferFn: transferVCoin }));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/:id/cancel', requireStayParty(), async (req, res) => {
    try {
      res.json(await cancelBooking(store, { bookingId: Number(req.params.id), transferFn: transferVCoin }));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/:id/void-services', requireGuest((id) => getBooking(store, id), 'booking'), async (req, res) => {
    try {
      res.status(201).json(await requestVoidService(store, {
        ...req.body, bookingId: Number(req.params.id), voidRequestFn: requestVoidJob,
      }));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/:id/void-services', (req, res) => {
    try {
      res.json({ requests: listVoidServiceRequests(store, Number(req.params.id)) });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/:id/sightseeing', requireGuest((id) => getBooking(store, id), 'booking'), async (req, res) => {
    try {
      res.status(201).json(await requestSightseeing(store, {
        ...req.body, bookingId: Number(req.params.id), voidHourlyRequestFn: requestVoidHourlyBooking,
      }));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/:id/sightseeing', (req, res) => {
    try {
      res.json({ requests: listSightseeingRequests(store, Number(req.params.id)) });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { createBookingsRouter };
