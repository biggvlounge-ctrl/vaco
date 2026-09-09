// VOKEN — CVLTVRE, the real, customer-facing brand name for this
// project's entire Cvltvre Card product (cards, packs, trading, VEX,
// VADO, fractional ownership, merch, art frames). VOKEN itself stays
// the technical/project name — the same relationship V3 already has
// to VCoin/VASH: one real backend, a different real name the product
// is actually sold under. Per direct instruction, grounded in
// Fanatics as the real, named comparable: a trading-card-and-
// memorabilia brand spanning collecting, trading, and auctions, not
// just one narrow mechanic.
//
// A real, small, queryable module rather than just a doc comment or a
// hardcoded UI string -- `getBrandInfo()` is the one real source of
// truth any consumer (VDP's VexView/VadoView, this project's own
// health endpoint) reads from, so the name can't drift between files.

const BRAND_NAME = 'CVLTVRE';
const BRAND_TAGLINE = 'Collect, trade, and auction anything with real cultural relevance — Fanatics-style, built on VOKEN.';
const POWERED_BY = 'VOKEN';

function getBrandInfo() {
  return { name: BRAND_NAME, tagline: BRAND_TAGLINE, poweredBy: POWERED_BY };
}

module.exports = {
  BRAND_NAME, BRAND_TAGLINE, POWERED_BY, getBrandInfo,
};
