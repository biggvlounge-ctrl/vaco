// VDP -- the Venus Resort Complex: the casino as a real, walkable
// place, per `vdp/VDP_CASINO_FIRST_STARTER_WORLD.md`'s own framing --
// "the casino as the deliberate centerpiece, not one feature among
// equals," and its supporting components "needed to make the casino a
// real, functioning centerpiece, not a standalone feature."
//
// **What changed, and what did not.** `world.js` already had a `vago`
// district, but as `contentType: 'vago-embed'` -- VDP's own taxonomy
// for a lounge-style doorway into the standalone app. A doorway is not
// a place. This module is the place; `VagoView` and `vagoClient.js`
// stay exactly as they were and remain how the actual game is played.
//
// **The split, stated once so it is not re-litigated per feature.**
// VDP owns the *venue*: where you are standing, how you cross the
// water, who is staffing the table. VAGO owns the *game and the money*
// -- `vagoClient.js`'s own header already says it, "no game logic lives
// here, every real number comes back from VAGO's own server," and
// nothing below moves a balance. That is not a limitation to fix
// later; a second place where stakes are computed is how two systems
// start disagreeing about what somebody is owed.
//
// **Two venues, not one floor, and the water between them is the
// point.** The source document asks for a "riverboat + land casino
// complex" connected by "VOID water taxis." Modelled literally: the
// two venues are not adjacent cells you can walk between. The taxi is
// the only crossing, a crossing takes real time, and a player who is
// aboard is in neither venue. That constraint is the reason the taxi
// exists at all -- make the venues walkable-adjacent and the water
// taxi becomes decoration.
//
// **The bug this shape creates, and why it is guarded.** Once a player
// can be moved between venues while seated, "seated at a table" and
// "standing in the room" can disagree, and the table on the far shore
// keeps a seat held for somebody who is now on a boat. So seating is
// checked against the player's *current* venue on every call, and
// boarding clears the seat rather than trusting the caller to.
//
// **Compliance, per the source document's own flag.** It names "the
// real compliance review already flagged for gambling-adjacent
// mechanics, before anything real-money-adjacent goes live." That
// review is not recorded as complete anywhere in this repo, so nothing
// here opens a real-money path: `CURRENCY` is in-world only and
// `assertNoRealMoney` refuses anything else, loudly, rather than
// leaving it to a code reviewer to notice.

export const RESORT_NAME = "Venus Resort Complex";

// -- The complex ---------------------------------------------------------

// Two venues. `landing` on each is the dock cell -- where the water
// taxi calls, and the only tile a crossing may start or end at.
export const VENUES = [
  {
    id: "land",
    name: "Venus Grand (land)",
    width: 580,
    height: 300,
    landing: { x: 540, y: 150 },
  },
  {
    id: "riverboat",
    name: "The Venus Queen (riverboat)",
    width: 380,
    height: 240,
    landing: { x: 40, y: 120 },
  },
];

export const VIEWPORT_WIDTH = 400;
export const VIEWPORT_HEIGHT = 220;
export const MOVE_STEP = 16;
export const ENTRY_RADIUS = 40;

// How close you must be to the dock to board. Deliberately tighter
// than ENTRY_RADIUS: boarding a boat from across the room is the kind
// of forgiving hitbox that later reads as a bug.
export const DOCK_RADIUS = 28;

// A crossing is not instant. VOID's water taxi is a real vehicle in
// the fiction and a real state in the code -- there is a moment where
// the player is aboard and in neither venue, which is exactly the
// state the seating guard below has to survive.
export const CROSSING_MS = 12000;

// In-world only. See the compliance note in the header.
export const CURRENCY = "vcoin";

// -- Floor: tables and the staff who open them ---------------------------

// The source document's "real NPC population with gambling/hospitality
// -relevant skills (dealers, hosts, security)" -- modelled as roles
// because the roles do different work, not as flavour text.
export const NPC_ROLES = ["dealer", "host", "security"];

export const TABLES = [
  { id: "mines-1", venueId: "land", name: "Mines I", game: "originals", x: 120, y: 90, seats: 4 },
  { id: "mines-2", venueId: "land", name: "Mines II", game: "originals", x: 300, y: 90, seats: 4 },
  { id: "plinko-1", venueId: "land", name: "Plinko Pit", game: "originals", x: 210, y: 220, seats: 6 },
  { id: "mines-boat", venueId: "riverboat", name: "Stateroom Mines", game: "originals", x: 200, y: 80, seats: 3 },
  { id: "high-limit", venueId: "riverboat", name: "High Limit Salon", game: "originals", x: 200, y: 180, seats: 2 },
];

