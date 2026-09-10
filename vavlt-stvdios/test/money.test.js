// Vavlt Stvdios' money path: channel tips paid to a person.
//
// Vavlt Stvdios was at zero coverage while moving VCoin on every tip.
// The structural point the module exists to prove is a money fact:
// `recipientPersonId` is a specific person, **not** the channel's
// `ownerId` — a doorman with his own camera earns his own tips even
// though the club owns the channel. That distinction is only real if
// the transfer actually lands on the person, and nothing asserted it.
//
// **Asserted on the money, never on a status.** `tipChannel` returns a
// tip record carrying `recipientPersonId` and `amountVCoin`; a test
// reading only those would pass while the money went to the channel
// owner instead.

const test = require('node:test');
const assert = require('node:assert');

const { createVavltStvdiosStore } = require('../lib/store');
const { createChannel } = require('../lib/channels');
const { tipChannel, getTipsForChannel, getTotalTipsForPerson } = require('../lib/channelTips');

function recorder() {
  const moves = [];
  // Takes a settlement and applies each leg, so every existing
  // assertion below reads exactly as it did when these were
  // separate transfers. `calls` is the new question: how many
  // times the ledger was asked. Amounts are identical whether a
  // settlement is atomic or split, which is why only a call count
  // can tell them apart.
  const calls = [];
  const fn = async (legs, meta = {}) => {
    calls.push({ legs, meta });
    for (const { fromUserId: fromUserId, toUserId: toUserId, amount: amount, reason: reason } of legs) {
      moves.push({ fromUserId, toUserId, amount, reason });
    }
    return { ok: true };
  };
  fn.calls = calls;
  fn.moves = moves;
  fn.totalTo = (who) => moves.filter((m) => m.toUserId === who).reduce((n, m) => n + m.amount, 0);
  fn.totalFrom = (who) => moves.filter((m) => m.fromUserId === who).reduce((n, m) => n + m.amount, 0);
  return fn;
}

// A channel owned by a business, per the module's own framing.
function clubChannel(store) {
  return createChannel(store, {
    ownerId: 'club-owner',
    groupingType: 'same-location-multi-room',
    name: 'Front Door Cam',
    streamUrl: 'https://example.test/door.m3u8',
  });
}

// -- The point of the module ---------------------------------------------

test('a tip lands on the person, never on the channel owner', async () => {
  const store = createVavltStvdiosStore();
  const channel = clubChannel(store);
  const settleFn = recorder();

  await tipChannel(store, {
    channelId: channel.id, tipperId: 'viewer-1', recipientPersonId: 'doorman-1',
    amountVCoin: 25, settleFn,
  });

  assert.equal(settleFn.totalTo('doorman-1'), 25);
  assert.equal(
    settleFn.totalTo('club-owner'), 0,
    'the tip was routed through the channel owner — the whole point of this module is that it is not',
  );
  assert.equal(settleFn.totalFrom('viewer-1'), 25);
  assert.equal(settleFn.moves.length, 1, 'a tip moved money more than once');
});

test('no platform cut is taken from a tip', async () => {
  // The module says so explicitly: the 80/20 split in the source
  // document is for locked-content subscriptions, not tips, and no fee
  // on tips is specified anywhere — "so none is invented." Asserted, so
  // a fee cannot appear later without this failing.
  const store = createVavltStvdiosStore();
  const channel = clubChannel(store);
  const settleFn = recorder();

  await tipChannel(store, {
    channelId: channel.id, tipperId: 'viewer-1', recipientPersonId: 'doorman-1',
    amountVCoin: 100, settleFn,
  });

  assert.equal(settleFn.totalFrom('viewer-1'), 100);
  assert.equal(settleFn.totalTo('doorman-1'), 100, 'a cut was taken from a tip');
});

