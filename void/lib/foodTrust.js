// VOID — Transparent-Kitchen Trust Signal.
// Source of truth: VOID_MEITUAN_MODEL_INTEGRATION.md's real "Raccoon
// Canteen" innovation: Meituan-supported kitchens with live,
// transparent kitchen streaming, directly addressing food safety trust
// through visibility -- "tying into HVNTZ's existing business trust/
// verification signals."
//
// Kept self-contained within VOID rather than making a live
// cross-service call into HVNTZ (a separate process/store in this
// session) -- a real, flagged simplification. The natural next
// integration step is wiring `hasLiveStream` into HVNTZ's own
// business-trust display, not attempted here.

function registerKitchenStream(store, options = {}) {
  const { businessId, streamUrl } = options;
  if (!businessId) throw new Error('registerKitchenStream requires a businessId');
  if (!streamUrl) throw new Error('registerKitchenStream requires a streamUrl');

  const existing = store.kitchenStreams.find((k) => k.businessId === businessId);
  if (existing) {
    existing.streamUrl = streamUrl;
    return existing;
  }
  const record = { businessId, streamUrl, registeredAt: Date.now() };
  store.kitchenStreams.push(record);
  return record;
}

function getKitchenTrustStatus(store, businessId) {
  const record = store.kitchenStreams.find((k) => k.businessId === businessId);
  return { businessId, hasLiveStream: !!record, streamUrl: record ? record.streamUrl : null };
}

module.exports = { registerKitchenStream, getKitchenTrustStatus };
