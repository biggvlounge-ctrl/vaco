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
// **Seeds one identity: whoever is signed in.** This used to run at
// mount for all four identities below, and it seeded nothing at all —
// verified against a real V3, not reasoned about. Two separate reasons,
// both of which had to be fixed:
//
//   no session   The boot effect fired before any session existed, so
//                every transfer went out with no `Authorization` header
//                and V3 answered 401. Eighteen requests, eighteen
//                refusals, nothing seeded. The header used to promise
//                that a presenter who clicks "Log in" finds their order
//                history already populated; that was a claim about code
//                that could not run.
//   wrong payer  `/api/vcoin/transfer` is `actorOrService('fromUserId')`
//                — the session must belong to the payer. A browser has
//                no service credential and must not have one, so VDP can
//                only ever move the signed-in user's own money. Seeding
//                `demo-maya` from `demo-user`'s session is not a timing
//                bug to fix; it is the authorization boundary working.
//
// So the seed now takes the session's `userId` and runs only that
// person's entries. The other three stay in the tables because a Shell
// handoff can sign any of them in (`adoptToken` in `App.jsx`).
//
// Payment goes through the exact same real `transferVCoin` V3 client
// call the live UI uses (`v3Client.js`). Each item is wrapped in its own
// try/catch so a V3 that isn't reachable degrades to a console warning
// per skipped item, never a crashed app shell.

import { orderMenuItem } from "./foodDistrict.js";
import { purchaseWearable, equipWearable } from "./degvchi.js";
import { transferVCoin } from "./v3Client.js";

// The default when nobody injects one — the same real V3 client the
// live UI uses. Injectable per the ecosystem's standing rule that
// cross-app calls are parameters, not imports reached for at the call
// site: without that, this module could only be tested by stubbing
// `global.fetch`, which tests `fetch` rather than the seed.
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

async function seedFoodDistrictOrders(foodDistrictStore, userId, transferFn) {
  if (!foodDistrictStore || foodDistrictStore.orders.length > 0) return;
  for (const order of DEMO_ORDERS.filter((o) => o.buyerId === userId)) {
    try {
      await orderMenuItem(foodDistrictStore, { ...order, transferFn });
    } catch (err) {
      console.warn(`seedDemoData: skipped food order ${order.brandSlug}/${order.itemName} for ${order.buyerId} — ${err.message}`);
    }
  }
}

async function seedAvatars(degvchiStore, userId, transferFn) {
  if (!degvchiStore || degvchiStore.ownership.length > 0) return;
  for (const avatar of DEMO_AVATARS.filter((a) => a.userId === userId)) {
    for (const itemName of avatar.outfit) {
      const wearable = degvchiStore.wearables.find((w) => w.name === itemName);
      if (!wearable) {
        console.warn(`seedDemoData: no registered wearable named "${itemName}", skipping for ${avatar.userId}`);
        continue;
      }
      try {
        await purchaseWearable(degvchiStore, { wearableId: wearable.id, buyerId: avatar.userId, transferFn });
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
// **No `userId`, no seed.** Refusing here rather than falling back to a
// default is the whole point: a seed with nobody signed in is the
// eighteen-refusal boot this replaced, and a silent no-op would let it
// come back unnoticed.
export async function seedDemoData({
  foodDistrictStore, degvchiStore, userId, transferFn = seedTransferFn,
} = {}) {
  if (!userId) throw new Error("seedDemoData requires the signed-in userId — V3 authorises each transfer against the payer's own session");
  await seedFoodDistrictOrders(foodDistrictStore, userId, transferFn);
  await seedAvatars(degvchiStore, userId, transferFn);
}
