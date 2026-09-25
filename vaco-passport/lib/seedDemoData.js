// VACO Passport -- real presentation/demo seed data.
//
// Reuses the same demo business VASH TAP already seeds --
// `vash-tap/lib/seedDemoData.js`'s HUNT Barber Shop, businessId 9001 --
// so the demo tells one coherent story across both apps: the same real
// business has both a live Tap Point (VASH TAP) and a Business
// Passport (here), rather than two unrelated fabricated businesses.
//
// Real, not fabricated: the Passport below is created through the real,
// validating registerPassport/verifyPassport functions in lib/passport.js
// -- nothing here hand-constructs a store record that bypasses their
// validation.
//
// Real stub fetch functions, same reasoning as vash-tap's own
// seedDemoData.js (see its header): seeding runs at process boot,
// before there is any guarantee HVNTZ or VACA are reachable, so this
// does not make live cross-app calls. registerPassport/verifyPassport
// already accept businessFetchFn/identityFetchFn as injected
// dependencies in production -- this just points them at fixed demo
// answers instead of a live HTTP call.

const HUNT_BARBER_SHOP_ID = 9001;
const HUNT_BARBER_SHOP = { id: HUNT_BARBER_SHOP_ID, name: 'HUNT Barber Shop', ownerId: 'owner-hunt-barber-shop' };

async function demoBusinessFetchFn(businessId) {
  return businessId === HUNT_BARBER_SHOP_ID ? HUNT_BARBER_SHOP : null;
}

async function demoIdentityFetchFn(subjectType, subjectId) {
  return { subjectType, subjectId, verified: true };
}

// Real, idempotent seed -- only runs against a genuinely empty store
// (see server.js's own `store.passports.length === 0` gate), so a
// persisted store with a real Passport is never touched, and
// restarting the server twice never double-seeds.
async function seedDemoData(store, { registerPassport, verifyPassport }) {
  const passport = await registerPassport(store, {
    businessId: HUNT_BARBER_SHOP_ID,
    businessFetchFn: demoBusinessFetchFn,
  });
  await verifyPassport(store, {
    businessId: HUNT_BARBER_SHOP_ID,
    identityFetchFn: demoIdentityFetchFn,
  });

  console.log(`[vaco-passport] seeded a Passport for "${HUNT_BARBER_SHOP.name}" (business ${HUNT_BARBER_SHOP_ID}), Level: ${passport.level}.`);
  console.log(`[vaco-passport] try: curl http://localhost:${process.env.PORT || 8826}/api/passports/${HUNT_BARBER_SHOP_ID}`);

  return { businessId: HUNT_BARBER_SHOP_ID, passport };
}

module.exports = {
  HUNT_BARBER_SHOP_ID,
  HUNT_BARBER_SHOP,
  demoBusinessFetchFn,
  demoIdentityFetchFn,
  seedDemoData,
};
