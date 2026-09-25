// VASH TAP core logic — the physical-to-digital resolution engine.
//
// Scope: the narrowest real slice of `dev-docs/on-deck/VASH_TAP_FREEZE.md`,
// per its own §1/§55 audit (see `dev-docs/on-deck/README.md`, "The VASH
// TAP §1/§55 audit"). This builds ONLY on infrastructure the audit
// confirmed real: V3 (VCoin/VASH ledger), VACA (identity), HVNTZ
// (business/location), vaco-notify (dispatch). It deliberately does NOT
// attempt push notifications, general messaging, QVAN-based fraud
// detection, employee accounts, recurring scheduling, or dimensioned
// geographic analytics — the audit found none of those exist to reuse,
// and building them is its own undertaking, not a VASH TAP detail.
//
// **Not a second ledger.** §7's own rule: VASH TAP must use V3's
// existing transaction system. Every function here that moves money
// calls an injected `transferFn` (the same "cross-app calls are
// injected, not hard-wired" convention VOID's CLAUDE.md documents) and
// records only ATTRIBUTION — which physical Tap a V3 transaction went
// through — never a balance of its own.
//
// **Not a second business/location model.** A Tap references a real
// HVNTZ `businessId`, verified through an injected `businessFetchFn`
// rather than assumed. HVNTZ's `locationType` enum (`screen`/`hub`/
// `business-locker`) has no room for "Chair 7", so a Tap Point is its
// own entity here — exactly what §37 lists `VashTapPoint` as a new
// logical entity for — rather than forcing a chair into HVNTZ's schema.

'use strict';

const TAP_TYPES = ['personal', 'business', 'wear', 'embed', 'point'];
const TAP_STATUSES = ['active', 'frozen', 'inactive'];
const ASSIGNMENT_STATUSES = ['active', 'ended', 'cancelled'];

function createTapStore() {
  return {
    taps: [],
    nextTapId: 1,
    assignments: [],
    nextAssignmentId: 1,
    transactions: [],
    nextTransactionId: 1,
  };
}

// VT-000001, VT-000002, ... — §4's own example format, permanent and
// independent of the database id (the database id can change on a
// restore; the printed Tap ID on a physical plaque cannot).
function tapCodeFor(numericId) {
  return `VT-${String(numericId).padStart(6, '0')}`;
}

function findTap(store, tapCode) {
  return store.taps.find((t) => t.tapCode === tapCode) || null;
}

// **Registration validates the business is real rather than trusting a
// number.** `businessFetchFn` is HVNTZ's own `GET /api/business/:id` in
// production and a stub in tests — the same injection pattern
// `void/lib/staffing.js`'s `hvntzFetchFn` already uses for the same
// reason: a Tap pointing at a business that does not exist is not a
// smaller bug than one moving money to the wrong place, it is the same
// bug with fewer steps.
async function registerTap(store, options = {}) {
  const {
    tapType, objectType = null, businessId, ownerIdentityId = null,
    metadata = {}, businessFetchFn = null, now = Date.now(),
  } = options;

  if (!TAP_TYPES.includes(tapType)) {
    throw new Error(`registerTap: tapType must be one of ${TAP_TYPES.join(', ')}`);
  }
  if (!businessId && !ownerIdentityId) {
    throw new Error('registerTap requires a businessId (business tap) or an ownerIdentityId (personal tap)');
  }
  if (businessId) {
    if (typeof businessFetchFn !== 'function') {
      throw new Error('registerTap requires businessFetchFn(businessId) when businessId is set');
    }
    const business = await businessFetchFn(businessId);
    if (!business) throw new Error(`registerTap: no business with id ${businessId}`);
  }

  const id = store.nextTapId++;
  const tap = {
    id,
    tapCode: tapCodeFor(id),
    tapType,
    objectType,
    businessId: businessId ?? null,
    ownerIdentityId,
    status: 'active',
    currentAssignmentId: null,
    metadata,
    createdAt: now,
    updatedAt: now,
  };
  store.taps.push(tap);
  return tap;
}