export const NPCS = [
  { id: "npc-dealer-1", role: "dealer", name: "Rosa", venueId: "land", assignedTableId: "mines-1" },
  { id: "npc-dealer-2", role: "dealer", name: "Ike", venueId: "land", assignedTableId: "plinko-1" },
  { id: "npc-dealer-3", role: "dealer", name: "Marisol", venueId: "riverboat", assignedTableId: "mines-boat" },
  { id: "npc-host-1", role: "host", name: "Devan", venueId: "land", assignedTableId: null },
  { id: "npc-host-2", role: "host", name: "Perry", venueId: "riverboat", assignedTableId: null },
  { id: "npc-security-1", role: "security", name: "Okonkwo", venueId: "land", assignedTableId: null },
  { id: "npc-security-2", role: "security", name: "Britt", venueId: "riverboat", assignedTableId: null },
];

// Deliberately: `mines-2` and `high-limit` have no dealer. An
// unstaffed table is the normal case in a real room, and the guard
// below is worth nothing if the fixture never exercises it.

export class ResortError extends Error {}

export function getVenue(venueId) {
  return VENUES.find((v) => v.id === venueId) || null;
}

export function tablesInVenue(venueId) {
  return TABLES.filter((t) => t.venueId === venueId);
}

export function staffInVenue(venueId) {
  return NPCS.filter((n) => n.venueId === venueId);
}

export function dealerForTable(tableId) {
  return NPCS.find((n) => n.role === "dealer" && n.assignedTableId === tableId) || null;
}

// A table is open when a dealer is standing at it. Derived, never
// stored: a stored `isOpen` flag and an absent dealer can disagree,
// and then the room says a table is open while nobody can deal.
export function isTableOpen(tableId) {
  return dealerForTable(tableId) !== null;
}

// -- Player state --------------------------------------------------------

export function createResortState() {
  const land = getVenue("land");
  return {
    venueId: "land",
    x: land.width / 2,
    y: land.height - 10,
    seatedAtTableId: null,
    // Non-null only while aboard the taxi, i.e. in neither venue.
    crossing: null,
  };
}

export function isAboard(state) {
  return state.crossing !== null;
}

export function movePlayer(state, dx, dy) {
  if (isAboard(state)) return state;      // you cannot walk on water
  const venue = getVenue(state.venueId);
  state.x = Math.max(0, Math.min(venue.width, state.x + dx));
  state.y = Math.max(0, Math.min(venue.height, state.y + dy));
  return state;
}

export function getCameraOffset(state) {
  const venue = getVenue(state.venueId);
  return {
    x: Math.max(0, Math.min(Math.max(0, venue.width - VIEWPORT_WIDTH), state.x - VIEWPORT_WIDTH / 2)),
    y: Math.max(0, Math.min(Math.max(0, venue.height - VIEWPORT_HEIGHT), state.y - VIEWPORT_HEIGHT / 2)),
  };
}

export function getNearbyTable(state) {
  if (isAboard(state)) return null;
  let closest = null;
  let closestDist = Infinity;
  for (const table of tablesInVenue(state.venueId)) {
    const dist = Math.hypot(state.x - table.x, state.y - table.y);
    if (dist <= ENTRY_RADIUS && dist < closestDist) {
      closest = table;
      closestDist = dist;
    }
  }
  return closest;
}

export function isAtDock(state) {
  if (isAboard(state)) return false;
  const { landing } = getVenue(state.venueId);
  return Math.hypot(state.x - landing.x, state.y - landing.y) <= DOCK_RADIUS;
}

// -- Seating -------------------------------------------------------------

