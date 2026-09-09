// VEX — the compliance gate that refuses orders before money moves.
//
// **Why this file exists.** `dev-docs/COMPLETION_AUDIT.md` §3.2 lists
// VEX among the gates other apps trust, and this is the one with a
// regulator behind it. `brokerage.js`'s own header states the standing
// position: VEX's brokerage trading is built, and its live-money
// trigger **stays off until real broker-dealer legal review clears
// it.** `complianceGate.js` starts `vex-brokerage` at `false` and the
// setter is described as "a real admin action -- fires only after
// actual broker-dealer registration/legal work clears, not as a
// routine toggle."
//
// A test suite is the only thing that keeps that true across a
// refactor. The failures targeted:
//
//   - the gate defaulting to open, or drifting open
//   - an order being validated, priced, or settled *before* the gate is
//     consulted, so a refusal still moves money or mints editions
//   - a typo'd gate name reading as open — or as closed, which is just
//     as wrong, because it hides the typo
//   - a non-boolean "cleared" value flipping the gate by truthiness
//   - a sell paying out for editions the account does not hold
//
// Every assertion is on the refusal and on the money not moving. A
// rejected order that already charged somebody is the failure this
// whole gate exists to prevent.

const test = require('node:test');
const assert = require('node:assert');

const { createVexStore } = require('../lib/store');
const gate = require('../lib/complianceGate');

// VEX reaches into VOKEN over HTTP for card data (`lib/vokenClient.js`).
// These tests are about VEX's gate, not about VOKEN, so that boundary is
// stubbed — and stubbing it strengthens the point rather than weakening
// it: even with a perfectly healthy VOKEN and a perfectly well-formed
// order, the gate still refuses.
//
// **The stub must be installed before `brokerage.js` is required**, and
// that is not a style choice. `brokerage.js` destructures its three
// client functions at module load:
//
//   const { getCultureCard, mintAdditionalEdition, ... } = require('./vokenClient');
//
// Those bindings are captured once. Replacing `module.exports` after
// the fact leaves brokerage still holding the originals — which is
// exactly what happened on the first run of this file: the gate-closed
// tests passed (they never reach the client) and every gate-open test
// failed against a real HTTP call.
//
// So the cache entry goes in first, and its functions delegate to a
// mutable `voken` that each test sets.
const vokenClientPath = require.resolve('../lib/vokenClient');
let voken = null;
require.cache[vokenClientPath] = {
  id: vokenClientPath,
  filename: vokenClientPath,
  loaded: true,
  exports: {
    getCultureCard: (...args) => voken.getCultureCard(...args),
    mintAdditionalEdition: (...args) => voken.mintAdditionalEdition(...args),
    transferEditionOwnership: (...args) => voken.transferEditionOwnership(...args),
  },
};

const brokerage = require('../lib/brokerage');

// A ledger, not a spy. A spy proves a transfer was attempted; a ledger
// proves money landed — and here, most of the time, that nothing moved
// at all. `moves` staying empty is the assertion in nearly every test
// below.
function ledger(initial = {}) {
  const balances = { ...initial };
  const moves = [];
  const fn = async (from, to, amount, reason) => {
    if (typeof amount !== 'number' || Number.isNaN(amount) || amount < 0) {
      throw new Error(`ledger: bad transfer of ${amount} (${reason})`);
    }
    balances[from] = (balances[from] || 0) - amount;
    balances[to] = (balances[to] || 0) + amount;
    moves.push({ from, to, amount, reason });
    return { ok: true };
  };
  fn.moves = moves;
  fn.of = (a) => balances[a] || 0;
  fn.movedNothing = () => moves.length === 0;
  return fn;
}

// Points the stubbed client at one card and starts a fresh call count.
// `calls` is what proves *ordering* — that a refused order did not
// fetch, mint, or move ownership on its way to being refused.
function stubVokenClient(card) {
  const calls = { get: 0, mint: 0, transfer: 0 };
  voken = {
    getCultureCard: async () => { calls.get += 1; return card; },
    mintAdditionalEdition: async () => { calls.mint += 1; return { editionNumber: calls.mint }; },
    transferEditionOwnership: async () => { calls.transfer += 1; return { ok: true }; },
  };
  return { calls, restore: () => { voken = null; } };
}

