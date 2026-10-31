// DREAMS -- the Dreams Wallet: what a real person collects by
// scanning a real screen.
//
// **Not the same thing as `recordScan` in campaigns.js.** That
// function is a service-credential, anonymous billing event -- a
// screen or kiosk backend reports "a scan happened" so the advertiser
// and screen owner can be paid. It has never known WHO scanned, only
// that one did. This module is the other half, by direct instruction:
// a real person, identified by a real Shield session, who scans a
// screen collects the campaign's own `incentive` (set by
// `setIncentive` -- every DREAMS campaign already has one, a coupon
// code or a percent/amount off, before it can even go live) into a
// personal wallet. The two can both happen from the same physical
// scan, by two different real actors, and this module deliberately
// never calls or depends on `recordScan`: whether an advertiser owes
// scan-pricing revenue is a separate question from whether a person
// is owed a coupon for having scanned.
//
// **One collected item per person per campaign, by direct
// instruction.** Scanning the same campaign's screen again answers
// "already collected" rather than minting a second coupon -- the
// obvious free-coupon-farming case a real deal has to close.
//
// **Redeeming is a status flag, by direct instruction, not a real
// checkout integration.** A person marks their own coupon "used",
// exactly like tearing a paper coupon. Nothing here talks to VENVS or
// any other checkout; that is real, separate, later work if ever
// built, not silently implied by this module's existence.

function getCampaignIncentiveSnapshot(campaign) {
  // Defensive, not trusting: `launchCampaign` already refuses to go
  // live without an incentive, but this module should not assume a
  // guarantee made somewhere else always held -- the same posture
  // `placeTradeOrder` takes on price ("a brokerage should not be
  // relying on its ledger to catch a price it never validated").
  if (!campaign.incentive) {
    throw new Error(`collectIncentive: campaign ${campaign.id} has no incentive set -- nothing to collect`);
  }
  // A real snapshot, not a live reference: `setIncentive` can only run
  // on a draft campaign (`requireDraft`), so a live campaign's
  // incentive cannot actually change underneath an already-collected
  // item today -- but a wallet entry should record what was promised
  // at collection time on its own terms, not depend on that staying
  // true forever.
  return { ...campaign.incentive };
}

function findExistingCollection(store, userId, campaignId) {
  return store.walletEntries.find((e) => e.userId === userId && e.campaignId === campaignId) || null;
}

// Real "scan and collect" -- the end-user half of a physical scan.
// Costs the user nothing; grants nothing to the advertiser or screen
// owner beyond what `recordScan`/`recordImpression` already do or do
// not record elsewhere. `getCampaign`/`campaign.screenIds` are passed
// in by the caller (server.js) rather than required here, so this
// module stays a plain function of a store and does not import
// campaigns.js's own validation a second time.
function collectIncentive(store, options = {}) {
  const { userId, campaignId, screenId, campaign, now = Date.now() } = options;

  if (!userId) throw new Error('collectIncentive requires a userId');
  if (!campaign) throw new Error(`collectIncentive: no campaign with id ${campaignId}`);
  if (campaign.status !== 'live') {
    throw new Error(`collectIncentive: campaign ${campaignId} is "${campaign.status}", not "live"`);
  }
  if (!campaign.screenIds.includes(screenId)) {
    throw new Error(`collectIncentive: screen ${screenId} is not selected for campaign ${campaignId}`);
  }

  const existing = findExistingCollection(store, userId, campaignId);
  if (existing) {
    throw new Error(`collectIncentive: ${userId} already collected campaign ${campaignId}'s incentive (wallet entry ${existing.id})`);
  }

  const incentive = getCampaignIncentiveSnapshot(campaign);

  const entry = {
    id: store.nextWalletEntryId++,
    userId,
    campaignId,
    screenId,
    advertiserId: campaign.advertiserId,
    incentive,
    collectedAt: now,
    redeemedAt: null,
  };
  store.walletEntries.push(entry);
  return entry;
}

function getWalletEntry(store, entryId) {
  return store.walletEntries.find((e) => e.id === entryId) || null;
}

function listWalletForUser(store, userId) {
  return store.walletEntries
    .filter((e) => e.userId === userId)
    .slice()
    .sort((a, b) => b.collectedAt - a.collectedAt);
}

// A status flag, by direct instruction -- see this file's own header.
// Still checks real ownership itself rather than trusting the caller
// to have already done so: the same defense-in-depth every ownership-
// sensitive function in this ecosystem applies (server.js's own
// `requireWalletOwner` checks it first, over a real session, but a
// second check here costs nothing and means this function is safe to
// call from anywhere, not just from behind that one guard).
function redeemIncentive(store, options = {}) {
  const { userId, entryId, now = Date.now() } = options;
  const entry = getWalletEntry(store, entryId);
  if (!entry) throw new Error(`redeemIncentive: no wallet entry with id ${entryId}`);
  if (entry.userId !== userId) {
    throw new Error('redeemIncentive: only the person who collected this item may redeem it');
  }
  if (entry.redeemedAt) {
    throw new Error(`redeemIncentive: wallet entry ${entryId} was already redeemed at ${entry.redeemedAt}`);
  }
  entry.redeemedAt = now;
  return entry;
}

module.exports = {
  collectIncentive,
  getWalletEntry,
  listWalletForUser,
  redeemIncentive,
};
