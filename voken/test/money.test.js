// VOKEN — the eight money flows, none of which had a test.
//
// **Why this file exists.** VOKEN moves real VCoin through eight
// separate paths and its only test file covered the compliance gate.
// `dev-docs/CVLTVRE_AND_VADO_EXTRACTION_AUDIT.md` named this as the
// precondition for any restructuring of the CVLTVRE square: four of
// these flows cross the proposed VOKEN/VADO boundary, and
// restructuring untested money code is the riskiest operation
// available in this repository.
//
// The flows:
//
//   1. pack open          buyer -> platform, then mints editions
//   2. raffle draw         no money, but mints an edition to a winner
//   3. trade               no money, but swaps custody both ways
//   4. auction settle      buyer -> seller, AND edition ownership
//   5. fractional buy      buyer -> seller, gated
//   6. secondary shares    buyer -> seller, gated
//   7. merch purchase      buyer -> creator, at a dynamic price
//   8. referral + spin     platform -> user
//
// **The one that matters most is #4.** `auctions.js` settle() calls
// `settleFn` and then `transferEditionOwnership` back to back
// against the same in-process store. That pairing is the reason the
// extraction audit recommends against splitting VADO into its own
// service — a network hop between those two lines produces a buyer who
// has paid and owns nothing, and V3 has no reversal endpoint by
// design. These tests assert the pairing, so a refactor that breaks it
// fails here rather than in production.
//
// Assertions are on money and on custody. Never on a status: a status
// is exactly what stays correct while the money goes wrong.

const test = require('node:test');
const assert = require('node:assert');

const { createVokenStore } = require('../lib/store');
const { mintCultureCard, getCultureCard, mintAdditionalEdition } = require('../lib/cultureCards');
const { VOKEN_PLATFORM_ACCOUNT } = require('../lib/platformAccount');
const { setComplianceStatus } = require('../lib/complianceGate');
const packs = require('../lib/cardPacks');
const raffles = require('../lib/raffles');
const trading = require('../lib/trading');
const auctions = require('../lib/auctions');
const fractional = require('../lib/fractionalOwnership');
const merch = require('../lib/limitedEditionMerch');
const referrals = require('../lib/referralGrowth');

const NOW = Date.UTC(2026, 5, 1);
const DAY = 24 * 3600000;

// A ledger, not a spy. A spy proves a transfer was attempted; a ledger
// proves money landed sanely — and `drift()` proves the total never
// changed, which is the property that actually matters when several
// parties settle in one call.
function ledger(initial = {}) {
  const balances = { ...initial };
  const moves = [];
  const opening = Object.values(balances).reduce((a, b) => a + b, 0);
  // Takes a settlement and applies each leg, so every existing
  // assertion below reads exactly as it did when these were
  // separate transfers. `calls` is the new question: how many
  // times the ledger was asked. Amounts are identical whether a
  // settlement is atomic or split, which is why only a call count
  // can tell them apart.
  const calls = [];
  const fn = async (legs, meta = {}) => {
    calls.push({ legs, meta });
    for (const { fromUserId: from, toUserId: to, amount: amount, reason: reason } of legs) {
      if (!Number.isFinite(amount)) throw new Error(`ledger: non-finite transfer of ${amount} (${reason})`);
      if (amount < 0) throw new Error(`ledger: negative transfer (${reason})`);
      balances[from] = (balances[from] || 0) - amount;
      balances[to] = (balances[to] || 0) + amount;
      moves.push({ from, to, amount, reason });
    }
    return { ok: true };
  };
  fn.calls = calls;
  fn.moves = moves;
  fn.of = (a) => balances[a] || 0;
  fn.movedNothing = () => moves.length === 0;
  // Sub-cent, not bit-exact: rounded shares do not re-add to the
  // original in IEEE-754. A stranded cent is structural; 1e-14 is not.
  fn.drift = () => Object.values(balances).reduce((a, b) => a + b, 0) - opening;
  return fn;
}

// A faithful fake of V3's real idempotency behavior, not a spy. The
// plain `ledger()` above applies every settlement it's handed and
// never looks at `meta.reason` at all, so it cannot tell a genuinely
// unique key from a reused one — which is exactly how six real key-
// collision bugs (auctions.js settle(), cardPacks.js openPack,
// referralGrowth.js's tier bonus and spin, fractionalOwnership.js's
// buyShares and buySecondaryShares, limitedEditionMerch.js's
// purchaseMerchItem) shipped with a green test suite behind them.
// This fake keys by `meta.reason`: a repeat with the same key AND the
// same legs replays; a repeat with the same key and DIFFERENT legs is
// refused, exactly like the real `/api/vcoin/settle` with V3's own
// (now-fixed) deep-stable-stringify fingerprint.
function idempotentLedger(initial = {}) {
  const inner = ledger(initial);
  const seen = new Map();
  const fn = async (legs, meta = {}) => {
    const key = meta && meta.reason;
    const fingerprint = JSON.stringify(legs);
    if (key) {
      const prior = seen.get(key);
      if (prior) {
        if (prior.fingerprint !== fingerprint) {
          throw new Error(`Idempotency-Key "${key}" was already used for a different request`);
        }
        return { ...prior.result, idempotentReplay: true };
      }
    }
    const result = await inner(legs, meta);
    if (key) seen.set(key, { fingerprint, result });
    return result;
  };
  fn.of = inner.of;
  fn.moves = inner.moves;
  fn.calls = inner.calls;
  fn.movedNothing = inner.movedNothing;
  fn.drift = inner.drift;
  fn.realCalls = () => inner.calls.length;
  return fn;
}

function card(store, overrides = {}) {
  return mintCultureCard(store, {
    subjectPersonId: 'nova',
    category: 'music',
    rarityTier: 'rare',
    tokenizationType: 'digital',
    formats: ['digital'],
    plannedDigitalMintCount: 20,
    ...overrides,
  });
}

