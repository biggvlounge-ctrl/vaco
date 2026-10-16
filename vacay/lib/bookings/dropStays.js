// VACAY -- Drop Stays, branded "Vacay Villas": VOID DROP's
// dropRoom/dropHome units, searchable from inside VACAY the same way
// a regular stay is. VACAY is the hospitality company; "Villas" is
// the real name for these container-built stays (founder's own
// correction -- not "Drop Hotel"). Real cross-app READ into VOID's
// own real asset/booking system (void/lib/voidDropBooking.js's
// `listAvailableDropAssetsNear`) -- not a second, parallel inventory.
// VACAY tracks nothing of its own here; VOID stays the one real
// system of record. Same shape `voidServices.js` already takes for
// its own VOID job requests: an injected function does the real
// network call, this module holds the one real decision around it.
//
// **The one real decision**: VOID has no single "Vacay Villas"
// category -- it has two real ones, `dropRoom` and `dropHome` (spec:
// "the drop homes, the drop hotel to a location"). Searching with no
// category means both, merged and sorted by real distance, not just
// whichever VOID happened to answer first.

const DROP_STAY_CATEGORIES = ['dropRoom', 'dropHome'];

async function searchDropStays(options = {}) {
  const {
    category = null, lat, lng, startDate, endDate, searchDropStaysFn,
  } = options;
  if (typeof searchDropStaysFn !== 'function') {
    throw new Error('searchDropStays requires a searchDropStaysFn');
  }
  const categories = category ? [category] : DROP_STAY_CATEGORIES;
  for (const c of categories) {
    if (!DROP_STAY_CATEGORIES.includes(c)) {
      throw new Error(`searchDropStays: invalid category "${c}" (expected one of ${DROP_STAY_CATEGORIES.join(', ')})`);
    }
  }

  const resultSets = await Promise.all(
    categories.map((c) => searchDropStaysFn({ category: c, lat, lng, startDate, endDate })),
  );
  return resultSets.flat().sort((a, b) => a.distanceKm - b.distanceKm);
}

module.exports = { DROP_STAY_CATEGORIES, searchDropStays };
