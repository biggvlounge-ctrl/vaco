# VACANCY — Comprehensive Retail Key Locations

The full, real retail Key location list — hardware stores, clothing
stores, and every other real retail category — each with its own
discovery pool, plus direct confirmation of the Control Key →
merchandise flow for whichever group takes it.

Confirmed: once a location's Control Key challenge is met, the
capturing group — Organization, Gang, Tribe, Family, or Relief
Organization — gains real, tangible access to that location's
merchandise pool.

KeyLocationCapture {
  locationId, capturingEntityId, capturingEntityType: "organization" |
    "tribe" | "family"
  merchandiseAccessGranted: true
}

The full Retail Key Location list: Hardware Store (tools, construction
materials), Clothing Store (clothing, fabric, protective gear),
Grocery Store/Supermarket (food), Pharmacy (medicine, medical
supplies), Sporting Goods Store (hunting/fishing equipment), Electronics
Store (technology components), Auto Parts Store (vehicle repair
components), Bookstore (additional book source).

RetailKeyLocationType {
  locationType: "hardware-store" | "clothing-store" | "grocery-store" |
    "pharmacy" | "sporting-goods-store" | "electronics-store" |
    "auto-parts-store" | "bookstore" | "gun-store" | "department-store"
  discoveryPool: string
  chaosEraState: "emptied"
}

Status: the Retail Key Location list is now genuinely comprehensive —
ten real store types, each tied directly to an existing skill or
resource system rather than generic loot.
