// VACAY FLIGHTS -- Flight inventory, built against the real, named
// comparable already flagged in VACAY_COMPARABLES.md as a real,
// unbuilt gap: "Flights+Stays bundling (Expedia's merchant-of-record
// model)". Expedia's real differentiator (per that doc, cross-
// referenced against VACAY Stays' own README) is acting as MERCHANT
// OF RECORD: Expedia -- not the airline -- charges the customer
// directly, then pays the airline its own wholesale/net rate,
// keeping the spread as margin. This is a genuinely different real
// economic model from every other VACAY division:
// - Stays/Experiences/Auto: a host/owner sets a price, VACAY takes a
//   percentage fee, the host/owner gets the rest.
// - Homes: no transaction fee at all -- an agent pays for a lead.
// - Flights: VACAY itself is the seller of record. There is no
//   "host." The airline is an external, real-world supplier (not a
//   VACAY user) paid its own separate net rate; VACAY keeps
//   `retailPrice - netRate` as real margin, not a percentage cut.
//
// `retailPrice >= netRate` is enforced structurally, not just
// described -- a real, sane business constraint (VACAY Flights can't
// sell a ticket below its own wholesale cost).

const CABIN_CLASSES = ['economy', 'premium-economy', 'business', 'first'];
const FLIGHT_STATUSES = ['scheduled', 'sold-out', 'cancelled'];

function listFlight(store, options = {}) {
  const {
    airline, flightNumber, origin, destination, departureAt, arrivalAt, cabinClass, capacity, netRate, retailPrice, now = Date.now(),
  } = options;

  if (!airline) throw new Error('listFlight requires an airline');
  if (!flightNumber) throw new Error('listFlight requires a flightNumber');
  if (!origin) throw new Error('listFlight requires an origin');
  if (!destination) throw new Error('listFlight requires a destination');
  if (origin === destination) throw new Error('listFlight: origin and destination must differ');
  if (!Number.isInteger(departureAt) || departureAt <= now) throw new Error('listFlight requires a real, future departureAt timestamp');
  if (!Number.isInteger(arrivalAt) || arrivalAt <= departureAt) throw new Error('listFlight requires arrivalAt after departureAt');
  if (!CABIN_CLASSES.includes(cabinClass)) throw new Error(`listFlight requires a cabinClass of ${CABIN_CLASSES.join(', ')}`);
  if (!Number.isInteger(capacity) || capacity < 1) throw new Error('listFlight requires a positive integer capacity');
  if (!Number.isFinite(netRate) || netRate <= 0) throw new Error('listFlight requires a positive netRate');
  if (!Number.isFinite(retailPrice) || retailPrice <= 0) throw new Error('listFlight requires a positive retailPrice');
  if (retailPrice < netRate) throw new Error('listFlight: retailPrice cannot be below netRate -- VACAY Flights cannot sell below its own cost');

  const flight = {
    id: store.nextFlightId++,
    airline,
    flightNumber,
    origin,
    destination,
    departureAt,
    arrivalAt,
    cabinClass,
    capacity,
    seatsAvailable: capacity,
    netRate,
    retailPrice,
    status: 'scheduled',
    createdAt: now,
  };
  store.flights.push(flight);
  return flight;
}

function getFlight(store, flightId) {
  return store.flights.find((f) => f.id === flightId) || null;
}

function searchFlights(store, options = {}) {
  const { origin, destination } = options;
  return store.flights.filter((f) => f.status === 'scheduled'
    && (!origin || f.origin === origin)
    && (!destination || f.destination === destination));
}

module.exports = {
  CABIN_CLASSES, FLIGHT_STATUSES, listFlight, getFlight, searchFlights,
};
