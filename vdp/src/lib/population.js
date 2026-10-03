// VDP — population tiers.
//
// Named, real scope from VDP's own README ("Population tiers" —
// listed alongside Jobs/Careers and Skills as not yet built, both of
// which shipped this phase). Deliberately NOT `worldExpansion.js`'s
// `isVisuallyPlayable`/`realGrowthSignal` machinery — that module
// answers a different question (where is it worth spending $3-5k of
// human artist time on a BACKDROP city's environment art) at a scale
// (`minPopulation: 25000`) that has nothing to do with how many real
// people and NPCs are actually in VDP's own walkable world right now.
// This is the much smaller, much more literal reading: count who's
// really here, name the size.
//
//: Flagged interpretive: no source document gives VDP its own
//: population-tier thresholds. Named, overridable constants rather
//: than a buried literal, same convention `worldExpansion.js`'s own
//: `DEFAULT_THRESHOLDS` already uses — picked to fit VDP's actual
//: current scale (single digits to low hundreds), not a real city's.
export const DEFAULT_TIERS = [
  { name: 'Hamlet', min: 0 },
  { name: 'Village', min: 10 },
  { name: 'Town', min: 50 },
  { name: 'City', min: 200 },
  { name: 'Metropolis', min: 1000 },
];

function requireNonNegativeInteger(value, field) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`population: ${field} must be a non-negative integer, got ${value}`);
  }
}

// The one real count this function trusts: real registered players
// (store.players) plus the real, server-ticked NPC population
// (store.npcWorld.npcs) — not a simulated/backdrop figure, an actual
// headcount of who is in the world.
export function populationTier(realPopulation, tiers = DEFAULT_TIERS) {
  requireNonNegativeInteger(realPopulation, 'realPopulation');
  // Tiers are read highest-threshold-first so a population sitting
  // exactly on two boundaries takes the higher, more specific one.
  const sorted = [...tiers].sort((a, b) => b.min - a.min);
  const tier = sorted.find((t) => realPopulation >= t.min) || sorted[sorted.length - 1];
  return { tier: tier.name, population: realPopulation };
}

export function describePopulation(playerCount, npcCount, tiers = DEFAULT_TIERS) {
  requireNonNegativeInteger(playerCount, 'playerCount');
  requireNonNegativeInteger(npcCount, 'npcCount');
  const total = playerCount + npcCount;
  const { tier } = populationTier(total, tiers);
  return { tier, population: total, players: playerCount, npcs: npcCount };
}
