// VDP — Rankings: the one real "league leader" mechanism, reused
// everywhere rather than rebuilt per entity.
//
// Per direct instruction (14 Oct 2026): "use this same league leader
// statistic style for everything that you can, so it makes the game
// just as fun statistically as sports... this team or this
// organization, this tribe, this group leads in this. This has the
// most this. They lead in this organization, in trade, or they trade
// the most this."
//
// `leaderboards.js` (fighter win/loss) and `teamStandings.js` (team
// win/loss/ties, player points) each already rank a real population
// by a real number -- and each one hand-wrote its own sort. This
// module is the one real piece that was actually repeated three
// times: given any real population and a real number to read off
// each member, rank it. It replaces nothing those two files already
// do (their own tie-breaking rules -- win rate, point differential --
// are real per-sport facts this generic function has no business
// deciding), and is the one new, small, reusable thing every ranking
// built from here on reaches for first, the same way `clamp` is
// reached for in a dozen files rather than redefined in each one.
//
// `rankBy` takes records already shaped as real `{ id, value }` pairs
// -- it does not know what a civilization, an organization, or a
// business IS, on purpose. Shaping real domain data into that pair is
// the caller's own job (see `civilizations.js`'s `statistics`,
// `organizations.js`'s `cohesion`, `property.js`'s `totalRevenue`),
// the same decoupled-by-injection discipline every cross-module call
// in this directory already uses.

// A real population to rank, excluded by default, is one with no real
// measured value at all (`null`/`undefined`) -- the same "unranked is
// not the same fact as a real zero" distinction `leaderboards.js`'s
// own `recordFor` already draws. `includeZero` defaults to true
// because, unlike a fighter's win/loss record, most of the real
// numbers this module ranks (wealth, population, cohesion) are
// meaningful at zero.
export function rankBy(records, { limit = 10, includeZero = true } = {}) {
  if (!Array.isArray(records)) throw new Error('rankBy requires a real array of {id, value} records');
  return records
    .filter((r) => r && r.value !== null && r.value !== undefined && (includeZero || r.value !== 0))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

// The honest inverse -- "who is LAST in this," a real fact a leader
// board alone cannot answer (sorting descending and reading the tail
// is not the same question when a limit truncates the list first).
export function rankByAscending(records, { limit = 10, includeZero = true } = {}) {
  if (!Array.isArray(records)) throw new Error('rankByAscending requires a real array of {id, value} records');
  return records
    .filter((r) => r && r.value !== null && r.value !== undefined && (includeZero || r.value !== 0))
    .sort((a, b) => a.value - b.value)
    .slice(0, limit);
}

// Where a single real id sits in its own real population, 1-indexed
// -- "who leads" is half the real question a player asks; "where do
// I rank" is the other half, and it needs the FULL real population,
// never a board already truncated by `limit`.
export function rankOf(records, id) {
  const ranked = rankBy(records, { limit: Infinity });
  const index = ranked.findIndex((r) => r.id === id);
  return index === -1 ? null : index + 1;
}
