// VDP — the district game logic nobody was testing.
//
// VDP has 38 lib modules and had three test files. The three covered
// Combat Sports, Venus Resort and world expansion; the rest of the game
// — the walkable Village interior, DEGVCHI's wearable economy, CHOPZ's
// unit state machine — had nothing.
//
// These are the modules with real rules in them: money moving, state
// transitions that must not be reversible, ownership that must not be
// forgeable. The `*Client.js` modules are deliberately not covered here
// — they are thin HTTP wrappers over other apps' APIs, and testing them
// would test `fetch`.

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ROOMS_LAYOUT, INTERIOR_WIDTH, INTERIOR_HEIGHT,
  INTERIOR_VIEWPORT_WIDTH, INTERIOR_VIEWPORT_HEIGHT, INTERIOR_ENTRY_RADIUS,
  createInteriorState, moveInteriorPlayer, getNearbyRoom, getInteriorCameraOffset,
} from '../src/lib/villageDistrict.js';

import {
  createDegvchi, registerWearable, getWearable, browseWearables,
  ownsWearable, getOwnedWearables, purchaseWearable,
  equipWearable, unequipWearable, getEquippedOutfit, WEARABLE_CATEGORIES,
} from '../src/lib/degvchi.js';

import {
  createChopz, getUnit, getAvailableUnits, getOwnedUnits,
  leaseUnit, runShift, staffWithAIEmployee, switchToSelfRun,
  getPendingEarnings, collectEarnings,
  LEASE_COST, SHIFT_PAYOUT, SHIFT_COOLDOWN_MS, AI_EMPLOYEE_RATE_PER_HOUR, PLATFORM_USER_ID,
} from '../src/lib/chopz.js';

// A transferFn that records every move instead of calling V3, so a test
// can assert on WHO paid WHOM — the thing that actually matters and the
// thing a stub returning `true` would hide.
function ledger() {
  const moves = [];
  const fn = async (from, to, amount, reason) => { moves.push({ from, to, amount, reason }); };
  fn.moves = moves;
  return fn;
}

const centerOf = (r) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

// ===========================================================================
// The Village District interior — a second walkable world
// ===========================================================================
// Same class of geometry bug as the outer world, in a file nobody was
// checking. The rooms grew from a doc that described "room types
// coexisting in one Village area", and the same growth risk applies.

test('the interior rooms fit inside the interior', () => {
  const escaped = ROOMS_LAYOUT.filter((r) => r.x < 0 || r.y < 0
    || r.x + r.width > INTERIOR_WIDTH || r.y + r.height > INTERIOR_HEIGHT);
  assert.deepEqual(escaped.map((r) => r.key), [], 'these rooms are outside the room they are in');
});

test('no two interior rooms overlap, and each is uniquely keyed', () => {
  const keys = ROOMS_LAYOUT.map((r) => r.key);
  assert.equal(new Set(keys).size, keys.length);
  for (let i = 0; i < ROOMS_LAYOUT.length; i += 1) {
    for (let j = i + 1; j < ROOMS_LAYOUT.length; j += 1) {
      const a = ROOMS_LAYOUT[i];
      const b = ROOMS_LAYOUT[j];
      const overlap = a.x < b.x + b.width && b.x < a.x + a.width
        && a.y < b.y + b.height && b.y < a.y + a.height;
      assert.ok(!overlap, `${a.key} overlaps ${b.key}`);
    }
  }
});

test('the interior spawn is in neutral space and near no room', () => {
  // Spawning inside a room's entry radius would auto-open that room the
  // instant a player walks in the door.
  const spawn = createInteriorState();
  assert.ok(spawn.x >= 0 && spawn.x <= INTERIOR_WIDTH);
  assert.ok(spawn.y >= 0 && spawn.y <= INTERIOR_HEIGHT);
  assert.equal(getNearbyRoom(spawn), null, 'the player spawns already standing in a doorway');
});

test('every interior room can be reached and detected', () => {
  for (const room of ROOMS_LAYOUT) {
    assert.equal(getNearbyRoom(centerOf(room))?.key, room.key, `${room.key} is not detectable`);
  }
});

test('interior rooms do not share an entry zone', () => {
  for (let i = 0; i < ROOMS_LAYOUT.length; i += 1) {
    for (let j = i + 1; j < ROOMS_LAYOUT.length; j += 1) {
      const a = centerOf(ROOMS_LAYOUT[i]);
      const b = centerOf(ROOMS_LAYOUT[j]);
      assert.ok(
        Math.hypot(a.x - b.x, a.y - b.y) > INTERIOR_ENTRY_RADIUS,
        `${ROOMS_LAYOUT[i].key} and ${ROOMS_LAYOUT[j].key} share a door`,
      );
    }
  }
});