// `mintCultureCard` already mints edition #1 to the subject at
// creation -- the card-#1-to-subject guarantee. So a "fresh" card is
// never empty, and every count below is relative to that first one.
function ownedEdition(store, cardId, ownerId) {
  return mintAdditionalEdition(store, { cardId, format: 'digital', ownerId });
}

// The subject already owns edition #1, so `nova` gets it for free by
// being the subject -- no extra mint, no assumption about counts.
function cardOwnedBy(store, ownerId, overrides = {}) {
  return card(store, { subjectPersonId: ownerId, ...overrides });
}

// -- 1. Pack opening ------------------------------------------------------

test('opening a pack charges the buyer the tier price and mints them editions', async () => {
  const store = createVokenStore();
  const settleFn = ledger({ sam: 500 });
  const tier = packs.createPackTier(store, { tierName: 'standard', price: 40, cardsPerPack: 3 });
  const ids = [card(store).id, card(store).id, card(store).id, card(store).id];

  const result = await packs.openPack(store, {
    packTierId: tier.packTierId, buyerId: 'sam', candidateCardIds: ids, settleFn, rng: () => 0.5,
  });

  assert.strictEqual(settleFn.of('sam'), 460);
  assert.strictEqual(settleFn.of(VOKEN_PLATFORM_ACCOUNT), 40);
  assert.strictEqual(result.pricePaid, 40);
  assert.strictEqual(result.cardsReceived.length, 3, 'the tier said three cards, so three arrive');
  for (const received of result.cardsReceived) {
    assert.strictEqual(received.edition.ownerId, 'sam',
      'a charged buyer must actually own what they bought');
  }
  assert.strictEqual(settleFn.drift(), 0);
});

test('two different buyers of the same pack tier both actually get charged, against a real idempotency-enforcing ledger', async () => {
  // The bug this test closes: the reason/idempotency key was
  // `voken_pack_open:${packTierId}` alone -- packTierId names a fixed
  // catalog tier, the same for every purchase of that tier by every
  // buyer, forever. The first buyer of "standard" anywhere would be
  // charged and minted; every later buyer (a different buyerId, so a
  // genuinely different settlement) would be refused by a real,
  // fingerprint-checking ledger as "already used for a different
  // request." A per-open nonce fixes it.
  const store = createVokenStore();
  const settleFn = idempotentLedger({ sam: 500, rio: 500 });
  const tier = packs.createPackTier(store, { tierName: 'standard', price: 40, cardsPerPack: 3 });
  const ids = [card(store).id, card(store).id, card(store).id, card(store).id];

  await packs.openPack(store, { packTierId: tier.packTierId, buyerId: 'sam', candidateCardIds: ids, settleFn, rng: () => 0.5 });
  await packs.openPack(store, { packTierId: tier.packTierId, buyerId: 'rio', candidateCardIds: ids, settleFn, rng: () => 0.5 });

  assert.strictEqual(settleFn.realCalls(), 2, 'both purchases must actually reach the ledger');
  assert.strictEqual(settleFn.of('sam'), 460);
  assert.strictEqual(settleFn.of('rio'), 460);
  assert.strictEqual(settleFn.of(VOKEN_PLATFORM_ACCOUNT), 80);
});

test('a declined charge mints nothing — no free cards', async () => {
  const store = createVokenStore();
  const tier = packs.createPackTier(store, { tierName: 'basic', price: 10, cardsPerPack: 2 });
  const target = card(store);
  const declining = async () => { throw new Error('insufficient funds'); };

  await assert.rejects(() => packs.openPack(store, {
    packTierId: tier.packTierId, buyerId: 'broke', candidateCardIds: [target.id],
    settleFn: declining, rng: () => 0,
  }), /insufficient funds/);

  // The charge happens before the mint, which is the correct order:
  // the alternative gives away editions to anyone whose payment fails.
  assert.strictEqual(getCultureCard(store, target.id).editions.length, 1,
    'only the subject\'s own edition #1 remains — nothing was minted for the buyer');
});

test('a pack cannot mint past a card’s planned supply', async () => {
  const store = createVokenStore();
  const settleFn = ledger({ sam: 500 });
  const tier = packs.createPackTier(store, { tierName: 'basic', price: 10, cardsPerPack: 5 });
  // plannedDigitalMintCount: 1 is fully consumed by the subject's own
  // edition #1 at creation, so there is genuinely nothing left to draw.
  const scarce = card(store, { plannedDigitalMintCount: 1 });

  // Print-to-order would destroy the scarcity the whole product sells.
  await assert.rejects(() => packs.openPack(store, {
    packTierId: tier.packTierId, buyerId: 'sam', candidateCardIds: [scarce.id], settleFn, rng: () => 0,
  }), /no candidate cards have any remaining/);
  assert.ok(settleFn.movedNothing(), 'and a refused pack must not charge');
});

// -- 2. Raffles -----------------------------------------------------------

test('a raffle draw mints to a real entrant, exactly once', () => {
  const store = createVokenStore();
  const prize = card(store);
  const raffle = raffles.createRaffle(store, { cardId: prize.id, entryMethod: 'free' });

  raffles.enterRaffle(store, { raffleId: raffle.raffleId, userId: 'ada' });
  raffles.enterRaffle(store, { raffleId: raffle.raffleId, userId: 'rio' });
  const { edition, raffle: drawn } = raffles.drawRaffleWinner(store, { raffleId: raffle.raffleId, rng: () => 0 });

  assert.strictEqual(edition.ownerId, 'ada');
  assert.ok(['ada', 'rio'].includes(drawn.winnerId), 'the winner must be someone who entered');
  // 2 = the subject's edition #1 plus the one just won.
  assert.strictEqual(getCultureCard(store, prize.id).editions.length, 2);

  // Drawing twice would mint a second prize edition for one raffle.
  assert.throws(() => raffles.drawRaffleWinner(store, { raffleId: raffle.raffleId, rng: () => 0 }),
    /already drawn/);
  assert.strictEqual(getCultureCard(store, prize.id).editions.length, 2, 'still two — no second prize');
});

