// Vvltvre Music/Distribution -- the real core loop.
// Built against the real, named comparables this session was given
// directly, not generic "music distribution": DistroKid and TuneCore
// (the real flat-fee model -- pay to distribute, keep 100% of
// streaming royalties, no percentage-of-revenue cut ever taken) plus
// gamma. (the real, ~$1B-backed model that extends the same
// artist-retained-ownership posture across music, video, AND
// podcasts, not music alone). This is Vvltvre's own division built on
// that structural pattern, per `VOID_MAGIC_MASTER_BUILD_BRIEF.md`'s
// own §17 framing that VVLTVRE (as the umbrella) provides "the
// entertainment ecosystem... distribution, creator ecosystem" the
// same way it already provides Touring & Tix (VOID MAGIC).
//
// The real structural choice this module encodes, deliberately
// different from every royalty-split module built elsewhere this
// session (VENVS Publishing's `royalties.js`, CHOPZ SHOP's
// affiliate-split `orders.js`): there is no percentage split here at
// all. A release costs a real, one-time flat fee at submission
// (TuneCore's actual real per-release pricing shape, not DistroKid's
// alternative unlimited-annual-subscription shape -- chosen because
// it maps directly onto individual Release records, flagged as a
// real, deliberate pick between two real comparable models). Every
// dollar of streaming revenue reported after that belongs 100% to the
// artist -- `ownershipRetainedPercent: 100` is a real, structural
// field on every release, not just a comment, so the "you keep
// everything" claim is something a caller can actually verify by
// reading the record, not just trust.
//
// DISTRIBUTION_TARGETS lists real platform names descriptively --
// exactly like VENVS Publishing's own "no Ingram API integration"
// honesty, there is no real DSP delivery integration here. `status`
// is a real, manually-advanced lifecycle field standing in for what
// would, in production, be webhook-driven confirmation from each real
// platform.
//
// **Co-writer/collaborator royalty splits added**, closing this
// file's own previously-flagged gap. Grounded in a real, named
// feature of this same module's own cited comparable: DistroKid's
// real "Splits" product -- the uploader adds every collaborator
// (including themself, if they keep a share) with a percentage, the
// percentages must total exactly 100%, and each collaborator is paid
// directly, not routed through the uploader. `coWriters` on a
// `Release`, if given, is that same real shape. Omitting it keeps
// Phase 1's original single-payee behavior exactly, unchanged --
// `coWriters` defaults to a single implicit 100% entry for
// `artistId`.
//
// A management deal (`lib/managers.js`) is a real, separate
// relationship between the primary artist and their own manager --
// it applies only to the primary `artistId`'s own resulting share,
// never to other collaborators, who have no relationship with that
// manager at all. Rounding discipline matches this session's other
// multi-way splits (CHOPZ SHOP's `createOrder`): every share but the
// last is rounded independently, and the last share absorbs whatever
// rounding remainder is left, so the real per-collaborator payouts
// always sum to exactly the reported `amount`, never drift.
//
// **Label deals (`lib/labelDeals.js`) layer in ahead of management**:
// if a collaborator's own share is covered by an active label deal
// (per-release or blanket), that deal's real recoupment/split math
// runs FIRST, against that collaborator's own raw `grossShare` --
// producing the real amount that actually reaches them from the label
// relationship. A management commission, if any, is then computed on
// THAT already-reduced amount, not the pre-label gross -- a manager
// commissions what the artist actually receives, matching how real
// personal-management deals work alongside a separate label deal.
//
// **Real, per-collaborator label deals**, closing this file's own
// previously-flagged gap ("a co-writer with their own separate label
// deal isn't modeled"). The label-deal lookup now runs for EVERY
// collaborator on a release, not just the primary artist who
// submitted it -- two different co-writers on the same release can
// each hold their own, completely independent label deal (different
// labels, different advances, different recoupment balances), each
// one applying only against that one collaborator's own share. A
// management deal, by contrast, is deliberately still primary-artist-
// only -- a manager represents the primary artist's whole career, not
// every collaborator who ever appears on one of their releases.

const { getArtistManager } = require('./managers');
const { getActiveLabelDealForRelease, applyLabelDeal } = require('./labelDeals');

const RELEASE_FORMATS = ['single', 'album', 'video', 'podcast-episode'];

const DISTRIBUTION_TARGETS = [
  'Spotify', 'Apple Music', 'YouTube Music', 'Amazon Music', 'TikTok', 'Deezer', 'SoundCloud',
];

// Real, deliberately interpretive numbers grounded in TuneCore's real
// public per-release pricing structure (exact figures move over time,
// so these are a flagged, structurally-accurate stand-in, not a
// scraped current price list).
const DISTRIBUTION_FEES = {
  single: 9.99,
  album: 29.99,
  video: 19.99,
  'podcast-episode': 4.99,
};

