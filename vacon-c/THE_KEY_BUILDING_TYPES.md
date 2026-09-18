# VACANCY — The Key: Building Types

The complete, definitive list of building/location categories that
always count as hero-tier, real, custom work — confirmed as the
standard reference used everywhere in the world, not just St. Louis.
Built once here, duplicated as the same category standard globally.

The complete Key: Skyscrapers, Universities, Government buildings,
Prisons, Art museums, Churches, Mosques, Synagogues, Temples, Masonic
buildings, Historic sites, Airports and train stations, Hospitals,
Stadiums and arenas, Libraries, Theaters and concert halls, Notable
bridges, Monuments and memorials, Zoos and aquariums, Cave systems and
natural formations, and any other genuinely distinctive feature not
covered above.

KeyBuildingType {
  category: "skyscraper" | "university" | "government-building" |
    "prison" | "art-museum" | "church" | "mosque" | "synagogue" |
    "temple" | "masonic-building" | "historic-site" | "airport" |
    "train-station" | "hospital" | "stadium-arena" | "library" |
    "theater-concert-hall" | "notable-bridge" | "monument-memorial" |
    "zoo-aquarium" | "cave-system" | "natural-formation" |
    "other-distinctive-feature"
  alwaysHeroTier: true
}

Confirmed: this is the same standard Key used globally, not
St. Louis-specific — built and proven in St. Louis, now the
definitive, standard reference for identifying hero-tier locations in
every subsequent city and region worldwide.

Status: The Key is now confirmed and complete — the definitive,
standard list of hero-tier building categories, proven in St. Louis
and applied consistently across every future region worldwide.

---

## Implementation note — added 18 Sep 2026, and it is a correction

This list is built as `server/landmarks.js`'s `KEY_BUILDING_TYPES`,
with each category carrying a significance band, the occupation that
runs it, the §26 merchandise or discovery pool it holds, and a
form (tower / building / site) so a cave system does not get
twenty-three floors.

**The engine carries twenty-four, not twenty-three, and the extra one
comes from this document disagreeing with another of its own.**
`KEY_LOCATION_DISCOVERY_WORD_OF_MOUTH_SYSTEM.md` names schools as a Key
building type twice — "the Key building types (skyscrapers, churches,
**schools**, hospitals, caves)" and "**Schools**/Libraries → knowledge
books across every category" — and the list above has universities and
no schools.

Both documents are here and both are authoritative, so the engine takes
the union rather than picking a winner. Three things support it: this
list's own final entry is "any other genuinely distinctive feature not
covered above", so it is explicitly open; `occupations.DEFINING_POST`
has mapped `school` to `teacher` since the occupation taxonomy was
built, so the post was already waiting; and
`PRISON_POPULATION_CENTERS_BREAKS_SCHOOLS.md` — named by the master
index, recorded as written, and not in this repository — is the
document that would have said so.

The named landmarks per region are NOT in this repository and are not
coming (`VACANCY_DOCUMENT_MANIFEST.md`: 90 named, 22 present, 68
absent, confirmed 12 Sep 2026). What duplicates across the country and
the world is this CATEGORY standard, exactly as the paragraphs above
say it should — real names arrive per region as a landmark pack
(`server/landmarkPacks.js`), either from the automated UNESCO / NRHP /
Cesium import `AUTOMATED_HISTORIC_LANDMARK_IMPORT_SYSTEM.md` specifies,
or pasted in. `data/st-louis.landmarks.json` is the worked example and
declares itself a sample rather than a register import, because the
three real sources are blocked at this environment's proxy.