test('the interior player cannot walk out of the interior', () => {
  const p = createInteriorState();
  moveInteriorPlayer(p, -9999, -9999);
  assert.deepEqual({ x: p.x, y: p.y }, { x: 0, y: 0 });
  moveInteriorPlayer(p, 9999, 9999);
  assert.deepEqual({ x: p.x, y: p.y }, { x: INTERIOR_WIDTH, y: INTERIOR_HEIGHT });
});

test('the interior camera keeps the player on screen everywhere', () => {
  assert.ok(INTERIOR_VIEWPORT_WIDTH < INTERIOR_WIDTH);
  assert.ok(INTERIOR_VIEWPORT_HEIGHT < INTERIOR_HEIGHT);
  for (let x = 0; x <= INTERIOR_WIDTH; x += 29) {
    for (let y = 0; y <= INTERIOR_HEIGHT; y += 31) {
      const cam = getInteriorCameraOffset({ x, y });
      assert.ok(x >= cam.x && x <= cam.x + INTERIOR_VIEWPORT_WIDTH, `off screen at ${x},${y}`);
      assert.ok(y >= cam.y && y <= cam.y + INTERIOR_VIEWPORT_HEIGHT, `off screen at ${x},${y}`);
    }
  }
});

// ===========================================================================
// DEGVCHI — the avatar wearable economy
// ===========================================================================

test('a wearable is refused unless it can actually be sold', () => {
  // Each of these would create an item that breaks at purchase time
  // instead of at creation time: no payout account, a free or negative
  // price, a category nothing renders.
  const store = createDegvchi();
  const ok = { name: 'Coat', category: WEARABLE_CATEGORIES[0], price: 10, creatorId: 'maker' };
  assert.throws(() => registerWearable(store, { ...ok, name: undefined }), /requires a name/);
  assert.throws(() => registerWearable(store, { ...ok, category: 'hats' }), /invalid category/);
  assert.throws(() => registerWearable(store, { ...ok, price: 0 }), /positive price/);
  assert.throws(() => registerWearable(store, { ...ok, price: -5 }), /positive price/);
  assert.throws(() => registerWearable(store, { ...ok, creatorId: undefined }), /requires a creatorId/);
  assert.equal(store.wearables.length, 0, 'and none of them were half-created');
});

test('buying a wearable pays the creator, not the platform', () => {
  // The whole point of `creatorId` being required: this is somebody's
  // payout account, and paying the wrong party is the kind of bug that
  // only surfaces as a complaint.
  const store = createDegvchi();
  const item = registerWearable(store, {
    name: 'Signal Jacket', category: WEARABLE_CATEGORIES[0], price: 40, creatorId: 'designer-mo',
  });
  const transferFn = ledger();

  return purchaseWearable(store, { wearableId: item.id, buyerId: 'player-1', transferFn })
    .then(() => {
      assert.equal(transferFn.moves.length, 1);
      assert.deepEqual(
        { from: transferFn.moves[0].from, to: transferFn.moves[0].to, amount: transferFn.moves[0].amount },
        { from: 'player-1', to: 'designer-mo', amount: 40 },
      );
      assert.ok(ownsWearable(store, 'player-1', item.id));
    });
});

test('a purchase that cannot be paid for transfers no ownership', () => {
  // The order that matters: transfer first, then record ownership. A
  // failed payment must not leave the buyer holding the item.
  const store = createDegvchi();
  const item = registerWearable(store, {
    name: 'Coat', category: WEARABLE_CATEGORIES[0], price: 40, creatorId: 'maker',
  });
  const broke = async () => { throw new Error('insufficient funds'); };

  return assert.rejects(
    () => purchaseWearable(store, { wearableId: item.id, buyerId: 'player-1', transferFn: broke }),
    /insufficient funds/,
  ).then(() => {
    assert.equal(ownsWearable(store, 'player-1', item.id), false, 'a failed payment granted the item');
    assert.equal(store.ownership.length, 0);
  });
});

test('the same person cannot buy the same wearable twice', () => {
  const store = createDegvchi();
  const item = registerWearable(store, {
    name: 'Coat', category: WEARABLE_CATEGORIES[0], price: 10, creatorId: 'maker',
  });
  const transferFn = ledger();
  return purchaseWearable(store, { wearableId: item.id, buyerId: 'p1', transferFn })
    .then(() => assert.rejects(
      () => purchaseWearable(store, { wearableId: item.id, buyerId: 'p1', transferFn }),
      /already owns/,
    ))
    .then(() => assert.equal(transferFn.moves.length, 1, 'and they were not charged for the attempt'));
});