const RELEASE_STATUSES = ['submitted', 'distributing', 'live', 'taken-down'];

const VULTURE_MUSIC_PLATFORM_ACCOUNT = 'vulture-music-platform';
const VULTURE_MUSIC_REVENUE_INTAKE_ACCOUNT = 'vulture-music-revenue-intake';

function round(n) {
  return Math.round(n * 100) / 100;
}

// Real, standalone validation so both `submitRelease` and any future
// caller enforce the exact same DistroKid-Splits-style rule: every
// named collaborator, percentages summing to exactly 100%.
function validateCoWriters(coWriters) {
  if (!Array.isArray(coWriters) || coWriters.length === 0) {
    throw new Error('coWriters, if given, must be a non-empty array');
  }
  const seen = new Set();
  let total = 0;
  for (const entry of coWriters) {
    const { userId, splitPercent } = entry || {};
    if (!userId) throw new Error('every coWriters entry requires a userId');
    if (seen.has(userId)) throw new Error(`coWriters: duplicate userId "${userId}"`);
    seen.add(userId);
    if (!Number.isFinite(splitPercent) || splitPercent <= 0 || splitPercent > 1) {
      throw new Error(`coWriters: splitPercent for "${userId}" must be a number between 0 (exclusive) and 1 (inclusive)`);
    }
    total += splitPercent;
  }
  if (Math.abs(total - 1) > 0.0001) {
    throw new Error(`coWriters: splitPercent values must sum to exactly 1 (got ${round(total)})`);
  }
}

async function submitRelease(store, options = {}) {
  const {
    artistId, title, format, targetPlatforms, coWriters = null, transferFn, now = Date.now(),
  } = options;

  if (!artistId) throw new Error('submitRelease requires an artistId');
  if (!title) throw new Error('submitRelease requires a title');
  if (!RELEASE_FORMATS.includes(format)) {
    throw new Error(`submitRelease requires a format of ${RELEASE_FORMATS.join(', ')}`);
  }
  if (!Array.isArray(targetPlatforms) || targetPlatforms.length === 0) {
    throw new Error('submitRelease requires a non-empty targetPlatforms array');
  }
  const unknown = targetPlatforms.filter((t) => !DISTRIBUTION_TARGETS.includes(t));
  if (unknown.length > 0) {
    throw new Error(`submitRelease: unknown target platform(s): ${unknown.join(', ')}`);
  }
  if (coWriters !== null) validateCoWriters(coWriters);
  if (typeof transferFn !== 'function') {
    throw new Error('submitRelease requires a transferFn(fromUserId, toUserId, amount, reason)');
  }

  const distributionFee = DISTRIBUTION_FEES[format];

  // Charge the artist the real flat fee before recording the release
  // -- a failed charge must never leave a "submitted" release behind.
  await transferFn(artistId, VULTURE_MUSIC_PLATFORM_ACCOUNT, distributionFee, `Distribution fee: ${format} "${title}"`);

  const release = {
    id: store.nextReleaseId++,
    artistId,
    title,
    format,
    targetPlatforms,
    coWriters: coWriters || [{ userId: artistId, splitPercent: 1 }],
    distributionFee,
    status: 'submitted',
    ownershipRetainedPercent: 100,
    vaultStvdiosPostId: null,
    createdAt: now,
  };
  store.releases.push(release);
  return release;
}

function getRelease(store, releaseId) {
  return store.releases.find((r) => r.id === releaseId) || null;
}

function listReleasesForArtist(store, artistId) {
  return store.releases.filter((r) => r.artistId === artistId).sort((a, b) => b.createdAt - a.createdAt);
}

function requireStatus(store, releaseId, expectedStatus, action) {
  const release = getRelease(store, releaseId);
  if (!release) throw new Error(`${action}: no release with id ${releaseId}`);
  if (release.status !== expectedStatus) {
    throw new Error(`${action}: release ${releaseId} is "${release.status}", expected "${expectedStatus}"`);
  }
  return release;
}

function markDistributing(store, releaseId) {
  const release = requireStatus(store, releaseId, 'submitted', 'markDistributing');
  release.status = 'distributing';
  return release;
}

function markLive(store, releaseId) {
  const release = requireStatus(store, releaseId, 'distributing', 'markLive');
  release.status = 'live';
  return release;
}

function takeDown(store, options = {}) {
  const { releaseId, reason } = options;
  if (!reason) throw new Error('takeDown requires a reason');
  const release = requireStatus(store, releaseId, 'live', 'takeDown');
  release.status = 'taken-down';
  release.takedownReason = reason;
  return release;
}