function cardWith(editions) {
  return { id: 'card-1', editions };
}

function openAccount(store, userId = 'ada') {
  return brokerage.openBrokerAccount(store, { userId });
}

// -- The gate's default state -------------------------------------------

test('the brokerage gate is closed out of the box', () => {
  const store = createVexStore();

  // This is a standing constraint, not a preference. If a future
  // refactor of createComplianceGateState ever defaults this to true,
  // VEX starts trading without broker-dealer registration.
  assert.strictEqual(gate.isComplianceCleared(store, 'vex-brokerage'), false,
    'a brokerage gate that defaults open is a business-ending default');
});

test('only vex-brokerage is a VEX gate — fractional-ownership stayed in VOKEN', () => {
  assert.deepStrictEqual(gate.GATES, ['vex-brokerage']);

  const store = createVexStore();
  // VADO's own gate. Asking VEX about it is a bug in the caller, and
  // answering `false` would hide that bug behind a plausible-looking
  // refusal.
  assert.throws(() => gate.isComplianceCleared(store, 'fractional-ownership'), /invalid gateName/);
});

test('an unknown gate name throws rather than reading as closed', () => {
  const store = createVexStore();

  // Both directions are wrong, but silently-closed is the sneakier one:
  // it looks like the gate is working while the real gate is never
  // consulted at all.
  for (const name of ['vex_brokerage', 'VEX-BROKERAGE', '', 'brokerage', undefined]) {
    assert.throws(() => gate.isComplianceCleared(store, name), /invalid gateName/,
      `gate name ${JSON.stringify(name)} must throw, not resolve`);
  }
});

test('the gate cannot be flipped by a truthy value — only a real boolean', () => {
  const store = createVexStore();

  // 'false', 0, and '' are the classic query-string and form-field
  // shapes. A gate that opens on the string "false" is worse than one
  // with no guard at all.
  for (const value of ['true', 'false', 1, 0, '', 'yes', null, undefined]) {
    assert.throws(() => gate.setComplianceStatus(store, 'vex-brokerage', value),
      /requires a boolean/, `cleared=${JSON.stringify(value)} must be refused`);
  }
  assert.strictEqual(gate.isComplianceCleared(store, 'vex-brokerage'), false,
    'after every refused attempt the gate is still closed');
});

test('setting an unknown gate is refused and does not create one', () => {
  const store = createVexStore();
  assert.throws(() => gate.setComplianceStatus(store, 'made-up-gate', true), /invalid gateName/);
  assert.strictEqual(store.complianceGates['made-up-gate'], undefined,
    'a typo must not silently create a new, permanently-open gate');
});

// -- The gate refuses before anything else happens -----------------------

test('a well-formed order is refused while the gate is closed, and no money moves', async () => {
  const store = createVexStore();
  const account = openAccount(store);
  const transferFn = ledger({ ada: 10000, 'vex-platform': 10000 });
  const voken = stubVokenClient(cardWith([]));

  try {
    await assert.rejects(() => brokerage.placeTradeOrder(store, {
      accountId: account.id, cardId: 'card-1', orderType: 'buy',
      quantity: 2, pricePerUnit: 100, transferFn,
    }), /held pending real broker-dealer compliance review/);

    assert.ok(transferFn.movedNothing(), 'a refused order must not charge anybody');
    assert.strictEqual(transferFn.of('ada'), 10000);
    assert.strictEqual(store.tradeOrders.length, 0, 'and must not leave an order behind');
    assert.strictEqual(store.nextTradeOrderId, 1, 'nor burn an order id');
  } finally {
    voken.restore();
  }
});

test('the gate is checked before the card is even fetched', async () => {
  const store = createVexStore();
  const account = openAccount(store);
  const voken = stubVokenClient(cardWith([]));

  try {
    await assert.rejects(() => brokerage.placeTradeOrder(store, {
      accountId: account.id, cardId: 'card-1', orderType: 'buy',
      quantity: 1, pricePerUnit: 100, transferFn: ledger({ ada: 1000 }),
    }), /held pending/);

    // Ordering is the whole point of a gate. Checking it last means
    // every refusal still did the work — and one refactor away from
    // still doing the *settlement*.
    assert.strictEqual(voken.calls.get, 0, 'no card lookup');
    assert.strictEqual(voken.calls.mint, 0, 'no edition minted');
    assert.strictEqual(voken.calls.transfer, 0, 'no ownership moved');
  } finally {
    voken.restore();
  }
});

