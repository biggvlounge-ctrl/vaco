// VDP — demo/seed data for the live walkthrough.
// Real orders against Food District's own real flagship brands
// (`orderMenuItem`, `lib/foodDistrict.js`) and real DEGVCHI avatar
// outfits (`purchaseWearable`/`equipWearable`, `lib/degvchi.js`) — both
// go through the exact same real functions the live UI already calls
// (`FoodDistrictView.jsx`/`DegvchiView.jsx`), not hand-built order/
// ownership records that skip `orderMenuItem`'s own validation
// (menu-item lookup, buyer id, transferFn) or `purchaseWearable`'s own
// (wearable lookup, double-purchase guard).
//
// No dedicated "avatar" entity or registration function exists
// anywhere in this codebase — confirmed directly: grepping "avatar"
// across `src/lib/` turns up only `world.js`'s player-position
// comments and `degvchi.js`'s own "avatar-wearable economy" framing,
// no separate avatar record. VMall (screen-based commerce) doesn't
// exist here either, for the same reason: neither was ever built, so
// neither gets invented here. A real "sample avatar" in this codebase
// IS a userId that actually owns and has equipped real wearables via
// DEGVCHI's own real purchase+equip functions — that's the real
// mechanic this task's "seed sample avatars" maps onto.
//
// `demo-user` (the app's own default login id — see `shieldAuth.js`'s
// `login("demo-user")` call in `App.jsx`) is deliberately one of the
// four seeded identities below, so a presenter who just clicks "Log
// in" during the live walkthrough sees their own order history and
// equipped outfit already populated, not an empty state to explain
// away before the real demo starts.
//
// Payment goes through the exact same real `transferVCoin` V3 client
// call the live UI uses (`v3Client.js`) — venvs-mock-backend auto-
// starts every fresh userId at 1000 VCoin, so these seed purchases
// succeed the same way a real first-time buyer's would. Each item is
// wrapped in its own try/catch so a V3 backend that isn't reachable
// yet at app boot degrades to a console warning per skipped item,
// never a crashed app shell.

import { orderMenuItem } from "./foodDistrict.js";
import { purchaseWearable, equipWearable } from "./degvchi.js";
import { transferVCoin } from "./v3Client.js";

const seedTransferFn = (from, to, amount, reason) =>
  transferVCoin({ fromUserId: from, toUserId: to, amount, reason });

const DEMO_ORDERS = [
  { buyerId: "demo-user", brandSlug: "vive", itemName: "Premium Coffee" },
  { buyerId: "demo-user", brandSlug: "taco-town", itemName: "Taco" },
  { buyerId: "demo-user", brandSlug: "wedge", itemName: "Nacho-Topped Wedges" },
  { buyerId: "demo-maya", brandSlug: "vordabellos", itemName: "Chef-Made Pizza" },
  { buyerId: "demo-maya", brandSlug: "vixens", itemName: "Vegan Comfort Plate" },
  { buyerId: "demo-carlos", brandSlug: "big-jacks", itemName: "Burger" },
  { buyerId: "demo-carlos", brandSlug: "nettys", itemName: "Soul Food Plate" },
  { buyerId: "demo-priya", brandSlug: "vfresh", itemName: "Fresh Fruit" },
  { buyerId: "demo-priya", brandSlug: "vazan", itemName: "Vitamins" },
];

// One real outfit per demo identity — item names must match real
// wearables already registered by `SEED_DEGVCHI`/
// `seedSvmikoDegvchiWearables` (App.jsx seeds those before this runs).
const DEMO_AVATARS = [
  { userId: "demo-user", outfit: ["DEGVCHI Signature Jacket", "Sunset Glow Palette", "Chrome Chain"] },
  { userId: "demo-maya", outfit: ["DEGVCHI Virtual Kimono-Sleeve Coat", "△AISON Virtual Hourglass Pendant"] },
  { userId: "demo-carlos", outfit: ["VvLGAR Virtual Distressed Denim Jacket", "DND Virtual Chain Wallet"] },
  { userId: "demo-priya", outfit: ["BOOBI Couture Virtual Corset Gown", "ANCÓR Virtual Anchor Pin"] },
];

async function seedFoodDistrictOrders(foodDistrictStore) {
  if (!foodDistrictStore || foodDistrictStore.orders.length > 0) return;
  for (const order of DEMO_ORDERS) {
    try {
      await orderMenuItem(foodDistrictStore, { ...order, transferFn: seedTransferFn });
    } catch (err) {
      console.warn(`seedDemoData: skipped food order ${order.brandSlug}/${order.itemName} for ${order.buyerId} — ${err.message}`);
    }
  }
}

async function seedAvatars(degvchiStore) {
  if (!degvchiStore || degvchiStore.ownership.length > 0) return;
  for (const avatar of DEMO_AVATARS) {
    for (const itemName of avatar.outfit) {
      const wearable = degvchiStore.wearables.find((w) => w.name === itemName);
      if (!wearable) {
        console.warn(`seedDemoData: no registered wearable named "${itemName}", skipping for ${avatar.userId}`);
        continue;
      }
      try {
        await purchaseWearable(degvchiStore, { wearableId: wearable.id, buyerId: avatar.userId, transferFn: seedTransferFn });
        equipWearable(degvchiStore, avatar.userId, wearable.id);
      } catch (err) {
        console.warn(`seedDemoData: skipped avatar wearable "${itemName}" for ${avatar.userId} — ${err.message}`);
      }
    }
  }
}

// Called once at app boot (`App.jsx`), guarded per-store by a real
// empty-array check — each store is freshly created on every mount
// (VDP has no server-side persistence layer for these two stores, see
// `persistence.js`'s own header), so the guard is trivially true today,
// but stays correct if either store is ever persisted across mounts.
export async function seedDemoData({ foodDistrictStore, degvchiStore } = {}) {
  await seedFoodDistrictOrders(foodDistrictStore);
  await seedAvatars(degvchiStore);
}