// Real video cross-link, per explicit instruction: any release --
// not just the `video` format, since a real music video most commonly
// accompanies a `single` or `album` release, not a video-format
// release itself -- can attach a real video hosted on Vavlt Stvdios
// rather than this project reinventing video hosting. `server.js`
// owns the actual cross-app HTTP call (creating a real Vavlt Stvdios
// Reel, `source: 'vulture-music'`); this function only records the
// resulting real cross-reference, a real, later attach step mirroring
// CHOPZ SHOP's own `requestFulfillment` pattern (a separate call
// attaching cross-app data to an already-created record, not baked
// into `submitRelease`). One video per release -- a second attach
// attempt is rejected, not silently overwritten.
function attachMusicVideo(store, options = {}) {
  const { releaseId, vaultStvdiosPostId } = options;
  const release = getRelease(store, releaseId);
  if (!release) throw new Error(`attachMusicVideo: no release with id ${releaseId}`);
  if (release.vaultStvdiosPostId !== null) throw new Error(`attachMusicVideo: release ${releaseId} already has a video attached`);
  if (!vaultStvdiosPostId) throw new Error('attachMusicVideo requires a vaultStvdiosPostId');

  release.vaultStvdiosPostId = vaultStvdiosPostId;
  return release;
}

// The real structural payoff of the flat-fee model: Vvltvre Music
// itself takes 0% of streaming revenue, not a percentage-of-revenue
// split -- both real payouts below still always sum to exactly the
// full reported `amount`, still both drawn from the same revenue-
// intake account, so that claim stays true and testable regardless of
// whether a manager is involved. Only a "live" release can report
// revenue -- there's nothing to have earned before a real platform is
// actually carrying it.
//
// Phase 2 addition: if the artist has an active management deal
// (`lib/managers.js`), the manager's own real commission comes out of
// the artist's share here -- a separate, real economic relationship
// between the artist and their own manager, not a Vvltvre Music cut.
// No deal means no change from Phase 1's original behavior: the
// artist keeps the full amount.
async function reportStreamingRevenue(store, options = {}) {
  const {
    releaseId, amount, source, transferFn, now = Date.now(),
  } = options;

  const release = getRelease(store, releaseId);
  if (!release) throw new Error(`reportStreamingRevenue: no release with id ${releaseId}`);
  if (release.status !== 'live') {
    throw new Error(`reportStreamingRevenue: release ${releaseId} is "${release.status}", must be "live"`);
  }
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('reportStreamingRevenue requires a positive amount');
  if (!source) throw new Error('reportStreamingRevenue requires a source');
  if (typeof transferFn !== 'function') {
    throw new Error('reportStreamingRevenue requires a transferFn(fromUserId, toUserId, amount, reason)');
  }

  const deal = getArtistManager(store, release.artistId);
  const coWriters = release.coWriters || [{ userId: release.artistId, splitPercent: 1 }];

  const payouts = [];
  let allocated = 0;
  for (let i = 0; i < coWriters.length; i += 1) {
    const { userId, splitPercent } = coWriters[i];
    const isLast = i === coWriters.length - 1;
    // The real, exact-sum rounding discipline: every share but the
    // last is rounded independently; the last absorbs whatever
    // remainder is left, so payouts always sum to exactly `amount`.
    const grossShare = isLast ? round(amount - allocated) : round(amount * splitPercent);
    allocated = round(allocated + grossShare);

    const isPrimaryArtist = userId === release.artistId;

    // Real, per-collaborator label deal lookup -- runs for whichever
    // collaborator this loop iteration is on, not just the primary
    // artist, so a co-writer's own separate label deal (per-release or
    // blanket) is found and applied against their own share.
    let workingShare = grossShare;
    let labelPayout = null;
    const labelDeal = getActiveLabelDealForRelease(store, release.id, userId);
    if (labelDeal) {
      const result = applyLabelDeal(labelDeal, workingShare, now);
      labelPayout = { dealId: labelDeal.id, labelId: labelDeal.labelId, ...result };
      workingShare = result.artistPortion;
      if (result.labelTotal > 0) {
        await transferFn(
          VULTURE_MUSIC_REVENUE_INTAKE_ACCOUNT,
          labelDeal.labelId,
          result.labelTotal,
          `Label recoupment/share: ${source} for "${release.title}"`,
        );
      }
    }

    const managerCommission = (isPrimaryArtist && deal) ? round(workingShare * deal.commissionPercent) : 0;
    const netShare = round(workingShare - managerCommission);

    // A label deal can recoup 100% of the primary artist's own share
    // on a given report, leaving a real, legitimate `netShare` of
    // exactly 0 -- skip the transfer rather than calling `transferFn`
    // with a non-positive amount (V3's own real ledger rejects those
    // outright; this isn't a hypothetical, a live pass against it
    // caught exactly this case).
    if (netShare > 0) {
      await transferFn(
        VULTURE_MUSIC_REVENUE_INTAKE_ACCOUNT,
        userId,
        netShare,
        managerCommission > 0
          ? `Streaming revenue: ${source} for "${release.title}" (after ${Math.round(deal.commissionPercent * 100)}% management commission)`
          : `Streaming revenue: ${source} for "${release.title}"`,
      );
    }

    if (managerCommission > 0) {
      await transferFn(
        VULTURE_MUSIC_REVENUE_INTAKE_ACCOUNT,
        deal.managerId,
        managerCommission,
        `Management commission: ${source} for "${release.title}"`,
      );
      store.commissionPayouts.push({
        id: store.nextCommissionPayoutId++,
        dealId: deal.id,
        managerId: deal.managerId,
        artistId: release.artistId,
        amount: managerCommission,
        createdAt: now,
      });
    }

    payouts.push({
      userId, splitPercent, grossShare, labelPayout, managerCommission, netShare,
    });
  }

  // Backward-compatible top-level fields: the primary artist's own
  // entry within `payouts`, unchanged in meaning from before this
  // feature existed for the single-payee (no coWriters) case.
  const primaryPayout = payouts.find((p) => p.userId === release.artistId) || payouts[0];

  const report = {
    id: store.nextRevenueReportId++,
    releaseId,
    amount,
    source,
    payouts,
    managerCommission: primaryPayout.managerCommission,
    artistNet: primaryPayout.netShare,
    createdAt: now,
  };
  store.revenueReports.push(report);
  return report;
}

