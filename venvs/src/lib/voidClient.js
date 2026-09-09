// VENVS — VOID fulfillment client.
// Source of truth: VOID_SERVICE_VERTICALS_COMPARABLES.md's own
// "FULFILLMENT — VOID as shared delivery backend for ecosystem
// commerce" section, which names this exact gap directly: "CHOPZ SHOP
// already has a voidClient.createShipment() stub. VENVS Marketplace
// should route physical-good deliveries through this same layer — not
// yet connected anywhere in VENVS's documentation, this is new to
// add." This module closes that, and deliberately reuses CHOPZ SHOP's
// already-proven shape rather than inventing a second one: a real
// POST into VOID's own job marketplace on the `courier` vertical
// (that doc's own pick as the closest real fit for ecosystem
// commerce fulfillment), quantity 1, `unitPrice` = the real quoted
// shipping cost since `courier` is a flat-quote vertical.
//
// Same real frontend-to-service posture `v3Client.js` already
// established here (VENVS has no server of its own; it is a real
// client of the ecosystem's real services). Errors are thrown, never
// swallowed into a fake shipment id -- an unfulfilled order must stay
// visibly unfulfilled.

const VOID_API_URL = import.meta.env.VITE_VOID_API_URL || "http://localhost:8793";

export async function createShipment(sellerId, shippingCost) {
  if (!sellerId) {
    throw new Error("createShipment requires a sellerId");
  }
  if (typeof shippingCost !== "number" || shippingCost <= 0) {
    throw new Error("createShipment requires a positive shippingCost");
  }

  const res = await fetch(`${VOID_API_URL}/api/job`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      verticalId: "courier",
      customerId: sellerId,
      quantity: 1,
      unitPrice: shippingCost,
    }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || `createShipment failed (${res.status})`);
  }
  return body;
}

// Real read-back of a shipment's live status, so a VENVS order can
// show where its real VOID courier job actually is (requested ->
// matched -> accepted -> completed, or a real delivery-failed) rather
// than just recording an id and never looking at it again.
export async function getShipmentStatus(voidShipmentId) {
  if (!voidShipmentId) {
    throw new Error("getShipmentStatus requires a voidShipmentId");
  }
  const res = await fetch(`${VOID_API_URL}/api/job/${voidShipmentId}`);
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || `getShipmentStatus failed (${res.status})`);
  }
  return body;
}
