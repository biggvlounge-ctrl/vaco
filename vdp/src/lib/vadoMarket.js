// VDP — the VADO district, now a real client of VOKEN's own VADO
// auction gallery (see world.js's own header for why this replaced
// the earlier VENVS iframe embed). Unlike VEX's brokerage trading,
// VADO's real auction mechanics (`voken/lib/auctions.js`) carry no
// compliance gate at all -- confirmed directly, not assumed: only
// VOKEN's separate fractional-ownership feature is gated, and this
// district doesn't use it. Every real auction here is fully live and
// tradable today.
//
// Real, necessary addition on VOKEN's own side: every existing VADO
// route looked up one auction by id, with no way to browse what's
// actually open -- `GET /api/auctions/open` (`voken/lib/auctions.js`'s
// new `listOpenAuctions`) was added as the minimal real piece this
// district genuinely needed, not routed around with the wrong data
// (VOKEN's separate `/api/vado/explore` ranks art cards by engagement
// generally -- a different real feature, not live auction state).

import { getBrandInfo, getOpenAuctions, getCurrentDutchPrice, placeBid } from "./vokenClient.js";

export async function getVadoMarketState() {
  const [brand, auctions] = await Promise.all([getBrandInfo(), getOpenAuctions()]);
  return { brand, auctions };
}

export async function getDutchPrice(auctionId) {
  return getCurrentDutchPrice(auctionId);
}

export async function bidOnAuction({ auctionId, bidderId, bidAmount }) {
  return placeBid({ auctionId, bidderId, bidAmount });
}
