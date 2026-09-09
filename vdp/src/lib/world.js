// VDP — the digital-mode walkable world (Phase 5, split out of VENVS
// into its own project per explicit instruction).
// Source of truth: VENVS's own CLAUDE.md §1 core design principle:
// "digital mode is not a separate app — every VACO app has an analog
// interface AND a physical space in this one shared world" — and §4's
// feature inventory: "a walkable top-down world you move an avatar
// through with arrow keys/WASD, camera follows you, buildings you
// walk up to and enter."
//
// No source doc specifies exact world dimensions, movement speed, or
// entry radius -- this is the first phase built without a concrete
// spec doc to check numbers against (unlike Publishing's real royalty
// percentages or DEGVCHI's real category list). All constants below
// are flagged as interpretive, chosen for a small, testable, real
// layout rather than derived from anything specified.
//
// Only the 6 "native districts" (§4: "solid border, real content
// matching analog") get physical space here. Lounge districts are
// explicitly described as living in their own separate VACO app, so
// they're not placed in this world at all -- a literal read of that
// distinction, not an oversight.
//
// `contentType` real, three-way split (replacing the old boolean
// `hasAnalogView`), resolving a genuine ambiguity in VENVS's own
// CLAUDE.md between §4's 5-tab analog list (never included DEGVCHI)
// and the digital-mode district list calling Fashion District "real
// content matching analog" (implying an analog DEGVCHI view) --
// settled directly by explicit instruction: avatar economy is VDP's,
// not VENVS's, regardless of that spec's own internal tension.
//   'venvs-embed' -- real content that belongs to VENVS (the analog
//     commerce app, now a separate real project): rendered via a real
//     iframe onto VENVS's own deep-linkable `?view=` route, not a
//     shared component instance (the two apps no longer share a
//     process or an in-memory store).
//   'vdp-native'  -- real content that's VDP's own (DEGVCHI's avatar-
//     wearable economy, Food District's flagship restaurants): rendered
//     directly, no iframe.
//   'vavlt-stvdios-embed' -- real content sourced from Vavlt Stvdios'
//     own separate API via a real HTTP fetch (`lib/vavltStvdiosClient.js`),
//     rendered directly (no iframe -- Vavlt Stvdios has no frontend to
//     embed). A real third category, distinct from 'vdp-native': the
//     data genuinely belongs to Vavlt Stvdios' own server/store, not
//     VDP's -- Stage (`lib/stage.js`/`StageView.jsx`) is the one
//     district using it, wiring in Vavlt Stvdios' own "up to 8
//     interactive screens" mechanic, per VENVS's own CLAUDE.md §4/§5
//     naming Stage as an "event plaza" with "up to 8 real camera feeds
//     with AI operators" as real, named, previously-unbuilt scope.
//   'vxllage-embed' -- real content sourced from VXLLAGE's own
//     separate API via a real HTTP fetch (`lib/vxllageClient.js`),
//     rendered directly (no iframe -- VXLLAGE has no frontend to
//     embed either). Same real category shape as 'vavlt-stvdios-embed'.
//     The Village District (`lib/villageDistrict.js`/
//     `VillageDistrictView.jsx`) is the one district using it -- a
//     real, deliberate exception to this file's own "only the 6 native
//     districts get physical space, lounge districts live only in
//     their own app" rule above. `VXLLAGE_VDP_VILLAGE_DISTRICT.md`
//     directly contradicts that framing for this one case: "VXLLAGE
//     gets its own dedicated Village district inside VENVS/VDP — a
//     real place with multiple distinct rooms... not just a card
//     linking out." Treated as the more specific, later doc winning
//     over the general rule for this one district, per direct
//     instruction to close this gap -- flagged here rather than
//     silently reconciled. That same doc's own claim that this should
//     follow "the same treatment already given to VAGO's Resort &
//     Casino, which is a real walkable destination inside VDP" was
//     checked directly and found false -- VAGO has no district
//     anywhere in this file, and its own README confirms its casino
//     world isn't built. This district is a first, not a copy of an
//     existing pattern.
//   'cvnvo-embed' -- real content sourced from CVNVO's own separate
//     API via a real HTTP fetch (`lib/cvnvoClient.js`), rendered
//     directly (same shape as 'vavlt-stvdios-embed'/'vxllage-embed').
//     The Dating Village (`lib/datingVillage.js`/`DatingVillageView.jsx`)
//     is the one district using it. Unlike the Village District's own
//     source doc, which cited a false VAGO precedent (see above), this
//     district's own doc cites a real, checked-true precedent: "the
//     same pattern already established for VXLLAGE's Village" --
//     VXLLAGE's own Village District, real and already built in this
//     same file.
//   'voken-embed' -- real content sourced from VOKEN's own separate
//     API via a real HTTP fetch (`lib/vokenClient.js`), rendered
//     directly (same shape as 'vavlt-stvdios-embed'/'vxllage-embed'/
//     'cvnvo-embed'). The `vex` and `vado` districts use it. **A real
//     migration, not a new district**: both districts used to render
//     via 'venvs-embed', iframing VENVS's own, independently-built
//     `vex.js`/`vado.js` (a generic trading floor + auction gallery,
//     Phase 9, Aug 11). VOKEN later built its own, separately-real
//     `vex.js`/`vadoExplore.js` (brokerage trading + auctions of
//     actual Cvltvre Card editions, Phase 4-5, Aug 13) under the same
//     names -- checked directly via git history, not assumed: neither
//     codebase ever referenced the other; these were never "moved,"
//     they were built twice, independently. Per direct instruction,
//     VOKEN is now the single canonical home -- VENVS's own
//     `vex.js`/`vado.js` were deleted (see `venvs/README.md`), and
//     these two districts were repointed here. Real, honest trade-off
//     flagged directly: VOKEN's VEX brokerage trading is gated behind
//     its own real `vex-brokerage` compliance flag (pending
//     broker-dealer legal review) -- VENVS's version had no such gate.
//     VADO's own auction mechanics carry no gate at all (checked
//     directly in `voken/lib/auctions.js` -- only VOKEN's separate
//     fractional-ownership feature is gated), so nothing was lost
//     there. `voken/lib/auctions.js` also gained one real, necessary
//     addition for this: `listOpenAuctions` (`GET /api/auctions/open`)
//     -- no prior VOKEN route could list what's actually open, only
//     look up one auction by a known id.
//   'vago-embed'  -- real content sourced from VAGO's own separate API
//     via a real HTTP fetch (`lib/vagoClient.js`), rendered directly
//     (same shape as 'voken-embed'/'cvnvo-embed'). The `vago` district
//     uses it -- closes the "VAGO has no district anywhere in this
//     file" gap flagged above, for real: a live client of VAGO's own
//     Originals (Mines) casino game.
//   'vacay-embed' -- real content sourced from VACAY's own separate API
//     via a real HTTP fetch (`lib/vacayClient.js`), rendered directly
//     (same shape as 'vago-embed' above). The `vacay` district uses
//     it, deliberately scoped to VACAY's Experiences resource rather
//     than Stays -- see `vacayClient.js`'s own header for why (Stays
//     has no browse-all route to embed here).
//   'hvntz-embed' -- real content sourced from HVNTZ's own separate
//     API via a real HTTP fetch (`lib/hvntzClient.js`), rendered
//     directly (same shape as 'vago-embed'/'vacay-embed'). The `hvntz`
//     district uses it -- HVNTZ's own original core mechanic, a real
//     scavenger hunt with a real sponsor budget and real VCoin
//     bounties.
//   'void-embed'  -- real content sourced from VOID's own separate API
//     via a real HTTP fetch (`lib/voidClient.js`), rendered directly.
//     The `void` district uses it -- VOID's own real
//     request/match/accept/complete/pay/rate marketplace loop, the
//     same loop every one of its 18+ verticals runs through (the
//     Courier vertical specifically, a real non-licensing-gated one).
//   'vulture-music-embed' / 'vulture-pods-embed' / 'vulture-flix-embed'
//     -- real content sourced from each Vvltvre division's own
//     separate API via a real HTTP fetch (`lib/vultureMusicClient.js`/
//     `vulturePodsClient.js`/`vultureFlixClient.js`), rendered
//     directly. The `vulture-music`/`vulture-pods`/`vulture-flix`
//     districts use them respectively -- a real release + royalty
//     payout, a real show/episode/subscription flow (publishing an
//     episode is itself a real cross-app call from Pods into Music),
//     and a real acquisition + subscription + concurrent-stream-limit
//     flow.
//   'chopz-embed' -- real content sourced from CHOPZ's own (and, for
//     the linked product itself, CHOPZ SHOP's own) separate APIs via
//     real HTTP fetches (`lib/chopzClient.js`/`lib/chopzShopClient.js`),
//     rendered directly. The `chopz` district uses it -- a real
//     shoppable video, closing this project's own long-carried "CHOPZ
//     isn't placed in the walkable world's district grid" gap.
//   'vulture-studios-embed' -- real content sourced from Vvltvre
//     Studios' own separate API via a real HTTP fetch
//     (`lib/vultureStudiosClient.js`), rendered directly (same shape
//     as 'vulture-music-embed' etc). The `vulture-studios` district
//     uses it -- a real client of that app's own fund-and-produce
//     financing engine (greenlight, real investor financing rounds,
//     production stages, real cross-app distribution into Vvltvre
//     Flix or Vvltvre Music depending on medium, real proportional
//     revenue reporting).
//   'none'        -- no view built yet -- an honest gap. Food District
//     moved out of this category once its own real flagship-brand
//     content was built (`lib/foodDistrict.js`) -- confirmed directly
//     beforehand that no placeholder restaurant content had ever
//     actually existed here, despite a since-corrected source doc
//     describing this district as already having 5 placeholder brands
//     to replace. Stage moved out of this category once Vavlt Stvdios'
//     own eight-screen mechanic existed to wire in.
export const WORLD_WIDTH = 860;
// Grown from 860 to 1140 to fit a 4th row (HVNTZ/VACAY/VOID), then to
// 1420 to fit a real 5th row (Vvltvre Music/Pods/Flix), then to 1700
// to fit a real 6th row (CHOPZ/VENVM/VACO Analytics), then to 1980 to
// fit a real 7th row (Beat Marketplace) -- same real precedent as the
// earlier 580->860 growth for the Village District row (see below).
// Grown once more to 2260 for an 8th row: the 7th filled up exactly
// (Beat Marketplace / Vvltvre Studios / VACON-C), leaving nowhere to
// put VACO Merch.
export const WORLD_HEIGHT = 2260;
export const VIEWPORT_WIDTH = 400;
export const VIEWPORT_HEIGHT = 300;
export const MOVE_STEP = 16;
export const BUILDING_ENTRY_RADIUS = 40;

