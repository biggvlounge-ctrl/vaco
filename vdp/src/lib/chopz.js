// VENVS — CHOPZ District.
// Source of truth: CLAUDE.md §4: "8 leasable retail units across 7
// business categories. Lease a shop, run it yourself (instant-payout
// shifts on cooldown) or staff it with a category-specific named AI
// employee (passive income, real elapsed-time math)."
//
// **Real, flagged naming collision, not a duplicate**: this "CHOPZ
// District" (8 leasable retail kiosks) is a genuinely different real
// feature from the actual standalone `chopz/` app elsewhere in this
// monorepo (a TikTok-style short-form-video app with its own real
// server) -- the two share a name purely because VENVS's own CLAUDE.md
// §4 happened to call this retail-kiosk concept "CHOPZ" independently
// of the later, separate ecosystem app of the same name. Checked
// directly, not assumed: this module's own local `createChopz()` store
// is entirely client-side and never calls the real `chopz/server.js`
// API. The real video app now has its own real walkable district too
// (`world.js`'s `chopz` entry, `ChopzShortsView.jsx` -- deliberately
// named "Shorts" to keep the two apart in code and on screen). Both
// are real, both are kept, per direct instruction: this district is
// "ok, we just will center it around chopz shop sellers and screen dtc
// shops" -- its mechanics (lease, self-run shift, AI employee) stay
// exactly as they were; only its categories were re-themed to actually
// match the real CHOPZ brand instead of the generic retail names this
// module started with.
//
// **Categories now mirror the real CHOPZ (TikTok Shop) seller niches**
// -- real top-selling categories on that model (beauty & personal
// care, apparel, electronics/gadgets, home & kitchen, toys & hobbies),
// not invented ones -- plus a second group, screen-based DTC
// storefronts, the same direct-to-consumer-advertising concept DREAMS
// (`dreamsClient.js`) already monetizes elsewhere in VDP. This module
// does not call DREAMS' real API (same "entirely client-side, no
// duplicated ledger" posture already established above) -- a
// `screen_dtc_shop` unit here is a themed kiosk slot, not a second
// screen registry.
//
// No source doc specifies lease cost, shift payout, cooldown length,
// or AI-employee earn rate -- every constant below is invented and
// flagged as interpretive, same posture as Phase 5's world constants.
// CLAUDE.md §4's original "7 business categories" is now 6 (beauty,
// apparel, gadgets, home, toys, screen-DTC) after the re-theme above;
// the 8-units split (two categories get 2 units each) is interpretive,
// same as it always was.
//
// leaseUnit/runShift/collectEarnings reuse the same injected
// transferFn pattern as every previous phase's real-money functions,
// for the same reason (plain-Node testability, decoupled from
// v3Client.js's Vite-only import.meta.env).
//
// **Creation before distribution, per direct instruction**: "everything
// that has distribution must also have a creation process... people
// have to create those things." Every unit here used to pay out on
// every shift/AI-employee collection with nothing ever created or
// sourced -- the same gap Food District had before its own real
// inventory pass. Each unit now carries real `stock`: a self-run shift
// or an AI-employee collection both require `stock > 0` and consume
// one real unit of it, refusing (before any payout) once a unit sells
// out. `restockUnit()` is the real sourcing step -- per CHOPZ's own
// real data model (`vxllage/VXLLAGE_CHOPZ_VACAY_ARCHITECTURE.md`'s
// `Product { id, sellerId, name, price, ... }`), a CHOPZ seller
// sources/lists their own product, so this is a user-funded leg (the
// owner pays, like `leaseUnit`'s own rent), not a platform-funded one
// -- no new payoutFn-shaped route needed.

const CATEGORIES = [
  'beauty_seller',
  'apparel_seller',
  'gadgets_seller',
  'home_seller',
  'toys_seller',
  'screen_dtc_shop',
];

const UNIT_TEMPLATE = [
  { category: 'beauty_seller' },
  { category: 'beauty_seller' }, // beauty & personal care is CHOPZ's single largest real seller niche, the one category with 2 of the 8 units
  { category: 'apparel_seller' },
  { category: 'gadgets_seller' },
  { category: 'home_seller' },
  { category: 'toys_seller' },
  { category: 'screen_dtc_shop' },
  { category: 'screen_dtc_shop' },
];

const LEASE_COST = 50;
const SHIFT_PAYOUT = 15;
const SHIFT_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours
const AI_EMPLOYEE_RATE_PER_HOUR = 3;
const PLATFORM_USER_ID = 'venvs-platform';

