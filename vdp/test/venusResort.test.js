// Venus Resort Complex -- the walkable casino's own rules.
//
// VDP's first test suite. Its lib modules are pure functions over
// plain state, which makes them straightforwardly testable; there was
// simply never a `vdp/test/` for `run-all-tests.mjs` to discover.
//
// Every assertion here was watched failing against a reintroduced bug
// before being trusted, per
// `dev-docs/STANDING_INSTRUCTION_TEST_VERIFICATION.md`. Three of them
// initially passed for the wrong reason and are noted where they sit.

import test from "node:test";
import assert from "node:assert";

import {
  RESORT_NAME, VENUES, TABLES, NPCS, CURRENCY, CROSSING_MS, DOCK_RADIUS, ENTRY_RADIUS,
  ResortError,
  createResortState, movePlayer, getCameraOffset, getNearbyTable, isAtDock, isAboard,
  seatPlayer, standUp, boardWaterTaxi, arriveIfDue, crossingProgress, otherVenueId,
  getVenue, tablesInVenue, dealerForTable, isTableOpen, assertNoRealMoney, describeResort,
} from "../src/lib/venusResort.js";

const land = getVenue("land");
const boat = getVenue("riverboat");

// Walk the player to a point, bypassing movement -- these tests are
// about the rules, not about pathfinding.
function at(state, venueId, x, y) {
  state.venueId = venueId;
  state.x = x;
  state.y = y;
  state.crossing = null;
  return state;
}

// -- The complex itself --------------------------------------------------

test("two venues, and they are separate places rather than adjacent rooms", () => {
  assert.equal(VENUES.length, 2);
  assert.deepEqual(VENUES.map((v) => v.id).sort(), ["land", "riverboat"]);
  // Each has its own dock. Without one on both shores a crossing is
  // one-way and the player is stranded.
  for (const v of VENUES) {
    assert.ok(v.landing, `${v.id} has no landing`);
    assert.ok(v.landing.x >= 0 && v.landing.x <= v.width, `${v.id} landing outside the venue`);
    assert.ok(v.landing.y >= 0 && v.landing.y <= v.height, `${v.id} landing outside the venue`);
  }
});

test("every table sits in a real venue and every NPC stands in one", () => {
  const ids = new Set(VENUES.map((v) => v.id));
  for (const t of TABLES) assert.ok(ids.has(t.venueId), `table ${t.id} is in nonexistent ${t.venueId}`);
  for (const n of NPCS) assert.ok(ids.has(n.venueId), `npc ${n.id} is in nonexistent ${n.venueId}`);
});

test("a dealer stands in the same venue as the table they are assigned to", () => {
  // The failure this catches is quiet: a dealer assigned across the
  // water opens a table nobody is standing at.
  for (const npc of NPCS.filter((n) => n.assignedTableId)) {
    const table = TABLES.find((t) => t.id === npc.assignedTableId);
    assert.ok(table, `${npc.id} is assigned to nonexistent table ${npc.assignedTableId}`);
    assert.equal(
      npc.venueId, table.venueId,
      `${npc.name} is in ${npc.venueId} but ${table.id} is in ${table.venueId}`,
    );
  }
});

test("the fixture contains both a staffed and an unstaffed table", () => {
  // Guard on the fixture, not on the code. The closed-table rule below
  // is worth nothing if every table in the data happens to have a
  // dealer -- the test would pass without ever reaching the branch.
  const open = TABLES.filter((t) => isTableOpen(t.id));
  const closed = TABLES.filter((t) => !isTableOpen(t.id));
  assert.ok(open.length > 0, "no open table to seat at");
  assert.ok(closed.length > 0, "no closed table -- the dealer guard is never exercised");
});

// -- Movement ------------------------------------------------------------

test("movement clamps to the venue the player is actually standing in", () => {
  const s = at(createResortState(), "riverboat", 10, 10);
  movePlayer(s, -500, -500);
  assert.equal(s.x, 0);
  assert.equal(s.y, 0);
  movePlayer(s, 5000, 5000);
  // Clamped to the riverboat's bounds, not the land casino's larger ones.
  assert.equal(s.x, boat.width);
  assert.equal(s.y, boat.height);
  assert.ok(boat.width < land.width, "fixture no longer distinguishes the two venues' widths");
});

