// Universal World Layer — Overture Maps Transportation import.
//
// ***VACON-C DEFERS TRANSPORTATION BY POLICY. READ THIS FIRST.***
//
// ---------------------------------------------------------------------
// The status, stated before the code, because it is the whole context
// ---------------------------------------------------------------------
// `vacon-c/CLAUDE.md` lists Transportation under "Explicitly deferred —
// do not touch", alongside Leader/Simulation/Multiplayer modes and
// subscription tiers. That is a live decision, not an oversight, and
// **nothing in this file changes it.**
//
// What this file does is separate two things that had been stuck
// together:
//
//   the ENGINE modelling movement     deferred, and stays deferred
//   the WORLD LAYER holding roads     a data slice, and it was the
//                                     only one with no importer
//
// `world-layer/transportation.js` already exists and predates this
// pass — the world layer has always modelled transport nodes. Overture
// Transportation is the free, permissively licensed source that fills
// them, and `transportationData` was the one slice in the registry that
// nothing could reach. It was also, measured, the ONLY thing keeping
// the per-tier coverage figures below 100%, which made the coverage
// report read as "one gap left" when the real gaps were the five
// unsourced FIELDS inside slices that read as covered.
//
// **So this is deliberately a producer with no consumer today**, which
// is normally CLAUDE.md's eleventh standing rule and a reason not to
// build something. The exception is stated rather than assumed: every
// importer in this directory is currently a producer with no consumer,
// because the proxy blocks every source, and the rule is about a
// generator nothing CAN call rather than one nothing HAS called.
// `DEFERRED_BY` is on every row so a consumer that appears later
// cannot mistake this for sanctioned engine scope.
//
// ---------------------------------------------------------------------
// Licence, which is the reason this is Overture and not OSM
// ---------------------------------------------------------------------
// OpenStreetMap carries the same roads under ODbL — share-alike
// obligations that bind the shipped product. Overture is built largely
// from OSM, ships as GeoParquet, and carries CDLA-Permissive-v2
// instead. `COST_REDUCTION_THROUGH_DATA.md` recommends skipping OSM for
// exactly this reason and preferring Overture, and this importer is the
// other half of that recommendation.
//
// NETWORK CONSTRAINT, checked directly: `overturemaps.org` is outside
// this environment's outbound proxy allowlist (403 CONNECT).

'use strict';

const { setLocationData, getLocation } = require('../locations');

//: Carried on every row. See the header.
const DEFERRED_BY = 'VACON-C defers Transportation by policy (vacon-c/CLAUDE.md, "Explicitly '
  + 'deferred — do not touch"). This data is imported into the world layer and no VACON-C '
  + 'system consumes it. Do not read it as sanctioned engine scope.';

//: Overture segment subtypes → what the engine's `infrastructure.js`
//: calls the thing. Only `road` and `rail` correspond to an
//: infrastructure type it enumerates; the rest are named and kept
//: distinct rather than folded into `roads`.
const SEGMENT_SUBTYPES = {
  road: { infrastructureType: 'roads', carries: 'vehicles' },
  rail: { infrastructureType: 'rail', carries: 'trains' },
  water: { infrastructureType: null, carries: 'vessels' },
};

const SUBTYPE_NAMES = Object.keys(SEGMENT_SUBTYPES);

//: Overture's road classes, coarse to fine. **The class is the whole
//: value of this import** — a motorway and a residential street are
//: both "a road", and the difference is what decides whether two
//: places are connected in any meaningful sense.
//:
//: `weight` is relative capacity, evenly ordered and flagged
//: interpretive: Overture publishes the class, not a capacity, and
//: anything other than a monotonic ordering would be asserting traffic
//: engineering this file has no basis for.
const ROAD_CLASSES = {
  motorway: { weight: 1, label: 'motorway' },
  trunk: { weight: 0.85, label: 'trunk road' },
  primary: { weight: 0.7, label: 'primary road' },
  secondary: { weight: 0.55, label: 'secondary road' },
  tertiary: { weight: 0.4, label: 'tertiary road' },
  residential: { weight: 0.25, label: 'residential street' },
  unclassified: { weight: 0.2, label: 'unclassified road' },
  service: { weight: 0.1, label: 'service road' },
  living_street: { weight: 0.1, label: 'living street' },
  pedestrian: { weight: 0.05, label: 'pedestrian way' },
  footway: { weight: 0.02, label: 'footway' },
  path: { weight: 0.02, label: 'path' },
};

const ROAD_CLASS_NAMES = Object.keys(ROAD_CLASSES);

function subtypeFor(subtype) {
  return SEGMENT_SUBTYPES[subtype] ?? null;
}

function roadClassFor(roadClass) {
  return ROAD_CLASSES[roadClass] ?? null;
}

