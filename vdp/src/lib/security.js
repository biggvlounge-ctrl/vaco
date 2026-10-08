// VDP — Security: cameras and robot patrols scale with real crime.
//
// Direct instruction (8 Oct 2026): "everything will be camera
// secured... at the beginning there will just be basic security
// features and then it will increase as crime increases and things
// increase the robots will increase for policing." A real,
// deterministic tier derived from the settlement's own real crime
// count -- never a separate, invented crime-rate simulation. The
// count itself comes from real records this world already keeps
// (`justice.js`'s tickets/detentions, `immigration.js`'s illegal
// arrivals/active illegal settlements, `property.js`'s unauthorized
// structures); this module only turns a real number into a real tier,
// the same shape `population.js`'s own `DEFAULT_TIERS` already uses
// for population.
//
// `DEFAULT_SECURITY_TIERS` is a flagged interpretive ladder -- no
// document gives VDP a real crime-to-security-level formula.
// `cameraCount`/`robotCount` are the real, named security features
// "camera secured" and "robots... for policing" ask for, scaled by
// tier rather than invented per-area.

export const DEFAULT_SECURITY_TIERS = [
  { name: 'Basic', min: 0, cameraCount: 4, robotCount: 1 },
  { name: 'Elevated', min: 5, cameraCount: 10, robotCount: 2 },
  { name: 'High Alert', min: 15, cameraCount: 20, robotCount: 4 },
  { name: 'Maximum Security', min: 30, cameraCount: 40, robotCount: 8 },
];

function requireNonNegativeInteger(value, field) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`security: ${field} must be a non-negative integer, got ${value}`);
  }
}

// A real sum of real counts -- never a hidden roll. Each count is the
// caller's own real measurement (`server.cjs` reads them straight off
// `store.justice`/`store.immigration`/`store.property`), named so a
// caller can see exactly what is and is not counted as crime.
export function measureCrime({
  ticketCount = 0, detentionCount = 0, illegalArrivalCount = 0,
  illegalSettlementCount = 0, unauthorizedStructureCount = 0,
} = {}) {
  const counts = { ticketCount, detentionCount, illegalArrivalCount, illegalSettlementCount, unauthorizedStructureCount };
  for (const [field, value] of Object.entries(counts)) {
    requireNonNegativeInteger(value, field);
  }
  return ticketCount + detentionCount + illegalArrivalCount + illegalSettlementCount + unauthorizedStructureCount;
}

// Tiers are read highest-threshold-first, same convention
// `population.js`'s `populationTier` already uses, so a crime count
// sitting exactly on two boundaries takes the higher, more specific
// tier.
export function securityTierFor(crimeCount, tiers = DEFAULT_SECURITY_TIERS) {
  requireNonNegativeInteger(crimeCount, 'crimeCount');
  const sorted = [...tiers].sort((a, b) => b.min - a.min);
  const tier = sorted.find((t) => crimeCount >= t.min) || sorted[sorted.length - 1];
  return { ...tier, crimeCount };
}
