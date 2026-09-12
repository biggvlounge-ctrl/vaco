// Vvltvre Music/Distribution -- the real beat marketplace.
// Built against the real, named comparables given directly for this
// feature: BeatStars and Airbit. Genuinely new -- confirmed by direct
// grep across the whole repo (this session's own standing discipline
// for anything without a source doc already in the handoff package)
// that no beat/instrumental/producer-marketplace concept existed
// anywhere under any name before this.
//
// **The real fee-model choice, made explicit rather than invented
// silently**: BeatStars charges sellers up to 30% on its free tier
// (down to 0% on a paid Pro tier, plus a separate buyer-side service
// fee); Airbit's real, current model eliminated seller commissions
// entirely -- 0% across every tier. Given `releases.js`'s own already-
// established defining choice for this whole division ("no percentage
// split anywhere in this codebase," the DistroKid/TuneCore flat-fee
// posture), v1 here takes the same real, consistent stance: a
// producer keeps 100% of every sale. `settleFn` moves the real
// price directly from buyer to producer -- no platform account in the
// path at all. A flat per-listing fee (mirroring `releases.js`'s own
// `DISTRIBUTION_FEES`) is real, later work if a revenue line is
// wanted here, not something this phase invents on its own.

const { settleOnce } = require('./settleOnce');

const LICENSE_TYPES = ['non-exclusive', 'exclusive'];
const BEAT_STATUSES = ['listed', 'sold-exclusive', 'taken-down'];

function round(n) {
  return Math.round(n * 100) / 100;
}

function listBeat(store, options = {}) {
  const {
    producerId, title, price, licenseType, previewUrl = null, now = Date.now(),
  } = options;

  if (!producerId) throw new Error('listBeat requires a producerId');
  if (!title) throw new Error('listBeat requires a title');
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('listBeat requires a positive price');
  }
  if (!LICENSE_TYPES.includes(licenseType)) {
    throw new Error(`listBeat: invalid licenseType "${licenseType}" (expected one of ${LICENSE_TYPES.join(', ')})`);
  }

  const beat = {
    id: store.nextBeatId++,
    producerId,
    title,
    price: round(price),
    licenseType,
    // Real, honest, caller-supplied field -- no real audio-file
    // storage/streaming infrastructure exists in this environment,
    // same class of gap as Vavlt Stvdios' own `streamUrl` or VENVM's
    // own `videoUrl`. Stays null unless a caller genuinely has one.
    previewUrl,
    status: 'listed',
    createdAt: now,
  };
  store.beats.push(beat);
  return beat;
}

function getBeat(store, beatId) {
  return store.beats.find((b) => b.id === beatId) || null;
}

// Real, deliberate filter: only what a buyer could actually purchase
// right now -- an exclusive beat already sold, or one taken down by
// its own producer, doesn't belong in the real browse list.
function listActiveBeats(store) {
  return store.beats.filter((b) => b.status === 'listed');
}

function takeDownBeat(store, options = {}) {
  const { beatId, producerId } = options;
  const beat = getBeat(store, beatId);
  if (!beat) throw new Error(`takeDownBeat: no beat with id ${beatId}`);
  if (beat.producerId !== producerId) {
    throw new Error('takeDownBeat: only the listing producer can take down this beat');
  }
  if (beat.status !== 'listed') {
    throw new Error(`takeDownBeat: beat ${beatId} is "${beat.status}", not "listed"`);
  }
  beat.status = 'taken-down';
  return beat;
}

// Real purchase: a real settleFn moves the real, full price directly
// from buyer to producer (no platform account in the path -- see this
// file's own header for why). The real purchase record IS the license
// delivery: a real, timestamped, immutable proof of what was bought,
// at what price, under what license terms -- a buyer or producer can
// always point back to it. An exclusive beat is delisted immediately
// after its one real sale; a non-exclusive beat stays listed, the
// same producer free to sell it again to someone else, matching how a
// real non-exclusive lease actually works.
async function purchaseBeat(store, options = {}) {
  const { beatId, buyerId, settleFn, now = Date.now() } = options;

  const beat = getBeat(store, beatId);
  if (!beat) throw new Error(`purchaseBeat: no beat with id ${beatId}`);
  if (beat.status !== 'listed') {
    throw new Error(`purchaseBeat: beat ${beatId} is "${beat.status}", not available for purchase`);
  }
  if (!buyerId) throw new Error('purchaseBeat requires a buyerId');
  if (buyerId === beat.producerId) {
    throw new Error('purchaseBeat: a producer cannot purchase their own beat');
  }
  if (typeof settleFn !== 'function') {
    throw new Error('purchaseBeat requires a settleFn(legs, meta)');
  }

  // **An exclusive licence is claimed before the money moves.**
  //
  // This settled, recorded the purchase, and only then set
  // `sold-exclusive`. Five concurrent buyers of one *exclusive* beat
  // all passed the status check, all paid, and all got a purchase
  // record: **one exclusive licence sold to 5 buyers for 250 VCoin**.
  // That is a rights problem before it is a money problem — five people
  // each hold a contract saying nobody else has it.
  //
  // **Non-exclusive beats are deliberately untouched.** Selling one
  // many times is the whole point of the licence, and a fix that
  // serialised those would be a worse bug than the one it fixed. That
  // distinction is held by a test, because it is the easy thing to get
  // wrong here.
  const claim = beat.licenseType === 'exclusive' ? { status: 'sold-exclusive' } : null;
  const pay = async () => {
    await settleFn(
      [{ fromUserId: buyerId, toUserId: beat.producerId, amount: beat.price, reason: `vulture_music_beat_purchase:${beatId}` }],
      { reason: `vulture_music_beat_purchase:${beatId}` },
    );
  };
  if (claim) await settleOnce(beat, claim, pay);
  else await pay();

  const purchase = {
    id: store.nextBeatPurchaseId++,
    beatId,
    beatTitle: beat.title,
    producerId: beat.producerId,
    buyerId,
    licenseType: beat.licenseType,
    pricePaid: beat.price,
    purchasedAt: now,
  };
  store.beatPurchases.push(purchase);

  return purchase;
}

function listPurchasesForBuyer(store, buyerId) {
  return store.beatPurchases.filter((p) => p.buyerId === buyerId);
}

function listSalesForProducer(store, producerId) {
  return store.beatPurchases.filter((p) => p.producerId === producerId);
}

module.exports = {
  LICENSE_TYPES,
  BEAT_STATUSES,
  listBeat,
  getBeat,
  listActiveBeats,
  takeDownBeat,
  purchaseBeat,
  listPurchasesForBuyer,
  listSalesForProducer,
};
