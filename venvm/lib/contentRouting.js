// VENVM -- length tiers and destination routing for the thousand-video
// plan.
//
// The plan is a planning document; this is the part of it that is
// actually a rule. A video has a length, that length puts it in a
// tier, the tier suits some destinations and not others, and each
// destination has a finite allocation. All four of those are things
// code can get wrong, so all four live here rather than in a spec
// somebody consults by memory.
//
// **The 250.** The allocation as specified is 350 + 200 + 100 + 100 =
// 750, against a planned 1,000. Two obvious ways to make that tidy
// would both be wrong: silently scaling the four numbers up to hit
// 1,000 invents an allocation nobody decided, and quietly changing the
// total to 750 discards a quarter of the plan. So the shortfall is a
// named constant, reported by `describePlan()`, and `UNALLOCATED` is
// its own pseudo-destination that nothing can route to. When someone
// decides where those 250 go, that decision has one place to land.
//
// **The tiers are contiguous, by decision.** They were originally
// specified as 5-15s, 30-60s, 120-300s and 300s+, which left 16-29s and
// 61-119s in no tier at all. That gap was surfaced rather than rounded
// away -- snapping a 20-second video into "Short" would have been the
// "match looser than its name" failure this repo keeps finding, where
// the classifier always answers and the answer is sometimes invented.
//
// The gap was then closed deliberately, by extending the existing
// boundaries rather than inventing a fifth tier for the orphans:
// Short 5-19s, Medium 20-59s, Long-form 60-299s, Flagship 300s+.
//
// **The floor stays.** Below 5s is still in no tier -- that is a real
// lower bound on the plan, not a gap between tiers, and a 2-second clip
// is not a Short. `classifyLength` still returns `null` with a reason
// there, and still refuses to guess. `assertContiguous()` below proves
// there is no hole *between* tiers, so the one remaining refusal is
// the floor and nothing else.
//
// **What this does not do.** It does not publish, transcode, or call
// any destination. `crossPlatformReformat.js` already owns per-platform
// aspect ratio and duration limits, and those are a different question
// (what a platform accepts) from this one (what the plan intends).

class RoutingError extends Error {}

// Exactly the tiers named in THOUSAND_VIDEO_CONTENT_PLAN.md. `maxSec`
// null means open-ended.
const LENGTH_TIERS = [
  { key: 'short', label: 'Short', minSec: 5, maxSec: 19 },
  { key: 'medium', label: 'Medium', minSec: 20, maxSec: 59 },
  { key: 'long-form', label: 'Long-form', minSec: 60, maxSec: 299 },
  { key: 'flagship', label: 'Flagship', minSec: 300, maxSec: null },
];

// The tier floor. A video shorter than this is in no tier, and that is
// a deliberate lower bound rather than a gap.
const MIN_TIER_SEC = LENGTH_TIERS[0].minSec;

// Proves the property the tiers were changed to have. Called by the
// test rather than at load, but exported so the invariant lives with
// the data it describes instead of only in a test file.
function assertContiguous() {
  const holes = [];
  for (let i = 0; i < LENGTH_TIERS.length - 1; i += 1) {
    const here = LENGTH_TIERS[i];
    const next = LENGTH_TIERS[i + 1];
    if (here.maxSec === null) holes.push(`${here.key} is open-ended but is not last`);
    else if (next.minSec !== here.maxSec + 1) {
      holes.push(
        `${here.key} ends at ${here.maxSec}s and ${next.key} starts at ${next.minSec}s`
        + ` -- ${next.minSec - here.maxSec - 1} second(s) belong to no tier`,
      );
    }
  }
  if (LENGTH_TIERS[LENGTH_TIERS.length - 1].maxSec !== null) {
    holes.push('the last tier is not open-ended, so long videos fall off the end');
  }
  return holes;
}

const PLANNED_TOTAL = 1000;

// Destinations, their allocation, and which tiers actually suit them.
// `app` is the real directory in this repo that receives the content --
// checked by the test, so a destination cannot point at an app that
// does not exist.
const DESTINATIONS = [
  {
    key: 'dreams-vmall',
    label: 'DREAMS / VMall screens',
    app: 'dreams',
    allocation: 350,
    // Screen content in a retail space is watched in passing. Nothing
    // long-form belongs on it.
    tiers: ['short', 'medium'],
    // VMall is not a separate app and correctly has none: it is a
    // physical location where DREAMS screens are installed. HVNTZ's own
    // revenue-stack document puts it plainly -- "installed for
    // DREAMS/VMall, just a new function on the same screen."
    note: 'VMall is a placement of the DREAMS screen network, not a separate service',
  },
  {
    key: 'hvntz-business',
    label: 'HVNTZ business content',
    app: 'hvntz',
    allocation: 200,
    tiers: ['medium', 'long-form'],
  },
  {
    key: 'vulture-flix',
    label: 'Vvltvre Flix',
    app: 'vulture-flix',
    allocation: 100,
    // A catalogue title. Fifteen seconds is not one.
    tiers: ['long-form', 'flagship'],
  },
  {
    key: 'social',
    label: 'VXLLAGE / CHOPZ social',
    app: 'vxllage',
    secondaryApp: 'chopz',
    allocation: 100,
    tiers: ['short', 'medium'],
  },
];

const ALLOCATED = DESTINATIONS.reduce((n, d) => n + d.allocation, 0);
const UNALLOCATED = PLANNED_TOTAL - ALLOCATED;

