// CVNVO's money path: gift-gated date requests.
//
// CVNVO's parent app was at zero coverage (`cvnvo/yap` had tests; the
// dating app itself did not) while moving VCoin from one user directly
// to another. This is the money path in the ecosystem with the most
// personal stakes: a stranger sends a real gift to a real person to ask
// them out, and the recipient sets the floor.
//
// **Asserted on the money, never on a status.** `requestDateWithGift`
// returns a request record carrying `giftValueVCoin`; a test reading
// only that would pass while the gift moved nothing, or moved to the
// wrong person, or moved twice.

const test = require('node:test');
const assert = require('node:assert');

const { createCvnvoStore } = require('../lib/store');
const {
  setGiftThreshold, getGiftThreshold, requestDateWithGift, getGiftRequestsForUser,
} = require('../lib/giftDating');

function recorder() {
  const moves = [];
  const fn = async (fromUserId, toUserId, amount, reason) => {
    moves.push({ fromUserId, toUserId, amount, reason });
    return { ok: true };
  };
  fn.moves = moves;
  fn.totalTo = (who) => moves.filter((m) => m.toUserId === who).reduce((n, m) => n + m.amount, 0);
  fn.totalFrom = (who) => moves.filter((m) => m.fromUserId === who).reduce((n, m) => n + m.amount, 0);
  return fn;
}

// -- The gift moves ------------------------------------------------------

test('a gift goes from the requester to the recipient, once', async () => {
  const store = createCvnvoStore();
  const transferFn = recorder();

  await requestDateWithGift(store, {
    requesterId: 'ada', recipientId: 'bo', giftValueVCoin: 50, transferFn,
  });

  assert.equal(transferFn.moves.length, 1, 'a gift moved money more than once');
  assert.equal(transferFn.totalTo('bo'), 50);
  assert.equal(transferFn.totalFrom('ada'), 50);
});

test('no cut is taken from a gift — the recipient receives the full amount', async () => {
  const store = createCvnvoStore();
  const transferFn = recorder();
  await requestDateWithGift(store, {
    requesterId: 'ada', recipientId: 'bo', giftValueVCoin: 100, transferFn,
  });
  assert.equal(transferFn.totalTo('bo'), 100, 'a cut was taken from a personal gift');
});

// -- The recipient's own floor -------------------------------------------

test("a gift under the recipient's threshold is refused, and moves nothing", async () => {
  // The threshold belongs to the recipient. A gift that slips under it
  // and still lands would mean their stated floor did not hold.
  const store = createCvnvoStore();
  setGiftThreshold(store, { userId: 'bo', minGiftValueVCoin: 100 });
  const transferFn = recorder();

  await assert.rejects(
    () => requestDateWithGift(store, {
      requesterId: 'ada', recipientId: 'bo', giftValueVCoin: 99, transferFn,
    }),
    /requires a minimum gift of 100/,
  );
  assert.equal(transferFn.moves.length, 0, 'a refused request still moved money');
  assert.equal(store.giftDateRequests.length, 0, 'a refused request was still recorded');
});

test('a gift exactly at the threshold is accepted', async () => {
  const store = createCvnvoStore();
  setGiftThreshold(store, { userId: 'bo', minGiftValueVCoin: 100 });
  const transferFn = recorder();
  await requestDateWithGift(store, {
    requesterId: 'ada', recipientId: 'bo', giftValueVCoin: 100, transferFn,
  });
  assert.equal(transferFn.totalTo('bo'), 100);
});

test("one person's threshold does not apply to another", async () => {
  const store = createCvnvoStore();
  setGiftThreshold(store, { userId: 'bo', minGiftValueVCoin: 500 });
  const transferFn = recorder();
  // Cy set no floor, so a small gift reaches them.
  await requestDateWithGift(store, {
    requesterId: 'ada', recipientId: 'cy', giftValueVCoin: 5, transferFn,
  });
  assert.equal(transferFn.totalTo('cy'), 5);
  assert.equal(transferFn.totalTo('bo'), 0);
});

