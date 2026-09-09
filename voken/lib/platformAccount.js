// VOKEN — the shared platform account id used by any VOKEN feature
// that charges or pays out VCoin on the platform's own behalf
// (pack-opening charges, referral/spin bonus payouts). Split out into
// its own module when VEX was extracted into its own standalone app
// (see dev-docs/phase-16-vex-extracted-to-standalone-app) — this
// constant was never VEX-specific, `lib/vex.js` just happened to be
// where it was first defined.

const VOKEN_PLATFORM_ACCOUNT = 'voken-platform';

module.exports = { VOKEN_PLATFORM_ACCOUNT };
