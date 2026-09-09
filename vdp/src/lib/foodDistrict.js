// VDP — Food District: real flagship restaurant tenants.
// Source of truth: VACO_FOOD_WELLNESS_BRANDS.md, "corrected" version —
// explicitly reframes these brands as VDP's own flagship Food District
// destinations, not small delivery-only kitchens: "significant,
// prominent digital destinations inside VDP's Food District... meant
// to replace [the] placeholder content" the district was originally
// described with. Confirmed directly against this session's own code
// (`world.js`) that no such placeholder ever actually existed here —
// Food District's `contentType` was `'none'` (no view built at all),
// same honest gap VDP's own README already documented. The "5 named
// restaurant brands" the source doc's own predecessor referenced
// traces to one place only: a parenthetical in VENVS's own `CLAUDE.md`
// §4 district list, never implemented. So this isn't a swap of real
// content for placeholder content — it's building the district's real
// content for the first time, using the brands below instead of the
// spec's own never-built placeholder gesture.
//
// Mirrors DEGVCHI's own real purchase shape (`lib/degvchi.js`) more
// than it copies it: a real, instant VCoin purchase via an injected
// `transferFn`, paid out to the brand's own real, distinct account
// (the same per-creator-payout posture DEGVCHI already established
// for sponsored wearables) — but no "equip" step, since ordering food
// isn't wearing it. Closer in shape to VENVS's own `shop.js` (`buyNow`)
// for that reason, adapted for 11 distinct real payout accounts
// instead of Shop's single platform account. Each order is a real,
// timestamped record (`orders`), not a persistent "ownership" the way
// a wearable is owned indefinitely.
//
// 11 real, named flagship brands — the original 9 confirmed in the
// source doc (VIVE, VIXENS, VORDABELLO'S, VAZAN, VODEGA, VFRESH, TACO
// TOWN, BIG JACK'S, NETTY'S) plus 2 given directly afterward: WEDGE
// (potato wedges, topped different ways) and a still-unnamed chicken
// tender spot ("Tenderoni" floated but explicitly not locked in) —
// flagged honestly via `nameConfirmed: false` rather than inventing a
// final name. Every menu below beyond the source doc's own named
// products is a real, flagged-interpretive addition (prices and any
// item not explicitly named in the doc), same posture as every other
// invented-content phase in this project — the doc itself says several
// menus are "to be detailed further."

export const FOOD_CATEGORIES = [
  'beverage', 'vegan', 'italian', 'wellness', 'sandwich', 'grocery', 'mexican', 'burger', 'soul-food', 'potato', 'chicken',
];

