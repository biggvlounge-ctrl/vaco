// VOKEN — fractional ownership.
// Source of truth: VOKEN_ARCHITECTURE.md's `FractionalOwnership { id,
// cardId, totalShares, soldShares, pricePerShare }`, explicitly flagged
// securities-adjacent and held pending real Reg D/A+ legal review --
// "the code path is worth building now, the live-money trigger should
// stay off until cleared." VOKEN_MASTER_SPEC_PROGRESS.md's own
// comparables research recommends Rally's structural model (broad
// category access, real custody-before-shares-sell) over Masterworks'
// concentrated approach -- implemented here as a real custody transfer
// into a shared pool account at listing time, with individual investor
// stakes tracked separately from the underlying edition's single-owner
// shape.
//
// **Real secondary resale market added**, closing this file's own
// previously-flagged gap. The same comparables doc names the exact
// real mechanism to build toward: Rally's own "real (if thin)
// secondary market via a registered ATS (PPEX) after a 90-day
// lockup." `SECONDARY_LOCKUP_MS` is that real, cited 90-day figure,
// not an invented one. This project has no registered ATS to route
// through, so secondary trades settle as direct, real peer-to-peer
// share transfers (seller to buyer, same `settleFn` pattern as the
// primary sale) rather than simulating an order book this codebase
// has no matching engine for -- the same "real code reuse, no
// invented infrastructure" discipline as this session's other
// simplified-but-real cross-app settlements.
//
// **Real per-share-lot lockup cohort tracking**, closing this file's
// own previously-flagged simplification: each `buyShares` call now
// opens a genuinely new, separately-tracked lot with its own
// `lockedUntil`, rather than re-locking a shareholder's entire
// position. A shareholder who already cleared an earlier lot's lockup
// can resell those specific shares immediately even while a newer lot
// they just bought is still locked -- real brokerage-style FIFO cohort
// behavior (Robinhood/Fidelity/Schwab all track purchase lots this
// way for the exact same reason: a later purchase never re-restricts
// earlier, already-vested shares). `createSecondaryListing` draws from
// the oldest unlocked lot(s) first, real FIFO order, and records
// exactly which lot(s) it drew from so a cancellation or a completed
// sale can release/debit the correct lot, not just a shareholder-level
// total. Shares acquired via secondary resale open their own new lot
// with `lockedUntil: null` -- matching the real rule that an
// ATS-style ownership transfer isn't a new private-placement purchase,
// so it was never subject to this lockup at all.

const { getCultureCard, transferEditionOwnership } = require('./cultureCards');
const { settleOnce } = require('./settleOnce');
const { isComplianceCleared } = require('./complianceGate');

const VOKEN_FRACTIONAL_POOL = 'voken-fractional-pool';
const SECONDARY_LOCKUP_MS = 90 * 24 * 60 * 60 * 1000; // Rally's real, cited 90-day post-purchase lockup

// -- Real per-lot cohort helpers --

function totalShares(shareholder) {
  return shareholder.lots.reduce((sum, lot) => sum + lot.shares, 0);
}

function isUnlocked(lot, now) {
  return !lot.lockedUntil || lot.lockedUntil <= now;
}

// Real sellable count: only unlocked lots' own (shares - listedShares)
// remainder counts, matching the actual point of per-lot tracking --
// a still-locked lot contributes zero, even if the shareholder's total
// position looks large.
function sellableShareCount(shareholder, now) {
  return shareholder.lots
    .filter((lot) => isUnlocked(lot, now))
    .reduce((sum, lot) => sum + (lot.shares - lot.listedShares), 0);
}

// Real FIFO draw across only unlocked lots (oldest `purchasedAt`
// first, the same convention real brokerages use for cost-basis lot
// selection) -- records exactly which lot(s) and how many shares were
// drawn from each, so a later cancel/sale can release/debit the
// correct real lot rather than a shareholder-level total.
function drawFromUnlockedLots(shareholder, shareCount, now) {
  const unlockedLots = shareholder.lots
    .filter((lot) => isUnlocked(lot, now) && lot.shares - lot.listedShares > 0)
    .sort((a, b) => a.purchasedAt - b.purchasedAt);

  const allocations = [];
  let remaining = shareCount;
  for (const lot of unlockedLots) {
    if (remaining <= 0) break;
    const available = lot.shares - lot.listedShares;
    const take = Math.min(available, remaining);
    lot.listedShares += take;
    allocations.push({ lotId: lot.id, shares: take });
    remaining -= take;
  }
  return allocations;
}

