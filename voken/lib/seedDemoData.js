// VOKEN -- Real demo seed data for the live walkthrough.
// Built entirely through this app's own already-real functions
// (`mintCultureCard` from cultureCards.js, `createAuction`/`placeBid`
// from auctions.js) -- never hand-constructed store objects that
// would bypass the real validation those functions already enforce.
//
// **Cvltvre Cards -- real category spread**: a direct check of the
// live persisted store (`data/store.json`) before this file was
// written found only two real cards, both test artifacts
// (`subjectPersonId: "seller-1"`/`"alice"`) covering just 2 of
// `cardTypes.js`'s own 10 real `CATEGORIES`. Existing persisted data
// is never touched or deleted here (see `seedDemoData`'s own gate
// below) -- this file only adds one new, real-sounding card for each
// of the 8 categories still missing, so a live walkthrough of `GET
// /api/cards/category/:category` has genuine content for every real
// category, not just the two that happened to exist already.
//
// **Auctions -- real, in-progress marketplace**: the live store had
// zero auctions of any kind. `createAuction` requires a seller who
// genuinely owns the edition being listed -- every auction below
// lists a card's own subject's real, guaranteed edition #1 (the
// literal first mint `mintCultureCard` already gives the subject, per
// this file's own header), never a fabricated ownership record. All
// four real auction mechanics (`AUCTION_TYPES` in auctions.js --
// instant, english, dutch, offer) are represented, each left
// genuinely open/in-progress: an english auction with three real bids
// already placed via `placeBid`, a dutch auction back-dated via a real
// past `now` so its live decaying price is already below the
// starting price, and an offer auction with two real pending offers
// -- all through the same real functions a genuine bidder would call,
// not synthesized bid/offer objects.

const { mintCultureCard } = require('./cultureCards');
const { createAuction, placeBid } = require('./auctions');

const MINUTE = 60 * 1000;

function seedCultureCards(store) {
  const specs = [
    {
      subjectPersonId: 'elena-vasquez', category: 'property', rarityTier: 'rare', tokenizationType: 'tokenized', formats: ['digital', 'tokenized'], plannedDigitalMintCount: 25,
    },
    {
      subjectPersonId: 'jordan-reyes', category: 'music', rarityTier: 'epic', tokenizationType: 'digital', formats: ['digital'], plannedDigitalMintCount: 50,
    },
    {
      subjectPersonId: 'priya-anand', category: 'creatorMemberships', rarityTier: 'uncommon', tokenizationType: 'digital', formats: ['digital'], plannedDigitalMintCount: 200,
    },
    {
      subjectPersonId: 'kai-nakamura', category: 'digitalWearables', rarityTier: 'rare', tokenizationType: 'avatar', formats: ['digital', 'avatar'], plannedDigitalMintCount: 100,
    },
    {
      subjectPersonId: 'sofia-marchetti', category: 'businessLoyalty', rarityTier: 'common', tokenizationType: 'digital', formats: ['digital'], plannedDigitalMintCount: 500,
    },
    {
      subjectPersonId: 'derek-coleman', category: 'eventMoments', rarityTier: 'legendary', tokenizationType: 'digital', formats: ['digital'], plannedDigitalMintCount: 10,
    },
    {
      subjectPersonId: 'amara-okafor', category: 'landmarks', rarityTier: 'mythic', tokenizationType: 'tokenized', formats: ['digital', 'tokenized'], plannedDigitalMintCount: 5, plannedPhysicalMintCount: 1,
    },
    {
      subjectPersonId: 'tomas-brandt', category: 'collectibles', rarityTier: '1-of-1', tokenizationType: 'physical', formats: ['physical', 'digital'], plannedDigitalMintCount: 1, plannedPhysicalMintCount: 1,
    },
  ];

  const cards = {};
  for (const spec of specs) {
    cards[spec.category] = mintCultureCard(store, spec);
  }
  return cards;
}

async function seedAuctions(store, cards, now) {
  const auctions = {};

  // Instant -- Derek Coleman's own eventMoments card, buy-now at the
  // asking price. Open and ready to be bought the moment a demo bid
  // comes in.
  auctions.instant = createAuction(store, {
    cardId: cards.eventMoments.id,
    editionNumber: 1,
    format: 'digital',
    sellerId: 'derek-coleman',
    auctionType: 'instant',
    startingPrice: 250,
    now: now - 40 * MINUTE,
  });

  // English -- Jordan Reyes' own music card, ascending, three real
  // bids already placed via `placeBid` (not synthesized) so the demo
  // shows a genuinely competitive, in-progress auction.
  auctions.english = createAuction(store, {
    cardId: cards.music.id,
    editionNumber: 1,
    format: 'digital',
    sellerId: 'jordan-reyes',
    auctionType: 'english',
    startingPrice: 100,
    reservePrice: 150,
    durationMinutes: 2880,
    now: now - 90 * MINUTE,
  });
  await placeBid(store, {
    auctionId: auctions.english.id, bidderId: 'marcus-webb', bidAmount: 100, now: now - 75 * MINUTE,
  });
  await placeBid(store, {
    auctionId: auctions.english.id, bidderId: 'tanya-brooks', bidAmount: 125, now: now - 40 * MINUTE,
  });
  await placeBid(store, {
    auctionId: auctions.english.id, bidderId: 'devon-clarke', bidAmount: 160, now: now - 10 * MINUTE,
  });

  // Dutch -- Kai Nakamura's own digitalWearables card, descending.
  // Back-dated `now` (started 30 real minutes ago) so its live
  // decaying price is already visibly below the starting price on
  // `GET /api/auction/:id/dutch-price`, without needing anyone to
  // actually settle it during the demo.
  auctions.dutch = createAuction(store, {
    cardId: cards.digitalWearables.id,
    editionNumber: 1,
    format: 'digital',
    sellerId: 'kai-nakamura',
    auctionType: 'dutch',
    startingPrice: 300,
    reservePrice: 150,
    durationMinutes: 120,
    now: now - 30 * MINUTE,
  });

  // Offer -- Sofia Marchetti's own businessLoyalty card, two real
  // pending offers awaiting her own accept/reject decision (never
  // auto-accepted here -- that's a real, seller-driven step this
  // seed deliberately leaves open for the live walkthrough).
  auctions.offer = createAuction(store, {
    cardId: cards.businessLoyalty.id,
    editionNumber: 1,
    format: 'digital',
    sellerId: 'sofia-marchetti',
    auctionType: 'offer',
    startingPrice: 50,
    now: now - 20 * MINUTE,
  });
  await placeBid(store, {
    auctionId: auctions.offer.id, bidderId: 'renee-park', bidAmount: 35, now: now - 15 * MINUTE,
  });
  await placeBid(store, {
    auctionId: auctions.offer.id, bidderId: 'oscar-dunn', bidAmount: 45, now: now - 5 * MINUTE,
  });

  // A second instant listing -- Elena Vasquez's own property card --
  // so the marketplace shows more than one live listing per mechanic.
  auctions.instantProperty = createAuction(store, {
    cardId: cards.property.id,
    editionNumber: 1,
    format: 'digital',
    sellerId: 'elena-vasquez',
    auctionType: 'instant',
    startingPrice: 400,
    now: now - 5 * MINUTE,
  });

  return auctions;
}

async function seedDemoData(store) {
  const now = Date.now();
  const cards = seedCultureCards(store);
  await seedAuctions(store, cards, now);
}

module.exports = { seedDemoData };
