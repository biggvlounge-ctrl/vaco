// Universal World Layer — CMS Provider of Services import.
//
// **The same hospitals HIFLD already places, with a bed count somebody
// is legally required to keep current.**
//
// ---------------------------------------------------------------------
// Why a second hospital source is not a duplicate
// ---------------------------------------------------------------------
// `hifldImport` maps the HIFLD hospitals layer and carries its `beds`
// field, which is real and is the right number. The problem is age:
// HIFLD's health layers are compiled from mixed sources on no fixed
// schedule, and a bed count is exactly the field that goes stale — a
// hospital that closed a wing five years ago still reads at its old
// capacity.
//
// The CMS Provider of Services file is the certification record for
// every Medicare-certified facility in the United States. Bed counts on
// it are a condition of certification and are refreshed quarterly. It
// is a U.S. Government Work, published as a flat file, no key.
//
// So this is a REFRESH source, and the design follows from that:
// `preferByDate` decides between two figures by which was collected
// last, rather than by which file it came from. **Neither source is
// declared the winner** — the same resolution `control.js` uses for the
// two columns that say who is in a building, and for the same reason:
// a disagreement should become harmless rather than require somebody to
// have been right.
//
// ---------------------------------------------------------------------
// What the number is for
// ---------------------------------------------------------------------
// `landmarks.staffingFor` and `control.maintenanceFor` size a crew from
// how big a thing is, and for a hospital "how big" means beds. It is
// also `infrastructure.js`'s `hospitals` capacity, which
// `mortality.js` reads when it fails.
//
// NETWORK CONSTRAINT, checked directly: `data.cms.gov` is outside this
// environment's outbound proxy allowlist (403 CONNECT). `fetchPos`
// throws with that reason; the transform is the tested part.

'use strict';

const { setLocationData, getLocation } = require('../locations');

//: CMS provider categories → the engine's infrastructure type, and the
//: Key category where the thing is also a landmark. **Short on
//: purpose**: the Provider of Services file covers dozens of facility
//: types and most of them — home health agencies, dialysis centres,
//: hospices — are not buildings this engine models as infrastructure.
const PROVIDER_TYPES = {
  'short-term-hospital': { infrastructureType: 'hospitals', category: 'hospital' },
  'critical-access-hospital': { infrastructureType: 'hospitals', category: 'hospital' },
  'childrens-hospital': { infrastructureType: 'hospitals', category: 'hospital' },
  'psychiatric-hospital': { infrastructureType: 'hospitals', category: 'hospital' },
  'rehabilitation-hospital': { infrastructureType: 'hospitals', category: 'hospital' },
  'long-term-hospital': { infrastructureType: 'hospitals', category: 'hospital' },
  'skilled-nursing-facility': { infrastructureType: 'hospitals', category: null },
};

const PROVIDER_TYPE_NAMES = Object.keys(PROVIDER_TYPES);

//: Facility types CMS certifies that this engine has no infrastructure
//: type for. Named rather than dropped, same rule as everywhere else in
//: this directory.
const UNMODELLED_PROVIDERS = {
  'home-health-agency': 'no building — a service delivered at the patient',
  hospice: 'no mechanism; deaths are mortality.js, not a facility',
  'dialysis-facility': 'no chronic-treatment mechanic',
  'rural-health-clinic': 'below the grain infrastructure.js models',
  'ambulatory-surgical-center': 'as rural health clinic',
};

function providerFor(type) {
  return PROVIDER_TYPES[type] ?? null;
}

// Decide between two capacity figures by collection date.
//
// Returns the one collected later, or the one that exists if only one
// does. **A figure with no date loses to one with a date, and two
// undated figures keep the existing one** — an undated number cannot be
// shown to be fresher, and replacing on a tie would make the result
// depend on import order.
function preferByDate(existing, incoming) {
  if (!incoming || incoming.capacity === null || incoming.capacity === undefined) return existing;
  if (!existing || existing.capacity === null || existing.capacity === undefined) return incoming;

  const existingAt = Date.parse(existing.collectedAt ?? '');
  const incomingAt = Date.parse(incoming.collectedAt ?? '');
  if (!Number.isFinite(incomingAt)) return existing;
  if (!Number.isFinite(existingAt)) return incoming;
  return incomingAt > existingAt ? incoming : existing;
}

