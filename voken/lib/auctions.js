// VOKEN — VADO auctions.
// Source of truth: VOKEN_ARCHITECTURE.md / VOKEN_MASTER_SPEC_PROGRESS.md:
// VADO (the art gallery/auctions sub-division) sells real Cvltvre Card
// editions through four real mechanics -- instant buy-now, English
// (ascending, settles at close), Dutch (descending, settles the moment
// a bidder accepts the live price), and offer (buyer-proposed, seller
// accepts on their own schedule). All four settle through this
// project's established injected-transferFn pattern and the real
// edition-ownership mechanics already built in cultureCards.js -- no
// parallel ownership system.

const { getCultureCard, transferEditionOwnership } = require('./cultureCards');

const AUCTION_TYPES = ['instant', 'english', 'dutch', 'offer'];
const AUCTION_STATUSES = ['open', 'sold', 'unsold'];
const DUTCH_DECAY_PER_MINUTE = 0.01;

function round(n) {
  return Math.round(n * 100) / 100;
}

function findOwnedEdition(card, editionNumber, format, sellerId) {
  const edition = card.editions.find((e) => e.editionNumber === editionNumber && e.format === format);
  if (!edition) throw new Error(`no ${format} edition #${editionNumber} on card ${card.id}`);
  if (edition.ownerId !== sellerId) {
    throw new Error(`edition ${format} #${editionNumber} of card ${card.id} is not owned by ${sellerId}`);
  }
  return edition;
}

function createAuction(store, options = {}) {
  const {
    cardId, editionNumber, format, sellerId, auctionType, startingPrice, reservePrice, durationMinutes, now = Date.now(),
  } = options;

  const card = getCultureCard(store, cardId);
  if (!card) throw new Error(`createAuction: no card with id ${cardId}`);
  if (!sellerId) throw new Error('createAuction requires a sellerId');
  if (!AUCTION_TYPES.includes(auctionType)) {
    throw new Error(`createAuction: invalid auctionType "${auctionType}" (expected one of ${AUCTION_TYPES.join(', ')})`);
  }
  if (!Number.isFinite(startingPrice) || startingPrice <= 0) {
    throw new Error('createAuction requires a positive startingPrice');
  }
  // Real ownership check up front -- you can only auction an edition you
  // genuinely, currently hold, never trusted from a stale claim.
  findOwnedEdition(card, editionNumber, format, sellerId);

  if (auctionType === 'dutch') {
    if (!Number.isFinite(reservePrice) || reservePrice <= 0) {
      throw new Error('createAuction: dutch auctions require a positive reservePrice');
    }
    if (reservePrice >= startingPrice) {
      throw new Error('createAuction: dutch auctions require reservePrice < startingPrice');
    }
  }
  if (reservePrice !== undefined && (!Number.isFinite(reservePrice) || reservePrice <= 0)) {
    throw new Error('createAuction: reservePrice, if given, must be a positive number');
  }
  if ((auctionType === 'english' || auctionType === 'dutch') && (!Number.isInteger(durationMinutes) || durationMinutes <= 0)) {
    throw new Error(`createAuction: ${auctionType} auctions require a positive integer durationMinutes`);
  }

  const auction = {
    id: store.nextAuctionId++,
    cardId,
    editionNumber,
    format,
    sellerId,
    auctionType,
    startingPrice,
    reservePrice: reservePrice ?? null,
    status: 'open',
    createdAt: now,
    endsAt: durationMinutes ? now + durationMinutes * 60 * 1000 : null,
    currentBid: 0,
    highestBidderId: null,
    bidCount: 0,
    offers: [],
    soldPrice: null,
    buyerId: null,
  };
  store.auctions.push(auction);
  return auction;
}

function getAuction(store, auctionId) {
  return store.auctions.find((a) => a.id === auctionId) || null;
}

// Real, minimal addition: every route so far looks up one auction by
// id, but a real browsing surface (VDP's VADO district) needs to see
// what's actually open right now, not guess ids -- the literal "walk
// into the gallery and see what's up for auction" feature.
function listOpenAuctions(store) {
  return store.auctions.filter((a) => a.status === 'open');
}

// Real linear decay: 1% of the starting price per elapsed minute,
// floored at the seller's reserve -- never gives the item away below
// the price they set when listing it.
function getCurrentDutchPrice(auction, now = Date.now()) {
  if (auction.auctionType !== 'dutch') {
    throw new Error('getCurrentDutchPrice: auction is not a dutch auction');
  }
  const minutesElapsed = Math.max(0, (now - auction.createdAt) / 60000);
  const decayed = auction.startingPrice * (1 - DUTCH_DECAY_PER_MINUTE * minutesElapsed);
  return round(Math.max(decayed, auction.reservePrice));
}

