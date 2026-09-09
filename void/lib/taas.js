// VOID — Technology-as-a-Service (TaaS) subscriptions.
// Source of truth: QUICK_INNOVATION_THREAD.md §5. Real branding
// correction stated directly in the source doc: VVI (the grandparent
// company) never appears customer-facing -- every subscription is
// `brandedAs: 'vaco'`, fixed, not a caller-settable value a client
// could accidentally mis-brand.
//
// **Real, honest scope note**: the source doc also describes a
// "Proactive hardware suggestions" feature (a business's AI advisor
// proactively recommending TaaS hardware -- a restaurant gets smart
// tables, an outdoor-facing venue gets smart benches) as "a real,
// direct extension of the already-established proactive business
// suggestion engine."
//
// Precisely what does and doesn't exist, checked directly rather than
// assumed: `vaco-analytics/intelligence.js` IS a real, built
// proactive engine -- the full Data Collection -> Pattern Learning
// (`computeBaseline`/`detectAnomaly`) -> Notification & Response
// (`routeAlert`/`evaluateMetric`) loop. But it operates on
// *ecosystem metrics*, with no business dimension at all (no
// `businessId` anywhere in that module). So there is no per-business
// suggestion engine to extend, which is what a venue-type-matched
// hardware recommendation actually requires.
//
// That makes this a real, bounded piece of future work rather than a
// from-scratch invention: add a business dimension to the existing
// intelligence loop, then match hardware to venue type the same way
// HVNTZ's own DREA already matches ad content to venue type.
// Deferred here, not faked. `TaaSSubscription` itself (the real,
// buildable half) is implemented in full below.

const ACQUISITION_MODELS = ['outright-purchase', 'lease', 'subscription-addon'];
const BILLING_MODELS = ['one-time', 'recurring-lease', 'bundled-subscription'];
// Real, fixed mapping -- an acquisition model implies exactly one
// real billing model; never left for a caller to mismatch the two.
const ACQUISITION_TO_BILLING = {
  'outright-purchase': 'one-time',
  lease: 'recurring-lease',
  'subscription-addon': 'bundled-subscription',
};
const TECHNOLOGY_TYPES = ['dream-screen', 'port-station', 'ai-assistant-access', 'smart-table', 'smart-bench'];

function registerTaasSubscription(store, options = {}) {
  const { clientBusinessId, technologyProvided, acquisitionModel, monthlyRecurringRevenue = 0 } = options;
  if (!clientBusinessId) throw new Error('registerTaasSubscription requires a clientBusinessId');
  if (!Array.isArray(technologyProvided) || technologyProvided.length === 0) {
    throw new Error('registerTaasSubscription requires at least one item in technologyProvided');
  }
  for (const tech of technologyProvided) {
    if (!TECHNOLOGY_TYPES.includes(tech)) {
      throw new Error(`registerTaasSubscription: invalid technology "${tech}" (expected one of ${TECHNOLOGY_TYPES.join(', ')})`);
    }
  }
  if (!ACQUISITION_MODELS.includes(acquisitionModel)) {
    throw new Error(`registerTaasSubscription: invalid acquisitionModel "${acquisitionModel}" (expected one of ${ACQUISITION_MODELS.join(', ')})`);
  }
  const billingModel = ACQUISITION_TO_BILLING[acquisitionModel];
  if (billingModel !== 'one-time' && (!Number.isFinite(monthlyRecurringRevenue) || monthlyRecurringRevenue <= 0)) {
    throw new Error(`registerTaasSubscription: acquisitionModel "${acquisitionModel}" requires a positive monthlyRecurringRevenue`);
  }
  if (billingModel === 'one-time' && monthlyRecurringRevenue !== 0) {
    throw new Error('registerTaasSubscription: "outright-purchase" must have monthlyRecurringRevenue of 0');
  }

  const subscription = {
    id: store.nextTaasSubscriptionId++,
    clientBusinessId,
    brandedAs: 'vaco', // fixed -- VVI never appears customer-facing, per the source doc verbatim
    technologyProvided,
    acquisitionModel,
    billingModel,
    monthlyRecurringRevenue,
    createdAt: Date.now(),
  };
  store.taasSubscriptions.push(subscription);
  return subscription;
}

function getTaasSubscription(store, subscriptionId) {
  return store.taasSubscriptions.find((s) => s.id === subscriptionId) || null;
}

function getTaasSubscriptionsForClient(store, clientBusinessId) {
  return store.taasSubscriptions.filter((s) => s.clientBusinessId === clientBusinessId);
}

module.exports = {
  ACQUISITION_MODELS,
  BILLING_MODELS,
  TECHNOLOGY_TYPES,
  registerTaasSubscription,
  getTaasSubscription,
  getTaasSubscriptionsForClient,
};
