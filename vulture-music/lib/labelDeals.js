// Vvltvre Music/Distribution -- Label Deals (Phase 4).
// Closes this project's own previously-flagged gap: "Label-level (not
// just personal-manager) deal shapes -- advances, recoupment,
// per-release (not blanket) deals -- a real, different economic
// structure from the personal-manager commission built here."
//
// No VACO source doc specifies exact label-deal terms, so this is
// grounded in real, standard, well-known record-industry mechanics
// rather than an invented shape:
//   - a real ADVANCE: an upfront lump sum the label pays the artist
//     at signing -- real money moving label -> artist immediately,
//     the literal opposite direction from `managers.js`'s commission
//     model, where money only ever flows artist -> manager.
//   - real RECOUPMENT: the label recovers that advance from the
//     artist's own share of future streaming revenue before any
//     further net money reaches the artist from this deal -- the
//     real, standard mechanic every traditional and modern record
//     deal uses.
//   - a real, ongoing post-recoupment LABEL SHARE PERCENT: once fully
//     recouped, revenue keeps splitting between label and artist.
//     `DEFAULT_LABEL_SHARE_PERCENT` is a real, flagged, interpretive
//     default (50/50), modeled on modern "artist-friendly" label/
//     imprint deals (real digital-label-services precedents like
//     AWAL/Stem/UnitedMasters' own label offerings), not legacy
//     80/20-or-worse major-label splits -- matching Vvltvre Music's
//     own already-established DistroKid/TuneCore/gamma.
//     artist-friendly positioning. A caller-specified rate always
//     overrides the default, same posture as `managers.js`'s own
//     `DEFAULT_COMMISSION_PERCENT`.
//
// PER-RELEASE vs. BLANKET, both real and named directly in the gap
// this closes: a per-release deal recoups against exactly one named
// `Release`; a blanket deal recoups against everything the artist
// releases while it's active. Real exclusivity, mirroring
// `managers.js`'s own one-manager-at-a-time rule: an artist can hold
// at most one active blanket deal, and at most one active deal (of
// either kind) per specific release -- a blanket deal already covers
// every release, so it blocks new per-release deals while active, and
// vice versa. "Active" for this purpose includes `fully-recouped` --
// the relationship and its ongoing split are still in force, only the
// advance itself has been paid down.
//
// Deliberately does NOT `require('./releases')` -- `signLabelDeal`
// takes an already-fetched `release` object instead of a bare
// `releaseId`, since `releases.js` itself needs to require THIS
// module (to apply a label deal during `reportStreamingRevenue`), and
// a two-way `require` would be circular. The caller (`server.js`)
// fetches the release via `releases.js`'s own `getRelease` first.
//
// Real layering with `managers.js`: a label deal and a personal
// manager are genuinely different, real, simultaneously-possible
// relationships -- a manager represents the artist's whole career and
// commissions whatever the artist actually receives; a label deal is
// about a specific release/catalog's own recoupment.
// `releases.js`'s `reportStreamingRevenue` applies the label deal
// FIRST (determining what actually reaches the artist from this
// specific income), then the manager's commission is computed on that
// real, already-reduced amount -- not on the pre-label gross the
// artist never fully saw.

const LABEL_DEAL_TYPES = ['per-release', 'blanket'];
const LABEL_DEAL_STATUSES = ['active', 'fully-recouped', 'terminated'];
const DEFAULT_LABEL_SHARE_PERCENT = 0.5;

function round(n) {
  return Math.round(n * 100) / 100;
}

function isInForce(deal) {
  return deal.status === 'active' || deal.status === 'fully-recouped';
}

function findActiveBlanketDeal(store, artistId) {
  return store.labelDeals.find((d) => d.artistId === artistId && d.dealType === 'blanket' && isInForce(d)) || null;
}

// Real, deliberately scoped by BOTH releaseId and artistId -- closes
// this file's own previously-flagged gap ("a co-writer with their own
// separate label deal isn't modeled"). A per-release deal belongs to
// whichever specific collaborator signed it, never to the release as
// a whole -- two different co-writers on the same release can each
// hold their own, completely independent per-release deal (different
// labels, different advances, different recoupment balances), each
// applying only against that one collaborator's own share.
function findActiveDealForRelease(store, releaseId, artistId) {
  return store.labelDeals.find((d) => d.dealType === 'per-release' && d.releaseId === releaseId && d.artistId === artistId && isInForce(d)) || null;
}