async function settle(store, auction, buyerId, price, transferFn) {
  await transferFn(buyerId, auction.sellerId, price, `voken_vado_${auction.auctionType}:${auction.cardId}`);
  transferEditionOwnership(store, {
    cardId: auction.cardId, editionNumber: auction.editionNumber, format: auction.format,
    fromOwnerId: auction.sellerId, toOwnerId: buyerId,
  });
  auction.status = 'sold';
  auction.soldPrice = price;
  auction.buyerId = buyerId;
}

async function placeBid(store, options = {}) {
  const { auctionId, bidderId, bidAmount, now = Date.now(), transferFn } = options;
  const auction = getAuction(store, auctionId);
  if (!auction) throw new Error(`placeBid: no auction with id ${auctionId}`);
  if (auction.status !== 'open') throw new Error(`placeBid: auction ${auctionId} is not open (status: ${auction.status})`);
  if (!bidderId) throw new Error('placeBid requires a bidderId');
  if (!Number.isFinite(bidAmount) || bidAmount <= 0) throw new Error('placeBid requires a positive bidAmount');

  if (auction.auctionType === 'instant') {
    if (typeof transferFn !== 'function') throw new Error('placeBid requires a transferFn(fromUserId, toUserId, amount, reason)');
    if (bidAmount < auction.startingPrice) {
      throw new Error(`placeBid: instant auctions settle at the full asking price of ${auction.startingPrice}`);
    }
    await settle(store, auction, bidderId, auction.startingPrice, transferFn);
    return auction;
  }

  if (auction.auctionType === 'english') {
    if (auction.endsAt !== null && now >= auction.endsAt) {
      throw new Error(`placeBid: auction ${auctionId} has already ended`);
    }
    const minAcceptable = auction.bidCount === 0 ? auction.startingPrice : auction.currentBid;
    const strictlyRequired = auction.bidCount === 0 ? bidAmount >= minAcceptable : bidAmount > minAcceptable;
    if (!strictlyRequired) {
      throw new Error(`placeBid: bid must exceed the current bid of ${auction.currentBid} (or meet the starting price of ${auction.startingPrice} if first)`);
    }
    auction.currentBid = bidAmount;
    auction.highestBidderId = bidderId;
    auction.bidCount += 1;
    return auction;
  }

  if (auction.auctionType === 'dutch') {
    if (typeof transferFn !== 'function') throw new Error('placeBid requires a transferFn(fromUserId, toUserId, amount, reason)');
    const currentPrice = getCurrentDutchPrice(auction, now);
    if (bidAmount < currentPrice) {
      throw new Error(`placeBid: dutch auction's current live price is ${currentPrice}, bid of ${bidAmount} is too low`);
    }
    await settle(store, auction, bidderId, currentPrice, transferFn);
    return auction;
  }

  // offer
  const offer = { bidderId, offerAmount: bidAmount, at: now };
  auction.offers.push(offer);
  return auction;
}

async function endAuction(store, options = {}) {
  const { auctionId, transferFn } = options;
  const auction = getAuction(store, auctionId);
  if (!auction) throw new Error(`endAuction: no auction with id ${auctionId}`);
  if (auction.auctionType !== 'english') throw new Error('endAuction: only english auctions settle via endAuction');
  if (auction.status !== 'open') throw new Error(`endAuction: auction ${auctionId} is not open (status: ${auction.status})`);

  if (auction.bidCount === 0 || (auction.reservePrice !== null && auction.currentBid < auction.reservePrice)) {
    auction.status = 'unsold';
    return auction;
  }

  if (typeof transferFn !== 'function') throw new Error('endAuction requires a transferFn(fromUserId, toUserId, amount, reason)');
  await settle(store, auction, auction.highestBidderId, auction.currentBid, transferFn);
  return auction;
}

async function acceptOffer(store, options = {}) {
  const { auctionId, offerIndex, transferFn } = options;
  const auction = getAuction(store, auctionId);
  if (!auction) throw new Error(`acceptOffer: no auction with id ${auctionId}`);
  if (auction.auctionType !== 'offer') throw new Error('acceptOffer: only offer-type auctions settle via acceptOffer');
  if (auction.status !== 'open') throw new Error(`acceptOffer: auction ${auctionId} is not open (status: ${auction.status})`);
  const offer = auction.offers[offerIndex];
  if (!offer) throw new Error(`acceptOffer: no offer at index ${offerIndex}`);
  if (typeof transferFn !== 'function') throw new Error('acceptOffer requires a transferFn(fromUserId, toUserId, amount, reason)');

  await settle(store, auction, offer.bidderId, offer.offerAmount, transferFn);
  auction.acceptedOfferIndex = offerIndex;
  return auction;
}

module.exports = {
  AUCTION_TYPES,
  AUCTION_STATUSES,
  DUTCH_DECAY_PER_MINUTE,
  createAuction,
  getAuction,
  listOpenAuctions,
  getCurrentDutchPrice,
  placeBid,
  endAuction,
  acceptOffer,
};
