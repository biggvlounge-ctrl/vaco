// VDP — Zones: real, distinct named areas inside the frontier and the
// underground world.
//
// Per direct instruction (9 Oct 2026): "the spots that are
// unauthorized part of the world, the woods and things like that --
// make the woods and the underground worlds... make them full of
// life, make them different, different areas, different places." A
// plain, side-effect-free constants module, the same shape `world.js`'s
// own `DISTRICTS` or `town.js`'s `TOWN_NAME` already are -- imported
// directly rather than injected, since there is no store or money path
// here to decouple from.
//
// `FRONTIER_ZONES`/`UNDERGROUND_ZONES` are flagged, chosen names, same
// footing every other invented-but-flagged list in this app already
// stands on (`resources.js`'s own yield table).
//
// **A correction (14 Oct 2026).** This header used to claim `bias` on
// a frontier zone "is real and read by `immigration.js`." Checked
// directly while widening the water/fishing zones below, by actually
// grepping for a real reader rather than trusting the comment: there
// was none. `immigration.js`'s own `reportSmugglingSpot` now really
// does propagate it (`resourceBias` on the real spot record), closing
// that gap instead of repeating the false claim -- the same
// "citation is not presence" discipline this project's own sibling
// project, VACON-C, names by that exact phrase.
//
// **Two real water zones (14 Oct 2026), per direct instruction**:
// "make the game heavily water heavy to where there's a lot of
// fishing involved." `Clearwater Flats` already existed (`bias:
// 'water'`); `Rivermouth Shoals` is the new, real, separate bias for
// `resources.js`'s own `fish` resource -- a fishing spot and a
// water-treatment spot are two different real things even though
// both involve water, the same honest split `jobs.js`'s own `fisher`/
// `water-treatment-worker` already draw.
export const FRONTIER_ZONES = [
  { name: 'Timberline Reach', bias: 'wood' },
  { name: 'Stonecut Hollow', bias: 'stone' },
  { name: 'Clearwater Flats', bias: 'water' },
  { name: 'Game Run Thicket', bias: 'game' },
  { name: 'Rivermouth Shoals', bias: 'fish' },
];

export const UNDERGROUND_ZONES = [
  { name: 'The Hollow Market' },
  { name: 'The Lower Vents' },
  { name: 'The Sunken Quarter' },
];

export function pickZone(zones, rng = Math.random) {
  if (!zones || zones.length === 0) throw new Error('pickZone requires a non-empty real zone list');
  return zones[Math.floor(rng() * zones.length)];
}