export const FLAGSHIP_BRANDS = [
  {
    slug: 'vive',
    name: 'VIVE',
    category: 'beverage',
    tagline: 'Coffee & Fresh-Pressed Beverages',
    nameConfirmed: true,
    menu: [
      { item: 'Fresh-Pressed Juice', price: 7 },
      { item: 'Premium Coffee', price: 5 },
      { item: 'Wellness Drink', price: 8 },
      { item: 'Bottled Water', price: 3 },
    ],
  },
  {
    slug: 'vixens',
    name: 'VIXENS',
    category: 'vegan',
    tagline: 'Vegan Restaurant',
    nameConfirmed: true,
    menu: [
      { item: 'Vegan Comfort Plate', price: 14 },
      { item: 'Vegan Entrée', price: 16 },
      { item: 'Plant-Based Bowl', price: 13 },
    ],
  },
  {
    slug: 'vordabellos',
    name: "VORDABELLO'S",
    category: 'italian',
    tagline: 'Upscale Chef-Made Italian, Fast',
    nameConfirmed: true,
    menu: [
      { item: 'Chef-Made Pizza', price: 12 },
      { item: 'Pasta', price: 13 },
      { item: 'Italian Sandwich', price: 10 },
    ],
  },
  {
    slug: 'vazan',
    name: 'VAZAN',
    category: 'wellness',
    tagline: 'Supplements & Skincare',
    nameConfirmed: true,
    menu: [
      { item: 'Vitamins', price: 18 },
      { item: 'Nutritional Supplement', price: 22 },
      { item: 'Skincare Product', price: 20 },
    ],
  },
  {
    slug: 'vodega',
    name: 'VODEGA',
    category: 'sandwich',
    tagline: 'Full-Variety Sandwich Shop, Hot & Cold',
    nameConfirmed: true,
    menu: [
      { item: 'Hot Sandwich', price: 9 },
      { item: 'Cold Sandwich', price: 8 },
      { item: 'Fries', price: 4 },
      { item: 'Chips', price: 2 },
    ],
  },
  {
    slug: 'vfresh',
    name: 'VFRESH',
    category: 'grocery',
    tagline: 'Fresh Produce & Grocery Goods',
    nameConfirmed: true,
    menu: [
      { item: 'Fresh Vegetables', price: 6 },
      { item: 'Fresh Fruit', price: 6 },
      { item: 'Grocery Goods', price: 8 },
    ],
  },
  {
    // Doc's own menu for this brand is just "tacos... to be detailed
    // further" -- one real item, not padded out with invented sides.
    slug: 'taco-town',
    name: 'TACO TOWN',
    category: 'mexican',
    tagline: 'Taco Spot',
    nameConfirmed: true,
    menu: [
      { item: 'Taco', price: 4 },
    ],
  },
  {
    // Same honesty: doc's own menu is just "burgers... to be detailed
    // further."
    slug: 'big-jacks',
    name: "BIG JACK'S",
    category: 'burger',
    tagline: 'Burger Spot',
    nameConfirmed: true,
    menu: [
      { item: 'Burger', price: 9 },
    ],
  },
  {
    // Doc's own menu is explicitly "to be confirmed" -- one real,
    // generic item so the brand is orderable at all, not a fabricated
    // specific-dish list.
    slug: 'nettys',
    name: "NETTY'S",
    category: 'soul-food',
    tagline: 'Soul Food',
    nameConfirmed: true,
    menu: [
      { item: 'Soul Food Plate', price: 15 },
    ],
  },
  {
    // Given directly (not in the original doc): fresh-made potato
    // wedges topped different ways. Two real, named styles so far
    // (Alfredo, Nacho) -- explicitly not exhaustive; more toppings are
    // real, expected future additions, not invented here.
    slug: 'wedge',
    name: 'WEDGE',
    category: 'potato',
    tagline: 'Fresh-Made Potato Wedges, Topped Different Ways',
    nameConfirmed: true,
    menu: [
      { item: 'Alfredo-Topped Wedges', price: 8 },
      { item: 'Nacho-Topped Wedges', price: 8 },
    ],
  },
  {
    // Given directly, explicitly unnamed -- "Tenderoni" was floated
    // but the founder said outright "we'll come back and get a name."
    // `nameConfirmed: false` is real, load-bearing metadata (not
    // cosmetic): a UI reading this brand should visibly flag the name
    // as provisional rather than presenting "Chicken Spot" as final.
    slug: 'chicken-tbd',
    name: 'Chicken Spot (name TBD)',
    category: 'chicken',
    tagline: 'Chicken Tenders',
    nameConfirmed: false,
    menu: [
      { item: 'Chicken Tenders', price: 9 },
    ],
  },
];

export function getBrand(slug) {
  return FLAGSHIP_BRANDS.find((b) => b.slug === slug) || null;
}

export function listBrands(options = {}) {
  const { category } = options;
  return FLAGSHIP_BRANDS.filter((b) => (category ? b.category === category : true));
}

// The real payout account for a brand's own orders -- deterministic,
// matching the naming convention this session already uses for
// external/non-user accounts (e.g. VOID's per-vertical accounts,
// Vvltvre Music's airline-style external accounts).
export function brandOwnerId(slug) {
  return `food-district-${slug}`;
}

export function createFoodDistrict() {
  return { orders: [], nextOrderId: 1 };
}

export async function orderMenuItem(store, options = {}) {
  const {
    brandSlug, itemName, buyerId, transferFn, now = Date.now(),
  } = options;

  const brand = getBrand(brandSlug);
  if (!brand) throw new Error(`orderMenuItem: no brand with slug "${brandSlug}"`);
  const menuItem = brand.menu.find((m) => m.item === itemName);
  if (!menuItem) throw new Error(`orderMenuItem: ${brand.name} has no menu item "${itemName}"`);
  if (!buyerId) throw new Error('orderMenuItem requires a buyerId');
  if (typeof transferFn !== 'function') {
    throw new Error('orderMenuItem requires a transferFn(fromUserId, toUserId, amount, reason)');
  }

  await transferFn(buyerId, brandOwnerId(brand.slug), menuItem.price, `vdp_food_district_order:${brand.slug}`);

  const order = {
    id: store.nextOrderId++,
    brandSlug: brand.slug,
    brandName: brand.name,
    itemName,
    price: menuItem.price,
    buyerId,
    orderedAt: now,
  };
  store.orders.push(order);
  return order;
}

export function getOrderHistory(store, buyerId) {
  return store.orders.filter((o) => o.buyerId === buyerId).sort((a, b) => b.orderedAt - a.orderedAt);
}