// 3x2 grid (plus one real, deliberate 7th cell, a new 3rd row, for the
// Village District -- see its own note above), 260x260 districts,
// 20px gaps and margin -- the gaps between/around districts are
// neutral walkable space, not inside any district (used deliberately
// as the player's spawn point below).
export const DISTRICTS = [
  {
    id: 'vex', name: 'VEX', x: 20, y: 20, width: 260, height: 260, contentType: 'voken-embed',
  },
  {
    id: 'vado', name: 'VADO', x: 300, y: 20, width: 260, height: 260, contentType: 'voken-embed',
  },
  {
    id: 'publisher', name: 'VENVS Publisher', x: 580, y: 20, width: 260, height: 260, contentType: 'venvs-embed', venvsView: 'publisher',
  },
  {
    id: 'stage', name: 'VENVS Stage', x: 20, y: 300, width: 260, height: 260, contentType: 'vavlt-stvdios-embed',
  },
  {
    id: 'food', name: 'Food District', x: 300, y: 300, width: 260, height: 260, contentType: 'vdp-native',
  },
  {
    id: 'fashion', name: 'Fashion District', x: 580, y: 300, width: 260, height: 260, contentType: 'vdp-native',
  },
  {
    id: 'village', name: 'VDP Village District', x: 300, y: 580, width: 260, height: 260, contentType: 'vxllage-embed',
  },
  {
    id: 'dating-village', name: 'CVNVO Dating Village', x: 580, y: 580, width: 260, height: 260, contentType: 'cvnvo-embed',
  },
  // **Promoted from a doorway to a place**, per
  // `VDP_CASINO_FIRST_STARTER_WORLD.md`: "the casino as the deliberate
  // centerpiece, not one feature among equals." It was
  // `contentType: 'vago-embed'` -- a lounge-style link-out. It is now
  // `vdp-native`: the Venus Resort Complex, a walkable two-venue
  // interior (`venusResort.js`) with VOID water taxis between them.
  //
  // VAGO's own game is not replaced by this and is still the only
  // thing that moves a balance -- `VenusResortView` renders `VagoView`
  // once the player has walked to a table and sat down.
  {
    id: 'vago', name: 'Venus Resort Complex', x: 20, y: 580, width: 260, height: 260, contentType: 'vdp-native',
  },
  // New 4th row (WORLD_HEIGHT grown above to fit it) -- real client of
  // VACAY's own Experiences API.
  {
    id: 'hvntz', name: 'HVNTZ Hunt', x: 20, y: 860, width: 260, height: 260, contentType: 'hvntz-embed',
  },
  {
    id: 'vacay', name: 'VACAY Experiences', x: 300, y: 860, width: 260, height: 260, contentType: 'vacay-embed',
  },
  {
    id: 'void', name: 'VOID Marketplace', x: 580, y: 860, width: 260, height: 260, contentType: 'void-embed',
  },
  // New 5th row (WORLD_HEIGHT grown again to fit it) -- real clients
  // of Vvltvre Music/Pods/Flix's own separate APIs.
  {
    id: 'vulture-music', name: 'Vvltvre Music', x: 20, y: 1140, width: 260, height: 260, contentType: 'vulture-music-embed',
  },
  {
    id: 'vulture-pods', name: 'Vvltvre Pods', x: 300, y: 1140, width: 260, height: 260, contentType: 'vulture-pods-embed',
  },
  {
    id: 'vulture-flix', name: 'Vvltvre Flix', x: 580, y: 1140, width: 260, height: 260, contentType: 'vulture-flix-embed',
  },
  // New 6th row (WORLD_HEIGHT grown again to fit it) -- real client of
  // CHOPZ's own shoppable-video mechanic. Closes a real, long-flagged
  // gap: "CHOPZ isn't placed in the walkable world's district grid,"
  // carried in this project's own README since before the VAGO/VACAY
  // phase.
  {
    id: 'chopz', name: 'CHOPZ Shorts', x: 300, y: 1420, width: 260, height: 260, contentType: 'chopz-embed',
  },
  // Fills the two open slots left in the 6th row -- real clients of
  // VENVM's own script-engine/reformat/production-pipeline API and
  // VACO Analytics' own unified dashboard API, both confirmed at a
  // real 0% VDP presence before this: neither had a district anywhere
  // in this walkable world.
  {
    id: 'venvm', name: 'VENVM Studio', x: 20, y: 1420, width: 260, height: 260, contentType: 'venvm-embed',
  },
  {
    id: 'vaco-analytics', name: 'VACO Analytics', x: 580, y: 1420, width: 260, height: 260, contentType: 'vaco-analytics-embed',
  },
  // Real 19th district, a new 7th row (`WORLD_HEIGHT` grown again) --
  // a user-flagged real gap, not self-discovered: Vvltvre Music's own
  // beat marketplace, confirmed genuinely new by direct grep across
  // the whole repo before it was built at all. Lives inside Vvltvre
  // Music's own server/store (see `beatMarketplaceClient.js`'s own
  // header), not a separate app, so this district is a sibling of
  // 'vulture-music-embed' above, not a new backend integration.
  {
    id: 'beat-marketplace', name: 'Beat Marketplace', x: 20, y: 1700, width: 260, height: 260, contentType: 'beat-marketplace-embed',
  },
  // Fills one of the two open slots the 7th row had left -- Vvltvre
  // Studios' own real fund-and-produce backlot, self-flagged in its
  // own README as one of two remaining gaps (the other, real music/
  // podcast distribution, was closed on Vvltvre Studios' own side, not
  // here). A real client of that same app's own separate API
  // (`vultureStudiosClient.js`), same shape as every other
  // '-embed' district -- no financing/production logic here.
  {
    id: 'vulture-studios', name: 'Vvltvre Studios', x: 300, y: 1700, width: 260, height: 260, contentType: 'vulture-studios-embed',
  },
  // VACON-C's own civilization-simulation engine, closing the one
  // confirmed zero-frontend gap the ecosystem audit found among the
  // 16 real parents. A real client of VACON-C's own separate API
  // (`vacancyClient.js`), same shape as every other '-embed' district
  // -- no simulation logic here, covering exactly VACON-C's own real,
  // currently-live 5-endpoint contract (state/tick/npc/artifacts/
  // mission), not its full future-phase spec.
  {
    id: 'vacancy', name: 'VACON-C', x: 580, y: 1700, width: 260, height: 260, contentType: 'vacancy-embed',
  },
  // A new 8th row, because the 7th filled up exactly. VACO's own merch
  // store, placed in VDP on purpose rather than left only in the shell:
  // VDP is where an avatar already wears SVMIKO DEGVCHI pieces in the
  // Fashion District, and merch is the same act aimed at the physical
  // world -- the thing you buy for the person, not the avatar. A real
  // client of VACO's own separate API (`vacoMerchClient.js`), same
  // shape as every other '-embed' district: no pricing, split, or
  // order-lifecycle logic lives here.
  {
    id: 'vaco-merch', name: 'VACO Merch', x: 20, y: 1980, width: 260, height: 260, contentType: 'vaco-merch-embed',
  },
  // The Combat Sports District, per
  // `VDP_COMBAT_SPORTS_DISTRICT.md`. Fills the second slot of the 8th
  // row -- no growth needed, unlike the Venus Resort's promotion above
  // which reused a slot that already existed.
  //
  // `vdp-native`, not an embed, and for a different reason than the
  // resort: there is no standalone combat-sports app to link out to.
  // The card itself (`combatSports.js`) is the district. Its three
  // integrations are seams, not embeds -- Vavlt Stvdios takes the
  // channel specs, VAGO takes the prediction market, VOKEN takes the
  // rookie cards, and each is already reachable from this directory.
  {
    id: 'combat-sports', name: 'Combat Sports District', x: 300, y: 1980, width: 260, height: 260, contentType: 'vdp-native',
  },
];

