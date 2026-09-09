// Vvltvre Music/Distribution -- Artist/Label Management (Phase 2).
// A real, separate economic relationship from everything Phase 1
// built: Vvltvre Music itself still takes 0% of streaming revenue
// (the whole structural point of the flat-fee/DistroKid-TuneCore
// model, unchanged) -- a personal manager or label taking a real
// commission on an artist's own earnings is a completely different,
// real-world relationship between the artist and their own manager,
// industry-standard 15-20% of the artist's income (not the
// distributor's), the same way a real musician can own 100% of their
// masters (this app's own `ownershipRetainedPercent: 100`) while still
// paying a manager a cut of what those masters earn -- two genuinely
// separate real concepts, not a contradiction.
//
// Real, deliberate design choice: management deals are exclusive, one
// active deal per artist at a time -- matching how real personal-
// management relationships actually work (an artist has one manager,
// not several simultaneously competing for the same commission).
// `signArtist` enforces this directly rather than allowing silent
// double-signing.

const MANAGEMENT_DEAL_STATUSES = ['active', 'terminated'];

// Real, deliberately interpretive default grounded in the real,
// standard personal-manager commission range in the music industry
// (15-20% of an artist's earnings) -- the midpoint, same posture as
// CHOPZ SHOP's own flagged `DEFAULT_FEE_PERCENT`.
const DEFAULT_COMMISSION_PERCENT = 0.175;

function signArtist(store, options = {}) {
  const {
    managerId, artistId, commissionPercent = DEFAULT_COMMISSION_PERCENT, now = Date.now(),
  } = options;

  if (!managerId) throw new Error('signArtist requires a managerId');
  if (!artistId) throw new Error('signArtist requires an artistId');
  if (!Number.isFinite(commissionPercent) || commissionPercent <= 0 || commissionPercent >= 1) {
    throw new Error('signArtist requires a commissionPercent between 0 and 1 (exclusive)');
  }

  const existing = getArtistManager(store, artistId);
  if (existing) {
    throw new Error(`signArtist: ${artistId} already has an active management deal (with ${existing.managerId})`);
  }

  const deal = {
    id: store.nextDealId++,
    managerId,
    artistId,
    commissionPercent,
    status: 'active',
    startedAt: now,
    endedAt: null,
    terminationReason: null,
  };
  store.managementDeals.push(deal);
  return deal;
}

function getDeal(store, dealId) {
  return store.managementDeals.find((d) => d.id === dealId) || null;
}

function terminateDeal(store, options = {}) {
  const { dealId, reason, now = Date.now() } = options;
  const deal = getDeal(store, dealId);
  if (!deal) throw new Error(`terminateDeal: no deal with id ${dealId}`);
  if (deal.status !== 'active') throw new Error(`terminateDeal: deal ${dealId} is not active (status: ${deal.status})`);
  if (!reason) throw new Error('terminateDeal requires a reason');

  deal.status = 'terminated';
  deal.endedAt = now;
  deal.terminationReason = reason;
  return deal;
}

// The real query `reportStreamingRevenue` calls to decide whether a
// commission split applies -- null (no active deal) means the artist
// keeps 100%, exactly Phase 1's original behavior, unchanged.
function getArtistManager(store, artistId) {
  return store.managementDeals.find((d) => d.artistId === artistId && d.status === 'active') || null;
}

function getManagerRoster(store, managerId) {
  return store.managementDeals.filter((d) => d.managerId === managerId && d.status === 'active');
}

function getManagerSummary(store, managerId) {
  const roster = getManagerRoster(store, managerId);
  const payouts = store.commissionPayouts.filter((p) => p.managerId === managerId);
  const totalCommissionEarned = Math.round(payouts.reduce((sum, p) => sum + p.amount, 0) * 100) / 100;
  return {
    managerId,
    rosterSize: roster.length,
    roster: roster.map((d) => ({ artistId: d.artistId, commissionPercent: d.commissionPercent, startedAt: d.startedAt })),
    totalCommissionEarned,
  };
}

module.exports = {
  MANAGEMENT_DEAL_STATUSES,
  DEFAULT_COMMISSION_PERCENT,
  signArtist,
  getDeal,
  terminateDeal,
  getArtistManager,
  getManagerRoster,
  getManagerSummary,
};