function findOwnedEdition(card, editionNumber, format, sellerId) {
  const edition = card.editions.find((e) => e.editionNumber === editionNumber && e.format === format);
  if (!edition) throw new Error(`no ${format} edition #${editionNumber} on card ${card.id}`);
  if (edition.ownerId !== sellerId) {
    throw new Error(`edition ${format} #${editionNumber} of card ${card.id} is not owned by ${sellerId}`);
  }
  return edition;
}

// Listing moves no money -- only real custody of the underlying edition
// into the fractional pool -- so it's deliberately ungated, matching
// this project's established rule (openBrokerAccount, createAuction).
function createFractionalListing(store, options = {}) {
  const { cardId, editionNumber, format, sellerId, totalShares, pricePerShare } = options;

  const card = getCultureCard(store, cardId);
  if (!card) throw new Error(`createFractionalListing: no card with id ${cardId}`);
  if (!sellerId) throw new Error('createFractionalListing requires a sellerId');
  if (!Number.isInteger(totalShares) || totalShares < 2) {
    throw new Error('createFractionalListing requires an integer totalShares of at least 2');
  }
  if (!Number.isFinite(pricePerShare) || pricePerShare <= 0) {
    throw new Error('createFractionalListing requires a positive pricePerShare');
  }
  findOwnedEdition(card, editionNumber, format, sellerId);

  transferEditionOwnership(store, {
    cardId, editionNumber, format, fromOwnerId: sellerId, toOwnerId: VOKEN_FRACTIONAL_POOL,
  });

  const listing = {
    id: store.nextFractionalListingId++,
    cardId,
    editionNumber,
    format,
    sellerId,
    totalShares,
    soldShares: 0,
    pricePerShare,
    shareholders: [],
    status: 'open',
    createdAt: Date.now(),
  };
  store.fractionalListings.push(listing);
  return listing;
}

function getFractionalListing(store, listingId) {
  return store.fractionalListings.find((l) => l.id === listingId) || null;
}

// The real, gated, money-moving action -- proceeds pay the original
// fractionalizing seller directly as shares sell, real remaining-share
// enforcement against totalShares.
async function buyShares(store, options = {}) {
  const { listingId, buyerId, shareCount, settleFn, now = Date.now() } = options;
  const listing = getFractionalListing(store, listingId);
  if (!listing) throw new Error(`buyShares: no fractional listing with id ${listingId}`);
  if (!isComplianceCleared(store, 'fractional-ownership')) {
    throw new Error('buyShares: fractional ownership is not yet compliance-cleared for live trading');
  }
  if (listing.status !== 'open') throw new Error(`buyShares: listing ${listingId} is not open (status: ${listing.status})`);
  if (!buyerId) throw new Error('buyShares requires a buyerId');
  if (!Number.isInteger(shareCount) || shareCount < 1) throw new Error('buyShares requires a positive integer shareCount');
  const remaining = listing.totalShares - listing.soldShares;
  if (shareCount > remaining) {
    throw new Error(`buyShares: only ${remaining} of ${listing.totalShares} shares remain, cannot buy ${shareCount}`);
  }
  if (typeof settleFn !== 'function') throw new Error('buyShares requires a settleFn(legs, meta)');

  const cost = round(shareCount * listing.pricePerShare);

  // **The shares are claimed before the money moves, not after.**
  //
  // This checked `totalShares - soldShares`, awaited the settlement,
  // then incremented `soldShares`. Concurrent buyers all saw the old
  // count, all passed the check, and all paid — overselling the
  // listing and creating obligations to more owners than there are
  // shares.
  //
  // **Latent rather than live**: this path is behind
  // `isComplianceCleared(store, 'fractional-ownership')`, and that gate
  // stays shut. It is fixed now because it will be reachable the day
  // compliance clears it, and a race found then would be found in
  // production.
  //
  // `status: 'fully-sold'` joins the claim so a listing that this
  // purchase completes closes in the same indivisible step.
  const soldAfter = listing.soldShares + shareCount;
  const claim = { soldShares: soldAfter };
  if (soldAfter === listing.totalShares) claim.status = 'fully-sold';

  await settleOnce(listing, claim, async () => {
    await settleFn(
      [{ fromUserId: buyerId, toUserId: listing.sellerId, amount: cost, reason: `voken_fractional_shares:${listing.cardId}` }],
      { reason: `voken_fractional_shares:${listing.cardId}` },
    );
  });

  const newLot = {
    id: store.nextFractionalLotId++, shares: shareCount, listedShares: 0, lockedUntil: now + SECONDARY_LOCKUP_MS, purchasedAt: now,
  };
  const existing = listing.shareholders.find((s) => s.userId === buyerId);
  if (existing) {
    // Real per-lot behavior: this purchase opens its OWN new lot,
    // locked for its own real 90 days -- it never re-locks any lot
    // the shareholder already holds.
    existing.lots.push(newLot);
  } else {
    listing.shareholders.push({ userId: buyerId, lots: [newLot] });
  }
  return { listing, sharesPurchased: shareCount, amountPaid: cost };
}