// **Dynamic assignment, §5's own worked example** — Chair 7 stays one
// Tap; the software tracks who is currently answering for it. Several
// assignments can exist for one Tap (a schedule), and this is the one
// that is happening now. No recurrence engine (`startAt`/`endAt` only,
// per-instance) — the audit found VOID's own provider `availability`
// deliberately stops at the same point and defers recurrence to a UI
// layer that does not exist yet; duplicating that gap here would not
// be progress.
async function assignTap(store, options = {}) {
  const {
    tapCode, assignedIdentityId, startAt = Date.now(), endAt = null,
    createdBy = null, now = Date.now(), identityFetchFn = null,
  } = options;

  const tap = findTap(store, tapCode);
  if (!tap) throw new Error(`assignTap: no tap ${tapCode}`);
  if (!assignedIdentityId) throw new Error('assignTap requires an assignedIdentityId');
  if (endAt !== null && endAt <= startAt) throw new Error('assignTap: endAt must be after startAt');

  if (identityFetchFn) {
    const status = await identityFetchFn('vash-tap-assignee', assignedIdentityId);
    if (!status || !status.verified) {
      throw new Error(`assignTap: identity ${assignedIdentityId} is not VACA-verified`);
    }
  }

  const assignment = {
    id: store.nextAssignmentId++,
    tapId: tap.id,
    tapCode,
    assignedIdentityId,
    startAt,
    endAt,
    status: 'active',
    createdBy,
    createdAt: now,
  };
  store.assignments.push(assignment);

  if (startAt <= now && (endAt === null || endAt > now)) {
    tap.currentAssignmentId = assignment.id;
    tap.updatedAt = now;
  }
  return assignment;
}

// The assignment covering `now`, freshly resolved rather than trusted
// from `currentAssignmentId` — a restart, a restore, or simply the
// clock moving past `endAt` must not require a write to become true.
function currentAssignmentFor(store, tap, now = Date.now()) {
  const covering = store.assignments
    .filter((a) => a.tapId === tap.id && a.status === 'active'
      && a.startAt <= now && (a.endAt === null || a.endAt > now))
    .sort((a, b) => b.startAt - a.startAt);
  return covering[0] || null;
}

// **§6, Tap Resolution** — steps 1-6 of the freeze's own numbered list,
// scoped to what this slice has: Tap ID, status, current assignment,
// the assignee's VACA verification, and the resolved business. Steps
// 7-10 (location, product/object/service/event, permissions, available
// actions) are out of scope here — nothing built provides them yet, and
// a Tap Point doesn't carry a locationId to resolve step 7 from.
async function resolveTap(store, tapCode, options = {}) {
  const { now = Date.now(), identityFetchFn = null, businessFetchFn = null } = options;
  const tap = findTap(store, tapCode);
  if (!tap) throw new Error(`resolveTap: no tap ${tapCode}`);

  const assignment = currentAssignmentFor(store, tap, now);
  let assigneeVerified = null;
  if (assignment && identityFetchFn) {
    // Fail soft, not hard — VOID's own standing rule ("VACA
    // verification... fail soft, null, never block a real job")
    // applies here for the same reason: §2's own framing is that
    // resolution identifies the object, authorization happens at
    // payment. A VACA outage must not take down the one route with no
    // session requirement, the closest thing this app has to a public
    // health check for a physical Tap.
    try {
      const status = await identityFetchFn('vash-tap-assignee', assignment.assignedIdentityId);
      assigneeVerified = status ? status.verified : null;
    } catch {
      assigneeVerified = null;
    }
  }

  // Real resolution, not a pass-through of the id stored at
  // registration time — a business can rename or move between when a
  // Tap was registered and when it is tapped. Same fail-soft reasoning
  // as identityFetchFn above: an HVNTZ outage must not break resolving
  // the one thing this route exists to identify, the Tap itself.
  let business = null;
  if (tap.businessId && businessFetchFn) {
    try {
      business = await businessFetchFn(tap.businessId);
    } catch {
      business = null;
    }
  }

  return {
    tap,
    assignment,
    assigneeIdentityId: assignment ? assignment.assignedIdentityId : null,
    assigneeVerified,
    business,
    payable: tap.status === 'active' && assignment !== null,
  };
}

