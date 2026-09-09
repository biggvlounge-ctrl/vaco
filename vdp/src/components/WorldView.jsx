import { useState, useEffect, useRef, useCallback } from "react";
import {
  VIEWPORT_WIDTH, VIEWPORT_HEIGHT, MOVE_STEP,
  DISTRICTS, createWorldState, movePlayer, getCurrentDistrict, getNearbyBuilding, enterBuilding, getCameraOffset,
} from "../lib/world.js";
import DegvchiView from "./DegvchiView.jsx";
import FoodDistrictView from "./FoodDistrictView.jsx";
import StageView from "./StageView.jsx";
import VillageDistrictView from "./VillageDistrictView.jsx";
import DatingVillageView from "./DatingVillageView.jsx";
import VexView from "./VexView.jsx";
import VadoView from "./VadoView.jsx";
import VenusResortView from "./VenusResortView.jsx";
import CombatSportsView from "./CombatSportsView.jsx";
import VacayView from "./VacayView.jsx";
import HvntzView from "./HvntzView.jsx";
import VoidView from "./VoidView.jsx";
import VultureMusicView from "./VultureMusicView.jsx";
import VulturePodsView from "./VulturePodsView.jsx";
import VultureFlixView from "./VultureFlixView.jsx";
import ChopzShortsView from "./ChopzShortsView.jsx";
import VenvmView from "./VenvmView.jsx";
import VacoAnalyticsView from "./VacoAnalyticsView.jsx";
import BeatMarketplaceView from "./BeatMarketplaceView.jsx";
import VultureStudiosView from "./VultureStudiosView.jsx";
import VacancyView from "./VacancyView.jsx";
import VacoMerchView from "./VacoMerchView.jsx";