function getFractionalHoldings(store, options = {}) {
  const { userId, now = Date.now() } = options;
  if (!userId) throw new Error('getFractionalHoldings requires a userId');
  const holdings = [];
  for (const listing of store.fractionalListings) {
    const stake = listing.shareholders.find((s) => s.userId === userId);
    const shares = stake ? totalShares(stake) : 0;
    if (stake && shares > 0) {
      holdings.push({
        listingId: listing.id,
        cardId: listing.cardId,
        shares,
        totalShares: listing.totalShares,
        sellableShares: sellableShareCount(stake, now),
        ownershipFraction: round(shares / listing.totalShares),
        // Real per-lot detail -- the actual point of cohort tracking:
        // a caller can see exactly which lots are still locked and
        // when each one individually clears, not just one aggregate
        // lockedUntil for the whole position.
        lots: stake.lots.map((lot) => ({
          id: lot.id,
          shares: lot.shares,
          sellableShares: lot.shares - lot.listedShares,
          lockedUntil: lot.lockedUntil,
          unlocked: isUnlocked(lot, now),
          purchasedAt: lot.purchasedAt,
        })),
      });
    }
  }
  return { userId, holdings };
}

function round(n) {
  return Math.round(n * 100) / 100;
}

// Real, ungated (moves no money) -- lists an existing shareholder's
// own shares for peer-to-peer resale, gated on the real 90-day lockup
// and on not over-listing shares the seller doesn't actually hold.
function createSecondaryListing(store, options = {}) {
  const {
    fractionalListingId, sellerId, shareCount, pricePerShare, now = Date.now(),
  } = options;
  const listing = getFractionalListing(store, fractionalListingId);
  if (!listing) throw new Error(`createSecondaryListing: no fractional listing with id ${fractionalListingId}`);
  if (!sellerId) throw new Error('createSecondaryListing requires a sellerId');
  const shareholder = listing.shareholders.find((s) => s.userId === sellerId);
  if (!shareholder || totalShares(shareholder) <= 0) {
    throw new Error(`createSecondaryListing: ${sellerId} holds no shares in listing ${fractionalListingId}`);
  }
  // Real per-lot check: a shareholder can be over one lot's lockup and
  // still have zero sellable shares if every OTHER lot they hold is
  // also still locked -- this is the real point of cohort tracking, so
  // the check is against the real, computed sellable total across
  // only unlocked lots, not a single position-wide flag.
  const sellable = sellableShareCount(shareholder, now);
  if (!Number.isInteger(shareCount) || shareCount < 1 || shareCount > sellable) {
    throw new Error(`createSecondaryListing: ${sellerId} has ${sellable} real sellable shares across unlocked lots (Rally's real 90-day per-lot post-purchase lockup), cannot list ${shareCount}`);
  }
  if (!Number.isFinite(pricePerShare) || pricePerShare <= 0) {
    throw new Error('createSecondaryListing requires a positive pricePerShare');
  }

  const lotAllocations = drawFromUnlockedLots(shareholder, shareCount, now);

  const secondaryListing = {
    id: store.nextSecondaryListingId++,
    fractionalListingId,
    cardId: listing.cardId,
    sellerId,
    shareCount,
    lotAllocations,
    pricePerShare,
    status: 'open',
    createdAt: now,
  };
  store.secondaryListings.push(secondaryListing);
  return secondaryListing;
}

function getSecondaryListing(store, secondaryListingId) {
  return store.secondaryListings.find((l) => l.id === secondaryListingId) || null;
}

function listOpenSecondaryListings(store, fractionalListingId) {
  return store.secondaryListings.filter((l) => l.fractionalListingId === fractionalListingId && l.status === 'open');
}

