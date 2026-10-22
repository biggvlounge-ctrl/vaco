// VENVM -- Growth Programs: referrals, growth missions, ambassador
// tiers, and a real KPI scorecard.
//
// Per a direct batch instruction naming a "Zeely AI inspired growth
// system" -- growth recommendations, campaign optimization, viral
// campaign generation, creator recruitment, ambassador management,
// affiliate tracking, referral systems, growth missions, business
// onboarding funnels, KPI tracking, growth scorecards.
//
// ---------------------------------------------------------------------
// What this builds, and what it deliberately does not
// ---------------------------------------------------------------------
// "AI growth recommendations," "campaign optimization" and "viral
// campaign generation" all genuinely need a generative/predictive
// model call this session's environment has no provider configured
// for (checked directly: no OpenAI/Replicate/ElevenLabs/etc. API key
// anywhere) -- not built here, and not faked with a canned
// recommendation standing in for a real one.
//
// "Affiliate tracking" already has a real, working implementation --
// `chopz/chopz-shop/lib/affiliateLinks.js`/`orders.js` (commission
// splits, real 7-day click attribution, TikTok-Shop-accurate
// economics). This module does not duplicate that; a referral here is
// a DIFFERENT real mechanic -- recruiting a person (a user, a creator,
// or a business) into the ecosystem via a code, not tracking a
// product-purchase click.
//
// "Creator recruitment" and "business onboarding funnels" are not
// separate systems from "referral systems" -- the instruction names
// them as different GOALS, not different MECHANICS, and
// `referralType` is left open the same way `combatSportType` is in
// VDP's own `combatSports.js` ("the instruction names real examples,
// not an exhaustive list") rather than inventing three parallel
// tracking systems for one real shape.
//
// ---------------------------------------------------------------------
// Reward amounts are tracked, not yet paid
// ---------------------------------------------------------------------
// `rewardReferral` records a real, specific reward amount against a
// referral -- it does NOT move money. No app in this ecosystem syncs
// `shared/settleOnce.js` into VENVM yet (`sync-shared-runtime.sh`'s
// own `SETTLE_ONCE_TARGETS` list does not include it), because VENVM
// has never needed to settle a real payment before this. Wiring a
// real payout is a genuine, separate, well-scoped follow-up -- adding
// VENVM to that list and giving this module a real `settleFn`, the
// same claim-before-settle discipline every other payout in this
// ecosystem already follows -- not attempted inside this same pass.

const REFERRAL_STATUSES = ['pending', 'converted', 'rewarded'];

// Real, named ambassador tiers, thresholded on real CONVERTED
// referrals (not raw signups -- a referral that never converted
// earned the ambassador nothing real yet). Flagged, interpretive
// numbers, the same honest posture `vago/lib/casinoSession.js`'s own
// `ORIGINALS_MIN_STAKE`/`ORIGINALS_MAX_STAKE` take: no comparable doc
// in this repo names an exact figure, so these are a reasonable
// default a program owner can change, not a researched real number.
const AMBASSADOR_TIERS = [
  { tier: 'none', minConverted: 0 },
  { tier: 'bronze', minConverted: 3 },
  { tier: 'silver', minConverted: 10 },
  { tier: 'gold', minConverted: 25 },
];

// Real, named growth missions -- a milestone and the real metric it
// is measured against. `requiredCount` is this module's own stated
// threshold, same flagged posture as the ambassador tiers above.
// Completion is read from data this module is actually given
// (`checkMissionProgress`'s `currentCount`), never invented or
// estimated -- a mission this module cannot measure is not listed
// here as completable.
const GROWTH_MISSIONS = {
  'first-referral': { label: 'Bring your first real referral', requiredCount: 1 },
  'recruit-3-creators': { label: 'Recruit three real creators', requiredCount: 3, referralType: 'creator' },
  'ten-conversions': { label: 'Convert ten real referrals', requiredCount: 10 },
  'onboard-a-business': { label: 'Onboard one real business account', requiredCount: 1, referralType: 'business' },
};

