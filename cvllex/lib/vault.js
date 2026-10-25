// CVLLEX — vaulting and redemption: Courtyard.io's real model (vault
// a physical collectible, mint a digital twin as a redemption
// voucher, burn the twin and ship the physical item on redemption),
// applied to a CVLLEX production run.
//
// **The digital twin IS a real Cvltvre Card**, minted through VOKEN's
// existing, canonical `mintExternalEntityCard()` — `sourceApp:
// 'cvllex', sourceType: 'production-order'` (see VOKEN's
// `lib/cultureCards.js`, extended for this app). CVLLEX never mints
// its own competing token; it calls the one real place a Cvltvre Card
// comes from. This is a deliberate choice, not an oversight — VOKEN's
// own `VEX_VADO_RESTRUCTURING.md` records that VEX was once extracted
// into its own standalone service and folded back into VOKEN
// specifically because a network hop between a payment and an
// ownership transfer can leave a buyer who paid and owns nothing, with
// no reversal endpoint by design. CVLLEX stays standalone for
// everything that is genuinely its own job (production, vaulting,
// redemption); only the actual mint call crosses into VOKEN, injected
// exactly like every other cross-app call in this ecosystem.
//
// **What this module does NOT do, honestly.** It tracks a vaulted
// run's remaining unit count and records who redeemed a unit — it
// does NOT verify that the redeemer currently owns a specific edition
// of the linked Cvltvre Card before releasing a unit. VOKEN's card
// model has no "burned"/"redeemed" edition status to call into yet.
// Building real redemption-against-specific-edition-ownership is a
// named, deferred piece of work, not something stubbed to look solved.

const VAULT_STATUSES = ['vaulted', 'depleted'];

function getVaultedCollectible(store, vaultId) {
  return store.vaultedCollectibles.find((v) => v.id === vaultId) || null;
}

// The real bridge from a produced order to a real, minted Cvltvre
// Card. `mintCultureCardFn(order)` is VOKEN's real
// `POST /api/card/external` in production (sourceApp: 'cvllex',
// sourceType: 'production-order', externalRef: String(order.id)) and
// a fake in tests — the same injected-cross-app-call shape this whole
// ecosystem uses, never a direct import (VOKEN is a separate real
// process, reached over HTTP).
async function vaultProducedOrder(store, options = {}) {
  const { order, mintCultureCardFn } = options;
  if (!order) throw new Error('vaultProducedOrder requires the order');
  if (order.status !== 'produced') {
    throw new Error(`vaultProducedOrder: order ${order.id} is ${order.status}, not produced -- nothing real to vault yet`);
  }
  if (order.vaultId !== null) {
    throw new Error(`vaultProducedOrder: order ${order.id} is already vaulted (vault ${order.vaultId})`);
  }
  if (typeof mintCultureCardFn !== 'function') {
    throw new Error('vaultProducedOrder requires mintCultureCardFn(order)');
  }

  const card = await mintCultureCardFn(order);
  if (!card || card.id === undefined) {
    throw new Error('vaultProducedOrder: mintCultureCardFn did not return a real minted card with an id');
  }

  const vault = {
    id: store.nextVaultId++,
    orderId: order.id,
    creatorId: order.creatorId,
    itemType: order.itemType,
    totalUnits: order.quantity,
    remainingUnits: order.quantity,
    cultureCardId: card.id,
    status: 'vaulted',
    redemptions: [],
    createdAt: Date.now(),
  };
  store.vaultedCollectibles.push(vault);
  order.vaultId = vault.id;
  return vault;
}

// `shippingCost` is a real, caller-stated input (no shipping-rate
// vendor integration exists here any more than one exists for the
// production cost itself) passed straight to VOID's real courier
// vertical, same shape VENVS's own `voidClient.createShipment` already
// established (`POST /api/job`, `verticalId: 'courier'`).
// `specification` is a caller-stated engraving/customization note
// (e.g. "engrave: For Maria", "matte finish"), recorded for the real
// human operator who confirms production the same honest way
// `vendorNote` already works on a production order — there is no real
// engraving or finishing vendor integration here, and this field does
// not pretend otherwise.
function requireOptionalString(value, field) {
  if (value !== null && typeof value !== 'string') {
    throw new Error(`redeemUnit: ${field} must be a string when given`);
  }
}

async function redeemUnit(store, options = {}) {
  const {
    vaultId, redeemerId, shippingCost, voidRequestFn, specification = null, now = Date.now(),
  } = options;
  const vault = getVaultedCollectible(store, vaultId);
  if (!vault) throw new Error(`redeemUnit: no vaulted collectible with id ${vaultId}`);
  if (!redeemerId) throw new Error('redeemUnit requires a redeemerId');
  if (vault.remainingUnits <= 0) throw new Error(`redeemUnit: vault ${vaultId} has no units left to redeem`);
  if (!Number.isFinite(shippingCost) || shippingCost <= 0) {
    throw new Error('redeemUnit requires a positive shippingCost');
  }
  if (typeof voidRequestFn !== 'function') {
    throw new Error('redeemUnit requires voidRequestFn(redeemerId, shippingCost)');
  }
  requireOptionalString(specification, 'specification');

  // Claimed before the real shipment request goes out, same
  // claim-before-pay discipline this ecosystem's settleOnce.js
  // enforces for money -- a concurrent second redeemer of the last
  // unit must see it already gone, not race a real courier job into
  // existence for a unit that was never really available.
  vault.remainingUnits -= 1;
  if (vault.remainingUnits === 0) vault.status = 'depleted';

  const job = await voidRequestFn(redeemerId, shippingCost);

  const redemption = {
    redeemerId,
    shippingCost,
    voidShipmentId: String(job.id),
    // **Real, not fabricated.** `#N/totalUnits` is normally a claim
    // about mint order, and mint order is only knowable at mint time —
    // this vault mints one card for the whole run, not one per unit,
    // so no real per-unit mint order exists to report (see this
    // file's own header, and
    // VOKEN_VALUE_DISPLAY_CARD_INDUSTRY_COMPARABLES.md's "On serial
    // numbering"). What IS real and knowable here is claim order: the
    // Nth unit actually redeemed, counted from when this vault opened.
    // Framed as that, not as mint order.
    serialNumber: vault.totalUnits - vault.remainingUnits,
    editionSize: vault.totalUnits,
    specification,
    redeemedAt: now,
  };
  vault.redemptions.push(redemption);
  return { vault, redemption };
}

module.exports = {
  VAULT_STATUSES,
  getVaultedCollectible,
  vaultProducedOrder,
  redeemUnit,
};