test('a garbage order is still refused by the gate, not by validation', async () => {
  const store = createVexStore();
  const voken = stubVokenClient(cardWith([]));

  try {
    // No account, negative quantity, no transferFn — every other guard
    // would also reject this. The gate must be the one that speaks
    // first, because that is the only ordering that holds when the
    // order is otherwise perfect.
    await assert.rejects(() => brokerage.placeTradeOrder(store, {
      accountId: 999, cardId: 'nope', orderType: 'sideways', quantity: -5, pricePerUnit: -1,
    }), /held pending real broker-dealer compliance review/);
  } finally {
    voken.restore();
  }
});

// -- With the gate open, the mechanics must still be right ---------------

test('an open gate lets a buy through: money moves and editions are minted', async () => {
  const store = createVexStore();
  gate.setComplianceStatus(store, 'vex-brokerage', true);
  const account = openAccount(store);
  const transferFn = ledger({ ada: 1000 });
  const voken = stubVokenClient(cardWith([]));

  try {
    const order = await brokerage.placeTradeOrder(store, {
      accountId: account.id, cardId: 'card-1', orderType: 'buy',
      quantity: 3, pricePerUnit: 50, transferFn,
    });

    assert.strictEqual(order.totalAmount, 150);
    assert.strictEqual(transferFn.of('ada'), 850);
    assert.strictEqual(transferFn.of(brokerage.VEX_PLATFORM_ACCOUNT), 150);
    assert.strictEqual(voken.calls.mint, 3, 'one edition per unit bought, not one per order');
    assert.strictEqual(order.status, 'filled');
  } finally {
    voken.restore();
  }
});

test('closing the gate again stops trading immediately', async () => {
  const store = createVexStore();
  const account = openAccount(store);
  const transferFn = ledger({ ada: 1000 });
  const voken = stubVokenClient(cardWith([]));

  try {
    gate.setComplianceStatus(store, 'vex-brokerage', true);
    await brokerage.placeTradeOrder(store, {
      accountId: account.id, cardId: 'card-1', orderType: 'buy',
      quantity: 1, pricePerUnit: 100, transferFn,
    });
    assert.strictEqual(transferFn.of('ada'), 900);

    // A gate that only gates at startup is not a gate. Registration can
    // lapse, and the close must bite the very next order.
    gate.setComplianceStatus(store, 'vex-brokerage', false);
    await assert.rejects(() => brokerage.placeTradeOrder(store, {
      accountId: account.id, cardId: 'card-1', orderType: 'buy',
      quantity: 1, pricePerUnit: 100, transferFn,
    }), /held pending/);
    assert.strictEqual(transferFn.of('ada'), 900, 'balance unchanged after the refusal');
  } finally {
    voken.restore();
  }
});

test('a sell of editions the account does not hold is refused before it is paid', async () => {
  const store = createVexStore();
  gate.setComplianceStatus(store, 'vex-brokerage', true);
  const account = openAccount(store, 'ada');
  const transferFn = ledger({ 'vex-platform': 10000 });
  // The card exists and has editions — they just belong to someone else.
  const voken = stubVokenClient(cardWith([
    { editionNumber: 1, format: 'digital', ownerId: 'rio' },
    { editionNumber: 2, format: 'digital', ownerId: 'rio' },
  ]));

  try {
    await assert.rejects(() => brokerage.placeTradeOrder(store, {
      accountId: account.id, cardId: 'card-1', orderType: 'sell',
      quantity: 1, pricePerUnit: 100, transferFn,
    }), /owns only 0 digital editions/);

    // The payout happens after the ownership transfer in this flow, so
    // a holdings check that ran late would pay for nothing.
    assert.ok(transferFn.movedNothing(), 'selling what you do not own must not pay out');
    assert.strictEqual(voken.calls.transfer, 0);
  } finally {
    voken.restore();
  }
});

