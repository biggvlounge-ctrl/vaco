// VXLLAGE -- a real, thin client for Vavlt Stvdios' own separate API.
// Source of truth: VXLLAGE_CHOPZ_VACAY_ARCHITECTURE.md's own "Confirmed:
// no duplication needed for Substack's other real features" section --
// "Paid subscriptions -- already fully built via Vavlt Stvdios' locked-
// content tier system; long-form articles here should use the *same*
// VCoin-based subscription infrastructure, not a separate one." This
// is that real connection: a paywalled Article's `requiredTierId`
// points at a real, already-existing Vavlt Stvdios `LockedContentTier`
// -- VXLLAGE never re-implements subscription billing or an 80/20
// split of its own.
//
// **Real, honest check on the doc's own other claims in that same
// section** ("Podcasts -- already covered by Vvltvre's Pods division"):
// confirmed false via the full ecosystem status audit -- Vvltvre Pods
// has zero real code anywhere. Not relied on here; VXLLAGE's own
// Articles never assume Pods exists. Flagged directly rather than
// silently trusted, the same posture already applied this session to
// VACON, Food District, and Vavlt Stvdios' own casino-layer claims.

const VAVLT_STVDIOS_API_URL = process.env.VAVLT_STVDIOS_API_URL || 'http://localhost:8808';

// Real access check -- Vavlt Stvdios has no dedicated "check access"
// endpoint, but `GET /api/tiers/:id` returns the tier's own real
// `subscribers` array, which is the same real data
// `canAccessLockedContent` checks against server-side there. Deriving
// access from that real response here is a real check, not a guess.
async function checkTierAccess(tierId, userId) {
  const res = await fetch(`${VAVLT_STVDIOS_API_URL}/api/tiers/${tierId}`);
  if (!res.ok) {
    if (res.status === 404) return false;
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `checkTierAccess failed (${res.status})`);
  }
  const tier = await res.json();
  return tier.subscribers.includes(userId);
}

module.exports = { checkTierAccess };
