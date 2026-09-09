// VOID — Mixed Transportation Sequencing.
// Source of truth: VOID_MASTER_FREEZE.md's own stated rule: "food
// deliveries generally prioritized for timely delivery to preserve
// quality; passenger safety and committed trip terms remain primary
// during routing; non-perishable packages typically sequence after
// passenger trips unless the assignment is a dedicated delivery route
// or another sequencing produces a better outcome." The doc itself
// calls Gibson's real-time final sequencing "a genuinely complex
// real-time multi-priority routing problem... should be scoped as
// real algorithmic work" -- this is a real, deterministic first-pass
// priority rule implementing the doc's own stated ordering, not a
// claim to have solved that full real-time problem (which would need
// live traffic/ETA data this session has no access to).

const STOP_TYPES = ['food', 'passenger', 'package'];
const PRIORITY_BY_TYPE = { food: 3, passenger: 2, package: 1 };

function computeSequencing(stops, options = {}) {
  const { isDedicatedDeliveryRoute = false } = options;
  if (!Array.isArray(stops) || stops.length === 0) {
    throw new Error('computeSequencing requires at least one stop');
  }
  for (const stop of stops) {
    if (!STOP_TYPES.includes(stop.type)) {
      throw new Error(`computeSequencing: invalid stop type "${stop.type}" (expected one of ${STOP_TYPES.join(', ')})`);
    }
  }

  const scored = stops.map((stop) => {
    // On a dedicated delivery route, packages aren't deprioritized
    // behind passenger stops -- the doc's own stated exception.
    const priority = stop.type === 'package' && isDedicatedDeliveryRoute
      ? PRIORITY_BY_TYPE.passenger
      : PRIORITY_BY_TYPE[stop.type];
    return { ...stop, priority };
  });

  scored.sort((a, b) => b.priority - a.priority);
  return scored;
}

module.exports = { STOP_TYPES, PRIORITY_BY_TYPE, computeSequencing };