test('a purchase needs a real payment function, not a promise to have one', () => {
  const store = createDegvchi();
  const item = registerWearable(store, {
    name: 'Coat', category: WEARABLE_CATEGORIES[0], price: 10, creatorId: 'maker',
  });
  return assert.rejects(
    () => purchaseWearable(store, { wearableId: item.id, buyerId: 'p1' }),
    /requires a transferFn/,
  );
});

test('you cannot equip what you do not own', () => {
  // The forgery check. Without it the wearable economy is cosmetic in
  // the worst sense: everybody wears everything and nobody buys.
  const store = createDegvchi();
  const item = registerWearable(store, {
    name: 'Coat', category: WEARABLE_CATEGORIES[0], price: 10, creatorId: 'maker',
  });
  assert.throws(() => equipWearable(store, 'freeloader', item.id), /does not own/);
  assert.throws(() => equipWearable(store, 'anyone', 9999), /no wearable with id/);
});

test('one slot per category — equipping replaces rather than stacks', () => {
  const store = createDegvchi();
  const category = WEARABLE_CATEGORIES[0];
  const a = registerWearable(store, { name: 'A', category, price: 5, creatorId: 'm' });
  const b = registerWearable(store, { name: 'B', category, price: 5, creatorId: 'm' });
  store.ownership.push({ userId: 'p', wearableId: a.id }, { userId: 'p', wearableId: b.id });

  equipWearable(store, 'p', a.id);
  const outfit = equipWearable(store, 'p', b.id);
  assert.equal(outfit[category].id, b.id, 'the second item is worn');
  assert.equal(getOwnedWearables(store, 'p').length, 2, 'and the first is still owned');
});

test('an outfit names every category, empty ones included', () => {
  // `null` per empty slot rather than an absent key: a renderer that
  // iterates categories must not have to guess which ones exist.
  const store = createDegvchi();
  const outfit = getEquippedOutfit(store, 'nobody');
  assert.deepEqual(Object.keys(outfit).sort(), [...WEARABLE_CATEGORIES].sort());
  for (const category of WEARABLE_CATEGORIES) assert.equal(outfit[category], null);
});

test('unequipping clears one slot and only that slot', () => {
  const store = createDegvchi();
  const [first, second] = WEARABLE_CATEGORIES;
  const a = registerWearable(store, { name: 'A', category: first, price: 5, creatorId: 'm' });
  const b = registerWearable(store, { name: 'B', category: second, price: 5, creatorId: 'm' });
  store.ownership.push({ userId: 'p', wearableId: a.id }, { userId: 'p', wearableId: b.id });
  equipWearable(store, 'p', a.id);
  equipWearable(store, 'p', b.id);

  const outfit = unequipWearable(store, 'p', first);
  assert.equal(outfit[first], null);
  assert.equal(outfit[second].id, b.id, 'the other slot was cleared too');
  assert.ok(ownsWearable(store, 'p', a.id), 'taking something off is not selling it');
});

test('unequipping an invalid category is refused, and unequipping nothing is harmless', () => {
  const store = createDegvchi();
  assert.throws(() => unequipWearable(store, 'p', 'hats'), /invalid category/);
  assert.doesNotThrow(() => unequipWearable(store, 'never-seen-before', WEARABLE_CATEGORIES[0]));
});

test('browsing filters by category and by sponsorship', () => {
  const store = createDegvchi();
  const [first, second] = WEARABLE_CATEGORIES;
  registerWearable(store, { name: 'A', category: first, price: 5, creatorId: 'm' });
  registerWearable(store, { name: 'B', category: second, price: 5, creatorId: 'm', sponsor: 'CHOPZ' });

  assert.equal(browseWearables(store).length, 2, 'no filter means everything');
  assert.equal(browseWearables(store, { category: first }).length, 1);
  assert.equal(browseWearables(store, { sponsoredOnly: true })[0].name, 'B');
  assert.equal(getWearable(store, 9999), null, 'an unknown id is null, not undefined');
});

// ===========================================================================
// CHOPZ — the unit lease and staffing state machine
// ===========================================================================

