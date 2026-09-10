# VACANCY — Key Location Discovery & Word-of-Mouth System

Connecting five already-built systems into one coherent Chaos Era
experience: hero-location loot quality, word-of-mouth-only information
spread, and realistic community reformation.

Hero locations as the real discovery-tier source: the Key building
types (skyscrapers, churches, schools, hospitals, caves) should be the
primary source of high-tier discoveries — books, weapons, technology,
artifacts.

Per-type discovery pools: Hospitals → medical books, medicine,
surgical equipment. Schools/Libraries → knowledge books across every
category. Churches/Religious sites → cultural/historical artifacts.
Skyscrapers/former corporate HQs → technology, blueprints, business
records. Caves → natural resources, lost pre-collapse technology
artifacts. Government buildings → laws, records, weapons/security
equipment.

LocationDiscoveryTier {
  locationId, locationType: string
  discoveryTier: "hero-key-location" | "scattered-common"
  itemPoolCategories: [string]
}

Word-of-mouth information spread: information should travel purely
person-to-person during the Chaos Era, using the Information Spread
Key already built. No radio, no internet, no phones — none of that
technology exists yet in this phase. As a community climbs the tech
tree during reemergence, the same Information Spread Key mechanic gets
faster and wider-reaching.

InformationSpreadByEra {
  currentEra: "chaos" | "resource-economy" | "community-economy" |
    "currency"
  spreadKeyRangeMultiplier: number
  spreadMethod: "word-of-mouth" | "written-message" | "radio" |
    "telecommunications"
}

Community reformation: this is the Rural Resource system already
established, requiring the real Survival and Agriculture skills
already in the trait system.

Keeping it realistic: the existing Habits system, Crime Pressure
formula, and NPC Needs all remain fully active during this phase —
reforming a community doesn't mean removing real struggle.

Status: connects five already-built systems into one coherent, real
early-game experience — nothing here requires new architecture.