test('raising a threshold applies to the next request, not retroactively', async () => {
  const store = createCvnvoStore();
  const transferFn = recorder();
  await requestDateWithGift(store, {
    requesterId: 'ada', recipientId: 'bo', giftValueVCoin: 10, transferFn,
  });
  setGiftThreshold(store, { userId: 'bo', minGiftValueVCoin: 100 });

  // The gift already received stays received.
  assert.equal(transferFn.totalTo('bo'), 10);
  await assert.rejects(
    () => requestDateWithGift(store, {
      requesterId: 'cy', recipientId: 'bo', giftValueVCoin: 10, transferFn,
    }),
    /minimum gift of 100/,
  );
  assert.equal(transferFn.totalTo('bo'), 10, 'the refused second gift still landed');
});

test('updating a threshold replaces it rather than stacking a second one', () => {
  const store = createCvnvoStore();
  setGiftThreshold(store, { userId: 'bo', minGiftValueVCoin: 50 });
  setGiftThreshold(store, { userId: 'bo', minGiftValueVCoin: 200 });
  assert.equal(store.giftDatingThresholds.filter((t) => t.userId === 'bo').length, 1);
  assert.equal(getGiftThreshold(store, 'bo').minGiftValueVCoin, 200);
});

test('a threshold of zero means no floor, not no gifts', async () => {
  const store = createCvnvoStore();
  setGiftThreshold(store, { userId: 'bo', minGiftValueVCoin: 0 });
  const transferFn = recorder();
  await requestDateWithGift(store, {
    requesterId: 'ada', recipientId: 'bo', giftValueVCoin: 1, transferFn,
  });
  assert.equal(transferFn.totalTo('bo'), 1);
});

// -- Refusals move nothing -----------------------------------------------

test('a non-numeric gift is refused rather than becoming NaN', async () => {
  const store = createCvnvoStore();
  const transferFn = recorder();
  for (const bad of [NaN, Infinity, -1, 0, '50', null, undefined]) {
    await assert.rejects(
      () => requestDateWithGift(store, {
        requesterId: 'ada', recipientId: 'bo', giftValueVCoin: bad, transferFn,
      }),
      `giftValueVCoin ${String(bad)} was accepted`,
    );
  }
  assert.equal(transferFn.moves.length, 0);
  assert.equal(store.giftDateRequests.length, 0);
});

test('a request with no transferFn is refused rather than silently free', async () => {
  const store = createCvnvoStore();
  await assert.rejects(
    () => requestDateWithGift(store, {
      requesterId: 'ada', recipientId: 'bo', giftValueVCoin: 50,
    }),
    /requires a transferFn/,
  );
  assert.equal(store.giftDateRequests.length, 0, 'a request was recorded with no gift sent');
});

test('you cannot send yourself a gift to ask yourself out', async () => {
  // Not a joke: a self-transfer that passed would let anyone
  // manufacture request records at no cost.
  const store = createCvnvoStore();
  const transferFn = recorder();
  await assert.rejects(
    () => requestDateWithGift(store, {
      requesterId: 'ada', recipientId: 'ada', giftValueVCoin: 50, transferFn,
    }),
    /must differ/,
  );
  assert.equal(transferFn.moves.length, 0);
});

test('a negative threshold is refused', () => {
  const store = createCvnvoStore();
  assert.throws(
    () => setGiftThreshold(store, { userId: 'bo', minGiftValueVCoin: -1 }),
    /non-negative/,
  );
  assert.equal(getGiftThreshold(store, 'bo'), null);
});

// -- Attribution ----------------------------------------------------------

test('requests are listed for the recipient, not the requester', async () => {
  const store = createCvnvoStore();
  const transferFn = recorder();
  await requestDateWithGift(store, { requesterId: 'ada', recipientId: 'bo', giftValueVCoin: 10, transferFn });
  await requestDateWithGift(store, { requesterId: 'cy', recipientId: 'bo', giftValueVCoin: 20, transferFn });

  assert.equal(getGiftRequestsForUser(store, 'bo').length, 2);
  assert.equal(getGiftRequestsForUser(store, 'ada').length, 0);
  assert.equal(transferFn.totalTo('bo'), 30);
});
