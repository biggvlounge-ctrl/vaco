// VDP — Customs: the government's real reach over everything that
// crosses into the country.
//
// Per direct instruction (9 Oct 2026): "the government wants to be
// involved in all transactions and in control of everything that
// comes in the country. This is what these illegal trade routes and
// smuggling routes will do." Read together with everything already
// built in `immigration.js`/`barter.js`, this names the real CAUSE,
// not a new effect: the government's own real desire for total
// control over incoming goods is exactly why a smuggling route or an
// untaxed barter trade is worth anything to the people using it. This
// module is the government's own HALF of that story -- the real,
// legitimate channel someone can go through instead -- not a rewrite
// of `barter.js`/`immigration.js`'s own smuggling mechanics, which
// stay exactly as real and exactly as untaxed/ungoverned as they
// already are. `immigration.js` already controls who crosses the
// border; this module is the same real control applied to what they
// bring, the missing other half.
//
// `declareImport`/`payCustomsDuty` is the legitimate path: a real
// declared good, a real duty owed, paid into the same real
// `GOVERNMENT_TREASURY_ACCOUNT` `taxes.js` already uses -- one
// government ledger, not two. `seizeSmuggledGoods` is the real
// enforcement half: what a robot patrol or customs officer does when
// they catch a good that never went through `declareImport` at all
// (read off `barter.js`'s own real inventory, by injection -- this
// module does not import `barter.js`, the same decoupled shape every
// cross-module reference in this directory already uses). The two
// halves are deliberately asymmetric: a declared good is cleared by
// paying; a seized good is simply recorded as caught -- there is no
// real document saying a seizure can be bought back, so none is
// invented here.
//
// `CUSTOMS_DUTY_RATE` is flagged interpretive, same footing every
// other unspecified rate in this app already stands on -- set higher
// than `taxes.js`'s own `DEFAULT_INCOME_TAX_RATE` on purpose: this is
// the government's own named priority ("in control of everything that
// comes in the country"), not an ordinary income tax.

export const CUSTOMS_DUTY_RATE = 0.2;

export function createCustomsStore() {
  return {
    declarations: [], nextDeclarationId: 1,
    seizures: [], nextSeizureId: 1,
  };
}

// The real, legitimate alternative to smuggling an item in -- a
// migrant or player who wants the government's own blessing on a good
// declares it, and owes a real, computed duty. `declaredValue` is the
// caller's own real figure (whatever VCoin price the good is worth);
// this module invents no price list of its own.
export function declareImport(store, {
  personId, itemName, quantity = 1, declaredValue, now = Date.now(),
} = {}) {
  if (!personId) throw new Error('declareImport requires a personId');
  if (!itemName) throw new Error('declareImport requires an itemName');
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('declareImport requires a positive integer quantity');
  }
  if (!Number.isFinite(declaredValue) || declaredValue < 0) {
    throw new Error(`declareImport requires a non-negative declaredValue, got ${declaredValue}`);
  }
  const declaration = {
    id: store.nextDeclarationId++,
    personId,
    itemName,
    quantity,
    declaredValue,
    dutyOwed: Math.round(declaredValue * CUSTOMS_DUTY_RATE),
    paid: false,
    clearedAt: null,
    declaredAt: now,
  };
  store.declarations.push(declaration);
  return declaration;
}

// Claim-before-pay, same ordering as every other paid action in this
// directory (`justice.js`'s own `payTicket`): marked paid before the
// transfer is awaited, rolled back if the transfer then fails.
export async function payCustomsDuty(store, declarationId, { transferFn, now = Date.now() } = {}) {
  const declaration = store.declarations.find((d) => d.id === declarationId);
  if (!declaration) throw new Error(`payCustomsDuty: no declaration #${declarationId}`);
  if (declaration.paid) throw new Error(`payCustomsDuty: declaration #${declarationId} is already paid`);
  if (typeof transferFn !== 'function') throw new Error('payCustomsDuty requires a transferFn');

  declaration.paid = true;
  declaration.clearedAt = now;

  try {
    await transferFn({ fromUserId: declaration.personId, amount: declaration.dutyOwed, reason: `vdp-customs-${declarationId}` });
  } catch (err) {
    declaration.paid = false;
    declaration.clearedAt = null;
    throw err;
  }

  return declaration;
}

export function declarationsFor(store, personId) {
  return store.declarations.filter((d) => d.personId === personId);
}

export function isCleared(store, declarationId) {
  const declaration = store.declarations.find((d) => d.id === declarationId);
  return Boolean(declaration && declaration.paid);
}

// The real enforcement half -- a good a robot patrol/customs officer
// actually caught that never went through `declareImport` at all.
// `itemName`/`quantity` are recorded as given, same free-text
// discipline `barter.js`'s own inventory already uses; the actual
// removal from whoever is holding it is the caller's own real side
// effect (`barter.js`'s `removeExoticGood`, by injection), not
// duplicated here -- this is the government's own real RECORD that a
// seizure happened, not a second inventory.
export function seizeSmuggledGoods(store, {
  personId, itemName, quantity = 1, seizedBy, now = Date.now(),
} = {}) {
  if (!personId) throw new Error('seizeSmuggledGoods requires a personId');
  if (!itemName) throw new Error('seizeSmuggledGoods requires an itemName');
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('seizeSmuggledGoods requires a positive integer quantity');
  }
  const seizure = {
    id: store.nextSeizureId++,
    personId,
    itemName,
    quantity,
    seizedBy: seizedBy || null,
    seizedAt: now,
  };
  store.seizures.push(seizure);
  return seizure;
}

export function seizuresFor(store, personId) {
  return store.seizures.filter((s) => s.personId === personId);
}

export function listSeizures(store) {
  return store.seizures;
}
