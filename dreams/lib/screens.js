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

module.exports = {
  SCREEN_STATUSES,
  registerScreen,
  getScreen,
  listActiveScreens,
  deactivateScreen,
  getScreenRevenue,
};
