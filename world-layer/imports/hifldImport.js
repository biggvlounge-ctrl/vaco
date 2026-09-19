// Universal World Layer — HIFLD Open infrastructure import.
//
// **It publishes the engine's own ten infrastructure types, as layers.**
//
// ---------------------------------------------------------------------
// The match is unusually exact, which is why this is worth wiring
// ---------------------------------------------------------------------
// `vacon-c/server/infrastructure.js` enumerates exactly ten types —
// roads, bridges, rail, water systems, electricity, internet, hospitals,
// schools, public safety, waste management. HIFLD Open publishes a
// national layer for almost every one, as open GIS, as a U.S.
// Government Work.
//
// That matters because of what `infrastructure.js` currently does with
// them. A world's infrastructure is generated with a capacity drawn from
// a band and a condition drawn from a band; `statecraft.js` funds it and
// `mortality.js` reads its failure. **The layers carry real capacity** —
// a hospital's bed count, a plant's generating capacity, a treatment
// works' throughput — which is the number those bands stand in for.
//
// It is also the number the maintain key sizes a crew from:
// `landmarks.staffingFor` and `control.maintenanceFor` both scale from
// how big a thing is, and "how big" for a hospital means beds.
//
// ---------------------------------------------------------------------
// One importer, many layers, and the layer must be named
// ---------------------------------------------------------------------
// HIFLD is hundreds of separate layers with different schemas. Rather
// than pretend one parser fits all of them, the caller says WHICH layer
// the records came from, and the map below says what that layer means
// to this engine. **An unnamed layer is refused** — guessing from field
// names would be the kind of inference that looks clever and silently
// mixes a fire station into the hospital count.
//
// NETWORK CONSTRAINT, checked directly: the HIFLD ArcGIS hub is outside
// this environment's outbound proxy allowlist (403 CONNECT).
// `fetchHifldLayer` throws with that reason.

'use strict';

const { generateLocation, setLocationData } = require('../locations');

//: HIFLD open layers → `infrastructure.INFRASTRUCTURE_TYPES`, plus the
//: Key category where the thing is also a landmark. A hospital is both:
//: it is infrastructure a city funds AND a hero-tier building somebody
//: might take.
//:
//: `capacityField` names the column that carries the real capacity for
//: that layer, because it differs per layer and the whole point of
//: using HIFLD over a generated band is that number.
const LAYERS = {
  hospitals: {
    infrastructureType: 'hospitals',
    category: 'hospital',
    capacityField: 'beds',
    capacityUnit: 'beds',
  },
  'public-schools': {
    infrastructureType: 'schools',
    category: 'school',
    capacityField: 'enrollment',
    capacityUnit: 'pupils',
  },
  'colleges-universities': {
    infrastructureType: 'schools',
    category: 'university',
    capacityField: 'enrollment',
    capacityUnit: 'students',
  },
  'fire-stations': {
    infrastructureType: 'public_safety',
    category: null,
    capacityField: null,
    capacityUnit: null,
  },
  'local-law-enforcement': {
    infrastructureType: 'public_safety',
    category: null,
    capacityField: null,
    capacityUnit: null,
  },
  prisons: {
    infrastructureType: 'public_safety',
    category: 'prison',
    capacityField: 'capacity',
    capacityUnit: 'inmates',
  },
  'power-plants': {
    infrastructureType: 'electricity',
    category: null,
    capacityField: 'megawatts',
    capacityUnit: 'MW',
  },
  'wastewater-treatment': {
    infrastructureType: 'waste_management',
    category: null,
    capacityField: 'flowMgd',
    capacityUnit: 'million gallons per day',
  },
  'public-water-systems': {
    infrastructureType: 'water_systems',
    category: null,
    capacityField: 'populationServed',
    capacityUnit: 'people served',
  },
  'major-bridges': {
    infrastructureType: 'bridges',
    category: 'notable-bridge',
    capacityField: null,
    capacityUnit: null,
  },
  'railroad-stations': {
    infrastructureType: 'rail',
    category: 'train-station',
    capacityField: null,
    capacityUnit: null,
  },
  airports: {
    infrastructureType: 'rail',
    category: 'airport',
    capacityField: 'enplanements',
    capacityUnit: 'annual passengers',
  },
};

const LAYER_NAMES = Object.keys(LAYERS);

function layerFor(layer) {
  return LAYERS[layer] ?? null;
}