const STARTING_STOCK = 5;
const RESTOCK_BATCH_SIZE = 5;
const RESTOCK_COST = 20;

// **Why platform-funded legs take a separate function, and why the
// browser never gets one.**
//
// This module runs in the browser, and its store lives in React state.
// Some of the money it moves is the *user's own* — a buyer paying, a
// tenant paying rent — and V3 authorises that from the user's Shield
// session, because `requireActor('fromUserId')` matches the session
// against the payer. A browser may legitimately instruct those.
//
// The rest is the **platform paying out**: a seller's share, an
// author's royalty, a shift payout. A browser must never be able to
// instruct those, and no credential fixes it — if this client could
// authenticate as the platform, any user could drain the platform
// account. VDP's CHOPZ shift payout is the sharp example: it moves 15
// VCoin from the platform to the signed-in user, rate-limited by a
// cooldown stored in browser memory that a page reload clears.
//
// So the two are separated by construction. `transferFn` moves the
// user's own money. `payoutFn` moves the platform's, and only a
// backend holding a service credential can supply one — no component
// in this app does, and none should.
//
// **A flow with any platform leg refuses entirely rather than settling
// half.** Charging the buyer and not paying the author is precisely
// the partial-settlement defect the ecosystem-wide sweep removed
// everywhere else; reintroducing it here to keep a demo working would
// be the worst of both. See `dev-docs/BROWSER_INITIATED_MONEY.md`.
function requirePayoutFn(payoutFn, operation) {
  if (typeof payoutFn !== 'function') {
    throw new Error(
      `${operation}: this pays out from the platform account, which a browser must not instruct. `
      + 'It needs a backend holding a service credential to supply payoutFn(fromUserId, toUserId, '
      + 'amount, reason) -- see dev-docs/BROWSER_INITIATED_MONEY.md.',
    );
  }
}


export function createChopz() {
  return {
    units: UNIT_TEMPLATE.map((u, i) => ({
      id: i + 1,
      category: u.category,
      ownerId: null,
      mode: null, // 'self_run' | 'ai_employee', null until leased
      employeeName: null,
      lastShiftAt: null,
      lastCollectedAt: null,
      stock: STARTING_STOCK,
    })),
  };
}

export function getStock(store, unitId) {
  const unit = getUnit(store, unitId);
  return unit ? unit.stock : 0;
}

// The real sourcing step a distributed sale depends on -- a CHOPZ
// seller lists/sources their own product (per CHOPZ's own real
// `Product` model), so the owner pays for it, same direction as
// `leaseUnit`'s own rent, not a platform-funded leg.
export async function restockUnit(store, options = {}) {
  const { unitId, ownerId, transferFn, now = Date.now() } = options;

  const unit = getUnit(store, unitId);
  if (!unit || unit.ownerId === null) {
    throw new Error(`restockUnit: no leased unit with id ${unitId}`);
  }
  if (unit.ownerId !== ownerId) {
    throw new Error(`restockUnit: unit ${unitId} is not leased by "${ownerId}"`);
  }
  if (typeof transferFn !== 'function') {
    throw new Error('restockUnit requires a transferFn(fromUserId, toUserId, amount, reason)');
  }

  await transferFn(ownerId, PLATFORM_USER_ID, RESTOCK_COST, `venvs_chopz_restock:${unitId}`);

  unit.stock += RESTOCK_BATCH_SIZE;
  return { unitId, batchSize: RESTOCK_BATCH_SIZE, stock: unit.stock, restockedAt: now };
}

export function getUnit(store, unitId) {
  return store.units.find((u) => u.id === unitId) || null;
}

export function getAvailableUnits(store) {
  return store.units.filter((u) => u.ownerId === null);
}

export function getOwnedUnits(store, ownerId) {
  return store.units.filter((u) => u.ownerId === ownerId);
}

export async function leaseUnit(store, options = {}) {
  const { unitId, ownerId, transferFn } = options;
  if (typeof transferFn !== 'function') {
    throw new Error('leaseUnit requires a transferFn(fromUserId, toUserId, amount, reason)');
  }
  const unit = getUnit(store, unitId);
  if (!unit) {
    throw new Error(`leaseUnit: no unit with id ${unitId}`);
  }
  if (unit.ownerId !== null) {
    throw new Error(`leaseUnit: unit ${unitId} is already leased`);
  }
  if (!ownerId) {
    throw new Error('leaseUnit requires an ownerId');
  }

  await transferFn(ownerId, PLATFORM_USER_ID, LEASE_COST, `venvs_chopz_lease:${unitId}`);
  unit.ownerId = ownerId;
  unit.mode = 'self_run';
  return unit;
}

