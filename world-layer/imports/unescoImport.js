// Universal World Layer — UNESCO World Heritage import.
// Source of truth: AUTOMATED_HISTORIC_LANDMARK_IMPORT_SYSTEM.md —
// "UNESCO World Heritage data as the source" for globally-significant
// historic landmarks, imported as hero-tier locations (Phase 1's
// `LOCATION_TIERS`, matching UNIVERSAL_WORLD_LAYER_ARCHITECTURE.md
// section 7's "Tier 1: global icons, ~1,200 UNESCO locations").
//
// NETWORK CONSTRAINT (confirmed directly, not assumed): this
// sandboxed environment's outbound HTTPS proxy rejects connections to
// hosts outside its allowlist. A direct test request to
// query.wikidata.org returned a 403 CONNECT rejection from the proxy
// itself ("gateway answered 403 to CONNECT (policy denial or upstream
// failure)"), confirmed via the proxy's own /__agentproxy/status
// endpoint. Neither UNESCO's site nor Wikidata's SPARQL endpoint is
// reachable from here. `fetchUnescoSites()` below is therefore an
// intentional stub, not a placeholder forgotten mid-build — swapping
// in a real HTTP call is a one-function change, not a rewrite of
// `importUnescoSites()`, which is the real, tested part.

const { generateLocation, setLocationData } = require('../locations');

function importUnescoSites(worldLayer, siteRecords) {
  if (!Array.isArray(siteRecords)) {
    throw new Error('importUnescoSites requires an array of site records');
  }

  const imported = [];
  for (const site of siteRecords) {
    const { name, lat, lng, country = null, inscribedYear = null, description = null } = site;

    if (!name) {
      throw new Error(`importUnescoSites: site record missing name (${JSON.stringify(site)})`);
    }
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      throw new Error(`importUnescoSites: site "${name}" missing numeric lat/lng`);
    }

    const location = generateLocation(worldLayer, { name, lat, lng, tier: 'hero' });
    setLocationData(worldLayer, location.id, 'landmarkData', {
      unesco: true,
      country,
      inscribedYear,
      description,
      // UNESCO inscription is treated as maximal historical importance
      // in this model -- an interpretive choice (no scoring formula is
      // specified in any source doc for this field), consistent with
      // AUTOMATED_HISTORIC_LANDMARK_IMPORT_SYSTEM.md's own framing of
      // UNESCO sites as the top of the significance hierarchy.
      historicalImportance: 100,
    });
    imported.push(location);
  }
  return imported;
}

function fetchUnescoSites() {
  throw new Error(
    'fetchUnescoSites is not implemented: this environment cannot reach external hosts ' +
    '(query.wikidata.org and whc.unesco.org are both outside the outbound proxy allowlist, ' +
    'confirmed directly). Call importUnescoSites(worldLayer, siteRecords) with pre-fetched ' +
    'records instead -- see dev-docs/phase-7-unesco-import/plan.md for the confirmed record shape.'
  );
}

module.exports = { importUnescoSites, fetchUnescoSites };