test("the camera never scrolls past the edge of the current venue", () => {
  const s = at(createResortState(), "land", land.width, land.height);
  const cam = getCameraOffset(s);
  assert.ok(cam.x <= land.width - 400, `camera x ${cam.x} ran past the venue`);
  assert.ok(cam.y <= land.height - 220, `camera y ${cam.y} ran past the venue`);
  assert.ok(cam.x >= 0 && cam.y >= 0);
});

test("getNearbyTable only ever offers a table in the current venue", () => {
  const boatTable = TABLES.find((t) => t.venueId === "riverboat");
  // Stand at the riverboat table's coordinates -- but on land.
  const s = at(createResortState(), "land", boatTable.x, boatTable.y);
  const near = getNearbyTable(s);
  if (near) assert.equal(near.venueId, "land", "offered a table from the other shore");
});

// -- Seating -------------------------------------------------------------

test("seating requires standing in the same venue as the table", () => {
  const boatTable = TABLES.find((t) => t.venueId === "riverboat" && isTableOpen(t.id));
  const s = at(createResortState(), "land", boatTable.x, boatTable.y);
  assert.throws(
    () => seatPlayer(s, boatTable.id),
    (err) => err instanceof ResortError && /water taxi/.test(err.message),
    "seated a player at a table across the water",
  );
  assert.equal(s.seatedAtTableId, null);
});

test("a table with no dealer is closed, and says so", () => {
  const closed = TABLES.find((t) => !isTableOpen(t.id));
  const s = at(createResortState(), closed.venueId, closed.x, closed.y);
  assert.throws(
    () => seatPlayer(s, closed.id),
    // Asserting on the reason, not just that it threw: the venue check
    // above also throws, and an early version of this test passed
    // because the fixture put the unstaffed table on the far shore --
    // proving the wrong rule entirely.
    (err) => err instanceof ResortError && /no dealer/.test(err.message),
    "seated a player at an unstaffed table",
  );
});

test("a full table refuses the next player", () => {
  const open = TABLES.find((t) => isTableOpen(t.id));
  const s = at(createResortState(), open.venueId, open.x, open.y);
  assert.throws(
    () => seatPlayer(s, open.id, { occupantsByTable: { [open.id]: open.seats } }),
    (err) => err instanceof ResortError && /full/.test(err.message),
  );
  // One free seat is still a seat.
  seatPlayer(s, open.id, { occupantsByTable: { [open.id]: open.seats - 1 } });
  assert.equal(s.seatedAtTableId, open.id);
});

test("seating at an unknown table is refused rather than silently recorded", () => {
  const s = createResortState();
  assert.throws(() => seatPlayer(s, "no-such-table"), /no table/);
  assert.equal(s.seatedAtTableId, null);
});

// -- The water taxi ------------------------------------------------------

test("boarding requires being at the dock", () => {
  const s = at(createResortState(), "land", 0, 0);
  assert.ok(!isAtDock(s));
  assert.throws(() => boardWaterTaxi(s), (err) => /dock|landing/.test(err.message));
  assert.equal(isAboard(s), false);
});

test("the dock is tighter than the table hitbox, deliberately", () => {
  assert.ok(DOCK_RADIUS < ENTRY_RADIUS, "boarding from across the room is a bug, not a convenience");
});

test("a crossing takes real time and lands the player on the other shore", () => {
  const s = at(createResortState(), "land", land.landing.x, land.landing.y);
  assert.ok(isAtDock(s));

  boardWaterTaxi(s, { now: 1000 });
  assert.ok(isAboard(s));
  assert.equal(s.crossing.to, "riverboat");

  // Mid-crossing: in neither venue, and cannot walk.
  arriveIfDue(s, { now: 1000 + CROSSING_MS - 1 });
  assert.ok(isAboard(s), "arrived before the crossing was due");
  const before = { x: s.x, y: s.y };
  movePlayer(s, 100, 100);
  assert.deepEqual({ x: s.x, y: s.y }, before, "walked on water");
  assert.equal(getNearbyTable(s), null, "offered a table while aboard");

  arriveIfDue(s, { now: 1000 + CROSSING_MS });
  assert.equal(isAboard(s), false);
  assert.equal(s.venueId, "riverboat");
  assert.deepEqual({ x: s.x, y: s.y }, { x: boat.landing.x, y: boat.landing.y });
});

