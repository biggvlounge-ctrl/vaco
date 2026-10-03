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
// are real, both are kept, per no instruction to remove either.
//
// No source doc specifies category names, lease cost, shift payout,
// cooldown length, or AI-employee earn rate -- every constant below
// is invented and flagged as interpretive, same posture as Phase 5's
// world constants. The 8-units-across-7-categories split (one
// category gets 2 units) is also an interpretive choice; no doc says
// which category gets the extra slot.
//
// leaseUnit/runShift/collectEarnings reuse the same injected
// transferFn pattern as every previous phase's real-money functions,
// for the same reason (plain-Node testability, decoupled from
// v3Client.js's Vite-only import.meta.env).

const CATEGORIES = [
  'food_stand',
  'clothing_boutique',
  'hardware_kiosk',
  'music_stall',
  'bookshop',
  'salon',
  'repair_shop',
];

const UNIT_TEMPLATE = [
  { category: 'food_stand' },
  { category: 'food_stand' }, // the one category with 2 of the 8 units
  { category: 'clothing_boutique' },
  { category: 'hardware_kiosk' },
  { category: 'music_stall' },
  { category: 'bookshop' },
  { category: 'salon' },
  { category: 'repair_shop' },
];

const LEASE_COST = 50;
const SHIFT_PAYOUT = 15;
const SHIFT_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours
const AI_EMPLOYEE_RATE_PER_HOUR = 3;
const PLATFORM_USER_ID = 'venvs-platform';

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
    })),
  };
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

  await payoutFn(PLATFORM_USER_ID, unit.ownerId, SHIFT_PAYOUT, `venvs_chopz_shift:${unitId}`);
  unit.lastShiftAt = now;
  return { unitId, payout: SHIFT_PAYOUT, nextAvailableAt: now + SHIFT_COOLDOWN_MS };
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

  await payoutFn(PLATFORM_USER_ID, unit.ownerId, pending, `venvs_chopz_ai_income:${unitId}`);
  unit.lastCollectedAt = now;
  return { unitId, collected: pending };
}

export { CATEGORIES, LEASE_COST, SHIFT_PAYOUT, SHIFT_COOLDOWN_MS, AI_EMPLOYEE_RATE_PER_HOUR, PLATFORM_USER_ID };
