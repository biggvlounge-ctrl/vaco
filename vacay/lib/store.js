// VACAY -- the one consolidated store for the whole app, per explicit
// instruction: one big app, with different sections inside it, not
// five separate apps. Each section gets its own real, isolated
// namespace -- no shared arrays/counters between sections, the same
// real separation the previous standalone-app split already had, just
// nested under one object instead of spread across five processes.
// Every section's own lib/*.js files are completely unaware of this
// nesting -- they still just take "a store" with their own expected
// fields, so `lib/bookings/*.js` gets `store.bookings`,
// `lib/home/*.js` gets `store.home`, and so on. Zero lib-level logic
// changed by this merge, only how the store is composed and handed
// out.

function createVacayStore() {
  return {
    bookings: {
      listings: [],
      nextListingId: 1,
      bookings: [],
      nextBookingId: 1,
      experiences: [],
      nextExperienceId: 1,
      experienceBookings: [],
      nextExperienceBookingId: 1,
      voidServiceRequests: [],
      nextVoidServiceRequestId: 1,
      sightseeingRequests: [],
      nextSightseeingRequestId: 1,
    },
    home: {
      listings: [],
      nextListingId: 1,
      leads: [],
      nextLeadId: 1,
    },
    auto: {
      vehicles: [],
      nextVehicleId: 1,
      rentals: [],
      nextRentalId: 1,
      forSaleListings: [],
      nextForSaleListingId: 1,
      fleetVehicles: [],
      nextFleetVehicleId: 1,
      fleetRentals: [],
      nextFleetRentalId: 1,
    },
    flights: {
      flights: [],
      nextFlightId: 1,
      flightBookings: [],
      nextFlightBookingId: 1,
    },
  };
}

module.exports = { createVacayStore };