test('entering twice does not double your odds', () => {
  const store = createVokenStore();
  const raffle = raffles.createRaffle(store, { cardId: card(store).id, entryMethod: 'free' });
  for (let i = 0; i < 5; i += 1) {
    raffles.enterRaffle(store, { raffleId: raffle.raffleId, userId: 'spammer' });
  }
  raffles.enterRaffle(store, { raffleId: raffle.raffleId, userId: 'ada' });

  assert.deepStrictEqual(raffles.getRaffle(store, raffle.raffleId).entries, ['spammer', 'ada'],
    'one entry per user — stacking entries is the cheapest way to rig a draw');
});

test('a closed raffle takes no more entries', () => {
  const store = createVokenStore();
  const raffle = raffles.createRaffle(store, { cardId: card(store).id, entryMethod: 'free' });
  raffles.enterRaffle(store, { raffleId: raffle.raffleId, userId: 'ada' });
  raffles.drawRaffleWinner(store, { raffleId: raffle.raffleId, rng: () => 0 });

  assert.throws(() => raffles.enterRaffle(store, { raffleId: raffle.raffleId, userId: 'late' }),
    /no longer open/);
});

// -- 3. Trades ------------------------------------------------------------

test('an accepted trade swaps custody in both directions', () => {
  const store = createVokenStore();
  // Each subject owns their own card's edition #1 by construction.
  const a = cardOwnedBy(store, 'ada');
  const b = cardOwnedBy(store, 'rio');

  const trade = trading.proposeTrade(store, {
    fromUserId: 'ada',
    toUserId: 'rio',
    cardIdsOffered: [{ cardId: a.id, editionNumber: 1, format: 'digital' }],
    cardIdsRequested: [{ cardId: b.id, editionNumber: 1, format: 'digital' }],
  });
  trading.acceptTrade(store, { tradeId: trade.tradeId });

  // A one-sided trade is theft with extra steps, so both directions are
  // asserted rather than just the happy one.
  assert.strictEqual(getCultureCard(store, a.id).editions[0].ownerId, 'rio');
  assert.strictEqual(getCultureCard(store, b.id).editions[0].ownerId, 'ada');
});

test('a trade whose offered edition changed hands first is refused, not half-applied', () => {
  const store = createVokenStore();
  const a = cardOwnedBy(store, 'ada');
  const b = cardOwnedBy(store, 'rio');

  const trade = trading.proposeTrade(store, {
    fromUserId: 'ada', toUserId: 'rio',
    cardIdsOffered: [{ cardId: a.id, editionNumber: 1, format: 'digital' }],
    cardIdsRequested: [{ cardId: b.id, editionNumber: 1, format: 'digital' }],
  });

  // Ada sells the card elsewhere before Rio accepts. Ownership is
  // re-checked at accept time, not trusted from proposal time — the
  // alternative transfers an edition its proposer no longer holds.
  require('../lib/cultureCards').transferEditionOwnership(store, {
    cardId: a.id, editionNumber: 1, format: 'digital', fromOwnerId: 'ada', toOwnerId: 'kai',
  });

  assert.throws(() => trading.acceptTrade(store, { tradeId: trade.tradeId }),
    /no longer owns offered/);
  assert.strictEqual(getCultureCard(store, b.id).editions[0].ownerId, 'rio',
    'and Rio keeps their side — no half-applied swap');
});

test('a cancelled trade cannot then be accepted', () => {
  const store = createVokenStore();
  const a = cardOwnedBy(store, 'ada');
  const b = cardOwnedBy(store, 'rio');

  const trade = trading.proposeTrade(store, {
    fromUserId: 'ada', toUserId: 'rio',
    cardIdsOffered: [{ cardId: a.id, editionNumber: 1, format: 'digital' }],
    cardIdsRequested: [{ cardId: b.id, editionNumber: 1, format: 'digital' }],
  });
  trading.cancelTrade(store, { tradeId: trade.tradeId, requestedByUserId: 'ada' });

  assert.throws(() => trading.acceptTrade(store, { tradeId: trade.tradeId }), /not pending/);
  assert.strictEqual(getCultureCard(store, a.id).editions[0].ownerId, 'ada');
});

test('a trade needs items on both sides — a one-way "trade" is a gift with no consent', () => {
  const store = createVokenStore();
  const a = cardOwnedBy(store, 'ada');

  assert.throws(() => trading.proposeTrade(store, {
    fromUserId: 'ada', toUserId: 'rio',
    cardIdsOffered: [{ cardId: a.id, editionNumber: 1, format: 'digital' }],
    cardIdsRequested: [],
  }), /at least one item on each side/);
});

// -- 4. Auctions: money and custody move together -------------------------

test('an instant auction pays the seller AND hands over the edition', async () => {
  const store = createVokenStore();
  const settleFn = ledger({ sam: 1000, nova: 0 });
  const subject = cardOwnedBy(store, 'nova');
  const edition = { editionNumber: 1 };

  const auction = auctions.createAuction(store, {
    cardId: subject.id, editionNumber: edition.editionNumber, format: 'digital',
    sellerId: 'nova', auctionType: 'instant', startingPrice: 250, reservePrice: 250, now: NOW,
  });
  await auctions.placeBid(store, {
    auctionId: auction.id, bidderId: 'sam', bidAmount: 250, settleFn, now: NOW,
  });

  // **The pairing.** These two assertions are the reason VADO should
  // not become its own service: money and custody move in one function,
  // in one process, with no I/O between them.
  assert.strictEqual(settleFn.of('nova'), 250, 'the seller was paid');
  assert.strictEqual(getCultureCard(store, subject.id).editions[0].ownerId, 'sam',
    'and the buyer owns what they paid for — a paid buyer who owns nothing is the worst outcome here');
  assert.strictEqual(settleFn.of('sam'), 750);
  assert.strictEqual(settleFn.drift(), 0);
});

