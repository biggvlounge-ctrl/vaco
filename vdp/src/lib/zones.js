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
// stands on (`resources.js`'s own yield table). `bias` on a frontier
// zone is real and read by `immigration.js` to vary which real
// resource a spot in that zone leans toward -- never a closed claim
// about anything beyond this fictional world's own geography.
export const FRONTIER_ZONES = [
  { name: 'Timberline Reach', bias: 'wood' },
  { name: 'Stonecut Hollow', bias: 'stone' },
  { name: 'Clearwater Flats', bias: 'water' },
  { name: 'Game Run Thicket', bias: 'game' },
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