// **§7's flow, literally**: VASH TAP -> VACA -> VASH authorization ->
// EXISTING VASH TRANSACTION SYSTEM -> ledger -> recipient -> notification
// -> analytics attribution. `transferFn` IS V3's own
// `POST /api/vcoin/transfer` in production (see server.js); this
// function never touches a balance directly. `notifyFn` is
// `vaco-notify`'s `send()` standing in for §8's "immediate phone
// alert" — the audit found real push delivery does not exist anywhere
// in this ecosystem, so a webhook/console notification is the honest
// today-version of that requirement, not a finished one.
async function payViaTap(store, options = {}) {
  const {
    tapCode, fromUserId, amount, tip = 0, message = null,
    now = Date.now(), transferFn, notifyFn = null, identityFetchFn = null,
  } = options;

  if (!fromUserId) throw new Error('payViaTap requires fromUserId');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('payViaTap requires a positive amount');
  if (!Number.isFinite(tip) || tip < 0) throw new Error('payViaTap: tip must be zero or a positive number');
  if (typeof transferFn !== 'function') throw new Error('payViaTap requires transferFn(fromUserId, toUserId, amount, reason)');

  const resolved = await resolveTap(store, tapCode, { now, identityFetchFn });
  if (!resolved.payable) {
    throw new Error(`payViaTap: tap ${tapCode} is not payable right now (status=${resolved.tap.status}, assigned=${resolved.assignment !== null})`);
  }
  const toUserId = resolved.assigneeIdentityId;
  if (toUserId === fromUserId) throw new Error('payViaTap: cannot pay yourself');

  const total = amount + tip;
  // Never recorded as paid before the ledger confirms it — §7's own
  // rule. If transferFn throws, nothing below runs and no attribution
  // row exists for a payment that never happened.
  const ledgerResult = await transferFn(fromUserId, toUserId, total, `VASH TAP ${tapCode}`);

  const record = {
    id: store.nextTransactionId++,
    tapId: resolved.tap.id,
    tapCode,
    v3TransactionId: ledgerResult && ledgerResult.id !== undefined ? ledgerResult.id : null,
    assignmentId: resolved.assignment.id,
    businessId: resolved.tap.businessId,
    fromUserId,
    toUserId,
    amount,
    tip,
    total,
    message,
    status: 'completed',
    createdAt: now,
  };
  store.transactions.push(record);

  if (notifyFn) {
    // Fire-and-record, not fire-and-forget: a failed alert must not
    // undo a completed payment (§7 already confirmed before this
    // runs), but it also must not disappear silently — vaco-notify's
    // own `send()` already returns `status: 'undelivered'` rather than
    // throwing, which is exactly the "visible rather than silently
    // dropped" behaviour this needs.
    record.notification = await notifyFn({
      app: 'vash-tap',
      severity: 'alert',
      title: `VASH TAP payment received — $${total.toFixed(2)}`,
      body: message,
      context: { tapCode, toUserId, fromUserId, amount, tip },
    }).catch((err) => ({ status: 'undelivered', error: err.message }));
  }

  return record;
}

function freezeTap(store, options = {}) {
  const { tapCode, now = Date.now() } = options;
  const tap = findTap(store, tapCode);
  if (!tap) throw new Error(`freezeTap: no tap ${tapCode}`);
  tap.status = 'frozen';
  tap.updatedAt = now;
  return tap;
}

function unfreezeTap(store, options = {}) {
  const { tapCode, now = Date.now() } = options;
  const tap = findTap(store, tapCode);
  if (!tap) throw new Error(`unfreezeTap: no tap ${tapCode}`);
  if (tap.status !== 'frozen') throw new Error(`unfreezeTap: tap ${tapCode} is not frozen`);
  tap.status = 'active';
  tap.updatedAt = now;
  return tap;
}

function transactionsForTap(store, tapCode) {
  return store.transactions.filter((t) => t.tapCode === tapCode);
}

// §18, "spender-side complete tracking" — every payment this person
// made through any Tap, theirs to see in full per the freeze's own
// privacy rule ("the spender should have complete visibility into
// THEIR OWN financial activity").
function spenderHistory(store, userId) {
  return store.transactions.filter((t) => t.fromUserId === userId);
}

// §16, revenue attribution — Tap -> transaction -> revenue -> business,
// the worked "Chair 1 -> $4,820" example, scoped to one business.
function revenueByTap(store, businessId) {
  const byTap = new Map();
  for (const t of store.transactions) {
    if (t.businessId !== businessId) continue;
    const row = byTap.get(t.tapCode) || { tapCode: t.tapCode, revenue: 0, tips: 0, transactions: 0 };
    row.revenue += t.amount;
    row.tips += t.tip;
    row.transactions += 1;
    byTap.set(t.tapCode, row);
  }
  return [...byTap.values()].sort((a, b) => (b.revenue + b.tips) - (a.revenue + a.tips));
}

function reseedIds(store) {
  const maxOf = (rows) => rows.reduce((max, r) => (r.id > max ? r.id : max), 0);
  store.nextTapId = maxOf(store.taps) + 1;
  store.nextAssignmentId = maxOf(store.assignments) + 1;
  store.nextTransactionId = maxOf(store.transactions) + 1;
  return { nextTapId: store.nextTapId, nextAssignmentId: store.nextAssignmentId, nextTransactionId: store.nextTransactionId };
}

module.exports = {
  TAP_TYPES,
  TAP_STATUSES,
  ASSIGNMENT_STATUSES,
  createTapStore,
  tapCodeFor,
  findTap,
  registerTap,
  assignTap,
  currentAssignmentFor,
  resolveTap,
  payViaTap,
  freezeTap,
  unfreezeTap,
  transactionsForTap,
  spenderHistory,
  revenueByTap,
  reseedIds,
};