// Import one HIFLD layer.
//
// `layer` is a key of `LAYERS`. `records` are that layer's features,
// flattened: `{ name, lat, lng, county, ...capacityField }`.
function importHifldLayer(worldLayer, layer, records) {
  const definition = layerFor(layer);
  if (definition === null) {
    throw new Error(
      `importHifldLayer: "${layer}" is not a mapped HIFLD layer. `
      + `Known: ${LAYER_NAMES.join(', ')}. HIFLD publishes hundreds of layers with `
      + 'different schemas — guessing which one this is from its field names is how a fire '
      + 'station ends up counted as a hospital.',
    );
  }
  if (!Array.isArray(records)) {
    throw new Error('importHifldLayer requires an array of feature records');
  }

  const imported = [];
  const skipped = [];
  for (const record of records) {
    const name = record?.name ?? record?.NAME ?? null;
    const lat = Number(record?.lat ?? record?.latitude ?? record?.Y);
    const lng = Number(record?.lng ?? record?.longitude ?? record?.X);
    if (!name) {
      skipped.push({ record, reason: 'no name' });
      continue;
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      skipped.push({ name, reason: 'no usable coordinates' });
      continue;
    }

    // **Capacity is read from the layer's own field, or is null.**
    // HIFLD suppresses or omits it for some facilities, and a null
    // capacity is different from a capacity of zero — a hospital with
    // no recorded bed count is not a hospital with no beds.
    const rawCapacity = definition.capacityField ? record?.[definition.capacityField] : null;
    const capacity = Number.isFinite(Number(rawCapacity)) && Number(rawCapacity) > 0
      ? Number(rawCapacity)
      : null;

    // Regional where the thing is also a Key landmark somebody might
    // take; filler where it is pure infrastructure. §7's tiers again:
    // a hospital earns refinement, a pumping station does not.
    const tier = definition.category === null ? 'filler' : 'regional';
    const location = generateLocation(worldLayer, { name, lat, lng, tier });

    setLocationData(worldLayer, location.id, 'buildingData', {
      source: 'hifld-open',
      layer,
      infrastructureType: definition.infrastructureType,
      capacity,
      capacityUnit: definition.capacityUnit,
      capacityReported: capacity !== null,
    });
    if (definition.category !== null) {
      setLocationData(worldLayer, location.id, 'landmarkData', {
        category: definition.category,
        area: record?.county ?? record?.city ?? null,
        source: 'hifld-open',
      });
    }
    imported.push(location);
  }
  return { imported, skipped };
}

// ---------------------------------------------------------------------
// describeInfrastructureCoverage — which of the engine's ten are real
// ---------------------------------------------------------------------
// `infrastructure.js` has ten types and a world generates all of them
// from bands. This reports which ones now have real facilities behind
// them and, of those, how many carry a real capacity — because a
// facility with no capacity figure still leaves the band doing the
// work for the number that matters most.
function describeInfrastructureCoverage(worldLayer) {
  const byType = {};
  for (const location of worldLayer.locations || []) {
    const data = location.buildingData;
    if (data?.source !== 'hifld-open') continue;
    const type = data.infrastructureType;
    if (!byType[type]) byType[type] = { facilities: 0, withCapacity: 0 };
    byType[type].facilities += 1;
    if (data.capacityReported) byType[type].withCapacity += 1;
  }

  const engineTypes = [
    'roads', 'bridges', 'rail', 'water_systems', 'electricity', 'internet',
    'hospitals', 'schools', 'public_safety', 'waste_management',
  ];
  return {
    byType,
    covered: engineTypes.filter((t) => byType[t]),
    // **`roads` and `internet` have no HIFLD open layer mapped here**,
    // and that is stated rather than left as a silent zero. Roads are
    // Overture Transportation's job; internet infrastructure is not
    // published as open national data in a form this needs.
    uncovered: engineTypes.filter((t) => !byType[t]),
  };
}

function fetchHifldLayer() {
  throw new Error(
    'fetchHifldLayer is not implemented: the HIFLD ArcGIS hub is outside this '
    + 'environment\'s outbound proxy allowlist (403 CONNECT, checked directly). Each layer '
    + 'is a separate GeoJSON or shapefile download from the HIFLD Open portal — fetch the '
    + 'one you want and pass its features to importHifldLayer(worldLayer, layer, records) '
    + `with the layer named. Known layers: ${LAYER_NAMES.join(', ')}.`,
  );
}

module.exports = {
  LAYERS,
  LAYER_NAMES,
  layerFor,
  importHifldLayer,
  describeInfrastructureCoverage,
  fetchHifldLayer,
};
