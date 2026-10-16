// VOID DROP — the category registry.
// Source: the founder's own VOID DROP spec (not a researched-comparables
// doc the way `verticalServiceConfigs.js`'s SERVICE_CONFIGS are — no
// comparable company is cited here because none was verified for this
// product yet, and inventing one would be exactly the kind of fabricated
// citation this ecosystem's own convention refuses to make).
//
// **Config, not code, same reason SERVICE_CONFIGS exists**: 14 named
// products (DROP SHOP, DROP FOOD, …) differ in label, typical intended
// uses, and default amenities/rental-model support — not in mechanics.
// One real engine (`voidDropAssets.js` + `voidDropBooking.js`) serves
// all of them; adding a 15th product is a new entry here, never a new
// module. This is the founder's own standing instruction ("Additional
// categories can be added without restructuring the core system"),
// applied directly.
//
// `supportedRentalModels` narrows `RENTAL_MODELS` (see voidDropBooking.js)
// per category — e.g. DROP STORAGE supports rent-to-own and purchase,
// DROP EVENT realistically does not. Left permissive (all models) where
// the founder's spec gave no reason to narrow one.

const RENTAL_MODELS = [
  'hourly', 'daily', 'weekend', 'weekly', 'monthly', 'long-term-lease',
  'rent-to-own', 'purchase', 'business-deployment', 'event-deployment', 'revenue-share',
];

const DROP_CATEGORIES = {
  // Real name, per the founder's own follow-up: "Drop Pop Shop," not
  // "Drop Shop" -- the mobile retail/pop-up-shop product gets its real
  // branded name here. The category id stays `dropShop` (it is a
  // stable key other code and data reference, not customer-facing
  // copy), only the label/description changed.
  dropShop: {
    label: 'DROP POP SHOP', description: 'Mobile retail / pop-up shop.',
    uses: ['boutique', 'retail store', 'temporary storefront', 'vendor space', 'market booth', 'seasonal business', 'product launch', 'brand activation'],
    supportedRentalModels: RENTAL_MODELS,
  },
  dropFood: {
    label: 'DROP FOOD', description: 'Mobile food and commercial kitchen space.',
    uses: ['food business', 'catering', 'temporary restaurant', 'festival vendor', 'food event', 'overflow kitchen', 'seasonal operation'],
    supportedRentalModels: RENTAL_MODELS,
  },
  dropSpa: {
    label: 'DROP SPA', description: 'Mobile wellness / spa environment.',
    uses: ['massage', 'beauty services', 'wellness', 'private spa', 'temporary salon', 'event wellness services'],
    supportedRentalModels: RENTAL_MODELS,
  },
  dropHot: {
    label: 'DROP HOT', description: 'Mobile hot-tub deployment.',
    uses: ['weekend rental', 'vacation rental', 'backyard use', 'parties', 'events', 'temporary installations'],
    supportedRentalModels: ['hourly', 'daily', 'weekend', 'weekly', 'event-deployment'],
  },
  dropPool: {
    label: 'DROP POOL', description: 'Mobile / portable pool deployment.',
    uses: ['weekend rental', 'vacation rental', 'backyard use', 'parties', 'events'],
    supportedRentalModels: ['daily', 'weekend', 'weekly', 'monthly', 'event-deployment'],
  },
  dropSauna: {
    label: 'DROP SAUNA', description: 'Mobile sauna.',
    uses: ['weekend rental', 'wellness', 'backyard use', 'events'],
    supportedRentalModels: ['daily', 'weekend', 'weekly', 'monthly', 'rent-to-own', 'purchase'],
  },
  dropIce: {
    label: 'DROP ICE', description: 'Cold-plunge / recovery space.',
    uses: ['recovery', 'wellness', 'weekend rental', 'events'],
    supportedRentalModels: ['daily', 'weekend', 'weekly', 'monthly', 'rent-to-own', 'purchase'],
  },
  dropOffice: {
    label: 'DROP OFFICE', description: 'Mobile office.',
    uses: ['remote work', 'temporary office', 'construction office', 'business expansion', 'property management', 'job-site operations'],
    supportedRentalModels: RENTAL_MODELS,
  },
  dropStudio: {
    label: 'DROP STUDIO', description: 'Mobile creative studio.',
    uses: ['podcast', 'photography', 'video', 'music', 'content creation', 'recording'],
    supportedRentalModels: ['hourly', 'daily', 'weekend', 'weekly', 'monthly', 'business-deployment', 'event-deployment'],
  },
  dropEvent: {
    label: 'DROP EVENT', description: 'Mobile event space.',
    uses: ['VIP room', 'dressing room', 'lounge', 'hospitality', 'private events', 'corporate events'],
    supportedRentalModels: ['hourly', 'daily', 'weekend', 'event-deployment', 'revenue-share'],
  },
  dropGame: {
    label: 'DROP GAME', description: 'Mobile gaming / esports space.',
    uses: ['gaming', 'esports', 'parties', 'events', 'brand activation'],
    supportedRentalModels: ['hourly', 'daily', 'weekend', 'event-deployment', 'business-deployment'],
  },
  // Branded "Drop Hotel" when surfaced on VACAY (see
  // vacay/lib/bookings/dropStays.js) -- the real use case named
  // directly: a visitor in town who does not want to stay at a hotel
  // but wants to stay close, so the room comes to the host's own
  // driveway/yard instead.
  dropRoom: {
    label: 'DROP ROOM', description: 'Mobile guest accommodation.',
    uses: ['guest room', 'temporary lodging', 'resort expansion', 'event lodging', 'workforce lodging', 'property overflow', 'visiting guest near a host\'s home'],
    supportedRentalModels: RENTAL_MODELS,
  },
  dropHome: {
    label: 'DROP HOME', description: 'Mobile / modular residential unit, where permitted by local law.',
    uses: ['guest house', 'ADU', 'workforce housing', 'affordable housing', 'temporary housing', 'long-term housing'],
    supportedRentalModels: RENTAL_MODELS,
    // Flagged, not enforced here: residential deployment is the
    // category most likely to run into zoning/permit limits (spec §5,
    // §6). `assessEligibility` already defaults every category to
    // `pending-review`; this flag exists so a reviewer knows to check
    // residential-specific zoning without the engine pretending to
    // know local law it has no real way to verify.
    zoningSensitive: true,
  },
  dropStorage: {
    label: 'DROP STORAGE', description: 'Secure mobile storage.',
    uses: ['residential storage', 'business storage', 'construction storage', 'event storage', 'inventory storage'],
    supportedRentalModels: RENTAL_MODELS,
  },
  // 15th product, added directly as a config entry per the founder's
  // own follow-up -- no module changed, exactly the design this file's
  // own header describes.
  dropBath: {
    label: 'DROP BATH', description: 'Mobile luxury bathroom.',
    uses: ['event restroom', 'wedding/venue overflow', 'job-site high-end restroom', 'festival VIP restroom', 'property overflow'],
    supportedRentalModels: ['hourly', 'daily', 'weekend', 'weekly', 'event-deployment', 'business-deployment'],
  },
};

function getDropCategory(categoryId) {
  return DROP_CATEGORIES[categoryId] || null;
}

function listDropCategories() {
  return Object.entries(DROP_CATEGORIES).map(([id, c]) => ({ id, ...c }));
}

module.exports = { RENTAL_MODELS, DROP_CATEGORIES, getDropCategory, listDropCategories };