// `occupantsByTable` is the caller's own live count -- VDP does not
// hold other players' state, so the room's fullness comes from
// whatever is tracking presence, not from this module inventing it.
export function seatPlayer(state, tableId, options = {}) {
  const { occupantsByTable = {} } = options;
  const a = "seatPlayer";

  if (isAboard(state)) {
    throw new ResortError(`${a}: you are aboard the water taxi, not in a room`);
  }

  const table = TABLES.find((t) => t.id === tableId);
  if (!table) throw new ResortError(`${a}: no table "${tableId}"`);

  // **The guard the two-venue design exists to need.** Checked against
  // the player's current venue on every call rather than at seat time
  // only, so a table on the far shore can never hold a seat for
  // somebody who has since crossed.
  if (table.venueId !== state.venueId) {
    throw new ResortError(
      `${a}: "${table.name}" is in ${getVenue(table.venueId).name}, and you are in `
      + `${getVenue(state.venueId).name} -- take the water taxi`,
    );
  }

  if (!isTableOpen(tableId)) {
    throw new ResortError(`${a}: "${table.name}" has no dealer and is closed`);
  }

  const occupied = occupantsByTable[tableId] ?? 0;
  if (occupied >= table.seats) {
    throw new ResortError(`${a}: "${table.name}" is full (${table.seats} seats)`);
  }

  state.seatedAtTableId = tableId;
  return state;
}

export function standUp(state) {
  state.seatedAtTableId = null;
  return state;
}

// -- The VOID water taxi -------------------------------------------------

export function otherVenueId(venueId) {
  return venueId === "land" ? "riverboat" : "land";
}

export function boardWaterTaxi(state, options = {}) {
  const { now = Date.now() } = options;
  const a = "boardWaterTaxi";

  if (isAboard(state)) throw new ResortError(`${a}: you are already aboard`);
  if (!isAtDock(state)) {
    throw new ResortError(`${a}: the water taxi calls at the dock -- walk to the landing first`);
  }

  // Standing up is done here rather than asked of the caller. A
  // crossing that leaves a seat held on the far shore is exactly the
  // inconsistency this module is shaped to prevent, and "the caller
  // remembers to stand up first" is not a guarantee.
  state.seatedAtTableId = null;

  const to = otherVenueId(state.venueId);
  state.crossing = { from: state.venueId, to, departedAt: now, arrivesAt: now + CROSSING_MS };
  return state;
}

export function crossingProgress(state, now = Date.now()) {
  if (!isAboard(state)) return null;
  const { departedAt, arrivesAt } = state.crossing;
  const span = arrivesAt - departedAt;
  return Math.max(0, Math.min(1, (now - departedAt) / span));
}

// Arrival is a fact about the clock, not a thing the UI decides. It is
// checked on read rather than fired by a timer, for the same reason a
// grant's expiry is read on every call: a timer that never fires
// leaves the player on the boat forever.
export function arriveIfDue(state, options = {}) {
  const { now = Date.now() } = options;
  if (!isAboard(state)) return state;
  if (now < state.crossing.arrivesAt) return state;

  const venue = getVenue(state.crossing.to);
  state.venueId = venue.id;
  state.x = venue.landing.x;
  state.y = venue.landing.y;
  state.crossing = null;
  return state;
}

// -- Compliance ----------------------------------------------------------

// Called by anything about to hand a currency to VAGO. Throws rather
// than warns, matching the ecosystem's own "fail soft on signals, hard
// on money" rule -- a gambling venue quietly accepting a real-money
// currency because a warning scrolled past is the failure this exists
// to make impossible.
export function assertNoRealMoney(currency) {
  if (currency !== CURRENCY) {
    throw new ResortError(
      `Venus Resort settles in ${CURRENCY} only. "${currency}" would be a real-money path, `
      + "and the gambling compliance review flagged in VDP_CASINO_FIRST_STARTER_WORLD.md "
      + "is not recorded as complete.",
    );
  }
  return currency;
}

// -- Description ---------------------------------------------------------

export function describeResort(state) {
  const venue = isAboard(state) ? null : getVenue(state.venueId);
  return {
    resort: RESORT_NAME,
    venue: venue ? venue.name : `aboard the water taxi to ${getVenue(state.crossing.to).name}`,
    aboard: isAboard(state),
    tables: venue
      ? tablesInVenue(venue.id).map((t) => ({
        id: t.id, name: t.name, seats: t.seats, open: isTableOpen(t.id),
        dealer: dealerForTable(t.id)?.name ?? null,
      }))
      : [],
    staff: venue ? staffInVenue(venue.id).map((n) => `${n.name} (${n.role})`) : [],
    seatedAt: state.seatedAtTableId,
    currency: CURRENCY,
  };
}