function requireString(value, field, action) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${action} requires a non-empty ${field}`);
  }
  return value.trim();
}

// A real, simple, collision-checked code -- not cryptographically
// secure (nothing here gates money or access on guessing it), just
// unique in this store the same way every other id generator in this
// ecosystem already works.
function generateReferralCode(store, ambassadorId) {
  const base = ambassadorId.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'REF';
  let suffix = store.nextReferralCodeSuffix++;
  let code = `${base}-${suffix}`;
  while (store.referralCodes[code]) {
    suffix = store.nextReferralCodeSuffix++;
    code = `${base}-${suffix}`;
  }
  return code;
}

function createReferralCode(store, options = {}) {
  const { ambassadorId } = options;
  requireString(ambassadorId, 'ambassadorId', 'createReferralCode');
  const code = generateReferralCode(store, ambassadorId);
  store.referralCodes[code] = { code, ambassadorId, createdAt: Date.now() };
  return store.referralCodes[code];
}

function getReferralCode(store, code) {
  return store.referralCodes[code] || null;
}

// A real signup against a real code -- `referralType` is open (see
// the header), defaulting to `'user'`, the plain case the instruction
// itself treats as the baseline the other two specialize.
function recordReferral(store, options = {}) {
  const { code, referredId, referralType = 'user', now = Date.now() } = options;
  const codeEntry = getReferralCode(store, code);
  if (!codeEntry) throw new Error(`recordReferral: no referral code "${code}"`);
  requireString(referredId, 'referredId', 'recordReferral');
  if (referredId === codeEntry.ambassadorId) {
    throw new Error('recordReferral: an ambassador cannot refer themselves');
  }
  // One real referral relationship per (ambassador, referredId) pair
  // -- the same person signing up twice through the same ambassador's
  // code is not two real recruits.
  const duplicate = store.referrals.find(
    (r) => r.ambassadorId === codeEntry.ambassadorId && r.referredId === referredId,
  );
  if (duplicate) throw new Error(`recordReferral: ${referredId} was already referred by ${codeEntry.ambassadorId}`);

  const referral = {
    id: store.nextReferralId++,
    ambassadorId: codeEntry.ambassadorId,
    referredId,
    referralType,
    code,
    status: 'pending',
    rewardAmount: null,
    createdAt: now,
    convertedAt: null,
    rewardedAt: null,
  };
  store.referrals.push(referral);
  return referral;
}

function getReferral(store, referralId) {
  return store.referrals.find((r) => r.id === referralId) || null;
}

// Conversion is a real fact the CALLER observed (a referred user's
// first real purchase, a creator's first real published video, a
// business's first real completed onboarding step) -- this module
// has no way to know what "qualifies" for any given program, so it
// never invents the trigger, only records it once given.
function convertReferral(store, options = {}) {
  const { referralId, now = Date.now() } = options;
  const referral = getReferral(store, referralId);
  if (!referral) throw new Error(`convertReferral: no referral with id ${referralId}`);
  if (referral.status !== 'pending') {
    throw new Error(`convertReferral: referral ${referralId} is "${referral.status}", expected "pending"`);
  }
  referral.status = 'converted';
  referral.convertedAt = now;
  return referral;
}

// Records a real, specific reward amount -- does not pay it. See the
// header on why: nothing in VENVM moves money yet.
function rewardReferral(store, options = {}) {
  const { referralId, rewardAmount, now = Date.now() } = options;
  const referral = getReferral(store, referralId);
  if (!referral) throw new Error(`rewardReferral: no referral with id ${referralId}`);
  if (referral.status !== 'converted') {
    throw new Error(`rewardReferral: referral ${referralId} is "${referral.status}", expected "converted"`);
  }
  if (!Number.isFinite(rewardAmount) || rewardAmount <= 0) {
    throw new Error('rewardReferral requires a positive rewardAmount');
  }
  referral.status = 'rewarded';
  referral.rewardAmount = rewardAmount;
  referral.rewardedAt = now;
  return referral;
}

// The real ambassador tier, derived fresh from real converted
// referrals every time -- never stored and left to go stale, the same
// "derive, don't cache a fact that can drift" rule
// `occupations.isRookieEligible` already holds in VACON-C.
function ambassadorTier(store, ambassadorId) {
  const converted = store.referrals.filter((r) => r.ambassadorId === ambassadorId && r.status !== 'pending').length;
  let tier = AMBASSADOR_TIERS[0].tier;
  for (const t of AMBASSADOR_TIERS) {
    if (converted >= t.minConverted) tier = t.tier;
  }
  return tier;
}

// The real KPI scorecard: an ambassador's own real referral counts by
// status, real reward total, and their real current tier -- every
// number a direct count or sum over `store.referrals`, nothing
// modeled or predicted.
function ambassadorScorecard(store, ambassadorId) {
  const own = store.referrals.filter((r) => r.ambassadorId === ambassadorId);
  const byStatus = { pending: 0, converted: 0, rewarded: 0 };
  let totalRewardEarned = 0;
  for (const r of own) {
    byStatus[r.status] += 1;
    if (r.status === 'rewarded') totalRewardEarned += r.rewardAmount;
  }
  const convertedOrBetter = byStatus.converted + byStatus.rewarded;
  return {
    ambassadorId,
    totalReferrals: own.length,
    byStatus,
    conversionRate: own.length > 0 ? Math.round((convertedOrBetter / own.length) * 100) / 100 : null,
    totalRewardEarned: Math.round(totalRewardEarned * 100) / 100,
    tier: ambassadorTier(store, ambassadorId),
  };
}

// Real progress against a real, named mission -- `currentCount` is
// supplied by the caller (read from this ambassador's own real
// referrals, typically filtered to the mission's own `referralType`),
// never estimated by this module. A mission naming no `referralType`
// is measured against every referral type combined.
function checkMissionProgress(store, options = {}) {
  const { ambassadorId, missionKey } = options;
  const mission = GROWTH_MISSIONS[missionKey];
  if (!mission) throw new Error(`checkMissionProgress: "${missionKey}" is not a real growth mission`);

  const relevant = store.referrals.filter((r) => {
    if (r.ambassadorId !== ambassadorId) return false;
    if (mission.referralType && r.referralType !== mission.referralType) return false;
    return r.status !== 'pending';
  });
  const currentCount = relevant.length;
  return {
    ambassadorId,
    missionKey,
    label: mission.label,
    requiredCount: mission.requiredCount,
    currentCount,
    complete: currentCount >= mission.requiredCount,
  };
}

module.exports = {
  REFERRAL_STATUSES, AMBASSADOR_TIERS, GROWTH_MISSIONS,
  createReferralCode, getReferralCode, recordReferral, getReferral,
  convertReferral, rewardReferral, ambassadorTier, ambassadorScorecard, checkMissionProgress,
};