test('a failed payment leaves the edition with the seller', async () => {
  const store = createVokenStore();
  const subject = cardOwnedBy(store, 'nova');
  const edition = { editionNumber: 1 };
  const declining = async () => { throw new Error('insufficient funds'); };

  const auction = auctions.createAuction(store, {
    cardId: subject.id, editionNumber: edition.editionNumber, format: 'digital',
    sellerId: 'nova', auctionType: 'instant', startingPrice: 250, reservePrice: 250, now: NOW,
  });

  await assert.rejects(() => auctions.placeBid(store, {
    auctionId: auction.id, bidderId: 'broke', bidAmount: 250, settleFn: declining, now: NOW,
  }), /insufficient funds/);

  // settleFn runs first in settle(), so a decline must stop the
  // custody change. The reverse order would give away an edition free.
  assert.strictEqual(getCultureCard(store, subject.id).editions[0].ownerId, 'nova');
});

test('a dutch auction never sells below the seller’s reserve', async () => {
  const store = createVokenStore();
  const settleFn = ledger({ sam: 1000 });
  const subject = cardOwnedBy(store, 'nova');
  const edition = { editionNumber: 1 };

  const auction = auctions.createAuction(store, {
    cardId: subject.id, editionNumber: edition.editionNumber, format: 'digital',
    sellerId: 'nova', auctionType: 'dutch', startingPrice: 1000, reservePrice: 400,
    durationMinutes: 600, now: NOW,
  });

  // Far past the point where linear decay would go below the reserve —
  // and past zero, which is the failure worth guarding.
  const late = NOW + 500 * 60000;
  const price = auctions.getCurrentDutchPrice(auction, late);
  assert.strictEqual(price, 400, 'decay floors at the reserve, it does not run to zero');

  await auctions.placeBid(store, {
    auctionId: auction.id, bidderId: 'sam', bidAmount: price, settleFn, now: late,
  });
  assert.strictEqual(settleFn.of('nova'), 400);
});

test('an english auction pays only the winning bid, once', async () => {
  const store = createVokenStore();
  const settleFn = ledger({ sam: 1000, rio: 1000 });
  const subject = cardOwnedBy(store, 'nova');
  const edition = { editionNumber: 1 };

  const auction = auctions.createAuction(store, {
    cardId: subject.id, editionNumber: edition.editionNumber, format: 'digital',
    sellerId: 'nova', auctionType: 'english', startingPrice: 100, reservePrice: 100,
    durationMinutes: 60, now: NOW,
  });
  await auctions.placeBid(store, { auctionId: auction.id, bidderId: 'sam', bidAmount: 150, settleFn, now: NOW });
  await auctions.placeBid(store, { auctionId: auction.id, bidderId: 'rio', bidAmount: 200, settleFn, now: NOW + 1 });

  // Bidding must not charge. Only the close does — otherwise every
  // outbid participant has paid for nothing.
  assert.ok(settleFn.movedNothing(), 'bids are commitments, not charges');

  await auctions.endAuction(store, { auctionId: auction.id, settleFn });
  assert.strictEqual(settleFn.of('rio'), 800, 'the winner paid exactly their bid');
  assert.strictEqual(settleFn.of('sam'), 1000, 'the loser paid nothing');
  assert.strictEqual(settleFn.of('nova'), 200);
  assert.strictEqual(getCultureCard(store, subject.id).editions[0].ownerId, 'rio');
});

test('an auction of an edition the seller does not own is refused', () => {
  const store = createVokenStore();
  const subject = cardOwnedBy(store, 'someone-else');

  assert.throws(() => auctions.createAuction(store, {
    cardId: subject.id, editionNumber: 1, format: 'digital',
    sellerId: 'nova', auctionType: 'instant', startingPrice: 100, reservePrice: 100, now: NOW,
  }), /.*/);
});

test('a card resold through a second instant auction actually settles, against a real idempotency-enforcing ledger', async () => {
  // The bug this test closes: settle()'s reason/idempotency key used
  // to be `voken_vado_${auctionType}:${cardId}` -- the same for EVERY
  // auction ever run on that card through that auctionType. A plain
  // ledger (every other test above uses one) applies whatever it's
  // handed and would never notice; a real V3-shaped ledger, keyed by
  // reason and comparing leg content, refuses a second genuinely
  // different settlement under a reused key. Keying by auction.id
  // instead fixes it.
  const store = createVokenStore();
  const settleFn = idempotentLedger({ sam: 1000, rio: 1000 });
  const subject = cardOwnedBy(store, 'nova');

  const firstAuction = auctions.createAuction(store, {
    cardId: subject.id, editionNumber: 1, format: 'digital',
    sellerId: 'nova', auctionType: 'instant', startingPrice: 100, reservePrice: 100, now: NOW,
  });
  await auctions.placeBid(store, { auctionId: firstAuction.id, bidderId: 'sam', bidAmount: 100, settleFn, now: NOW });
  assert.strictEqual(getCultureCard(store, subject.id).editions[0].ownerId, 'sam');

  // sam now owns the edition and lists it again, a genuinely different
  // sale with a different seller, buyer, and (here) price.
  const secondAuction = auctions.createAuction(store, {
    cardId: subject.id, editionNumber: 1, format: 'digital',
    sellerId: 'sam', auctionType: 'instant', startingPrice: 150, reservePrice: 150, now: NOW,
  });
  await auctions.placeBid(store, { auctionId: secondAuction.id, bidderId: 'rio', bidAmount: 150, settleFn, now: NOW });

  assert.strictEqual(settleFn.realCalls(), 2, 'both sales must actually reach the ledger, not replay the first');
  assert.strictEqual(getCultureCard(store, subject.id).editions[0].ownerId, 'rio', 'the second sale must actually transfer the edition');
  assert.strictEqual(settleFn.of('sam'), 1050, '-100 to buy, +150 to resell');
  assert.strictEqual(settleFn.of('rio'), 850);
});

