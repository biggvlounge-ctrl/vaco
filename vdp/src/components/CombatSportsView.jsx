// VDP -- the Combat Sports District.
//
// Shows a real card and what each bout can and cannot do. The rules
// live in `combatSports.js`; this renders them and surfaces the
// refusals verbatim, because the reasons there are written to be read
// ("street-tier bouts do not settle...") and rewording them here would
// only make them vaguer.
//
// The three integrations are shown as what they are -- seams. The
// channel list is what Vavlt Stvdios would open, the prediction line
// is the gate before calling VAGO, and rookie eligibility is the gate
// before VOKEN. None of them are called from here.

import { useState, useEffect, useCallback } from "react";
import {
  DISTRICT_NAME, MATCH_FORMATS, SKILL_LEVELS, CombatError,
  createMatch, startMatch, recordResult, assertBookable,
  broadcastChannels, predictionMarketEligibility, isRookieEligible, describeMatch,
} from "../lib/combatSports.js";
import { MOVES } from "../lib/liveWrestling.js";

// A real opening card, one per format, spanning the progression so the
// street-tier refusal is visible rather than theoretical.
function seedCard() {
  return [
    createMatch({
      matchId: "vdp-cs-1", matchFormat: "one-on-one", combatSportType: "boxing",
      skillLevel: "professional", participantIds: ["ruiz", "okafor"],
    }),
    createMatch({
      matchId: "vdp-cs-2", matchFormat: "cage-match", combatSportType: "mma",
      skillLevel: "semi-pro", participantIds: ["delacroix", "mbeki"],
    }),
    createMatch({
      matchId: "vdp-cs-3", matchFormat: "tag-team", combatSportType: "wrestling",
      skillLevel: "amateur", participantIds: ["hale", "quist", "navarro", "penn"],
    }),
    createMatch({
      matchId: "vdp-cs-4", matchFormat: "royal-rumble", combatSportType: "wrestling",
      skillLevel: "street", participantIds: ["ozz", "kite", "bramble", "sol", "renn"],
    }),
  ];
}

const TIER_TONE = {
  street: "#8a8a8a", amateur: "#5b7fa6", "semi-pro": "#a6742f", professional: "#8c3f5b",
};

const VDP_API_URL = import.meta.env?.VITE_VDP_API_URL || "http://localhost:8827";

const MOVE_LABELS = {
  strike: ["Strike", "Quick — beats Grapple"],
  grapple: ["Grapple", "Control — beats High-Risk"],
  highRisk: ["High-Risk (top rope)", "Big damage, beats Strike — a Reversal punishes it hard"],
  reversal: ["Reversal", "Nullifies Strike/Grapple, hard-counters a High-Risk"],
  pinAttempt: ["Pin Attempt", "Wins outright if their health is low enough — fails exposed otherwise"],
  submissionAttempt: ["Submission Attempt", "Wins outright if their stamina is low enough — fails exposed otherwise"],
};

function Meter({ label, value }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#666" }}>
        <span>{label}</span><span>{value}</span>
      </div>
      <div style={{ height: 6, background: "#eee", borderRadius: 3 }}>
        <div style={{ height: 6, width: `${value}%`, background: value > 40 ? "#2b7a4b" : "#8c3f5b", borderRadius: 3 }} />
      </div>
    </div>
  );
}

// -- Live wrestling: two real players, one real-time match --------------
//
// By direct instruction ("people can wrestle other players live too"),
// with the mechanic given directly too: a turn-based move exchange.
// This is the one part of this view that is genuinely real-time and
// server-backed -- the rest of the view above is a local, in-browser
// demo card (see this file's own original header). Real-time delivery
// comes from `wrestlingUpdates`, read from WorldView's one shared
// WebSocket connection (see its own header) rather than this
// component opening a second one; a manual refresh still works if a
// frame was missed.
function LiveWrestlingPanel({ session, wrestlingUpdates }) {
  const [matchIdInput, setMatchIdInput] = useState("");
  const [watchingId, setWatchingId] = useState(null);
  const [live, setLive] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (id) => {
    setError(null);
    try {
      const res = await fetch(`${VDP_API_URL}/api/combat-sports/matches/${encodeURIComponent(id)}/live`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `load failed (${res.status})`);
      setLive(body);
      setWatchingId(id);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  // A pushed frame for the match this player is already watching
  // updates the view without them having to re-click Watch.
  useEffect(() => {
    if (!watchingId) return;
    const update = wrestlingUpdates?.[watchingId];
    if (update?.live) setLive(update.live);
  }, [wrestlingUpdates, watchingId]);

  const myWrestlerId = session?.userId && live?.wrestlers && live.wrestlers[session.userId] ? session.userId : null;
  const myTurn = myWrestlerId && live?.status === "live" && (live.waitingOn || []).includes(myWrestlerId);

  async function sendMove(move) {
    if (!watchingId || !myWrestlerId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${VDP_API_URL}/api/combat-sports/matches/${encodeURIComponent(watchingId)}/live/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.sessionToken}` },
        body: JSON.stringify({ wrestlerId: myWrestlerId, move }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `move failed (${res.status})`);
      setLive(body);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendForfeit() {
    if (!watchingId || !myWrestlerId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${VDP_API_URL}/api/combat-sports/matches/${encodeURIComponent(watchingId)}/live/forfeit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.sessionToken}` },
        body: JSON.stringify({ wrestlerId: myWrestlerId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `forfeit failed (${res.status})`);
      setLive(body);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ marginTop: 24, borderTop: "2px solid #ddd", paddingTop: 16 }}>
      <h4 style={{ margin: "0 0 4px" }}>Live Wrestling</h4>
      <p style={{ color: "#666", margin: "0 0 12px", fontSize: 13 }}>
        Two real players, one real-time match — a turn-based move exchange on a real, already-booked
        one-on-one or cage-match card. Booking and opening the live feed is a promoter action (done
        server-side); once it's open, watch by its match id and, if you're one of the two wrestlers
        on the card, pick your move each round.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          placeholder="match-1"
          value={matchIdInput}
          onChange={(e) => setMatchIdInput(e.target.value)}
          style={{ padding: "4px 8px" }}
        />
        <button disabled={!matchIdInput || busy} onClick={() => load(matchIdInput)}>Watch</button>
      </div>

      {error && <p style={{ color: "crimson", fontSize: 13 }}>{error}</p>}

      {live && (
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
            <strong>{live.matchId}</strong>
            <span style={{ color: "#666" }}>
              {live.status === "live" ? `Round ${live.round}` : `Finished — ${live.winnerId} won by ${live.endedBy}`}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 12 }}>
            {Object.entries(live.wrestlers || {}).map(([id, s]) => (
              <div key={id}>
                <div style={{ fontSize: 13, marginBottom: 4 }}>
                  {id}{id === myWrestlerId ? " (you)" : ""}
                  {live.status === "live" && (live.waitingOn || []).includes(id) && (
                    <span style={{ color: "#8a5a00", fontSize: 11 }}> — picking…</span>
                  )}
                </div>
                <Meter label="Health" value={s.health} />
                <Meter label="Stamina" value={s.stamina} />
              </div>
            ))}
          </div>

          {myTurn && (
            <div>
              <p style={{ fontSize: 12, color: "#666", margin: "0 0 6px" }}>Your move:</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {MOVES.map((move) => (
                  <button key={move} disabled={busy} onClick={() => sendMove(move)} title={MOVE_LABELS[move][1]}>
                    {MOVE_LABELS[move][0]}
                  </button>
                ))}
              </div>
              <button
                disabled={busy}
                onClick={sendForfeit}
                style={{ marginTop: 8, color: "#8c3f5b" }}
              >
                Forfeit
              </button>
            </div>
          )}

          {myWrestlerId && !myTurn && live.status === "live" && (
            <p style={{ fontSize: 12, color: "#666" }}>Move submitted — waiting on your opponent.</p>
          )}

          {!myWrestlerId && live.status === "live" && (
            <p style={{ fontSize: 12, color: "#666" }}>Spectating — you're not one of the two wrestlers on this card.</p>
          )}
        </div>
      )}
    </section>
  );
}