function buildingCenter(district) {
  return { x: district.x + district.width / 2, y: district.y + district.height / 2 };
}

export function createWorldState() {
  // Spawns in the neutral horizontal corridor between the two rows
  // (y=290 falls in the 280-300 gap), not inside any district.
  return { x: WORLD_WIDTH / 2, y: 290 };
}

export function movePlayer(worldState, dx, dy) {
  const nextX = Math.max(0, Math.min(WORLD_WIDTH, worldState.x + dx));
  const nextY = Math.max(0, Math.min(WORLD_HEIGHT, worldState.y + dy));
  worldState.x = nextX;
  worldState.y = nextY;
  return worldState;
}

export function getCurrentDistrict(worldState) {
  return (
    DISTRICTS.find(
      (d) =>
        worldState.x >= d.x &&
        worldState.x <= d.x + d.width &&
        worldState.y >= d.y &&
        worldState.y <= d.y + d.height
    ) || null
  );
}

// "Walk up to and enter" -- proximity to a district's building center,
// not requiring the player be inside the district's own bounds first
// (a real player would approach a building from just outside it).
export function getNearbyBuilding(worldState) {
  let closest = null;
  let closestDist = Infinity;
  for (const district of DISTRICTS) {
    const center = buildingCenter(district);
    const dist = Math.hypot(worldState.x - center.x, worldState.y - center.y);
    if (dist <= BUILDING_ENTRY_RADIUS && dist < closestDist) {
      closest = district;
      closestDist = dist;
    }
  }
  return closest;
}

export function enterBuilding(worldState, districtId) {
  const nearby = getNearbyBuilding(worldState);
  if (!nearby || nearby.id !== districtId) {
    throw new Error(`enterBuilding: player is not near the "${districtId}" building`);
  }
  return { entered: true, district: nearby };
}

// Real, clamped camera-follow math: centers the viewport on the
// player, but never scrolls past the world's edges.
export function getCameraOffset(worldState) {
  const rawX = worldState.x - VIEWPORT_WIDTH / 2;
  const rawY = worldState.y - VIEWPORT_HEIGHT / 2;
  const x = Math.max(0, Math.min(WORLD_WIDTH - VIEWPORT_WIDTH, rawX));
  const y = Math.max(0, Math.min(WORLD_HEIGHT - VIEWPORT_HEIGHT, rawY));
  return { x, y };
}