test('two concurrent buys of the same instant auction — only one settles, the other is refused', async () => {
  // settle()'s status write used to happen after the settlement
  // awaited, not before -- the same claim-after-pay race
  // lib/settleOnce.js's own header documents in four other apps. Two
  // concurrent instant-buy requests on the same auction both used to
  // pass the "is it still open" check before either awaited, both
  // paid the seller, and transferEditionOwnership ran twice.
  const store = createVokenStore();
  const settleFn = idempotentLedger({ sam: 1000, rio: 1000 });
  const subject = cardOwnedBy(store, 'nova');
  const auction = auctions.createAuction(store, {
    cardId: subject.id, editionNumber: 1, format: 'digital',
    sellerId: 'nova', auctionType: 'instant', startingPrice: 100, reservePrice: 100, now: NOW,
  });

  const results = await Promise.allSettled([
    auctions.placeBid(store, { auctionId: auction.id, bidderId: 'sam', bidAmount: 100, settleFn, now: NOW }),
    auctions.placeBid(store, { auctionId: auction.id, bidderId: 'rio', bidAmount: 100, settleFn, now: NOW }),
  ]);

  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');
  assert.strictEqual(fulfilled.length, 1, 'exactly one buyer may win the same auction');
  assert.strictEqual(rejected.length, 1);
  assert.strictEqual(settleFn.realCalls(), 1, 'the seller must be paid exactly once');
  const winner = fulfilled[0].value.buyerId;
  assert.strictEqual(getCultureCard(store, subject.id).editions[0].ownerId, winner);
});

// -- 5 & 6. Fractional shares, primary and secondary ----------------------

test('fractional buying is refused while the compliance gate is closed', async () => {
  const store = createVokenStore();
  const settleFn = ledger({ sam: 1000 });
  const subject = cardOwnedBy(store, 'nova');
  const edition = { editionNumber: 1 };

  const listing = fractional.createFractionalListing(store, {
    cardId: subject.id, editionNumber: edition.editionNumber, format: 'digital',
    sellerId: 'nova', totalShares: 10, pricePerShare: 50,
  });

  // The gate is securities posture, not a feature flag. Default closed.
  await assert.rejects(() => fractional.buyShares(store, {
    listingId: listing.id, buyerId: 'sam', shareCount: 2, settleFn, now: NOW,
  }), /not yet compliance-cleared/);
  assert.ok(settleFn.movedNothing());
});

test('a cleared fractional purchase pays the seller and cannot oversell', async () => {
  const store = createVokenStore();
  setComplianceStatus(store, 'fractional-ownership', true);
  const settleFn = ledger({ sam: 1000, rio: 1000 });
  const subject = cardOwnedBy(store, 'nova');
  const edition = { editionNumber: 1 };

  const listing = fractional.createFractionalListing(store, {
    cardId: subject.id, editionNumber: edition.editionNumber, format: 'digital',
    sellerId: 'nova', totalShares: 10, pricePerShare: 50,
  });

  await fractional.buyShares(store, {
    listingId: listing.id, buyerId: 'sam', shareCount: 4, settleFn, now: NOW,
  });
  assert.strictEqual(settleFn.of('sam'), 800);
  assert.strictEqual(settleFn.of('nova'), 200);

  await fractional.buyShares(store, {
    listingId: listing.id, buyerId: 'rio', shareCount: 6, settleFn, now: NOW,
  });
  assert.strictEqual(settleFn.of('nova'), 500, 'the seller is paid for every share, not just the first buyer');

  // Selling an eleventh share of ten dilutes everyone who already
  // bought, silently and after the fact.
  await assert.rejects(() => fractional.buyShares(store, {
    listingId: listing.id, buyerId: 'sam', shareCount: 1, settleFn, now: NOW,
  }), /shares remain|not open/);
  assert.strictEqual(settleFn.drift(), 0);
});

test('two different buyers of the same fractional listing both actually get charged, against a real idempotency-enforcing ledger', async () => {
  // The bug this test closes: the reason/idempotency key was
  // `voken_fractional_shares:${listing.cardId}` -- the same for every
  // buyer who buys into that listing before it sells out. A real,
  // fingerprint-checking ledger would refuse every buyer after the
  // first as "already used for a different request." Keying by
  // listing.id and the share offset the purchase starts from fixes
  // it, since that offset is claimed atomically and can't repeat.
  const store = createVokenStore();
  setComplianceStatus(store, 'fractional-ownership', true);
  const settleFn = idempotentLedger({ sam: 1000, rio: 1000 });
  const subject = cardOwnedBy(store, 'nova');
  const listing = fractional.createFractionalListing(store, {
    cardId: subject.id, editionNumber: 1, format: 'digital',
    sellerId: 'nova', totalShares: 10, pricePerShare: 50,
  });

  await fractional.buyShares(store, { listingId: listing.id, buyerId: 'sam', shareCount: 4, settleFn, now: NOW });
  await fractional.buyShares(store, { listingId: listing.id, buyerId: 'rio', shareCount: 6, settleFn, now: NOW });

  assert.strictEqual(settleFn.realCalls(), 2, 'both purchases must actually reach the ledger');
  assert.strictEqual(settleFn.of('nova'), 500, 'the seller must be paid for both purchases, not just the first');
});

test('the underlying edition moves into the pool, not to a shareholder', () => {
  const store = createVokenStore();
  const subject = cardOwnedBy(store, 'nova');
  const edition = { editionNumber: 1 };

  fractional.createFractionalListing(store, {
    cardId: subject.id, editionNumber: edition.editionNumber, format: 'digital',
    sellerId: 'nova', totalShares: 10, pricePerShare: 50,
  });

  // If custody stayed with the seller they could sell the same edition
  // out from under the shareholders.
  assert.strictEqual(getCultureCard(store, subject.id).editions[0].ownerId,
    fractional.VOKEN_FRACTIONAL_POOL);
});

