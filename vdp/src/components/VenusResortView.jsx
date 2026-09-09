// VDP -- the Venus Resort Complex, VDP's casino as a walkable place.
//
// Replaces the `vago-embed` doorway that used to sit at this district.
// **`VagoView` is not replaced** -- it is rendered here, at a table,
// once the player has walked to one and sat down. The game and the
// money stay VAGO's; this component owns only where you are standing.
//
// The interaction shape is the one `VillageDistrictView` already
// proved: arrow keys move, walking near a thing offers it, and the
// camera follows clamped to the venue. The one addition is the water
// taxi, which is a real timed state rather than a scene transition --
// see `venusResort.js`'s header for why the crossing has a duration.

import { useState, useEffect, useRef, useCallback } from "react";
import VagoView from "./VagoView.jsx";
import {
  RESORT_NAME, VIEWPORT_WIDTH, VIEWPORT_HEIGHT, MOVE_STEP, CROSSING_MS,
  ResortError,
  createResortState, movePlayer, getCameraOffset, getNearbyTable, isAtDock, isAboard,
  seatPlayer, standUp, boardWaterTaxi, arriveIfDue, crossingProgress,
  getVenue, tablesInVenue, staffInVenue, isTableOpen, dealerForTable,
} from "../lib/venusResort.js";

const VENUE_TONE = { land: "#c2933a", riverboat: "#3f7f8c" };

export default function VenusResortView({ session }) {
  const stateRef = useRef(createResortState());
  const [, forceRender] = useState(0);
  const [error, setError] = useState(null);
  const redraw = useCallback(() => forceRender((n) => n + 1), []);

  const state = stateRef.current;
  const aboard = isAboard(state);

  // Arrival is read from the clock rather than fired by a timer, so a
  // dropped interval cannot strand the player mid-river. The interval
  // only exists to re-render; `arriveIfDue` is the authority.
  useEffect(() => {
    if (!aboard) return undefined;
    const id = setInterval(() => {
      arriveIfDue(stateRef.current);
      redraw();
    }, 200);
    return () => clearInterval(id);
  }, [aboard, redraw]);

  useEffect(() => {
    function onKey(e) {
      const step = MOVE_STEP;
      if (e.key === "ArrowUp") movePlayer(stateRef.current, 0, -step);
      else if (e.key === "ArrowDown") movePlayer(stateRef.current, 0, step);
      else if (e.key === "ArrowLeft") movePlayer(stateRef.current, -step, 0);
      else if (e.key === "ArrowRight") movePlayer(stateRef.current, step, 0);
      else return;
      e.preventDefault();
      redraw();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [redraw]);

  // Every mutation goes through the module and surfaces its refusal
  // verbatim. The reasons there are written to be read by a player
  // ("take the water taxi", "has no dealer and is closed"), so
  // rewording them here would only make them worse.
  function attempt(fn) {
    try {
      fn();
      setError(null);
    } catch (err) {
      if (!(err instanceof ResortError)) throw err;
      setError(err.message);
    }
    redraw();
  }

  const venue = aboard ? null : getVenue(state.venueId);
  const camera = aboard ? { x: 0, y: 0 } : getCameraOffset(state);
  const nearby = getNearbyTable(state);
  const seatedTable = state.seatedAtTableId
    ? tablesInVenue(state.venueId).find((t) => t.id === state.seatedAtTableId)
    : null;

  if (aboard) {
    const pct = Math.round((crossingProgress(state) ?? 0) * 100);
    const to = getVenue(state.crossing.to);
    return (
      <section style={{ marginTop: 16 }}>
        <h3 style={{ margin: "0 0 4px" }}>{RESORT_NAME}</h3>
        <p style={{ color: "#666", margin: "0 0 12px" }}>
          Aboard the VOID water taxi to <strong>{to.name}</strong>. Crossing takes{" "}
          {Math.round(CROSSING_MS / 1000)}s.
        </p>
        <div style={{ background: "#eef3f6", border: "1px solid #cfd9df", borderRadius: 8, padding: 16 }}>
          <div style={{ height: 10, background: "#cfd9df", borderRadius: 5, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: VENUE_TONE.riverboat }} />
          </div>
          <p style={{ margin: "10px 0 0", color: "#456" }}>{pct}% across.</p>
        </div>
      </section>
    );
  }

  return (
    <section style={{ marginTop: 16 }}>
      <h3 style={{ margin: "0 0 4px" }}>{RESORT_NAME}</h3>
      <p style={{ color: "#666", margin: "0 0 12px" }}>
        {venue.name} — arrow keys to walk. Settles in VCoin only.
      </p>

      <div
        style={{
          position: "relative", width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT,
          overflow: "hidden", border: "1px solid #ccc", borderRadius: 8,
          background: state.venueId === "land" ? "#faf4e6" : "#eef5f7",
        }}
      >
        <div
          style={{
            position: "absolute", width: venue.width, height: venue.height,
            transform: `translate(${-camera.x}px, ${-camera.y}px)`,
          }}
        >
          {tablesInVenue(venue.id).map((t) => {
            const open = isTableOpen(t.id);
            return (
              <div
                key={t.id}
                style={{
                  position: "absolute", left: t.x - 34, top: t.y - 22, width: 68, height: 44,
                  borderRadius: 22,
                  background: open ? VENUE_TONE[venue.id] : "#bbb",
                  opacity: open ? 1 : 0.55,
                  color: "#fff", fontSize: 10, display: "flex", alignItems: "center",
                  justifyContent: "center", textAlign: "center", padding: 2,
                  outline: nearby?.id === t.id ? "2px solid #222" : "none",
                }}
                title={open ? `Dealer: ${dealerForTable(t.id).name}` : "Closed — no dealer"}
              >
                {t.name}
              </div>
            );
          })}

          {/* The dock. The only tile the taxi calls at. */}
          <div
            style={{
              position: "absolute", left: venue.landing.x - 18, top: venue.landing.y - 18,
              width: 36, height: 36, borderRadius: 6, border: "2px dashed #3f7f8c",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
            }}
            title="Water taxi landing"
          >
            ⛴
          </div>

          <div
            style={{
              position: "absolute", left: state.x - 6, top: state.y - 6,
              width: 12, height: 12, borderRadius: "50%", background: "#222",
            }}
          />
        </div>
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {nearby && !seatedTable && (
          <button onClick={() => attempt(() => seatPlayer(stateRef.current, nearby.id))}>
            Sit at {nearby.name}
          </button>
        )}
        {seatedTable && (
          <button onClick={() => attempt(() => standUp(stateRef.current))}>
            Leave {seatedTable.name}
          </button>
        )}
        {isAtDock(state) && (
          <button onClick={() => attempt(() => boardWaterTaxi(stateRef.current))}>
            Board the VOID water taxi
          </button>
        )}
      </div>

      {error && <p style={{ color: "crimson", marginTop: 8 }}>{error}</p>}

      <p style={{ color: "#666", fontSize: 12, marginTop: 8 }}>
        On the floor: {staffInVenue(venue.id).map((n) => `${n.name} (${n.role})`).join(", ")}
      </p>

      {/* VAGO's own game, unchanged, once the player is actually seated. */}
      {seatedTable && (
        <div style={{ marginTop: 12, borderTop: "1px solid #eee", paddingTop: 12 }}>
          <p style={{ color: "#666", margin: "0 0 8px" }}>
            Seated at <strong>{seatedTable.name}</strong>, dealt by{" "}
            {dealerForTable(seatedTable.id).name}.
          </p>
          <VagoView session={session} />
        </div>
      )}
    </section>
  );
}