test('a unit starts unowned and becomes owned exactly once', () => {
  const store = createChopz();
  const available = getAvailableUnits(store);
  assert.ok(available.length > 0);
  const unit = available[0];
  assert.equal(unit.ownerId, null);
  assert.equal(unit.mode, null, 'an unleased unit has no mode, not a default one');

  const transferFn = ledger();
  return leaseUnit(store, { unitId: unit.id, ownerId: 'p1', transferFn })
    .then(() => {
      assert.equal(getUnit(store, unit.id).ownerId, 'p1');
      assert.equal(getUnit(store, unit.id).mode, 'self_run');
      assert.deepEqual(
        { from: transferFn.moves[0].from, to: transferFn.moves[0].to, amount: transferFn.moves[0].amount },
        { from: 'p1', to: PLATFORM_USER_ID, amount: LEASE_COST },
      );
      assert.equal(getOwnedUnits(store, 'p1').length, 1);
      assert.ok(!getAvailableUnits(store).some((u) => u.id === unit.id));
    })
    .then(() => assert.rejects(
      () => leaseUnit(store, { unitId: unit.id, ownerId: 'p2', transferFn }),
      /already leased/,
    ));
});

test('a shift pays the owner and then locks for the cooldown', () => {
  const store = createChopz();
  const transferFn = ledger();
  const id = getAvailableUnits(store)[0].id;

  return leaseUnit(store, { unitId: id, ownerId: 'p1', transferFn })
    .then(() => runShift(store, { unitId: id, transferFn, now: 1000 }))
    .then((out) => {
      assert.equal(out.payout, SHIFT_PAYOUT);
      const paid = transferFn.moves[1];
      assert.deepEqual(
        { from: paid.from, to: paid.to, amount: paid.amount },
        { from: PLATFORM_USER_ID, to: 'p1', amount: SHIFT_PAYOUT },
      );
    })
    // Immediately again: refused.
    .then(() => assert.rejects(
      () => runShift(store, { unitId: id, transferFn, now: 1000 }),
      /on cooldown/,
    ))
    // One millisecond before the cooldown ends: still refused.
    .then(() => assert.rejects(
      () => runShift(store, { unitId: id, transferFn, now: 1000 + SHIFT_COOLDOWN_MS - 1 }),
      /on cooldown/,
    ))
    // Exactly at the boundary: allowed.
    .then(() => runShift(store, { unitId: id, transferFn, now: 1000 + SHIFT_COOLDOWN_MS }))
    .then(() => assert.equal(transferFn.moves.length, 3, 'lease + two shifts, nothing else'));
});

test('a unit nobody leased cannot be worked', () => {
  const store = createChopz();
  const transferFn = ledger();
  const id = getAvailableUnits(store)[0].id;
  return assert.rejects(() => runShift(store, { unitId: id, transferFn }), /no leased unit/)
    .then(() => assert.rejects(() => runShift(store, { unitId: 9999, transferFn }), /no leased unit/))
    .then(() => assert.equal(transferFn.moves.length, 0));
});

test('an AI-staffed unit cannot also be worked by its owner', () => {
  // The two modes are exclusive on purpose — otherwise an owner
  // collects hourly AI income AND shift payouts from the same unit.
  const store = createChopz();
  const transferFn = ledger();
  const id = getAvailableUnits(store)[0].id;

  return leaseUnit(store, { unitId: id, ownerId: 'p1', transferFn })
    .then(() => {
      staffWithAIEmployee(store, id, 'Rosa', 0);
      return assert.rejects(
        () => runShift(store, { unitId: id, transferFn, now: SHIFT_COOLDOWN_MS * 10 }),
        /staffed with an AI employee/,
      );
    })
    .then(() => assert.equal(transferFn.moves.length, 1, 'the lease, and nothing since'));
});

test('AI earnings accrue with time and reset when collected', () => {
  const store = createChopz();
  const transferFn = ledger();
  const id = getAvailableUnits(store)[0].id;
  const HOUR = 60 * 60 * 1000;

  return leaseUnit(store, { unitId: id, ownerId: 'p1', transferFn })
    .then(() => {
      staffWithAIEmployee(store, id, 'Rosa', 0);
      assert.equal(getPendingEarnings(store, id, 0), 0, 'nothing accrues in zero time');
      assert.equal(getPendingEarnings(store, id, 2 * HOUR), 2 * AI_EMPLOYEE_RATE_PER_HOUR);
      return collectEarnings(store, { unitId: id, transferFn, now: 2 * HOUR });
    })
    .then((out) => {
      assert.equal(out.collected, 2 * AI_EMPLOYEE_RATE_PER_HOUR);
      const paid = transferFn.moves[1];
      assert.equal(paid.from, PLATFORM_USER_ID);
      assert.equal(paid.to, 'p1');
      assert.equal(getPendingEarnings(store, id, 2 * HOUR), 0, 'collecting resets the clock');
    })
    // And collecting again immediately pays nothing rather than double-paying.
    .then(() => assert.rejects(
      () => collectEarnings(store, { unitId: id, transferFn, now: 2 * HOUR }),
      /no pending earnings/,
    ))
    .then(() => assert.equal(transferFn.moves.length, 2));
});