test('secondary shares settle peer to peer, and the gate applies there too', async () => {
  const store = createVokenStore();
  setComplianceStatus(store, 'fractional-ownership', true);
  const settleFn = ledger({ sam: 1000, rio: 1000 });
  const subject = cardOwnedBy(store, 'nova');
  const edition = { editionNumber: 1 };

  const listing = fractional.createFractionalListing(store, {
    cardId: subject.id, editionNumber: edition.editionNumber, format: 'digital',
    sellerId: 'nova', totalShares: 10, pricePerShare: 50,
  });
  await fractional.buyShares(store, {
    listingId: listing.id, buyerId: 'sam', shareCount: 5, settleFn, now: NOW,
  });

  // Primary lots carry a lockup; resale is only possible after it.
  const afterLockup = NOW + 200 * DAY;
  const secondary = fractional.createSecondaryListing(store, {
    fractionalListingId: listing.id, sellerId: 'sam', shareCount: 2, pricePerShare: 80, now: afterLockup,
  });

  const beforeSam = settleFn.of('sam');
  await fractional.buySecondaryShares(store, {
    secondaryListingId: secondary.id, buyerId: 'rio', settleFn,
  });

  // Peer to peer: the original seller is not paid twice for the same
  // shares, and the platform takes no second cut here.
  assert.strictEqual(settleFn.of('sam'), beforeSam + 160);
  assert.strictEqual(settleFn.of('rio'), 840);
  assert.strictEqual(settleFn.of('nova'), 250, 'unchanged by the resale');
  assert.strictEqual(settleFn.drift(), 0);
});

test('you cannot buy your own secondary listing', async () => {
  const store = createVokenStore();
  setComplianceStatus(store, 'fractional-ownership', true);
  const settleFn = ledger({ sam: 1000 });
  const subject = cardOwnedBy(store, 'nova');
  const edition = { editionNumber: 1 };

  const listing = fractional.createFractionalListing(store, {
    cardId: subject.id, editionNumber: edition.editionNumber, format: 'digital',
    sellerId: 'nova', totalShares: 10, pricePerShare: 50,
  });
  await fractional.buyShares(store, {
    listingId: listing.id, buyerId: 'sam', shareCount: 5, settleFn, now: NOW,
  });
  const secondary = fractional.createSecondaryListing(store, {
    fractionalListingId: listing.id, sellerId: 'sam', shareCount: 2,
    pricePerShare: 80, now: NOW + 200 * DAY,
  });

  // Wash trading — buying your own listing to manufacture a price
  // history — is the classic thin-market abuse.
  await assert.rejects(() => fractional.buySecondaryShares(store, {
    secondaryListingId: secondary.id, buyerId: 'sam', settleFn,
  }), /cannot buy your own listing/);
});

test('two different secondary sales of the same card both actually settle, against a real idempotency-enforcing ledger', async () => {
  // The bug this test closes: the reason/idempotency key was
  // `voken_secondary_shares:${secondaryListing.cardId}` -- the same
  // for every secondary listing ever made of that card, no matter how
  // many different lots, sellers, or buyers later trade it. A real,
  // fingerprint-checking ledger would refuse every secondary sale
  // after the first on that card as "already used for a different
  // request." Keying by secondaryListing.id instead fixes it.
  const store = createVokenStore();
  setComplianceStatus(store, 'fractional-ownership', true);
  const settleFn = idempotentLedger({ sam: 1000, rio: 1000, mo: 1000 });
  const subject = cardOwnedBy(store, 'nova');
  const listing = fractional.createFractionalListing(store, {
    cardId: subject.id, editionNumber: 1, format: 'digital',
    sellerId: 'nova', totalShares: 10, pricePerShare: 50,
  });
  await fractional.buyShares(store, { listingId: listing.id, buyerId: 'sam', shareCount: 5, settleFn, now: NOW });

  const afterLockup = NOW + 200 * DAY;
  const firstSecondary = fractional.createSecondaryListing(store, {
    fractionalListingId: listing.id, sellerId: 'sam', shareCount: 2, pricePerShare: 80, now: afterLockup,
  });
  await fractional.buySecondaryShares(store, { secondaryListingId: firstSecondary.id, buyerId: 'rio', settleFn });

  const secondSecondary = fractional.createSecondaryListing(store, {
    fractionalListingId: listing.id, sellerId: 'sam', shareCount: 3, pricePerShare: 90, now: afterLockup,
  });
  await fractional.buySecondaryShares(store, { secondaryListingId: secondSecondary.id, buyerId: 'mo', settleFn });

  assert.strictEqual(settleFn.realCalls(), 3, 'the primary purchase and both secondary sales must all actually reach the ledger');
  assert.strictEqual(settleFn.of('sam'), 1000 - 250 + 160 + 270, 'sam is paid for both secondary sales, not just the first');
});

// -- 7. Limited-edition merch ---------------------------------------------

test('merch pays the creator directly, at the live dynamic price', async () => {
  const store = createVokenStore();
  const settleFn = ledger({ sam: 1000, rio: 1000 });
  const listing = merch.createMerchListing(store, {
    creatorId: 'nova', itemType: 't-shirt', totalSupply: 4, basePrice: 100,
  });

  const first = await merch.purchaseMerchItem(store, {
    listingId: listing.id, buyerId: 'sam', settleFn,
  });
  assert.strictEqual(first.pricePaid, 100, 'the first buyer pays base price');
  assert.strictEqual(settleFn.of('nova'), 100, 'the creator is paid, not the platform');

  const second = await merch.purchaseMerchItem(store, {
    listingId: listing.id, buyerId: 'rio', settleFn,
  });
  // Scarcity pricing: 1 of 4 sold => base * (1 + 0.25).
  assert.strictEqual(second.pricePaid, 125);
  assert.strictEqual(settleFn.of('nova'), 225);
  assert.strictEqual(settleFn.drift(), 0);
});

