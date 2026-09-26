// Universal World Layer — export a region as a landmark pack.
//
// Source of truth: UNIVERSAL_WORLD_LAYER_ARCHITECTURE.md ("one shared,
// generated Earth model, not separate generation pipelines") and
// AUTOMATED_HISTORIC_LANDMARK_IMPORT_SYSTEM.md ("when Claude Code
// imports a new region — the same process already used for St. Louis").
//
// ---------------------------------------------------------------------
// The consumer this module was waiting for
// ---------------------------------------------------------------------
// UNIVERSAL_WORLD_LAYER_ARCHITECTURE.md's own status section has said,
// since it was written:
//
//   "**Genuinely unbuilt**: the consumers. VACON-C is paused, so the
//   world model is generated and read by nothing yet. That is the
//   honest ceiling — this is real infrastructure waiting on the game
//   that uses it."
//
// **VACON-C is not paused any more.** It built `server/landmarks.js`
// without finding `locations.js`, so for a while there were two
// answers to "what landmarks are in this area" — one anonymous and
// generated per city, one real and imported per region. This function
// is the join.
//
// ---------------------------------------------------------------------
// Why a file and not an import
// ---------------------------------------------------------------------
// `dev-docs/DEPLOYMENT_FILE_PLACEMENT.md`: ten apps reference this
// directory in comments and **none import it across a directory
// boundary**, which is what keeps each app's Docker build context
// valid. So this produces a PACK — plain JSON, the shape
// `vacon-c/server/landmarkPacks.js` validates and reads — and the pack
// travels as a file. Neither app requires the other.
//
// The category vocabulary is VACANCY's Key (THE_KEY_BUILDING_TYPES.md,
// twenty-three hero types) plus the retail ten, because that is the
// standard both documents describe as global: "built once here,
// duplicated as the same category standard globally... proven in
// St. Louis, now the definitive, standard reference for identifying
// hero-tier locations in every subsequent city and region worldwide."

'use strict';

// The Key's own categories, as the consuming engine spells them.
// Duplicated here rather than imported for the deployment reason in the
// header — and asserted against the consumer by that side's test, so
// the two cannot drift silently.
const KEY_CATEGORIES = [
  'skyscraper', 'university', 'government-building', 'prison', 'art-museum',
  'church', 'mosque', 'synagogue', 'temple', 'masonic-building', 'historic-site',
  'airport', 'train-station', 'hospital', 'stadium-arena', 'library',
  'theater-concert-hall', 'notable-bridge', 'monument-memorial', 'zoo-aquarium',
  'cave-system', 'natural-formation', 'other-distinctive-feature',
  // **A twenty-fourth.** THE_KEY_BUILDING_TYPES.md lists twenty-three
  // and no school; KEY_LOCATION_DISCOVERY_WORD_OF_MOUTH_SYSTEM.md
  // names schools as a Key building type twice. Both documents are the
  // owner's and both are present, so the list is the union — see
  // `vacon-c/server/landmarks.js` for the reasoning, and that repo's
  // `landmark-packs.test.js` for the assertion that keeps these two
  // copies identical.
  'school',
  // **A twenty-fifth, added 26 Sep 2026.** Not a document
  // reconciliation like `school` — a new category added directly at
  // the owner's request, alongside the retail-list `junkyard` that
  // stays out of this array because it is not hero-tier. See
  // `vacon-c/server/landmarks.js` for the reasoning and
  // `landmark-packs.test.js` for the identity assertion.
  'park',
  // Twenty-sixth through thirty-first, same date, same batch, same
  // reasoning as `park` above.
  'warehouse', 'public-housing', 'river', 'lake', 'corporate-headquarters',
  'shopping-mall',
  // Thirty-second, same reasoning, added alongside server/gambling.js.
  'casino',
  // Thirty-third through thirty-seventh, same reasoning, five named
  // venue subtypes beside stadium-arena.
  'dome', 'amphitheater', 'hockey-arena', 'soccer-stadium', 'college-stadium',
];

// UNESCO inscription is treated as maximal historical importance by
// `imports/unescoImport.js`, which writes `historicalImportance: 100`
// into `landmarkData`. That judgement belongs to the importer; this
// carries it through rather than forming a second opinion.
function significanceOf(location) {
  const importance = Number(location?.landmarkData?.historicalImportance);
  return Number.isFinite(importance) ? Math.max(0, Math.min(100, importance)) : null;
}

// A location's Key category. **Not guessed from the name.** A location
// carries it in `landmarkData.category` when an import knew it, and
// `null` otherwise — and a null is dropped from the pack with a reason
// rather than defaulted to `other-distinctive-feature`, because a
// silent default is how a whole region ends up as one category.
function categoryOf(location) {
  const category = location?.landmarkData?.category ?? null;
  return KEY_CATEGORIES.includes(category) ? category : null;
}

// Turn the world layer's locations into a pack a game engine can read.
//
// `region` is required for the same reason `generateLocation` requires
// a name: a pack with no region is not a per-region import, and the
// consumer refuses one.
function exportRegion(worldLayer, options = {}) {
  const { region, source = 'sample', tiers = ['hero', 'regional'] } = options;
  if (!region) {
    throw new Error('exportRegion requires options.region — a pack is per-region by definition');
  }

  const locations = [];
  const skipped = [];
  for (const location of worldLayer.locations || []) {
    if (!tiers.includes(location.tier)) continue;
    const category = categoryOf(location);
    if (category === null) {
      // Named, not dropped in silence. A region that exports fewer
      // locations than it holds should say which and why.
      skipped.push({ name: location.name, reason: 'no Key category in landmarkData' });
      continue;
    }
    const entry = {
      name: location.name,
      category,
      tier: location.tier,
    };
    const significance = significanceOf(location);
    if (significance !== null) entry.significance = significance;
    if (location.landmarkData?.area) entry.area = location.landmarkData.area;
    // Coordinates travel together or not at all — the consumer's
    // validator rejects half a pair.
    if (typeof location.lat === 'number' && typeof location.lng === 'number') {
      entry.lat = location.lat;
      entry.lng = location.lng;
    }
    locations.push(entry);
  }

  const areas = [...new Set(locations.map((l) => l.area).filter(Boolean))];
  return {
    region,
    source,
    areas,
    locations,
    // Carried on the pack rather than logged, so the record of what an
    // import could not place travels with the import.
    skipped,
  };
}

module.exports = { KEY_CATEGORIES, exportRegion, categoryOf, significanceOf };