// Phase 5 demo: the digital-mode walkable world. Real canvas
// rendering + keyboard movement + clamped camera-follow (world.js,
// unit-tested separately), plus the literal embodiment of VENVS's own
// CLAUDE.md §1 core design principle -- walking into a building opens
// real content for that district, same account/wallet (V3), not a
// separate identity.
//
// Split-out-of-VENVS note: this used to directly import and render
// VENVS's own PublishingView/VexView/VadoView React components --
// that only worked because both apps lived in one process sharing one
// in-memory store (App.jsx's Phase 8 fix). Now that VENVS is a real,
// separate app/process/origin, the Publisher district still renders
// VENVS's actual running app inside a real `<iframe>` pointed at its
// own `?view=<name>` route (see `venvs/src/App.jsx`) -- genuinely
// VENVS's own UI and its own real V3-backed state, not a shared
// component instance. The VEX and VADO districts no longer do this --
// see world.js's own header for the real, checked-via-git-history
// finding that VENVS's and VOKEN's own VEX/VADO were built twice,
// independently, never actually shared; VOKEN is now the single
// canonical source, and these two districts render this project's own
// `VexView`/`VadoView`, real clients of VOKEN's own separate API
// (`vokenClient.js`) -- the same 'voken-embed' shape as every other
// cross-app district below. Fashion District (DEGVCHI) and Food
// District stay real, native VDP components -- neither was ever
// VENVS's own content (see world.js's header on the `contentType`
// split). Stage renders `StageView`, a real client of Vavlt Stvdios'
// own separate, running API (`vavltStvdiosClient.js`) -- a third real
// rendering category, 'vavlt-stvdios-embed', distinct from the VENVS
// iframe embed and VDP's own native content. All 6 native districts
// now have a real view. A real 7th district, the Village District,
// renders `VillageDistrictView` via the same real-cross-app-fetch
// shape ('vxllage-embed') -- a deliberate, flagged exception to the
// "only 6 native districts, lounge apps live only in their own app"
// rule (see world.js's own header for the real doc conflict this
// resolves). A real 8th district, the Dating Village, renders
// `DatingVillageView` the same way -- CVNVO's own real BarBuddy venue
// check-in, live -- citing that same Village District precedent, this
// time correctly (checked directly, unlike the Village District's own
// false VAGO citation). A real 9th district, now the Venus Resort
// Complex, renders `VenusResortView` ('vdp-native') -- promoted from
// the `vago-embed` doorway it used to be, per
// `VDP_CASINO_FIRST_STARTER_WORLD.md`. It is a walkable two-venue
// interior, and it still renders `VagoView` at a table, so VAGO's own
// Originals (Mines) game remains the only thing moving a balance. A real 10th district, VACAY Experiences, renders `VacayView`
// ('vacay-embed') in a new 4th row (world.js's own WORLD_HEIGHT grown
// to fit it, same precedent as the earlier Village District row
// growth) -- a live client of VACAY's own Experiences API, chosen over
// Stays since Experiences is the one VACAY resource with a real
// browse-all route (see vacayClient.js's own header). Real 11th-15th
// districts fill out the rest of the 4th row (HVNTZ Hunt, VOID
// Marketplace) and a new 5th row (Vvltvre Music/Pods/Flix, world.js's
// own WORLD_HEIGHT grown again to fit it): `HvntzView` ('hvntz-embed')
// is a live client of HVNTZ's own original scavenger-hunt mechanic;
// `VoidView` ('void-embed') is a live client of VOID's own real
// request/match/accept/complete/pay/rate marketplace loop; and
// `VultureMusicView`/`VulturePodsView`/`VultureFlixView`
// ('vulture-music-embed'/'vulture-pods-embed'/'vulture-flix-embed')
// are live clients of each Vvltvre division's own real
// release/subscription/streaming engine. A real 16th district, CHOPZ
// Shorts, fills a new 6th row (`WORLD_HEIGHT` grown again) -- closes
// this project's own long-carried "CHOPZ isn't placed in the walkable
// world's district grid" gap. `ChopzShortsView`
// ('chopz-embed') is a live client of CHOPZ's own real shoppable-video
// mechanic, spanning both CHOPZ's and CHOPZ SHOP's real separate APIs.
// **Deliberately named "Shorts", not "CHOPZ", to stay distinct from
// the pre-existing, unrelated "CHOPZ District" already rendered
// outside this walkable world in `App.jsx`** (`ChopzView.jsx`/
// `lib/chopz.js`, a real leasable-retail-kiosk feature sourced from
// VENVS's own CLAUDE.md §4) -- a genuine naming collision in this
// ecosystem's own source docs, not a duplicate; both are real, both
// are kept, see `lib/chopz.js`'s own header for the full detail. Real
// 17th-18th districts, VENVM Studio and VACO Analytics, fill the two
// open slots the 6th row had left -- both apps were confirmed at a
// real 0% VDP presence before this (no district anywhere in this
// walkable world). `VenvmView` ('venvm-embed') is a live client of
// VENVM's own real reformat math, production-pipeline stage machine,
// and script-generation call; `VacoAnalyticsView`
// ('vaco-analytics-embed') is a live client of VACO Analytics' own
// real unified dashboard, showing whatever real revenue metrics the
// ecosystem's own apps have actually pushed in. A real 19th district,
// Beat Marketplace, fills a new 7th row (`WORLD_HEIGHT` grown again) --
// a user-flagged real gap, not self-discovered: Vvltvre Music's own
// beat/instrumental marketplace, confirmed genuinely new by direct
// grep across the whole repo before it was built at all.
// `BeatMarketplaceView` ('beat-marketplace-embed') is a live client of
// that same real listing/purchase engine -- it lives inside Vvltvre
// Music's own server/store (see `beatMarketplaceClient.js`'s own
// header), a sibling feature of `VultureMusicView` above, not a new
// backend. The full real loop: list a beat as a producer, browse real
// active listings with a real `<audio>` preview when one exists, buy
// as a real V3 transfer (100% to the producer, no platform cut), and
// the returned purchase record renders directly as the real license
// delivery. A real 20th district, Vvltvre Studios, fills the other
// open slot the 7th row had left -- closes one of that app's own two
// self-flagged gaps (the other, real music/podcast distribution, was
// closed on Vvltvre Studios' own side, not here). `VultureStudiosView`
// ('vulture-studios-embed') is a live client of that app's own real
// fund-and-produce financing engine: greenlight a project, invest as
// a real backer in a real financing round (capped at budget, real
// proportional equity), watch it move through a real production
// pipeline, distribute a completed project (film/tv into Vvltvre
// Flix, music/podcast into Vvltvre Music with investors paid there
// directly as real co-writers), and report real revenue against a
// completed project that wasn't distributed through Vvltvre Music
// (which already has its own real payout path). The
// `contentType === 'none'` branch below stays as the honest fallback
// for any future district added without one yet.
//
// **Real cross-origin SSO, closing this file's own previously-flagged
// gap**: VDP and VENVS are separate origins with separate Shield
// sessions -- logging into VDP used to not carry over into the
// embedded VENVS iframe, so a user saw VENVS's own login prompt inside
// the frame even after already signing in to VDP. Closed the same way
// the direct-visit case was closed (see `shieldAuth.js`'s own header):
// the iframe `src` below now carries VDP's own real `session.sessionToken`
// as `&shieldToken=...` alongside `?view=...`, and VENVS's own
// `adoptToken()` (App.jsx's mount effect) reads it from
// `window.location.search` exactly the same way whether that location
// is a top-level tab or an iframe's own `src` -- no VENVS-side code
// changed, the existing direct-visit mechanism just needed VDP to
// actually pass the token through. Still real and honest about what's
// NOT solved: this is still a one-directional handoff (VDP -> VENVS),
// not a shared cookie domain or two-way sync -- a session started
// fresh inside the VENVS iframe itself still doesn't propagate back
// out to VDP or sideways to the Shell.