test('two different buyers of the same merch listing both actually get charged, against a real idempotency-enforcing ledger', async () => {
  // The bug this test closes: the reason/idempotency key was
  // `voken_merch:${listing.id}` alone -- the same for every unit of a
  // multi-item listing. A real, fingerprint-checking ledger would
  // refuse the second buyer (a different buyerId, and here a
  // different dynamically-repriced amount) as "already used for a
  // different request." A per-purchase sequence number in the key,
  // claimed atomically alongside the supply decrement, fixes it.
  const store = createVokenStore();
  const settleFn = idempotentLedger({ sam: 1000, rio: 1000 });
  const listing = merch.createMerchListing(store, {
    creatorId: 'nova', itemType: 't-shirt', totalSupply: 4, basePrice: 100,
  });

  await merch.purchaseMerchItem(store, { listingId: listing.id, buyerId: 'sam', settleFn });
  await merch.purchaseMerchItem(store, { listingId: listing.id, buyerId: 'rio', settleFn });

  assert.strictEqual(settleFn.realCalls(), 2, 'both purchases must actually reach the ledger');
  assert.strictEqual(settleFn.of('nova'), 225, '100 from sam plus 125 (scarcity-repriced) from rio');
});

test('two concurrent buyers of the last merch unit — only one succeeds, the other sees it sold out', async () => {
  // The claim-after-pay race lib/settleOnce.js's own header documents:
  // remainingSupply was checked before the settlement awaited and
  // decremented only afterward, so two concurrent buyers of the last
  // unit could both pass the check and both pay, overselling a
  // "fixed, limited run."
  const store = createVokenStore();
  const settleFn = idempotentLedger({ sam: 1000, rio: 1000 });
  const listing = merch.createMerchListing(store, {
    creatorId: 'nova', itemType: 'hat', totalSupply: 1, basePrice: 50,
  });

  const results = await Promise.allSettled([
    merch.purchaseMerchItem(store, { listingId: listing.id, buyerId: 'sam', settleFn }),
    merch.purchaseMerchItem(store, { listingId: listing.id, buyerId: 'rio', settleFn }),
  ]);

  assert.strictEqual(results.filter((r) => r.status === 'fulfilled').length, 1, 'only one buyer may win the last unit');
  assert.strictEqual(settleFn.realCalls(), 1);
  assert.strictEqual(listing.remainingSupply, 0);
});

test('merch cannot be oversold past its supply', async () => {
  const store = createVokenStore();
  const settleFn = ledger({ sam: 10000 });
  const listing = merch.createMerchListing(store, {
    creatorId: 'nova', itemType: 'hat', totalSupply: 2, basePrice: 50,
  });

  await merch.purchaseMerchItem(store, { listingId: listing.id, buyerId: 'sam', settleFn });
  await merch.purchaseMerchItem(store, { listingId: listing.id, buyerId: 'sam', settleFn });
  const paidForTwo = settleFn.of('nova');

  // "Limited edition" that is not limited is a lie the buyers paid for.
  await assert.rejects(() => merch.purchaseMerchItem(store, {
    listingId: listing.id, buyerId: 'sam', settleFn,
  }), /sold out/);
  assert.strictEqual(settleFn.of('nova'), paidForTwo, 'a refused purchase pays nobody');
});

// -- 8. Referrals and spins ------------------------------------------------

test('a referral tier bonus is paid by the platform, once', async () => {
  const store = createVokenStore();
  const settleFn = ledger({ [VOKEN_PLATFORM_ACCOUNT]: 10000 });
  const firstTier = referrals.REFERRAL_TIERS[0];

  let result;
  for (let i = 0; i < firstTier.threshold; i += 1) {
    // eslint-disable-next-line no-await-in-loop -- sequential by design
    result = await referrals.recordReferral(store, {
      referrerId: 'ada', refereeId: `friend-${i}`, settleFn, now: NOW,
    });
  }

  assert.strictEqual(result.tierReached.threshold, firstTier.threshold);
  assert.strictEqual(settleFn.of('ada'), firstTier.bonusVCoin);
  assert.strictEqual(settleFn.of(VOKEN_PLATFORM_ACCOUNT), 10000 - firstTier.bonusVCoin,
    'the bonus comes out of the platform account, not from nowhere');
  assert.strictEqual(settleFn.drift(), 0);
});

test('two different referrers who each cross the same tier both actually get paid, against a real idempotency-enforcing ledger', async () => {
  // The bug this test closes: the reason/idempotency key was
  // `voken_referral_tier:${threshold}` alone -- the same fixed, small
  // set of threshold values shared by EVERY referrer who ever crosses
  // them. A real, fingerprint-checking ledger would pay the first
  // referrer anywhere to cross a tier and then refuse every other
  // referrer who ever crosses that same tier afterward (a different
  // referrerId, so a genuinely different settlement) as "already used
  // for a different request." Keying by referrerId as well fixes it.
  const store = createVokenStore();
  const settleFn = idempotentLedger({ [VOKEN_PLATFORM_ACCOUNT]: 10000 });
  const firstTier = referrals.REFERRAL_TIERS[0];

  for (let i = 0; i < firstTier.threshold; i += 1) {
    // eslint-disable-next-line no-await-in-loop -- sequential by design
    await referrals.recordReferral(store, { referrerId: 'ada', refereeId: `ada-friend-${i}`, settleFn, now: NOW });
  }
  for (let i = 0; i < firstTier.threshold; i += 1) {
    // eslint-disable-next-line no-await-in-loop -- sequential by design
    await referrals.recordReferral(store, { referrerId: 'bo', refereeId: `bo-friend-${i}`, settleFn, now: NOW });
  }

  assert.strictEqual(settleFn.realCalls(), 2, 'both referrers crossing the same tier must each actually reach the ledger');
  assert.strictEqual(settleFn.of('ada'), firstTier.bonusVCoin);
  assert.strictEqual(settleFn.of('bo'), firstTier.bonusVCoin, 'the second referrer to cross this tier must be paid too');
});

