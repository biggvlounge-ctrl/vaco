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

## Implementation note — added 26 Sep 2026, and it is a new category, not a correction

A twenty-fifth: `park`. Unlike `school` above, this one does not come
from a disagreement between two documents already in the repository —
it was added directly at the owner's request ("penitentiaries,
hospitals... caves... parks... St. Louis was the template"). It fits
the same open door the Key's own last entry leaves ("any other
genuinely distinctive feature not covered above"), and St. Louis is
again the worked example: Forest Park is larger than New York's Central
Park, and the sample pack already names an AREA after it without ever
naming the park itself as a landmark. That gap is now closed in
`data/st-louis.landmarks.json`.

Coded in `server/landmarks.js` as a `site`-form, unstaffed category
alongside `cave-system` and `natural-formation` — a park is kept, not
operated, the same as those two. `world-layer/exportRegion.js` carries
the identical addition, and `landmark-packs.test.js` is the assertion
that keeps the two from drifting apart.

Real named parks and caves beyond city limits — the Ozarks, the
Illinois side of the confluence — are the same "not yet" as the 68
absent named landmarks above: the category exists and is ready to hold
them, and `world-layer/imports/gnisImport.js` already maps GNIS's
`park` and `cave` feature classes onto them, once the network reaches
GNIS rather than being blocked at this environment's proxy the way
UNESCO/NRHP/Cesium are.

## Implementation note — added 26 Sep 2026, a thirty-second, same day as `server/gambling.js`

`casino`. Same standing as `corporate-headquarters`/`shopping-mall`:
new design, no source document, named directly by the owner alongside
the request that produced `server/gambling.js`. `discovery: null` in
`server/landmarks.js` because a casino is not a merchandise site —
what it holds is a game to play, not stock to search, and
`server/discovery.js` says so the same way it already does for `prison`
and `stadium-arena`.

Rivers and lakes are a narrower gap than "blocked": `gnisImport.js`
deliberately excludes `stream` as a `BULK_CLASS` — its own comment says
why, "we chose not to import 40,000 creeks" rather than a technical
limit — and carries no `lake` mapping at all yet. A named river or lake
(the Mississippi, the Meramec, Lake of the Ozarks) is reachable the
same way a named park now is, but it is an importer change, not
something the network being open would fix by itself.

## Implementation note — added 26 Sep 2026, same day, six more, same non-correction

`warehouse`, `public-housing`, `river`, `lake`, `corporate-headquarters`,
`shopping-mall` — twenty-sixth through thirty-first. None come from
either source document; all six were named directly by the owner in
the same request as `park` above ("every river, park... warehouses,
major corporations... skyscrapers... apartment buildings... public
housing"), and are held to the same standard: said here plainly rather
than dressed up as a document finding.

Two of the six are not really new categories so much as a gap this
FILE had. `propertyTypeFor` has mapped every other category onto nine
of the schema's ten `properties.type` values since this file was
written — `industrial` and `residential` were the two nothing here had
ever used, which is the eleventh standing rule's shape one level down:
a schema type nothing writes to is indistinguishable from a schema type
that does not exist, inside the one file whose whole job is closing
exactly that kind of gap for landmarks. `warehouse` is `industrial`;
`public-housing` is `residential`.

`river` and `lake` sit beside `park` in the "gnisImport.js already has
half the story" note above, and were given the one thing neither
`cave-system` nor `natural-formation` ever needed: the `water` §26
trade category, real in `items.TRADE_CATEGORIES` since before this file
existed and never given an item. Adding the pool
(`discovery.js`) surfaced that gap immediately — `test/discovery.test.js`'s
own "the guard reports item categories no item in the world belongs to"
failed the moment `river`/`lake` existed, which is the guard doing
exactly what it was built for. Closed the same way the original four
(`clothing`/`food`/`repair`/`transport`) were: one named item in
`merchandise.js` (`clean water`), not a document quote, because no
retail location in either source document sells this — a river does.

`corporate-headquarters` and `shopping-mall` have no source document and
no real importer naming them yet — `world-layer/imports/overtureImport.js`
reaches `department-store`, already in the retail list, but nothing
named "corporation" or "mall" anywhere in `world-layer/`. Added on the
same standing as everything else in this note: the owner said so
directly, and that is a real reason, distinct from "a document already
said so."

Deliberately NOT done in this pass, and worth recording rather than
silently dropping: the owner also asked for "high schools, middle
schools." `world-layer/imports/ncesImport.js` was checked first, and it
does NOT support fragmenting `school` by level — it already treats
every K-12 building as one landmark category (`category: 'school'`,
`ncesImport.js` line 59) and separately maps grade spans onto
`demographics.EDUCATION_LEVELS`' `primary`/`secondary` rungs, a
population-attainment concept unconnected to landmark categories.
Inventing `elementary-school`/`middle-school`/`high-school` as three
new Key categories would have contradicted the one real source that
already covers this, which is the exact mistake `server/landmarks.js`
itself was built to stop repeating (see the "two disagreeing answers"
note near the top of this file). If grade-level matters to gameplay,
the fix is carrying `ncesImport.js`'s existing `primary`/`secondary`
read through to a landmark's data rather than a new category —
unbuilt, and a different piece of work from this one.
