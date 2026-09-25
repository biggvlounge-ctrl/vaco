// VASH TAP -- real presentation/demo seed data.
//
// §46's own worked example, narrowed to the slice this build actually
// has: HUNT Barber Shop, Chair 1 through Chair 5, each assigned a
// different demo barber. Not seeded here: Maya's five outfit Taps and
// the DEGVCHI Jacket embedded Tap -- both belong to systems the §1/§55
// audit found do not exist yet (a real entertainer/product model), so
// seeding them would fabricate data with nothing real underneath it.
//
// Real, not fabricated: every Tap and assignment below is created
// through the real, validating functions in lib/tap.js -- nothing here
// hand-constructs a store record that bypasses their validation.
//
// Real stub fetch functions, same reasoning as hvntz/lib/seedDemoData.js
// (see its own header): seeding runs at process boot, before there is
// any guarantee HVNTZ or VACA are reachable, so this module does not
// make live cross-app calls. It uses the same minimal, real, in-memory
// stubs registerTap/assignTap already accept in production --
// businessFetchFn and identityFetchFn -- just pointed at fixed demo
// answers instead of a live HTTP call.
//
// No seeded payments: a Tap payment moves real VCoin through V3's own
// ledger (see server.js's payViaTap wiring), and that must not happen
// silently at boot. The demo proves the pay step by actually calling
// `POST /api/taps/:tapCode/pay` once the app is up, against a live V3 --
// exactly what a real tap does.

const HUNT_BARBER_SHOP_ID = 9001;
const HUNT_BARBER_SHOP = { id: HUNT_BARBER_SHOP_ID, name: 'HUNT Barber Shop', ownerId: 'owner-hunt-barber-shop' };

const DEMO_BARBERS = [
  { assignedIdentityId: 'demo-barber-1', label: 'Chair 1' },
  { assignedIdentityId: 'demo-barber-2', label: 'Chair 2' },
  { assignedIdentityId: 'demo-barber-3', label: 'Chair 3' },
  { assignedIdentityId: 'demo-barber-4', label: 'Chair 4' },
  { assignedIdentityId: 'demo-barber-5', label: 'Chair 5' },
];

async function demoBusinessFetchFn(businessId) {
  return businessId === HUNT_BARBER_SHOP_ID ? HUNT_BARBER_SHOP : null;
}

async function demoIdentityFetchFn(_subjectType, subjectId) {
  return { subjectType: 'vash-tap-assignee', subjectId, verified: true };
}

// Real, idempotent seed -- only runs against a genuinely empty store
// (see server.js's own `store.taps.length === 0` gate), so a persisted
// store with real taps is never touched, and restarting the server
// twice never double-seeds.
async function seedDemoData(store, { registerTap, assignTap }) {
  const taps = [];
  for (const barber of DEMO_BARBERS) {
    const tap = await registerTap(store, {
      tapType: 'business',
      objectType: 'chair',
      businessId: HUNT_BARBER_SHOP_ID,
      metadata: { label: barber.label, business: HUNT_BARBER_SHOP.name },
      businessFetchFn: demoBusinessFetchFn,
    });
    await assignTap(store, {
      tapCode: tap.tapCode,
      assignedIdentityId: barber.assignedIdentityId,
      createdBy: HUNT_BARBER_SHOP.ownerId,
      identityFetchFn: demoIdentityFetchFn,
    });
    taps.push(tap);
  }

  console.log(
    `[vash-tap] seeded ${taps.length} Tap Points for "${HUNT_BARBER_SHOP.name}" `
    + `(${taps.map((t) => t.tapCode).join(', ')}), each assigned a demo barber.`,
  );
  console.log(`[vash-tap] try: curl http://localhost:${process.env.PORT || 8825}/api/taps/${taps[0].tapCode}/resolve`);

  return { businessId: HUNT_BARBER_SHOP_ID, taps };
}

module.exports = {
  HUNT_BARBER_SHOP_ID,
  HUNT_BARBER_SHOP,
  DEMO_BARBERS,
  demoBusinessFetchFn,
  demoIdentityFetchFn,
  seedDemoData,
};
