// VOID — Driver/Fleet Management.
// Source of truth: VOID_AMAZON_LOGISTICS_INTEGRATION.md's real two-tier
// model: the existing gig-driver pool (Amazon Flex's real role —
// flexible overflow/peak capacity, 1099, own vehicle) plus a new
// "VOID DSP" tier (Amazon Delivery Service Partner's real role —
// small businesses running branded, W-2-driver fleets on fixed daily
// routes for reliable core coverage). VOID cannot partner with
// Amazon's real DSP program directly (individual-applicant-only, no
// company path) -- this is VOID's own independent structure modeled on
// the same real approach, not an integration with Amazon's system.

const DRIVER_TIERS = ['gig', 'dsp'];
const DSP_STARTUP_CAPITAL_REQUIRED = 30000; // real bar to apply, per Amazon's actual DSP program

function registerGigDriver(store, options = {}) {
  const { driverId, certifiedVerticals = [] } = options;
  if (!driverId) throw new Error('registerGigDriver requires a driverId');
  if (!Array.isArray(certifiedVerticals)) {
    throw new Error('registerGigDriver requires certifiedVerticals to be an array');
  }
  const existing = store.gigDrivers.find((d) => d.driverId === driverId);
  if (existing) {
    existing.certifiedVerticals = certifiedVerticals;
    return existing;
  }
  const driver = { driverId, tier: 'gig', certifiedVerticals, registeredAt: Date.now() };
  store.gigDrivers.push(driver);
  return driver;
}

function getGigDriver(store, driverId) {
  return store.gigDrivers.find((d) => d.driverId === driverId) || null;
}

// The real, reliable-core-coverage tier: a small business (potentially
// an HVNTZ-onboarded one, extending the existing Affiliate Network
// relationship) runs a branded fleet of W-2 drivers on fixed routes.
function registerVoidDSP(store, options = {}) {
  const { operatorBusinessId, startupCapitalRequired = DSP_STARTUP_CAPITAL_REQUIRED } = options;
  if (!operatorBusinessId) throw new Error('registerVoidDSP requires an operatorBusinessId');
  if (!Number.isFinite(startupCapitalRequired) || startupCapitalRequired < DSP_STARTUP_CAPITAL_REQUIRED) {
    throw new Error(`registerVoidDSP requires startupCapitalRequired of at least ${DSP_STARTUP_CAPITAL_REQUIRED} (Amazon DSP's real bar to apply)`);
  }
  const dsp = {
    id: store.nextDspId++,
    operatorBusinessId,
    startupCapitalRequired,
    driverIds: [],
    vehicleFleetIds: [],
    assignedRoutes: [],
    createdAt: Date.now(),
  };
  store.voidDSPs.push(dsp);
  return dsp;
}

function getVoidDSP(store, dspId) {
  return store.voidDSPs.find((d) => d.id === dspId) || null;
}

function addDriverToDSP(store, options = {}) {
  const { dspId, driverId } = options;
  const dsp = getVoidDSP(store, dspId);
  if (!dsp) throw new Error(`addDriverToDSP: no VOID DSP with id ${dspId}`);
  if (!driverId) throw new Error('addDriverToDSP requires a driverId');
  if (!dsp.driverIds.includes(driverId)) dsp.driverIds.push(driverId);
  return dsp;
}

function addVehicleToDSP(store, options = {}) {
  const { dspId, vehicleId } = options;
  const dsp = getVoidDSP(store, dspId);
  if (!dsp) throw new Error(`addVehicleToDSP: no VOID DSP with id ${dspId}`);
  if (!vehicleId) throw new Error('addVehicleToDSP requires a vehicleId');
  if (!dsp.vehicleFleetIds.includes(vehicleId)) dsp.vehicleFleetIds.push(vehicleId);
  return dsp;
}

function assignRouteToDSP(store, options = {}) {
  const { dspId, routeId } = options;
  const dsp = getVoidDSP(store, dspId);
  if (!dsp) throw new Error(`assignRouteToDSP: no VOID DSP with id ${dspId}`);
  if (!routeId) throw new Error('assignRouteToDSP requires a routeId');
  if (!dsp.assignedRoutes.includes(routeId)) dsp.assignedRoutes.push(routeId);
  return dsp;
}

module.exports = {
  DRIVER_TIERS,
  DSP_STARTUP_CAPITAL_REQUIRED,
  registerGigDriver,
  getGigDriver,
  registerVoidDSP,
  getVoidDSP,
  addDriverToDSP,
  addVehicleToDSP,
  assignRouteToDSP,
};