export async function runShift(store, options = {}) {
  const { unitId, payoutFn, now = Date.now() } = options;
  requirePayoutFn(payoutFn, 'runShift');

  const unit = getUnit(store, unitId);
  if (!unit || unit.ownerId === null) {
    throw new Error(`runShift: no leased unit with id ${unitId}`);
  }
  if (unit.mode !== 'self_run') {
    throw new Error(`runShift: unit ${unitId} is staffed with an AI employee, not run by the owner`);
  }
  if (unit.lastShiftAt !== null && now - unit.lastShiftAt < SHIFT_COOLDOWN_MS) {
    const remainingMs = SHIFT_COOLDOWN_MS - (now - unit.lastShiftAt);
    throw new Error(`runShift: unit ${unitId} is on cooldown for ${Math.ceil(remainingMs / 60000)} more minute(s)`);
  }
  if (unit.stock <= 0) {
    throw new Error(`runShift: unit ${unitId} has nothing left to sell -- restock first`);
  }

  await payoutFn(PLATFORM_USER_ID, unit.ownerId, SHIFT_PAYOUT, `venvs_chopz_shift:${unitId}`);
  unit.lastShiftAt = now;
  unit.stock -= 1;
  return { unitId, payout: SHIFT_PAYOUT, nextAvailableAt: now + SHIFT_COOLDOWN_MS, stock: unit.stock };
}

export function staffWithAIEmployee(store, unitId, employeeName, now = Date.now()) {
  const unit = getUnit(store, unitId);
  if (!unit || unit.ownerId === null) {
    throw new Error(`staffWithAIEmployee: no leased unit with id ${unitId}`);
  }
  if (!employeeName) {
    throw new Error('staffWithAIEmployee requires an employeeName');
  }
  unit.mode = 'ai_employee';
  unit.employeeName = employeeName;
  unit.lastCollectedAt = now;
  return unit;
}

export function switchToSelfRun(store, unitId, now = Date.now()) {
  const unit = getUnit(store, unitId);
  if (!unit || unit.ownerId === null) {
    throw new Error(`switchToSelfRun: no leased unit with id ${unitId}`);
  }
  unit.mode = 'self_run';
  unit.employeeName = null;
  unit.lastShiftAt = null; // fresh cooldown state on switching modes
  return unit;
}

export function getPendingEarnings(store, unitId, now = Date.now()) {
  const unit = getUnit(store, unitId);
  if (!unit || unit.ownerId === null) {
    throw new Error(`getPendingEarnings: no leased unit with id ${unitId}`);
  }
  if (unit.mode !== 'ai_employee') {
    throw new Error(`getPendingEarnings: unit ${unitId} is not staffed with an AI employee`);
  }
  const elapsedHours = (now - unit.lastCollectedAt) / (60 * 60 * 1000);
  return Math.max(0, Math.round(elapsedHours * AI_EMPLOYEE_RATE_PER_HOUR * 100) / 100);
}

export async function collectEarnings(store, options = {}) {
  const { unitId, payoutFn, now = Date.now() } = options;
  requirePayoutFn(payoutFn, 'collectAIEmployeeIncome');

  const unit = getUnit(store, unitId);
  if (!unit || unit.ownerId === null) {
    throw new Error(`collectEarnings: no leased unit with id ${unitId}`);
  }
  const pending = getPendingEarnings(store, unitId, now);
  if (pending <= 0) {
    throw new Error(`collectEarnings: unit ${unitId} has no pending earnings yet`);
  }
  if (unit.stock <= 0) {
    throw new Error(`collectEarnings: unit ${unitId} has nothing left to sell -- restock first`);
  }

  await payoutFn(PLATFORM_USER_ID, unit.ownerId, pending, `venvs_chopz_ai_income:${unitId}`);
  unit.lastCollectedAt = now;
  unit.stock -= 1;
  return { unitId, collected: pending, stock: unit.stock };
}

export {
  CATEGORIES, LEASE_COST, SHIFT_PAYOUT, SHIFT_COOLDOWN_MS, AI_EMPLOYEE_RATE_PER_HOUR, PLATFORM_USER_ID,
  STARTING_STOCK, RESTOCK_BATCH_SIZE, RESTOCK_COST,
};