test('two people on the same channel earn separately', async () => {
  // "Every role becomes its own earner" — only true if two recipients
  // on one channel keep their own totals.
  const store = createVavltStvdiosStore();
  const channel = clubChannel(store);
  const settleFn = recorder();

  await tipChannel(store, {
    channelId: channel.id, tipperId: 'v1', recipientPersonId: 'doorman-1', amountVCoin: 10, settleFn,
  });
  await tipChannel(store, {
    channelId: channel.id, tipperId: 'v2', recipientPersonId: 'barber-1', amountVCoin: 40, settleFn,
  });

  assert.equal(settleFn.totalTo('doorman-1'), 10);
  assert.equal(settleFn.totalTo('barber-1'), 40);
  assert.equal(getTotalTipsForPerson(store, 'doorman-1'), 10);
  assert.equal(getTotalTipsForPerson(store, 'barber-1'), 40);
});

test('a person earns across channels, and the total matches what moved', async () => {
  const store = createVavltStvdiosStore();
  const a = clubChannel(store);
  const b = createChannel(store, {
    ownerId: 'other-owner', groupingType: 'same-role-multi-location',
    name: 'Second Venue', streamUrl: 'https://example.test/b.m3u8',
  });
  const settleFn = recorder();

  await tipChannel(store, { channelId: a.id, tipperId: 'v1', recipientPersonId: 'doorman-1', amountVCoin: 15, settleFn });
  await tipChannel(store, { channelId: b.id, tipperId: 'v2', recipientPersonId: 'doorman-1', amountVCoin: 35, settleFn });

  assert.equal(getTotalTipsForPerson(store, 'doorman-1'), 50);
  assert.equal(settleFn.totalTo('doorman-1'), 50, 'the reported total disagrees with the ledger');
});

test('tips are attributed to the channel they were given on', async () => {
  const store = createVavltStvdiosStore();
  const a = clubChannel(store);
  const b = createChannel(store, {
    ownerId: 'other-owner', groupingType: 'same-role-multi-location',
    name: 'Second Venue', streamUrl: 'https://example.test/b.m3u8',
  });
  const settleFn = recorder();
  await tipChannel(store, { channelId: a.id, tipperId: 'v1', recipientPersonId: 'p1', amountVCoin: 5, settleFn });

  assert.equal(getTipsForChannel(store, a.id).length, 1);
  assert.equal(getTipsForChannel(store, b.id).length, 0);
});

// -- Refusals move nothing -----------------------------------------------

test('a non-numeric amount is refused rather than becoming NaN', async () => {
  const store = createVavltStvdiosStore();
  const channel = clubChannel(store);
  const settleFn = recorder();
  for (const bad of [NaN, Infinity, -1, 0, '25', null, undefined]) {
    await assert.rejects(
      () => tipChannel(store, {
        channelId: channel.id, tipperId: 'v1', recipientPersonId: 'p1', amountVCoin: bad, settleFn,
      }),
      `amountVCoin ${String(bad)} was accepted`,
    );
  }
  assert.equal(settleFn.moves.length, 0);
  assert.equal(store.channelTips.length, 0, 'a refused tip was still recorded');
});

test('a tip with no settleFn is refused rather than silently free', async () => {
  const store = createVavltStvdiosStore();
  const channel = clubChannel(store);
  await assert.rejects(
    () => tipChannel(store, {
      channelId: channel.id, tipperId: 'v1', recipientPersonId: 'p1', amountVCoin: 10,
    }),
    /requires a settleFn/,
  );
  assert.equal(store.channelTips.length, 0, 'a tip was recorded with no money moved');
});

test('a tip with no named recipient is refused — money needs somewhere to land', async () => {
  const store = createVavltStvdiosStore();
  const channel = clubChannel(store);
  const settleFn = recorder();
  await assert.rejects(
    () => tipChannel(store, {
      channelId: channel.id, tipperId: 'v1', amountVCoin: 10, settleFn,
    }),
    /requires a recipientPersonId/,
  );
  assert.equal(settleFn.moves.length, 0);
});

test('a tip on a channel that does not exist moves nothing', async () => {
  const store = createVavltStvdiosStore();
  const settleFn = recorder();
  await assert.rejects(
    () => tipChannel(store, {
      channelId: 9999, tipperId: 'v1', recipientPersonId: 'p1', amountVCoin: 10, settleFn,
    }),
    /no channel with id/,
  );
  assert.equal(settleFn.moves.length, 0);
});

test('a person with no tips has a total of zero, not undefined', () => {
  const store = createVavltStvdiosStore();
  assert.equal(getTotalTipsForPerson(store, 'nobody'), 0);
});