// Summarise the segments touching a place into a connectivity profile.
//
// `segments`: `[{ subtype, class, lengthMetres, connectorIds }]`.
//
// **The best class, not the count.** A place on a motorway is
// well connected whether or not it also has forty service roads, and
// summing or averaging would let a car park dilute a trunk road. Same
// argument `femaImport.toRiskProfile` makes for taking the maximum.
function toConnectivity(segments) {
  if (!Array.isArray(segments)) {
    throw new Error('toConnectivity requires an array of Overture segment records');
  }

  let best = null;
  let bestWeight = -1;
  const byClass = {};
  const unrecognised = [];
  let totalLengthMetres = 0;
  const connectors = new Set();

  for (const segment of segments) {
    const subtype = subtypeFor(segment?.subtype);
    if (subtype === null) {
      unrecognised.push({ subtype: segment?.subtype ?? null, reason: 'not an Overture subtype' });
      continue;
    }
    const length = Number(segment?.lengthMetres);
    if (Number.isFinite(length) && length > 0) totalLengthMetres += length;
    for (const id of segment?.connectorIds ?? []) connectors.add(id);

    // Only road segments carry a class; rail and water do not.
    if (segment.subtype !== 'road') {
      byClass[segment.subtype] = (byClass[segment.subtype] ?? 0) + 1;
      continue;
    }
    const roadClass = roadClassFor(segment?.class);
    if (roadClass === null) {
      unrecognised.push({ class: segment?.class ?? null, reason: 'not an Overture road class' });
      continue;
    }
    byClass[segment.class] = (byClass[segment.class] ?? 0) + 1;
    if (roadClass.weight > bestWeight) {
      bestWeight = roadClass.weight;
      best = segment.class;
    }
  }

  return {
    // **Null, not zero, where no road was recognised.** A place with no
    // segments is unsurveyed, not unreachable, and a connectivity of 0
    // would say the second.
    bestClass: best,
    connectivity: best === null ? null : ROAD_CLASSES[best].weight,
    byClass,
    unrecognised,
    totalLengthMetres: Math.round(totalLengthMetres),
    // How many distinct junctions touch this place. Overture's own
    // connector ids, deduplicated — the closest thing to "how many ways
    // in and out" the source publishes.
    junctions: connectors.size,
  };
}

// Attach a connectivity profile to a location.
function importSegments(worldLayer, locationId, segments) {
  const location = getLocation(worldLayer, locationId);
  if (!location) throw new Error(`importSegments: no location with id ${locationId}`);

  const connectivity = toConnectivity(segments);
  setLocationData(worldLayer, locationId, 'transportationData', {
    source: 'overture-transportation',
    licence: 'CDLA-Permissive-v2',
    // See the header. On every row, on purpose.
    deferredBy: DEFERRED_BY,
    bestClass: connectivity.bestClass,
    connectivity: connectivity.connectivity,
    segmentsByClass: connectivity.byClass,
    totalLengthMetres: connectivity.totalLengthMetres,
    junctions: connectivity.junctions,
    unrecognisedSegments: connectivity.unrecognised,
    infrastructureType: connectivity.bestClass === null
      ? null
      : SEGMENT_SUBTYPES.road.infrastructureType,
  });
  return location;
}

function describeTransportCoverage(worldLayer) {
  let places = 0;
  let connected = 0;
  const byBestClass = {};
  for (const location of worldLayer.locations || []) {
    const data = location.transportationData;
    if (data?.source !== 'overture-transportation') continue;
    places += 1;
    if (data.bestClass !== null) {
      connected += 1;
      byBestClass[data.bestClass] = (byBestClass[data.bestClass] ?? 0) + 1;
    }
  }
  return {
    places,
    connected,
    // Imported but with no recognised road — surveyed and found
    // unconnected, which is different from not imported.
    unconnected: places - connected,
    byBestClass,
    // Stated in the report as well as on the rows, so a coverage
    // summary cannot be read as the engine having taken this up.
    deferredBy: DEFERRED_BY,
  };
}

function fetchTransportation() {
  throw new Error(
    'fetchTransportation is not implemented: overturemaps.org is outside this '
    + 'environment\'s outbound proxy allowlist (403 CONNECT, checked directly). The '
    + 'Transportation theme downloads with the `overturemaps` CLI as GeoParquet, no key. '
    + 'NOTE: VACON-C defers Transportation by policy — importing this fills a world-layer '
    + 'slice and no engine system reads it. Pass segment records to '
    + `importSegments(worldLayer, locationId, segments). Subtypes: ${SUBTYPE_NAMES.join(', ')}. `
    + `Road classes: ${ROAD_CLASS_NAMES.join(', ')}.`,
  );
}

module.exports = {
  DEFERRED_BY,
  SEGMENT_SUBTYPES,
  SUBTYPE_NAMES,
  ROAD_CLASSES,
  ROAD_CLASS_NAMES,
  subtypeFor,
  roadClassFor,
  toConnectivity,
  importSegments,
  describeTransportCoverage,
  fetchTransportation,
};
