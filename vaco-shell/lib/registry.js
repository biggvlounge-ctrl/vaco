// Vaco Shell -- the real app registry. Every entry here is checked
// directly against that app's own server.js/README for its real dev
// port -- not guessed. `url: null` means the app genuinely has no
// live server yet.
//
// This is deliberately a static, in-process list, not a database --
// matching this session's own established "no persistence unless the
// task needs it" posture. Adding a newly-built app means adding one
// real entry here.
//
// `parent`/`bundle` (added per direct instruction): every real running
// app here maps to one of 16 real "parent" products -- some parents
// are one app (VACAY), some fold several real, independently-running
// apps together (Vvltvre = Music + Flix + Pods + Studios + VENVM;
// VACON-C = the civilization-sim engine + VACON + VSAFE; V3 = the
// ledger + VACA; V4 = the proxy + search layer; CVNVO = itself + YAP;
// CHOPZ = itself + CHOPZ SHOP). Folding is organizational only -- it
// does not change what actually runs where; every folded app keeps
// its own real process, port, and health check.
//
// The 16 parents are grouped into 6 real bundles, by genuine
// functional similarity, so related parents are easy to find/reason
// about together -- 5 of 3, and (per direct instruction) a 6th pulling
// VDP and VACON-C out on their own: both are genuinely gamified
// (VDP's avatar economy/districts, VACON-C's civilization-sim/NPC/
// mission engine), a different kind of "product" than the rest, so
// they get their own category instead of being folded into
// Operations & Infrastructure just to keep every bundle at 3 --
// Operations & Infrastructure now correctly stands at 2 (VOID, V4).
// `vaco-analytics`, `shield`, and `v3-shield` (legacy mock) still
// aren't products of their own -- no parent/bundle. Neither are
// `vaco-notify`, `vaco-audit`, `vaco-operator` and `vaco-media`: the
// four cross-cutting services every app calls and no user launches.
//
// **Two absences here are deliberate, and both have bitten before.**
// `vex` (8816) is not listed because `vex-trading` (8817) is the shell
// that serves it -- launching the sub-app directly would bypass the
// parent, which is exactly the stale row that had to be dropped once
// already. `v3-shield` (8791) is the legacy `venvs-mock-backend`,
// intentionally not containerised and dev-only.
//
// Everything else that `docker-compose.yml` builds must appear below.
// This list is cited as authoritative in the root README, and three
// services (audit, operator, media) sat outside it for a while --
// present in compose, absent here -- which is the silent-omission
// failure class this repo keeps finding. `scripts/test/registry.test.mjs`
// now holds the two lists against each other.