// Attach or refresh a facility's capacity.
function importProvider(worldLayer, locationId, record = {}) {
  const location = getLocation(worldLayer, locationId);
  if (!location) throw new Error(`importProvider: no location with id ${locationId}`);
  if (!record.ccn) {
    throw new Error(
      'importProvider requires record.ccn — the CMS Certification Number. It is what makes '
      + 'a bed count checkable against the published file, and what lets a later quarter '
      + 'refresh the same facility rather than duplicate it.',
    );
  }

  const definition = providerFor(record.providerType);
  if (definition === null) {
    throw new Error(
      `importProvider: "${record.providerType}" is not a provider type this importer maps. `
      + `Known: ${PROVIDER_TYPE_NAMES.join(', ')}. Deliberately not mapped: `
      + `${Object.keys(UNMODELLED_PROVIDERS).join(', ')}.`,
    );
  }

  const beds = Number(record.beds);
  const incoming = {
    capacity: Number.isFinite(beds) && beds > 0 ? beds : null,
    collectedAt: record.collectedAt ?? null,
    source: 'cms-pos',
  };

  const existing = location.buildingData ?? {};
  // **The existing figure is whatever is on the row, whoever wrote
  // it.** HIFLD does not date its bed counts, so in practice a dated
  // CMS figure wins — which is the intent, stated by the mechanism
  // rather than by a special case naming HIFLD.
  const chosen = preferByDate(
    {
      capacity: existing.capacity ?? null,
      collectedAt: existing.capacityCollectedAt ?? null,
      source: existing.source ?? null,
    },
    incoming,
  );

  setLocationData(worldLayer, locationId, 'buildingData', {
    ...existing,
    // The row's own source becomes CMS only if CMS actually supplied
    // the capacity. Otherwise the earlier source keeps the credit,
    // because a row claiming a source it did not take its number from
    // is the citation-is-not-presence failure in miniature.
    source: chosen.source ?? existing.source ?? 'cms-pos',
    licence: 'public-domain',
    ccn: record.ccn,
    providerType: record.providerType,
    infrastructureType: definition.infrastructureType,
    capacity: chosen.capacity,
    capacityUnit: 'beds',
    capacityReported: chosen.capacity !== null,
    capacityCollectedAt: chosen.collectedAt,
    // What the previous figure was, where one was replaced. Kept so a
    // refresh is visible rather than silent — a bed count halving
    // between quarters is a real event somebody may want to see.
    capacitySupersededFrom: chosen === incoming && existing.capacity != null
      && existing.capacity !== chosen.capacity
      ? { capacity: existing.capacity, source: existing.source ?? null }
      : null,
  });

  if (definition.category !== null) {
    const landmark = location.landmarkData ?? {};
    setLocationData(worldLayer, locationId, 'landmarkData', {
      ...landmark,
      category: landmark.category ?? definition.category,
    });
  }
  return location;
}

function describeProviderCoverage(worldLayer) {
  let facilities = 0;
  let withBeds = 0;
  let refreshed = 0;
  const byType = {};
  for (const location of worldLayer.locations || []) {
    const data = location.buildingData;
    if (!data?.ccn) continue;
    facilities += 1;
    if (data.capacityReported) withBeds += 1;
    if (data.capacitySupersededFrom) refreshed += 1;
    byType[data.providerType] = (byType[data.providerType] ?? 0) + 1;
  }
  return {
    facilities,
    withBeds,
    // **How many figures this import actually improved.** A refresh
    // source whose numbers all match what was already there has done
    // nothing, and that is worth being able to see rather than assume
    // either way.
    refreshed,
    byType,
    unmodelledProviders: UNMODELLED_PROVIDERS,
  };
}

function fetchPos() {
  throw new Error(
    'fetchPos is not implemented: data.cms.gov is outside this environment\'s outbound '
    + 'proxy allowlist (403 CONNECT, checked directly). The Provider of Services file is a '
    + 'quarterly flat-file download from the CMS data portal and needs no key. Pass '
    + '{ ccn, providerType, beds, collectedAt } to importProvider(worldLayer, locationId, '
    + `record). Mapped provider types: ${PROVIDER_TYPE_NAMES.join(', ')}.`,
  );
}

module.exports = {
  PROVIDER_TYPES,
  PROVIDER_TYPE_NAMES,
  UNMODELLED_PROVIDERS,
  providerFor,
  preferByDate,
  importProvider,
  describeProviderCoverage,
  fetchPos,
};
