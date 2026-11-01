import { TOWN_NAME } from './town.js';

// VDP — venues: a promoter renting a real gym or stadium for a real
// event, and the real revenue/finance/cost that event produces.
//
// Per direct instruction (14 Oct 2026): "somebody could be a
// promoter, rent the gym out or the stadium... make sure it also
// shows... revenue, finance, cost." `jobs.js` already covers
// `referee`/`announcer` as real shift work at the Combat Sports
// District's own payroll account -- a promoter is a different real
// thing, an entrepreneur who pays a real cost to use a space for one
// event rather than clocking into a shift, so it gets its own module
// rather than a forced fit into the shift engine.
//
// **This is not `property.js`.** That module is real estate someone
// owns and operates indefinitely (a home, a business, a warehouse). A
// promoter does not own the stadium -- they book it for one event and
// pay for that use, the same real distinction a wedding venue rental
// draws from a mortgage. Modeling it as ownership would mean a
// one-night promoter either buying the stadium outright or squatting
// in someone else's business property, neither of which is the real
// thing being asked for.
//
// **`VENUES` is a small, flagged-invented catalog**, the same
// discipline `cardMarketPrice.js`'s own constants already carry --
// real capacities and rental costs for a game economy, not a
// transcription of any confirmed design document. `GYM`, the cheap
// small-capacity option, and `STADIUM`, the expensive large one, are
// the two the direct instruction names by name ("rent the gym out or
// the stadium").
export const VENUES = {
  'combat-sports-gym': {
    name: 'Combat Sports District Gym', capacity: 150, rentalCostPerEvent: 200,
  },
  'downtown-stadium': {
    name: `${TOWN_NAME} Downtown Stadium`, capacity: 5000, rentalCostPerEvent: 4000,
  },
};

export const VENUE_PAYROLL_ACCOUNT = 'vdp-venues-office';

export class VenueError extends Error {}

export function listVenues() {
  return Object.entries(VENUES).map(([id, venue]) => ({ id, ...venue }));
}

export function getVenue(venueId) {
  const venue = VENUES[venueId];
  if (!venue) throw new VenueError(`venues: no venue "${venueId}"`);
  return venue;
}

export function createVenueStore() {
  return { bookings: [], nextBookingId: 1 };
}

export function getBooking(store, bookingId) {
  return store.bookings.find((b) => b.id === bookingId) || null;
}

// A promoter pays the venue's own real rental cost up front, the same
// claim-before-pay ordering this district's own `combatSports.js`/
// `liveWrestling.js` already use for every other real payment:
// `transferFn` is awaited before the booking is recorded, so a failed
// payment never leaves a free booking behind.
export async function bookVenue(store, { promoterId, venueId, label = null, matchId = null, transferFn, now = Date.now() } = {}) {
  const a = 'bookVenue';
  if (!promoterId) throw new VenueError(`${a} requires a promoterId`);
  const venue = getVenue(venueId);
  if (typeof transferFn !== 'function') {
    throw new VenueError(`${a} requires a transferFn({fromUserId, toUserId, amount, reason})`);
  }

  await transferFn({
    fromUserId: promoterId, toUserId: VENUE_PAYROLL_ACCOUNT, amount: venue.rentalCostPerEvent,
    reason: `venue_rental:${venueId}`,
  });

  const booking = {
    id: store.nextBookingId++,
    promoterId,
    venueId,
    label,
    matchId,
    rentalCost: venue.rentalCostPerEvent,
    ticketPrice: null,
    ticketsSold: 0,
    createdAt: now,
  };
  store.bookings.push(booking);
  return booking;
}

// Only the promoter who booked the event prices its own tickets --
// the real resource-ownership check every other owner-gated action in
// this district already draws (`combatSports.js`'s own header on
// "who may act on this" split).
export function setTicketPrice(store, bookingId, promoterId, price) {
  const a = 'setTicketPrice';
  const booking = getBooking(store, bookingId);
  if (!booking) throw new VenueError(`${a}: no booking ${bookingId}`);
  if (booking.promoterId !== promoterId) {
    throw new VenueError(`${a}: only this event's own promoter may set its ticket price`);
  }
  if (!Number.isFinite(price) || price <= 0) {
    throw new VenueError(`${a} requires a positive price`);
  }
  booking.ticketPrice = price;
  return booking;
}

// A real ticket sale: the buyer pays the promoter directly (not the
// venue -- the venue was already paid its rental cost at booking
// time), the same buyer-to-seller shape `marketplace.js`'s own
// checkout draws for a platform-free direct sale. Capped at the real
// venue capacity -- a sold-out gym cannot oversell, the same posture
// `marketplace.js`'s own limited-edition check already takes before
// a buyer is ever charged.
export async function sellTicket(store, bookingId, { buyerId, transferFn } = {}) {
  const a = 'sellTicket';
  const booking = getBooking(store, bookingId);
  if (!booking) throw new VenueError(`${a}: no booking ${bookingId}`);
  if (booking.ticketPrice === null) {
    throw new VenueError(`${a}: this event has no ticket price set yet`);
  }
  if (!buyerId) throw new VenueError(`${a} requires a buyerId`);
  if (typeof transferFn !== 'function') {
    throw new VenueError(`${a} requires a transferFn({fromUserId, toUserId, amount, reason})`);
  }
  const venue = getVenue(booking.venueId);
  if (booking.ticketsSold >= venue.capacity) {
    throw new VenueError(`${a}: ${venue.name} is sold out (capacity ${venue.capacity})`);
  }

  await transferFn({
    fromUserId: buyerId, toUserId: booking.promoterId, amount: booking.ticketPrice,
    reason: `venue_ticket:${bookingId}`,
  });
  booking.ticketsSold += 1;
  return booking;
}

// The real finance view the direct instruction asked for -- derived,
// never stored redundantly, the same "read the real result, never
// recompute it elsewhere" posture `leaderboards.js`'s own header
// already draws, just inverted: here the derivation itself IS the
// real, honest fact, computed fresh from the booking's own real
// numbers every time rather than cached and risking drift.
export function eventFinance(store, bookingId) {
  const booking = getBooking(store, bookingId);
  if (!booking) throw new VenueError(`eventFinance: no booking ${bookingId}`);
  const ticketRevenue = booking.ticketPrice !== null ? booking.ticketsSold * booking.ticketPrice : 0;
  return {
    bookingId: booking.id,
    venueId: booking.venueId,
    promoterId: booking.promoterId,
    rentalCost: booking.rentalCost,
    ticketsSold: booking.ticketsSold,
    ticketPrice: booking.ticketPrice,
    ticketRevenue,
    netProfit: ticketRevenue - booking.rentalCost,
  };
}

export function bookingsByPromoter(store, promoterId) {
  return store.bookings.filter((b) => b.promoterId === promoterId);
}
