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

import { useState } from "react";
import {
  DISTRICT_NAME, MATCH_FORMATS, SKILL_LEVELS, CombatError,
  createMatch, startMatch, recordResult, assertBookable,
  broadcastChannels, predictionMarketEligibility, isRookieEligible, describeMatch,
} from "../lib/combatSports.js";

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

export default function CombatSportsView({ session }) {
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
    </section>
  );
}