test("boarding stands the player up -- a seat is never held across the water", () => {
  // The bug the two-venue design makes possible, and the reason
  // boarding does this itself rather than asking the caller to.
  const open = TABLES.find((t) => t.venueId === "land" && isTableOpen(t.id));
  const s = at(createResortState(), "land", open.x, open.y);
  seatPlayer(s, open.id);
  assert.equal(s.seatedAtTableId, open.id);

  at(s, "land", land.landing.x, land.landing.y);
  s.seatedAtTableId = open.id;          // still seated, now standing at the dock
  boardWaterTaxi(s, { now: 0 });

  assert.equal(s.seatedAtTableId, null, "kept a seat on the far shore while aboard");
});

test("you cannot seat yourself while aboard", () => {
  const s = at(createResortState(), "land", land.landing.x, land.landing.y);
  boardWaterTaxi(s, { now: 0 });
  const open = TABLES.find((t) => isTableOpen(t.id));
  assert.throws(
    () => seatPlayer(s, open.id),
    (err) => /aboard/.test(err.message),
  );
});

test("boarding twice is refused rather than restarting the crossing", () => {
  const s = at(createResortState(), "land", land.landing.x, land.landing.y);
  boardWaterTaxi(s, { now: 0 });
  const departedAt = s.crossing.departedAt;
  assert.throws(() => boardWaterTaxi(s, { now: 5000 }), /already aboard/);
  assert.equal(s.crossing.departedAt, departedAt, "a second board reset the clock");
});

test("arrival is read from the clock, so a missed tick cannot strand the player", () => {
  const s = at(createResortState(), "land", land.landing.x, land.landing.y);
  boardWaterTaxi(s, { now: 0 });
  // Nothing ticked for an hour. The player still arrives.
  arriveIfDue(s, { now: 60 * 60 * 1000 });
  assert.equal(isAboard(s), false);
  assert.equal(s.venueId, "riverboat");
});

test("crossingProgress runs 0 to 1 and stops there", () => {
  const s = at(createResortState(), "land", land.landing.x, land.landing.y);
  assert.equal(crossingProgress(s), null, "reported progress while not aboard");
  boardWaterTaxi(s, { now: 0 });
  assert.equal(crossingProgress(s, 0), 0);
  assert.equal(crossingProgress(s, CROSSING_MS / 2), 0.5);
  assert.equal(crossingProgress(s, CROSSING_MS * 10), 1, "progress ran past 1");
});

test("the taxi alternates shores rather than always sailing to the boat", () => {
  assert.equal(otherVenueId("land"), "riverboat");
  assert.equal(otherVenueId("riverboat"), "land");

  const s = at(createResortState(), "riverboat", boat.landing.x, boat.landing.y);
  boardWaterTaxi(s, { now: 0 });
  assert.equal(s.crossing.to, "land", "the return leg did not go back to land");
});

// -- Compliance ----------------------------------------------------------

test("the resort settles in-world only, and throws on anything else", () => {
  assert.equal(assertNoRealMoney(CURRENCY), CURRENCY);
  for (const real of ["usd", "USD", "vash", "card"]) {
    assert.throws(
      () => assertNoRealMoney(real),
      (err) => err instanceof ResortError && /compliance/.test(err.message),
      `${real} was accepted as a settlement currency`,
    );
  }
});

test("CURRENCY is vcoin -- the in-world unit, asserted rather than assumed", () => {
  assert.equal(CURRENCY, "vcoin");
});

// -- Description ---------------------------------------------------------

test("describeResort reports the venue the player is really in", () => {
  const s = at(createResortState(), "riverboat", 10, 10);
  const d = describeResort(s);
  assert.equal(d.resort, RESORT_NAME);
  assert.equal(d.venue, boat.name);
  // Only this venue's tables and staff -- not the whole complex's.
  assert.deepEqual(
    d.tables.map((t) => t.id).sort(),
    tablesInVenue("riverboat").map((t) => t.id).sort(),
  );
  assert.ok(d.tables.some((t) => t.open === false), "no closed table surfaced to the player");
  assert.ok(d.tables.some((t) => t.dealer !== null), "no dealer named");
});

test("describeResort says you are aboard rather than naming a venue you are not in", () => {
  const s = at(createResortState(), "land", land.landing.x, land.landing.y);
  boardWaterTaxi(s, { now: 0 });
  const d = describeResort(s);
  assert.equal(d.aboard, true);
  assert.match(d.venue, /water taxi/);
  assert.deepEqual(d.tables, [], "offered tables while the player was on a boat");
});

test("dealerForTable and isTableOpen agree", () => {
  for (const t of TABLES) {
    assert.equal(isTableOpen(t.id), dealerForTable(t.id) !== null, `disagreement on ${t.id}`);
  }
});