const VENVS_URL = import.meta.env.VITE_VENVS_URL || "http://localhost:5173";

const DISTRICT_COLORS = {
  vex: "#4a6fa5",
  vado: "#a54a8f",
  publisher: "#4aa568",
  stage: "#a58a4a",
  food: "#a5504a",
  fashion: "#7a4aa5",
  village: "#4aa5a0",
  "dating-village": "#c25b7a",
  vago: "#c2933a",
  vacay: "#3aa0c2",
  hvntz: "#7a933a",
  void: "#5a5a8f",
  "vulture-music": "#933a6b",
  "vulture-pods": "#3a7d93",
  "vulture-flix": "#933a3a",
  chopz: "#4a933a",
  venvm: "#6b4a93",
  "vaco-analytics": "#4a7a93",
  "beat-marketplace": "#93704a",
  "vulture-studios": "#4a5f93",
  vacancy: "#5f7a4a",
  "vaco-merch": "#93564a",
};

export default function WorldView({ session, degvchiStore, foodDistrictStore, onPurchase }) {
  const [worldState, setWorldState] = useState(() => createWorldState());
  const [enteredDistrict, setEnteredDistrict] = useState(null);
  const canvasRef = useRef(null);
  const worldStateRef = useRef(worldState);

  useEffect(() => {
    worldStateRef.current = worldState;
  }, [worldState]);

  const handleKeyDown = useCallback((e) => {
    let dx = 0;
    let dy = 0;
    if (e.key === "ArrowUp" || e.key === "w") dy = -MOVE_STEP;
    else if (e.key === "ArrowDown" || e.key === "s") dy = MOVE_STEP;
    else if (e.key === "ArrowLeft" || e.key === "a") dx = -MOVE_STEP;
    else if (e.key === "ArrowRight" || e.key === "d") dx = MOVE_STEP;
    else return;
    e.preventDefault();
    const next = { ...worldStateRef.current };
    movePlayer(next, dx, dy);
    setWorldState(next);
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const camera = getCameraOffset(worldState);

    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

    for (const d of DISTRICTS) {
      const sx = d.x - camera.x;
      const sy = d.y - camera.y;
      if (sx + d.width < 0 || sx > VIEWPORT_WIDTH || sy + d.height < 0 || sy > VIEWPORT_HEIGHT) continue;
      const hasView = d.contentType !== 'none';
      ctx.fillStyle = DISTRICT_COLORS[d.id] || "#555";
      ctx.fillRect(sx, sy, d.width, d.height);
      ctx.strokeStyle = hasView ? "#fff" : "#888";
      ctx.lineWidth = hasView ? 3 : 1;
      ctx.setLineDash(hasView ? [] : [6, 4]);
      ctx.strokeRect(sx, sy, d.width, d.height);
      ctx.setLineDash([]);
      ctx.fillStyle = "#fff";
      ctx.font = "12px sans-serif";
      ctx.fillText(d.name, sx + 6, sy + 16);
    }

    const px = worldState.x - camera.x;
    const py = worldState.y - camera.y;
    ctx.fillStyle = "#ffd700";
    ctx.beginPath();
    ctx.arc(px, py, 8, 0, Math.PI * 2);
    ctx.fill();
  }, [worldState]);

  const currentDistrict = getCurrentDistrict(worldState);
  const nearbyBuilding = getNearbyBuilding(worldState);

  const handleEnter = () => {
    if (!nearbyBuilding) return;
    const result = enterBuilding(worldState, nearbyBuilding.id);
    setEnteredDistrict(result.district);
  };

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 8px 0" }}>VDP — Walkable World</h2>
      <p style={{ fontSize: 12, color: "#666" }}>
        Click the map, then use arrow keys or WASD. Position: ({Math.round(worldState.x)},{" "}
        {Math.round(worldState.y)}). {currentDistrict ? `In: ${currentDistrict.name}` : "Neutral ground"}.
      </p>
      <canvas
        ref={canvasRef}
        width={VIEWPORT_WIDTH}
        height={VIEWPORT_HEIGHT}
        tabIndex={0}
        style={{ border: "1px solid #444", outline: "none" }}
      />
      {nearbyBuilding && (
        <div style={{ marginTop: 8 }}>
          <button onClick={handleEnter}>Enter {nearbyBuilding.name}</button>
        </div>
      )}
      {enteredDistrict && (
        <div style={{ marginTop: 12, borderTop: "1px dashed #ccc", paddingTop: 12 }}>
          <p style={{ fontSize: 13 }}>
            Entered <strong>{enteredDistrict.name}</strong>.
          </p>
          {enteredDistrict.contentType === 'venvs-embed' && (
            <iframe
              title={`VENVS — ${enteredDistrict.name}`}
              src={`${VENVS_URL}/?view=${enteredDistrict.venvsView}${session?.sessionToken ? `&shieldToken=${encodeURIComponent(session.sessionToken)}` : ''}`}
              style={{ width: '100%', height: 420, border: '1px solid #444', borderRadius: 4 }}
            />
          )}
          {enteredDistrict.contentType === 'voken-embed' && enteredDistrict.id === 'vex' && (
            <VexView session={session} />
          )}
          {enteredDistrict.contentType === 'voken-embed' && enteredDistrict.id === 'vado' && (
            <VadoView session={session} />
          )}
          {enteredDistrict.contentType === 'vdp-native' && enteredDistrict.id === 'fashion' && (
            <DegvchiView session={session} store={degvchiStore} onPurchase={onPurchase} />
          )}
          {enteredDistrict.contentType === 'vdp-native' && enteredDistrict.id === 'food' && (
            <FoodDistrictView session={session} store={foodDistrictStore} onPurchase={onPurchase} />
          )}
          {enteredDistrict.contentType === 'vavlt-stvdios-embed' && enteredDistrict.id === 'stage' && (
            <StageView session={session} onPurchase={onPurchase} />
          )}
          {enteredDistrict.contentType === 'vxllage-embed' && enteredDistrict.id === 'village' && (
            <VillageDistrictView session={session} />
          )}
          {enteredDistrict.contentType === 'cvnvo-embed' && enteredDistrict.id === 'dating-village' && (
            <DatingVillageView session={session} />
          )}
          {enteredDistrict.contentType === 'vdp-native' && enteredDistrict.id === 'vago' && (
            <VenusResortView session={session} />
          )}
          {enteredDistrict.contentType === 'vdp-native' && enteredDistrict.id === 'combat-sports' && (
            <CombatSportsView session={session} />
          )}
          {enteredDistrict.contentType === 'vacay-embed' && enteredDistrict.id === 'vacay' && (
            <VacayView session={session} />
          )}
          {enteredDistrict.contentType === 'hvntz-embed' && enteredDistrict.id === 'hvntz' && (
            <HvntzView session={session} />
          )}
          {enteredDistrict.contentType === 'void-embed' && enteredDistrict.id === 'void' && (
            <VoidView session={session} />
          )}
          {enteredDistrict.contentType === 'vulture-music-embed' && enteredDistrict.id === 'vulture-music' && (
            <VultureMusicView session={session} />
          )}
          {enteredDistrict.contentType === 'vulture-pods-embed' && enteredDistrict.id === 'vulture-pods' && (
            <VulturePodsView session={session} />
          )}
          {enteredDistrict.contentType === 'vulture-flix-embed' && enteredDistrict.id === 'vulture-flix' && (
            <VultureFlixView session={session} />
          )}
          {enteredDistrict.contentType === 'chopz-embed' && enteredDistrict.id === 'chopz' && (
            <ChopzShortsView session={session} />
          )}
          {enteredDistrict.contentType === 'venvm-embed' && enteredDistrict.id === 'venvm' && (
            <VenvmView session={session} />
          )}
          {enteredDistrict.contentType === 'vaco-analytics-embed' && enteredDistrict.id === 'vaco-analytics' && (
            <VacoAnalyticsView />
          )}
          {enteredDistrict.contentType === 'beat-marketplace-embed' && enteredDistrict.id === 'beat-marketplace' && (
            <BeatMarketplaceView session={session} />
          )}
          {enteredDistrict.contentType === 'vulture-studios-embed' && enteredDistrict.id === 'vulture-studios' && (
            <VultureStudiosView session={session} />
          )}
          {enteredDistrict.contentType === 'vacancy-embed' && enteredDistrict.id === 'vacancy' && (
            <VacancyView />
          )}
          {enteredDistrict.contentType === 'vaco-merch-embed' && enteredDistrict.id === 'vaco-merch' && (
            <VacoMerchView session={session} onPurchase={onPurchase} />
          )}
          {enteredDistrict.contentType === 'none' && (
            <p style={{ fontSize: 12, color: "#888" }}>No view built for this district yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