function getDestination(key) {
  return DESTINATIONS.find((d) => d.key === key) || null;
}

function getTier(key) {
  return LENGTH_TIERS.find((t) => t.key === key) || null;
}

// Returns `{ tier }` or `{ tier: null, reason }`. Never guesses.
function classifyLength(durationSeconds) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return { tier: null, reason: `durationSeconds must be a positive number, got ${durationSeconds}` };
  }
  for (const tier of LENGTH_TIERS) {
    const overMin = durationSeconds >= tier.minSec;
    const underMax = tier.maxSec === null || durationSeconds <= tier.maxSec;
    if (overMin && underMax) return { tier: tier.key, reason: null };
  }
  // The tiers are contiguous, so the only way to reach here with a
  // positive number is to be under the floor. Kept as a general
  // between-tiers message anyway: if someone edits LENGTH_TIERS and
  // reopens a gap, this still says something true rather than
  // something confidently wrong -- and `assertContiguous()` fails.
  if (durationSeconds < MIN_TIER_SEC) {
    return {
      tier: null,
      reason: `${durationSeconds}s is below the ${MIN_TIER_SEC}s floor — shorter than `
        + `${LENGTH_TIERS[0].label}. Too short to route; it will not be rounded up.`,
    };
  }
  const below = LENGTH_TIERS.filter((t) => durationSeconds > (t.maxSec ?? Infinity)).pop();
  const above = LENGTH_TIERS.find((t) => durationSeconds < t.minSec);
  return {
    tier: null,
    reason: `${durationSeconds}s falls between tiers`
      + (below ? ` — longer than ${below.label} (max ${below.maxSec}s)` : '')
      + (above ? ` and shorter than ${above.label} (min ${above.minSec}s)` : '')
      + '. The tiers are meant to be contiguous, so this is a bug in LENGTH_TIERS,'
      + ' not in the video.',
  };
}

function tiersFor(destinationKey) {
  const dest = getDestination(destinationKey);
  return dest ? [...dest.tiers] : [];
}

// How many of a destination's allocation are already committed.
// `produced` is the caller's own count -- VENVM's job store is the
// record of what exists, and a second tally here would be a second
// truth about the same fact.
function remainingFor(destinationKey, produced = {}) {
  const dest = getDestination(destinationKey);
  if (!dest) throw new RoutingError(`remainingFor: no destination "${destinationKey}"`);
  const used = produced[destinationKey] ?? 0;
  return Math.max(0, dest.allocation - used);
}

// The one gate. Called before a job is created, so a video that could
// never be routed is never produced.
function assertRoutable(options = {}) {
  const a = 'assertRoutable';
  const { destination, durationSeconds, produced = {} } = options;

  const dest = getDestination(destination);
  if (!dest) {
    throw new RoutingError(
      `${a}: no destination "${destination}". Known: ${DESTINATIONS.map((d) => d.key).join(', ')}`,
    );
  }

  const { tier, reason } = classifyLength(durationSeconds);
  if (!tier) throw new RoutingError(`${a}: ${reason}`);

  if (!dest.tiers.includes(tier)) {
    throw new RoutingError(
      `${a}: a "${tier}" video does not belong on ${dest.label}, which takes `
      + `${dest.tiers.join(' or ')}`,
    );
  }

  const left = remainingFor(destination, produced);
  if (left <= 0) {
    throw new RoutingError(
      `${a}: ${dest.label} has used its full allocation of ${dest.allocation}. `
      + `${UNALLOCATED} of the ${PLANNED_TOTAL} planned videos are still unassigned to any `
      + 'destination — that is the pool to draw from, once somebody decides where it goes.',
    );
  }

  return { destination: dest.key, tier, remaining: left };
}

// Every tier that no destination accepts. Empty today; a guard against
// a future tier being added and quietly having nowhere to go.
function orphanTiers() {
  const claimed = new Set(DESTINATIONS.flatMap((d) => d.tiers));
  return LENGTH_TIERS.filter((t) => !claimed.has(t.key)).map((t) => t.key);
}

function describePlan(produced = {}) {
  return {
    plannedTotal: PLANNED_TOTAL,
    allocated: ALLOCATED,
    unallocated: UNALLOCATED,
    destinations: DESTINATIONS.map((d) => ({
      key: d.key,
      label: d.label,
      allocation: d.allocation,
      remaining: remainingFor(d.key, produced),
      tiers: d.tiers,
    })),
    tiers: LENGTH_TIERS.map((t) => ({
      key: t.key,
      range: t.maxSec === null ? `${t.minSec}s+` : `${t.minSec}-${t.maxSec}s`,
    })),
    orphanTiers: orphanTiers(),
    // Stated on the health surface so the shortfall is visible rather
    // than something rediscovered by adding the numbers up again.
    note: UNALLOCATED > 0
      ? `${UNALLOCATED} of ${PLANNED_TOTAL} videos are not assigned to any destination. `
        + 'The four allocations sum to ' + ALLOCATED + '; the gap is deliberate and undecided.'
      : 'every planned video is allocated',
  };
}

module.exports = {
  RoutingError,
  LENGTH_TIERS,
  MIN_TIER_SEC,
  assertContiguous,
  DESTINATIONS,
  PLANNED_TOTAL,
  ALLOCATED,
  UNALLOCATED,
  getDestination,
  getTier,
  classifyLength,
  tiersFor,
  remainingFor,
  assertRoutable,
  orphanTiers,
  describePlan,
};