export const APPS = [
  // -- Consumer-facing apps --
  { id: 'vdp', name: 'VDP', description: 'The walkable digital layer -- avatar economy, districts, Vavlt Stvdios Stage.', url: 'http://localhost:5174', category: 'consumer', parent: 'VDP', bundle: 'Gamified & Simulation' },
  { id: 'venvs', name: 'VENVS', description: 'Analog commerce -- Shop, Marketplace, Publishing.', url: 'http://localhost:5173', category: 'consumer', parent: 'VENVS', bundle: 'Commerce & Marketplace' },
  { id: 'hvntz', name: 'HVNTZ', description: 'Revenue stack, hunts, and the Explore Page.', url: 'http://localhost:8792', category: 'consumer', parent: 'HVNTZ', bundle: 'Social & Discovery' },
  { id: 'void', name: 'VOID', description: 'Real-world logistics, drones, workforce, and station network.', url: 'http://localhost:8793', category: 'consumer', parent: 'VOID', bundle: 'Operations & Infrastructure' },
  // CVLTVRE and VADO are parents #17 and #18, promoted 2026-08-26.
  //
  // **All three rows point at the same runtime on 8794.** They are not
  // three services. `voken/` is one process; CVLTVRE is the brand its
  // card product ships under (lib/brand.js is the source of truth for
  // that name) and VADO is its art surface. Promoting them to parents
  // records what a customer sees; splitting the process would break the
  // auction settle path, where a VCoin transfer and an edition-ownership
  // change happen back to back with no I/O between them. See
  // dev-docs/CVLTVRE_AND_VADO_EXTRACTION_AUDIT.md.
  // Not a consumer product: the one channel every alerting surface
  // delivers through. Listed so it is discoverable and health-checked,
  // and parented to VACON-C with the rest of the internal layer -- see
  // dev-docs/VACO_CONSTELLATIONS.md.
  { id: 'vaco-notify', name: 'VACO Notify', description: 'The one notification channel — VSAFE escalations, DREAMS and Analytics alerts.', url: 'http://localhost:8818', category: 'system', parent: 'VACON-C', bundle: 'Gamified & Simulation' },
  { id: 'voken', name: 'VOKEN', description: 'The card engine — minting, editions, provenance, value scores.', url: 'http://localhost:8794', category: 'consumer', parent: 'VOKEN', bundle: 'Commerce & Marketplace' },
  { id: 'cvltvre', name: 'CVLTVRE', description: 'Collect, trade, and auction anything with real cultural relevance.', url: 'http://localhost:8794/#packs', category: 'consumer', parent: 'CVLTVRE', bundle: 'Commerce & Marketplace' },
  { id: 'vado', name: 'VADO', description: 'The Art District — auctions, galleries, art frames.', url: 'http://localhost:8794/#vado', category: 'consumer', parent: 'VADO', bundle: 'Commerce & Marketplace' },
  { id: 'vago', name: 'VAGO', description: 'Wagering, prediction markets, and casino currency.', url: 'http://localhost:8795', category: 'consumer', parent: 'VAGO', bundle: 'Financial & Trading' },
  { id: 'vxllage', name: 'VXLLAGE', description: 'Home feed, Threads, Villages, Live, Call.', url: 'http://localhost:8796', category: 'consumer', parent: 'VXLLAGE', bundle: 'Social & Discovery' },
  { id: 'voidmagic', name: 'VOID MAGIC', description: 'Meet & Greet bookings -- Vvltvre -> Touring & Tix.', url: 'http://localhost:8797', category: 'consumer', parent: 'VOID', bundle: 'Operations & Infrastructure' },
  { id: 'cvnvo', name: 'CVNVO', description: 'Dating -- real stable matching, safety-first.', url: 'http://localhost:8798', category: 'consumer', parent: 'CVNVO', bundle: 'Social & Discovery' },
  { id: 'chopz', name: 'CHOPZ', description: 'Short-form video feed.', url: 'http://localhost:8800', category: 'consumer', parent: 'CHOPZ', bundle: 'Commerce & Marketplace' },
  { id: 'chopz-shop', name: 'CHOPZ SHOP', description: "CHOPZ's affiliate commerce layer.", url: 'http://localhost:8801', category: 'consumer', parent: 'CHOPZ', bundle: 'Commerce & Marketplace' },
  { id: 'yap', name: 'YAP', description: 'Safety reporting, split out of CVNVO.', url: 'http://localhost:8802', category: 'consumer', parent: 'CVNVO', bundle: 'Social & Discovery' },
  { id: 'vacay', name: 'VACAY', description: 'Bookings, Home, Auto, Flights -- one merged app. Real UI: VDP\'s own VACAY Experiences district.', url: 'http://localhost:8803', category: 'consumer', parent: 'VACAY', bundle: 'Leisure & Entertainment' },
  { id: 'vulture-music', name: 'Vvltvre Music/Distribution', description: 'Flat-fee release distribution, TuneCore-style.', url: 'http://localhost:8806', category: 'consumer', parent: 'Vvltvre', bundle: 'Leisure & Entertainment' },
  { id: 'vulture-flix', name: 'Vvltvre Flix', description: 'Netflix Originals-model exclusive content.', url: 'http://localhost:8807', category: 'consumer', parent: 'Vvltvre', bundle: 'Leisure & Entertainment' },
  { id: 'vulture-pods', name: 'Vvltvre Pods', description: 'Podcast shows/episodes, Spotify/Apple Podcasts model.', url: 'http://localhost:8810', category: 'consumer', parent: 'Vvltvre', bundle: 'Leisure & Entertainment' },
  { id: 'vulture-studios', name: 'Vvltvre Studios', description: 'VVLTVRE -> STUDIOS, the real production-financing arm: greenlight, raise real financing for real equity, produce, distribute into Vvltvre Flix.', url: 'http://localhost:8815', category: 'consumer', parent: 'Vvltvre', bundle: 'Leisure & Entertainment' },
  { id: 'venvm', name: 'VENVM', description: "The ecosystem's AI production/marketing tool -- script requests, cross-platform video reformatting, a real production pipeline. Lives inside Vvltvre; also reachable through this shell for public use.", url: 'http://localhost:8813', category: 'consumer', parent: 'Vvltvre', bundle: 'Leisure & Entertainment' },
  { id: 'dreams', name: 'DREAMS', description: "The ecosystem's ad/screen network -- screen registration, self-serve advertiser flow, real per-screen revenue split. Runs inside HVNTZ, feeding its screens real analytics.", url: 'http://localhost:8814', category: 'consumer', parent: 'HVNTZ', bundle: 'Social & Discovery' },
  { id: 'vavlt-stvdios', name: 'Vavlt Stvdios', description: 'Multi-channel streaming, IG-style content layer, 8-screen sessions.', url: 'http://localhost:8808', category: 'consumer', parent: 'Vault', bundle: 'Leisure & Entertainment' },
  { id: 'vsafe', name: 'VSAFE', description: 'Universal safety layer -- check-ins, trusted contacts, escalation.', url: 'http://localhost:8799', category: 'consumer', parent: 'VACON-C', bundle: 'Gamified & Simulation' },
  { id: 'vacon-c', name: 'VACON-C', description: 'Civilization simulation engine -- state/tick/NPC/mission API.', url: 'http://localhost:8809', category: 'consumer', parent: 'VACON-C', bundle: 'Gamified & Simulation' },
  { id: 'vex-trading', name: 'Vex Trading', description: 'Parent shell over two real sub-apps: VEX (Cvltvre Card brokerage, extracted from VOKEN) and Vex Business (futures-research/trading platform, renamed from CALL).', url: 'http://localhost:8817', category: 'consumer', parent: 'Vex', bundle: 'Financial & Trading' },

  // -- Foundation / infrastructure --
  { id: 'vaca', name: 'VACA', description: "Identity/authenticity verification -- V3's third component.", url: 'http://localhost:8804', category: 'infra', parent: 'V3', bundle: 'Financial & Trading' },
  { id: 'vacon', name: 'VACON', description: 'The real operating network -- MIA + the named executive agents.', url: 'http://localhost:8805', category: 'infra', parent: 'VACON-C', bundle: 'Gamified & Simulation' },
  { id: 'v4-proxy', name: 'V4 Agent Proxy', description: 'Holds the Anthropic API key server-side for VACON.', url: 'http://localhost:8787', category: 'infra', parent: 'V4', bundle: 'Operations & Infrastructure' },
  { id: 'v4-search', name: 'V4 Search Layer', description: 'Shared cross-app search routing.', url: 'http://localhost:8788', category: 'infra', parent: 'V4', bundle: 'Operations & Infrastructure' },
  { id: 'vaco-analytics', name: 'VACO Analytics', description: "The ecosystem's unified metrics dashboard.", url: 'http://localhost:8790', category: 'infra', parent: null, bundle: null },
  { id: 'v3', name: 'V3', description: "The ecosystem's real, standalone VCoin/VASH ledger -- extracted from the mock below with verified drop-in compatibility. Now the real default V3_API_URL for every app that reads one; see its own README's 'Ecosystem cutover' section for the full switched-over list.", url: 'http://localhost:8811', category: 'infra', parent: 'V3', bundle: 'Financial & Trading' },
  { id: 'shield', name: 'Shield', description: "The ecosystem's real, standalone session layer -- extracted from the mock below with verified drop-in compatibility (login/session-check proven through vaco-shell's own unmodified routes). Now the real default SHIELD_API_URL for every app that reads one; see its own README's 'Ecosystem cutover' section.", url: 'http://localhost:8812', category: 'infra', parent: null, bundle: null },
  { id: 'v3-shield', name: 'V3 / Shield (mock)', description: "The original inferred VCoin/VASH/Shield stand-in -- no longer any app's default. Kept running for local dev/reference; the real 'v3' and 'shield' entries above are now what every app actually points at.", url: 'http://localhost:8791', category: 'infra', parent: null, bundle: null },
  { id: 'vaco-audit', name: 'VACO Audit', description: 'The append-only record of operator-grade decisions -- who decided, on what basis, and against whom. Written to before a decision is authorized, never after, so a decision that cannot be recorded is refused rather than made.', url: 'http://localhost:8819', category: 'infra', parent: null, bundle: null },
  { id: 'vaco-operator', name: 'VACO Operator', description: 'Human-operator credentials and scopes -- a separate, deliberately small credential, not a Shield role. Group-2 routes ("decisions with a loser") accept it and no service-token fallback.', url: 'http://localhost:8820', category: 'infra', parent: null, bundle: null },
  { id: 'vaco-media', name: 'VACO Media', description: 'The media control plane: live session grants and recorded-asset playback grants. Owns who gets a playable address and for how long; the transport and storage planes sit behind adapters.', url: 'http://localhost:8821', category: 'infra', parent: null, bundle: null },
];