export default function CombatSportsView({ session, wrestlingUpdates }) {
  const [card, setCard] = useState(seedCard);
  const [error, setError] = useState(null);

  function attempt(fn) {
    try {
      fn();
      setError(null);
    } catch (err) {
      if (!(err instanceof CombatError)) throw err;
      setError(err.message);
    }
    setCard((c) => [...c]);
  }

  return (
    <section style={{ marginTop: 16 }}>
      <h3 style={{ margin: "0 0 4px" }}>{DISTRICT_NAME}</h3>
      <p style={{ color: "#666", margin: "0 0 12px" }}>
        {MATCH_FORMATS.length} formats, {SKILL_LEVELS.length} tiers — street through
        professional, any discipline. Streams via Vavlt Stvdios, predictions via VAGO,
        rookie cards via VOKEN.
      </p>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <div style={{ display: "grid", gap: 10 }}>
        {card.map((match) => {
          const d = describeMatch(match);
          const market = predictionMarketEligibility(match);
          const channels = broadcastChannels(match);
          return (
            <div
              key={match.matchId}
              style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <strong style={{ textTransform: "capitalize" }}>{match.combatSportType}</strong>
                <span style={{ color: "#666" }}>{match.matchFormat}</span>
                <span
                  style={{
                    fontSize: 11, padding: "2px 8px", borderRadius: 10,
                    background: TIER_TONE[match.skillLevel], color: "#fff",
                  }}
                >
                  {match.skillLevel}
                </span>
                <span style={{ marginLeft: "auto", color: "#666", fontSize: 12 }}>{d.status}</span>
              </div>

              <p style={{ margin: "8px 0 4px", fontSize: 13 }}>
                {match.participantIds.join(match.matchFormat === "tag-team" ? " & " : " vs ")}
              </p>

              <p style={{ margin: "0 0 4px", fontSize: 12, color: "#666" }}>
                {channels.length} monetizable angles: {channels.map((c) => c.angle).join(", ")}
              </p>

              <p style={{ margin: "0 0 8px", fontSize: 12, color: market.eligible ? "#2b7a4b" : "#8a5a00" }}>
                Predictions: {market.eligible ? "open on VAGO" : market.reason}
              </p>

              <p style={{ margin: "0 0 8px", fontSize: 12, color: "#666" }}>
                Rookie cards:{" "}
                {match.participantIds
                  .filter((id) => isRookieEligible({ skillLevel: match.skillLevel }))
                  .length > 0
                  ? `${match.participantIds.length} eligible for a VOKEN rookie card`
                  : "none — this card is all professionals"}
              </p>

              <div style={{ display: "flex", gap: 8 }}>
                {match.status === "scheduled" && (
                  <button
                    onClick={() => attempt(() => {
                      assertBookable(match, card);
                      startMatch(match);
                    })}
                  >
                    Start
                  </button>
                )}
                {match.status === "live" && (
                  <button onClick={() => attempt(() => recordResult(match, [match.participantIds[0]]))}>
                    Record {match.participantIds[0]} as winner
                  </button>
                )}
                {match.status === "finished" && (
                  <span style={{ fontSize: 12, color: "#2b7a4b" }}>
                    Winner: {match.winnerIds.join(", ")}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <LiveWrestlingPanel session={session} wrestlingUpdates={wrestlingUpdates} />
    </section>
  );
}