test('the same person cannot be referred twice, and you cannot refer yourself', async () => {
  const store = createVokenStore();
  const settleFn = ledger({ [VOKEN_PLATFORM_ACCOUNT]: 10000 });

  await referrals.recordReferral(store, { referrerId: 'ada', refereeId: 'kai', settleFn, now: NOW });

  // Both are ways to farm tier bonuses out of the platform account.
  await assert.rejects(() => referrals.recordReferral(store, {
    referrerId: 'rio', refereeId: 'kai', settleFn, now: NOW,
  }), /already been referred/);
  await assert.rejects(() => referrals.recordReferral(store, {
    referrerId: 'ada', refereeId: 'ada', settleFn, now: NOW,
  }), /cannot refer yourself/);
});

test('a spin pays only a real prize, and consumes the spin', async () => {
  const store = createVokenStore();
  const settleFn = ledger({ [VOKEN_PLATFORM_ACCOUNT]: 10000 });
  const firstTier = referrals.REFERRAL_TIERS[0];
  for (let i = 0; i < firstTier.threshold; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await referrals.recordReferral(store, {
      referrerId: 'ada', refereeId: `friend-${i}`, settleFn, now: NOW,
    });
  }

  const before = settleFn.of('ada');
  const spin = await referrals.spinWheel(store, {
    userId: 'ada', clientSeed: 'seed-1', settleFn, now: NOW,
  });

  const labels = referrals.SPIN_PRIZES.map((p) => p.label);
  assert.ok(labels.includes(spin.prizeLabel), 'the prize must come from the published table');
  assert.strictEqual(settleFn.of('ada'), before + spin.vcoinWon,
    'the payout equals the prize — no more, no less');
  assert.ok(spin.verified, 'provably-fair: the server seed must verify against its published hash');

  const progress = referrals.getReferralProgress(store, 'ada');
  assert.strictEqual(progress.spinsAvailable, firstTier.spinsAwarded - 1);
});

test('two concurrent spins both actually get paid, against a real idempotency-enforcing ledger', async () => {
  // The bug this test closes: the nonce used in the reason/idempotency
  // key (`voken_spin_prize:${nonce}`) was read from store.nextSpinId
  // and only incremented afterward, when the spin record was built --
  // so two concurrent spins could both read the same nonce before
  // either incremented it, giving them the same key for what are, in
  // general, two different prizes. Allocating the nonce up front,
  // before either spin's settlement runs, fixes it.
  const store = createVokenStore();
  const settleFn = idempotentLedger({ [VOKEN_PLATFORM_ACCOUNT]: 10000 });
  // Tier 1 (threshold 3) grants a cumulative 2 spins, so ada has two
  // real spins to use concurrently.
  for (let i = 0; i < 3; i += 1) {
    // eslint-disable-next-line no-await-in-loop -- sequential by design
    await referrals.recordReferral(store, { referrerId: 'ada', refereeId: `friend-${i}`, settleFn, now: NOW });
  }
  assert.strictEqual(referrals.getReferralProgress(store, 'ada').spinsAvailable, 2);

  const [spinA, spinB] = await Promise.all([
    referrals.spinWheel(store, { userId: 'ada', clientSeed: 'seed-a', settleFn, now: NOW }),
    referrals.spinWheel(store, { userId: 'ada', clientSeed: 'seed-b', settleFn, now: NOW }),
  ]);

  // Both calls run synchronously up to this read before either awaits,
  // so a nonce read without being claimed first is the same for both
  // regardless of which prizes are actually drawn -- asserting on
  // `nonce` directly (not `id`, which the old code only assigned
  // after its own later await, by which point the two calls had
  // already interleaved and could coincidentally differ) is what
  // actually pins down the root cause.
  assert.notStrictEqual(spinA.nonce, spinB.nonce, 'each spin must claim its own nonce before settling, not read a shared one');
  assert.strictEqual(referrals.getReferralProgress(store, 'ada').spinsAvailable, 0);
});

test('spinning with no spins available pays nothing', async () => {
  const store = createVokenStore();
  const settleFn = ledger({ [VOKEN_PLATFORM_ACCOUNT]: 10000 });

  await assert.rejects(() => referrals.spinWheel(store, {
    userId: 'nobody', clientSeed: 'seed', settleFn, now: NOW,
  }), /no spins available/);
  assert.ok(settleFn.movedNothing(),
    'an unearned spin must not reach the platform account at all');
});

test('spin prize odds are published and sum to a whole', () => {
  // The prizes are weighted and the weights are meant to read directly
  // as percentages. If they stop summing to 100 the published odds are
  // wrong, which is a compliance problem, not a cosmetic one.
  const total = referrals.SPIN_PRIZES.reduce((sum, p) => sum + p.weight, 0);
  assert.strictEqual(total, 100);
  for (const prize of referrals.SPIN_PRIZES) {
    assert.ok(Number.isFinite(prize.vcoin) && prize.vcoin >= 0);
  }
});

// -- Every money path refuses a non-finite amount -------------------------

test('no money path accepts a NaN price', async () => {
  const store = createVokenStore();

  // The V3 ledger bug arrived exactly this way: arithmetic on a field
  // that came in as undefined or an unparsed string. Every entry point
  // that takes a price should refuse it at the door rather than relying
  // on the ledger to catch it.
  assert.throws(() => packs.createPackTier(store, { tierName: 'basic', price: NaN }),
    /positive price/);
  assert.throws(() => merch.createMerchListing(store, {
    creatorId: 'nova', itemType: 'hat', totalSupply: 2, basePrice: NaN,
  }), /positive basePrice/);

  const subject = cardOwnedBy(store, 'nova');
  const edition = { editionNumber: 1 };
  assert.throws(() => fractional.createFractionalListing(store, {
    cardId: subject.id, editionNumber: edition.editionNumber, format: 'digital',
    sellerId: 'nova', totalShares: 10, pricePerShare: NaN,
  }), /positive pricePerShare/);
});