// Real, ungated -- releases shares a seller no longer wants to sell
// back to their own sellable balance.
function cancelSecondaryListing(store, options = {}) {
  const { secondaryListingId, requesterId } = options;
  const secondaryListing = getSecondaryListing(store, secondaryListingId);
  if (!secondaryListing) throw new Error(`cancelSecondaryListing: no secondary listing with id ${secondaryListingId}`);
  if (secondaryListing.status !== 'open') throw new Error(`cancelSecondaryListing: listing ${secondaryListingId} is not open (status: ${secondaryListing.status})`);
  if (secondaryListing.sellerId !== requesterId) throw new Error('cancelSecondaryListing: only the seller can cancel their own listing');

  const fractionalListing = getFractionalListing(store, secondaryListing.fractionalListingId);
  const shareholder = fractionalListing.shareholders.find((s) => s.userId === secondaryListing.sellerId);
  // Real per-lot release: gives each specific lot its own listedShares
  // back, not a shareholder-level total, so a still-locked lot's own
  // real unlock timestamp is unaffected by this cancellation.
  for (const allocation of secondaryListing.lotAllocations) {
    const lot = shareholder.lots.find((l) => l.id === allocation.lotId);
    if (lot) lot.listedShares -= allocation.shares;
  }
  secondaryListing.status = 'cancelled';
  return secondaryListing;
}

// The real, gated, money-moving action -- same compliance gate as the
// primary sale (still securities-adjacent per the doc), settling as a
// direct real peer-to-peer transfer, seller to buyer, rather than
// routing through the fractional pool the way a primary purchase does
// (there's no new custody event here -- the underlying edition never
// moves, only the investor-level stake does).
async function buySecondaryShares(store, options = {}) {
  const { secondaryListingId, buyerId, settleFn } = options;
  const secondaryListing = getSecondaryListing(store, secondaryListingId);
  if (!secondaryListing) throw new Error(`buySecondaryShares: no secondary listing with id ${secondaryListingId}`);
  if (!isComplianceCleared(store, 'fractional-ownership')) {
    throw new Error('buySecondaryShares: fractional ownership is not yet compliance-cleared for live trading');
  }
  if (secondaryListing.status !== 'open') throw new Error(`buySecondaryShares: listing ${secondaryListingId} is not open (status: ${secondaryListing.status})`);
  if (!buyerId) throw new Error('buySecondaryShares requires a buyerId');
  if (buyerId === secondaryListing.sellerId) throw new Error('buySecondaryShares: cannot buy your own listing');
  if (typeof settleFn !== 'function') throw new Error('buySecondaryShares requires a settleFn(legs, meta)');

  const fractionalListing = getFractionalListing(store, secondaryListing.fractionalListingId);
  const cost = round(secondaryListing.shareCount * secondaryListing.pricePerShare);
  await settleFn(
    [{ fromUserId: buyerId, toUserId: secondaryListing.sellerId, amount: cost, reason: `voken_secondary_shares:${secondaryListing.cardId}` }],
    { reason: `voken_secondary_shares:${secondaryListing.cardId}` },
  );

  // Real per-lot debit: remove exactly the shares from exactly the
  // lots this listing actually drew from, deleting a lot entirely once
  // it's fully sold off rather than leaving a real zero-share husk.
  const sellerHolding = fractionalListing.shareholders.find((s) => s.userId === secondaryListing.sellerId);
  for (const allocation of secondaryListing.lotAllocations) {
    const lot = sellerHolding.lots.find((l) => l.id === allocation.lotId);
    if (lot) {
      lot.shares -= allocation.shares;
      lot.listedShares -= allocation.shares;
    }
  }
  sellerHolding.lots = sellerHolding.lots.filter((lot) => lot.shares > 0);

  // A real, brand-new, immediately-sellable lot -- secondary-acquired
  // shares were never subject to the primary-purchase lockup at all.
  const now = Date.now();
  const buyerLot = {
    id: store.nextFractionalLotId++, shares: secondaryListing.shareCount, listedShares: 0, lockedUntil: null, purchasedAt: now,
  };
  const buyerHolding = fractionalListing.shareholders.find((s) => s.userId === buyerId);
  if (buyerHolding) {
    buyerHolding.lots.push(buyerLot);
  } else {
    fractionalListing.shareholders.push({ userId: buyerId, lots: [buyerLot] });
  }

  secondaryListing.status = 'sold';
  secondaryListing.soldAt = now;
  return { secondaryListing, fractionalListing, amountPaid: cost };
}

module.exports = {
  VOKEN_FRACTIONAL_POOL,
  SECONDARY_LOCKUP_MS,
  createFractionalListing,
  getFractionalListing,
  buyShares,
  getFractionalHoldings,
  createSecondaryListing,
  getSecondaryListing,
  listOpenSecondaryListings,
  cancelSecondaryListing,
  buySecondaryShares,
};