test('a partial holding cannot be oversold', async () => {
  const store = createVexStore();
  gate.setComplianceStatus(store, 'vex-brokerage', true);
  const account = openAccount(store, 'ada');
  const transferFn = ledger({ 'vex-platform': 10000 });
  const voken = stubVokenClient(cardWith([
    { editionNumber: 1, format: 'digital', ownerId: 'ada' },
    // A physical edition ada owns must not count toward a digital sell.
    { editionNumber: 1, format: 'physical', ownerId: 'ada' },
  ]));

  try {
    await assert.rejects(() => brokerage.placeTradeOrder(store, {
      accountId: account.id, cardId: 'card-1', orderType: 'sell',
      quantity: 2, pricePerUnit: 100, transferFn,
    }), /owns only 1 digital editions/);
    assert.ok(transferFn.movedNothing());
  } finally {
    voken.restore();
  }
});

// -- Accounts ------------------------------------------------------------

test('an account requires a user, and only a known net-capital model', () => {
  const store = createVexStore();
  assert.throws(() => brokerage.openBrokerAccount(store, {}), /requires a userId/);
  assert.throws(() => brokerage.openBrokerAccount(store, {
    userId: 'ada', netCapitalModel: 'self-clearing',
  }), /invalid netCapitalModel/);

  assert.strictEqual(store.brokerAccounts.length, 0, 'a refused account must not be stored');
  assert.deepStrictEqual(brokerage.NET_CAPITAL_MODELS, ['introducing-broker']);
});

test('an order against an unknown account is refused once the gate is open', async () => {
  const store = createVexStore();
  gate.setComplianceStatus(store, 'vex-brokerage', true);
  const transferFn = ledger({ ada: 1000 });
  const voken = stubVokenClient(cardWith([]));

  try {
    await assert.rejects(() => brokerage.placeTradeOrder(store, {
      accountId: 999, cardId: 'card-1', orderType: 'buy',
      quantity: 1, pricePerUnit: 100, transferFn,
    }), /no broker account with id 999/);
    assert.ok(transferFn.movedNothing());
  } finally {
    voken.restore();
  }
});

test('an order with no transferFn is refused rather than settling silently', async () => {
  const store = createVexStore();
  gate.setComplianceStatus(store, 'vex-brokerage', true);
  const account = openAccount(store);
  const voken = stubVokenClient(cardWith([]));

  try {
    // The dangerous version of this bug is not a crash — it is a
    // module that treats a missing ledger as "settlement not required"
    // and records a filled order anyway.
    await assert.rejects(() => brokerage.placeTradeOrder(store, {
      accountId: account.id, cardId: 'card-1', orderType: 'buy', quantity: 1, pricePerUnit: 100,
    }), /requires a transferFn/);
    assert.strictEqual(store.tradeOrders.length, 0);
    assert.strictEqual(voken.calls.mint, 0);
  } finally {
    voken.restore();
  }
});

test('quantity and price must be real, positive numbers', async () => {
  const store = createVexStore();
  gate.setComplianceStatus(store, 'vex-brokerage', true);
  const account = openAccount(store);
  const transferFn = ledger({ ada: 1000 });
  const voken = stubVokenClient(cardWith([]));

  try {
    for (const quantity of [0, -1, 1.5, '2', NaN]) {
      await assert.rejects(() => brokerage.placeTradeOrder(store, {
        accountId: account.id, cardId: 'card-1', orderType: 'buy',
        quantity, pricePerUnit: 100, transferFn,
      }), /positive integer quantity/, `quantity ${JSON.stringify(quantity)}`);
    }
    for (const pricePerUnit of [0, -100, '100', NaN]) {
      await assert.rejects(() => brokerage.placeTradeOrder(store, {
        accountId: account.id, cardId: 'card-1', orderType: 'buy',
        quantity: 1, pricePerUnit, transferFn,
      }), /positive pricePerUnit/, `price ${JSON.stringify(pricePerUnit)}`);
    }
    assert.ok(transferFn.movedNothing(), 'not one of those refusals may have moved money');
  } finally {
    voken.restore();
  }
});