// Real, corrected for co-writer splits: this artist's own reported
// figures now reflect only their own real `grossShare`/`netShare` of
// each report's payouts, not the full release amount -- honest even
// when this artist gave away most or all of a release's income to
// real collaborators. Unaffected (still 100%) for the no-`coWriters`
// case, exactly Phase 1/2's original behavior.
function getArtistSummary(store, artistId) {
  const releases = listReleasesForArtist(store, artistId);
  const releaseIds = new Set(releases.map((r) => r.id));
  const reports = store.revenueReports.filter((rr) => releaseIds.has(rr.releaseId));
  const totalDistributionFeesPaid = round(releases.reduce((sum, r) => sum + r.distributionFee, 0));

  let totalStreamingRevenue = 0;
  let totalManagementCommissionPaid = 0;
  let totalNetAfterManagement = 0;
  for (const rr of reports) {
    const ownPayout = rr.payouts.find((p) => p.userId === artistId);
    if (!ownPayout) continue; // this artist gave away their entire share on this release
    totalStreamingRevenue = round(totalStreamingRevenue + ownPayout.grossShare);
    totalManagementCommissionPaid = round(totalManagementCommissionPaid + ownPayout.managerCommission);
    totalNetAfterManagement = round(totalNetAfterManagement + ownPayout.netShare);
  }

  return {
    artistId,
    releaseCount: releases.length,
    totalDistributionFeesPaid,
    totalStreamingRevenue,
    netEarnings: round(totalStreamingRevenue - totalDistributionFeesPaid),
    totalManagementCommissionPaid,
    // What actually reached the artist's own wallet from streaming
    // revenue, after both Vvltvre Music's flat fee AND a manager's
    // real commission (if any) -- the fully honest bottom line.
    netAfterManagement: round(totalNetAfterManagement - totalDistributionFeesPaid),
    ownershipRetainedPercent: 100,
  };
}

// Real, necessary addition for co-writer splits: a collaborator who
// isn't a release's own `artistId` never appears in
// `listReleasesForArtist`/`getArtistSummary` at all -- this is the
// cross-release query that actually finds them, scanning every real
// revenue report's own `payouts` for their userId regardless of which
// release or which artist submitted it.
function getCollaboratorEarnings(store, userId) {
  const earnings = [];
  for (const rr of store.revenueReports) {
    const payout = rr.payouts.find((p) => p.userId === userId);
    if (!payout) continue;
    const release = getRelease(store, rr.releaseId);
    earnings.push({
      releaseId: rr.releaseId,
      releaseTitle: release ? release.title : null,
      reportId: rr.id,
      splitPercent: payout.splitPercent,
      grossShare: payout.grossShare,
      managerCommission: payout.managerCommission,
      netShare: payout.netShare,
    });
  }
  return {
    userId,
    totalNetEarnings: round(earnings.reduce((sum, e) => sum + e.netShare, 0)),
    earnings,
  };
}

module.exports = {
  RELEASE_FORMATS,
  DISTRIBUTION_TARGETS,
  DISTRIBUTION_FEES,
  RELEASE_STATUSES,
  VULTURE_MUSIC_PLATFORM_ACCOUNT,
  VULTURE_MUSIC_REVENUE_INTAKE_ACCOUNT,
  submitRelease,
  getRelease,
  listReleasesForArtist,
  markDistributing,
  markLive,
  takeDown,
  attachMusicVideo,
  reportStreamingRevenue,
  getArtistSummary,
  getCollaboratorEarnings,
};