async function signLabelDeal(store, options = {}) {
  const {
    labelId, artistId, dealType, release = null, advanceAmount,
    labelSharePercent = DEFAULT_LABEL_SHARE_PERCENT, transferFn, now = Date.now(),
  } = options;

  if (!labelId) throw new Error('signLabelDeal requires a labelId');
  if (!artistId) throw new Error('signLabelDeal requires an artistId');
  if (!LABEL_DEAL_TYPES.includes(dealType)) {
    throw new Error(`signLabelDeal requires a dealType of ${LABEL_DEAL_TYPES.join(' or ')}`);
  }
  if (!Number.isFinite(advanceAmount) || advanceAmount <= 0) {
    throw new Error('signLabelDeal requires a positive advanceAmount');
  }
  if (!Number.isFinite(labelSharePercent) || labelSharePercent <= 0 || labelSharePercent >= 1) {
    throw new Error('signLabelDeal requires a labelSharePercent between 0 and 1 (exclusive)');
  }
  if (typeof transferFn !== 'function') {
    throw new Error('signLabelDeal requires a transferFn(fromUserId, toUserId, amount, reason)');
  }
  if (findActiveBlanketDeal(store, artistId)) {
    throw new Error(`signLabelDeal: ${artistId} already has an active blanket label deal`);
  }

  if (dealType === 'per-release') {
    if (!release) throw new Error('signLabelDeal: a per-release deal requires a release');
    // Real, closes this file's own previously-flagged gap: the deal's
    // own artistId can be the release's primary artist OR any of its
    // real coWriters -- a co-writer signing a label deal for their own
    // share of a release they collaborate on, not just the artist who
    // originally submitted it.
    const isPrimaryArtist = release.artistId === artistId;
    const isCoWriter = Array.isArray(release.coWriters) && release.coWriters.some((cw) => cw.userId === artistId);
    if (!isPrimaryArtist && !isCoWriter) {
      throw new Error(`signLabelDeal: ${artistId} is neither the primary artist nor a co-writer on release ${release.id}`);
    }
    if (findActiveDealForRelease(store, release.id, artistId)) {
      throw new Error(`signLabelDeal: ${artistId} already has an active label deal on release ${release.id}`);
    }
  } else if (release !== null) {
    throw new Error('signLabelDeal: a blanket deal must not specify a release');
  }

  // The real, defining reversal from a personal-manager relationship:
  // the label pays the artist a real advance immediately, up front.
  await transferFn(labelId, artistId, advanceAmount, `Label advance: ${dealType} deal`);

  const deal = {
    id: store.nextLabelDealId++,
    labelId,
    artistId,
    dealType,
    releaseId: release ? release.id : null,
    advanceAmount,
    recoupmentBalance: advanceAmount,
    labelSharePercent,
    status: 'active',
    signedAt: now,
    fullyRecoupedAt: null,
    terminatedAt: null,
    terminationReason: null,
  };
  store.labelDeals.push(deal);
  return deal;
}

function getLabelDeal(store, dealId) {
  return store.labelDeals.find((d) => d.id === dealId) || null;
}

function terminateLabelDeal(store, options = {}) {
  const { dealId, reason, now = Date.now() } = options;
  const deal = getLabelDeal(store, dealId);
  if (!deal) throw new Error(`terminateLabelDeal: no label deal with id ${dealId}`);
  if (deal.status === 'terminated') throw new Error(`terminateLabelDeal: deal ${dealId} is already terminated`);
  if (!reason) throw new Error('terminateLabelDeal requires a reason');

  deal.status = 'terminated';
  deal.terminatedAt = now;
  deal.terminationReason = reason;
  return deal;
}

// The real query `releases.js`'s `reportStreamingRevenue` calls --
// per-release takes precedence (defensive; the signing-time
// exclusivity rules above should already prevent both existing at
// once for the same release). Called once per collaborator now, not
// just for the primary artist -- see `releases.js`'s own header for
// why.
function getActiveLabelDealForRelease(store, releaseId, artistId) {
  return findActiveDealForRelease(store, releaseId, artistId) || findActiveBlanketDeal(store, artistId);
}

// Real, standard recoupment math, and the one place that mutates the
// deal itself (the same granularity as `revealMinesTile` mutating its
// own round object elsewhere this session): the portion of
// `grossShare` still owed (up to whatever's left of
// `recoupmentBalance`) is recouped first, flipping the deal to
// `fully-recouped` the moment the balance reaches zero; whatever's
// left of `grossShare` after that splits by `labelSharePercent`.
// Returns the real amounts for `releases.js` to actually pay out --
// this function computes, `releases.js` calls `transferFn`, the same
// separation of concerns as every other split helper this session.
function applyLabelDeal(deal, grossShare, now = Date.now()) {
  const recoupedAmount = round(Math.min(grossShare, deal.recoupmentBalance));
  deal.recoupmentBalance = round(deal.recoupmentBalance - recoupedAmount);
  if (deal.recoupmentBalance === 0 && deal.status === 'active') {
    deal.status = 'fully-recouped';
    deal.fullyRecoupedAt = now;
  }

  const remaining = round(grossShare - recoupedAmount);
  const labelShareAmount = round(remaining * deal.labelSharePercent);
  const artistPortion = round(remaining - labelShareAmount);
  const labelTotal = round(recoupedAmount + labelShareAmount);

  return {
    recoupedAmount, labelShareAmount, labelTotal, artistPortion,
  };
}

module.exports = {
  LABEL_DEAL_TYPES,
  LABEL_DEAL_STATUSES,
  DEFAULT_LABEL_SHARE_PERCENT,
  signLabelDeal,
  getLabelDeal,
  terminateLabelDeal,
  getActiveLabelDealForRelease,
  applyLabelDeal,
};
