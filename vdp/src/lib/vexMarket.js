// VDP — the VEX district, now a real client of the standalone VEX
// app (extracted from VOKEN — see `../../../vex/README.md` and
// world.js's own header for why VOKEN's card infra was ever iframed
// here in the first place). VEX trades real Cvltvre Card editions,
// not abstract stock-like assets the way VENVS's earlier, unrelated
// `vex.js` did -- a genuinely different, more specific product, not a
// reskin. Card browsing/brand info still come from VOKEN directly
// (Cvltvre Cards are VOKEN's own product); broker accounts, orders,
// and the `vex-brokerage` compliance gate now come from VEX's own API.
//
// Real, honest gating: opening a broker account moves no money, so
// it's never blocked. Placing an actual trade order is gated behind
// VEX's own real `vex-brokerage` compliance flag, pending broker-
// dealer legal review -- `getVexMarketState` surfaces that real,
// current gate status so the UI can show it honestly rather than
// letting a trade attempt fail as a surprise.

import { getBrandInfo, listCardsByCategory } from "./vokenClient.js";
import { getVexComplianceGateStatus, openBrokerAccount, placeVexOrder } from "./vexClient.js";

export const VEX_CARD_CATEGORY = "vehicles"; // VEX's own real "Robinhood-style trading floor" framing fits vehicles most directly among VOKEN's real categories

export async function getVexMarketState() {
  const [brand, tradingCleared, cards] = await Promise.all([
    getBrandInfo(),
    getVexComplianceGateStatus(),
    listCardsByCategory(VEX_CARD_CATEGORY),
  ]);
  return { brand, tradingCleared, cards };
}

export async function ensureBrokerAccount(userId) {
  return openBrokerAccount(userId);
}

export async function buyCardEdition({ accountId, cardId, quantity, pricePerUnit }) {
  return placeVexOrder({
    accountId, cardId, orderType: "buy", quantity, pricePerUnit,
  });
}
