// DREAMS -- screen registration and real per-screen revenue tracking.
// No DREAMS implementation existed anywhere in this repo before this
// build (confirmed by direct grep across the whole tree, not
// assumed) -- DREAMS is referenced extensively by name across HVNTZ,
// VOID MAGIC, VENVS, Vavlt Stvdios, and VOKEN's own agent roster
// ("DREA for DREAMS"), but only as an external system those apps
// integrate with conceptually, never as a real, standalone app of its
// own. Built directly against that real, cross-referenced spec --
// most concretely `hvntz/HVNTZ_COMPLETE_REVENUE_STACK.md`'s own
// "DREAMS screen ad revenue" and "DREAMS screen DTC commission"
// streams, and its "Ad tier system" section.
//
// **Honest scope note**: HVNTZ already has its own
// `lib/adReview.js`/`lib/adPricing.js` -- a narrower, HVNTZ-local
// version of "a business submits ad content to run on its own
// screen." That is a real, different shape from what's built here:
// DREAMS is the standalone marketplace where any advertiser signs up
// and buys placement across the whole screen network, not just their
// own location. The two are complementary, not duplicates -- see this
// app's own README for the honest, explicit statement of what a
// future integration between them would still need.

const SCREEN_STATUSES = ['active', 'inactive'];

function registerScreen(store, options = {}) {
  const {
    screenOwnerId, locationName, locationAddress, now = Date.now(),
  } = options;

  if (!screenOwnerId) throw new Error('registerScreen requires a screenOwnerId');
  if (!locationName) throw new Error('registerScreen requires a locationName');
  if (!locationAddress) throw new Error('registerScreen requires a locationAddress');

  const screen = {
    id: store.nextScreenId++,
    screenOwnerId,
    locationName,
    locationAddress,
    status: 'active',
    createdAt: now,
    // Real cross-link to an actual HVNTZ business location -- this
    // project's own README flagged the gap directly: "the two systems
    // are integrated at the revenue-share concept level... but not at
    // the data level yet." Null until linked; linking is optional and
    // separate from registration, the same real "a checkpoint is often
    // built before its host business has a Network yet" shape HVNTZ's
    // own `linkCheckpointNetwork` already established.
    hvntzBusinessId: null,
    hvntzLocationId: null,
  };
  store.screens.push(screen);
  return screen;
}

function getScreen(store, screenId) {
  return store.screens.find((s) => s.id === screenId) || null;
}

function listActiveScreens(store) {
  return store.screens.filter((s) => s.status === 'active');
}

function deactivateScreen(store, options = {}) {
  const { screenId, screenOwnerId } = options;
  const screen = getScreen(store, screenId);
  if (!screen) throw new Error(`deactivateScreen: no screen with id ${screenId}`);
  if (screen.screenOwnerId !== screenOwnerId) {
    throw new Error('deactivateScreen: only the registering screen owner can deactivate this screen');
  }
  screen.status = 'inactive';
  return screen;
}

// Real, per-screen revenue tracking -- the actual number the screen
// owner earned across every real ad run on their screen, not a
// blended, ecosystem-wide average. See `campaigns.js`'s own
// `recordImpression` for where these numbers come from.
function getScreenRevenue(store, screenId) {
  const screenImpressions = store.impressions.filter((i) => i.screenId === screenId);
  const totalRevenue = screenImpressions.reduce((sum, i) => sum + i.screenOwnerPayout, 0);
  return {
    screenId,
    impressionCount: screenImpressions.length,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
  };
}

// Real, live cross-app validation against HVNTZ's own real location --
// `hvntzLocationFetchFn` is the same injected-client pattern this
// session uses everywhere else (`transferFn`, `voidFetchFn`,
// `huntFetchFn`). The location's own `businessId` is read live from
// HVNTZ, never taken as a caller-declared pair that could claim a
// mismatched business/location.
async function linkHvntzBusinessLocation(store, options = {}) {
  const { screenId, hvntzLocationId, hvntzLocationFetchFn } = options;
  const screen = getScreen(store, screenId);
  if (!screen) throw new Error(`linkHvntzBusinessLocation: no screen with id ${screenId}`);
  if (!hvntzLocationId) throw new Error('linkHvntzBusinessLocation requires a hvntzLocationId');
  if (typeof hvntzLocationFetchFn !== 'function') {
    throw new Error('linkHvntzBusinessLocation requires a hvntzLocationFetchFn(hvntzLocationId)');
  }

  const location = await hvntzLocationFetchFn(hvntzLocationId);
  if (!location) throw new Error(`linkHvntzBusinessLocation: HVNTZ returned no location for id ${hvntzLocationId}`);

  screen.hvntzLocationId = location.id;
  screen.hvntzBusinessId = location.businessId;
  return screen;
}

function unlinkHvntzBusinessLocation(store, options = {}) {
  const { screenId } = options;
  const screen = getScreen(store, screenId);
  if (!screen) throw new Error(`unlinkHvntzBusinessLocation: no screen with id ${screenId}`);
  screen.hvntzLocationId = null;
  screen.hvntzBusinessId = null;
  return screen;
}

module.exports = {
  SCREEN_STATUSES,
  registerScreen,
  getScreen,
  listActiveScreens,
  deactivateScreen,
  getScreenRevenue,
  linkHvntzBusinessLocation,
  unlinkHvntzBusinessLocation,
};