test('earnings cannot be collected from a self-run unit', () => {
  const store = createChopz();
  const transferFn = ledger();
  const id = getAvailableUnits(store)[0].id;
  return leaseUnit(store, { unitId: id, ownerId: 'p1', transferFn })
    .then(() => {
      assert.throws(() => getPendingEarnings(store, id), /not staffed with an AI employee/);
      return assert.rejects(
        () => collectEarnings(store, { unitId: id, transferFn }),
        /not staffed with an AI employee/,
      );
    });
});

test('switching back to self-run DISCARDS uncollected AI earnings', () => {
  // **Flagged, not endorsed.** `switchToSelfRun` resets mode and
  // clears the shift cooldown, and says nothing about pending income.
  // `staffWithAIEmployee` then re-stamps `lastCollectedAt` to now, so
  // an owner who staffs an AI, accrues ten hours, switches to self-run
  // and staffs again has silently lost that income.
  //
  // No ledger drift — the money was never credited, so nothing is out
  // of balance — but a player would experience it as their wages
  // vanishing. This test pins the behaviour as it actually is rather
  // than asserting it is right; whether a switch should force a
  // collection first is a game-design call, not a bug fix to make
  // unilaterally.
  const store = createChopz();
  const transferFn = ledger();
  const id = getAvailableUnits(store)[0].id;
  const HOUR = 60 * 60 * 1000;

  return leaseUnit(store, { unitId: id, ownerId: 'p1', transferFn })
    .then(() => {
      staffWithAIEmployee(store, id, 'Rosa', 0);
      assert.equal(getPendingEarnings(store, id, 10 * HOUR), 10 * AI_EMPLOYEE_RATE_PER_HOUR);

      switchToSelfRun(store, id, 10 * HOUR);
      staffWithAIEmployee(store, id, 'Rosa', 10 * HOUR);

      assert.equal(
        getPendingEarnings(store, id, 10 * HOUR), 0,
        'ten hours of accrued income survived the switch — if this fails, the behaviour '
        + 'was deliberately changed and this test should be updated to say so',
      );
      assert.equal(transferFn.moves.length, 1, 'and nothing was paid out along the way');
    });
});

test('switching to self-run clears the shift cooldown', () => {
  // Documented in the source as deliberate ("fresh cooldown state on
  // switching modes"), so it is pinned rather than left to drift.
  const store = createChopz();
  const transferFn = ledger();
  const id = getAvailableUnits(store)[0].id;

  return leaseUnit(store, { unitId: id, ownerId: 'p1', transferFn })
    .then(() => runShift(store, { unitId: id, transferFn, now: 1000 }))
    .then(() => {
      switchToSelfRun(store, id, 2000);
      assert.equal(getUnit(store, id).lastShiftAt, null);
      assert.equal(getUnit(store, id).employeeName, null, 'and the employee is gone');
      return runShift(store, { unitId: id, transferFn, now: 2000 });
    })
    .then((out) => assert.equal(out.payout, SHIFT_PAYOUT, 'a shift is available again immediately'));
});

test('staffing requires a leased unit and a named employee', () => {
  const store = createChopz();
  const id = getAvailableUnits(store)[0].id;
  assert.throws(() => staffWithAIEmployee(store, id, 'Rosa'), /no leased unit/);
  assert.throws(() => switchToSelfRun(store, id), /no leased unit/);

  const transferFn = ledger();
  return leaseUnit(store, { unitId: id, ownerId: 'p1', transferFn })
    .then(() => assert.throws(() => staffWithAIEmployee(store, id, ''), /requires an employeeName/));
});

test('every money-moving CHOPZ operation demands a real transfer function', () => {
  // Not ceremony: a missing transferFn defaulting to a no-op would make
  // leases free and shifts pay nothing, and both would look like they
  // worked.
  const store = createChopz();
  const id = getAvailableUnits(store)[0].id;
  return assert.rejects(() => leaseUnit(store, { unitId: id, ownerId: 'p' }), /requires a transferFn/)
    .then(() => assert.rejects(() => runShift(store, { unitId: id }), /requires a transferFn/))
    .then(() => assert.rejects(() => collectEarnings(store, { unitId: id }), /requires a transferFn/));
});