// The 6 real bundles, grouped by genuine functional similarity (not
// alphabetical, not insertion order) -- 5 of 3 parents, plus Gamified
// & Simulation (2) pulled out on its own per direct instruction, and
// Operations & Infrastructure correspondingly down to 2.
export const BUNDLES = [
  { name: 'Financial & Trading', parents: ['Vex', 'V3', 'VAGO'] },
  { name: 'Commerce & Marketplace', parents: ['VENVS', 'VOKEN', 'CHOPZ'] },
  { name: 'Social & Discovery', parents: ['VXLLAGE', 'CVNVO', 'HVNTZ'] },
  { name: 'Leisure & Entertainment', parents: ['VACAY', 'Vvltvre', 'Vault'] },
  { name: 'Gamified & Simulation', parents: ['VDP', 'VACON-C'] },
  { name: 'Operations & Infrastructure', parents: ['VOID', 'V4'] },
];

export function listApps() {
  return APPS;
}

export function getApp(id) {
  return APPS.find((a) => a.id === id) || null;
}

export function listBundles() {
  return BUNDLES.map((b) => ({
    ...b,
    apps: APPS.filter((a) => b.parents.includes(a.parent)),
  }));
}

export function getBundle(name) {
  const found = BUNDLES.find((b) => b.name.toLowerCase() === name.toLowerCase());
  if (!found) return null;
  return { ...found, apps: APPS.filter((a) => found.parents.includes(a.parent)) };
}
