import { useState } from "react";
import { startCasinoSession, startMinesRound, revealMinesTile, cashOutMines } from "../lib/vagoClient.js";

// VDP's real VAGO district -- a live client of VAGO's own Originals
// (Mines) casino game. Same real-cross-app-fetch shape as VEX/VADO
// ('voken-embed'): no game logic here, every real stake, tile reveal,
// and payout number comes back from VAGO's own server.

const BOARD_SIZE = 25;
const MIN_MINES = 1;
const MAX_MINES = 24;

export default function VagoView({ session }) {
  const [stakeAmount, setStakeAmount] = useState("10");
  const [minesCount, setMinesCount] = useState("3");
  const [round, setRound] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [cashedOut, setCashedOut] = useState(null);

  const handleStart = async () => {
    setBusy(true);
    setError(null);
    setCashedOut(null);
    try {
      const stake = Number(stakeAmount);
      const mines = Number(minesCount);
      const casinoSession = await startCasinoSession({ userId: session.userId, stakeAmount: stake });
      const newRound = await startMinesRound({
        sessionId: casinoSession.id,
        clientSeed: `vdp-${Date.now()}`,
        minesCount: mines,
      });
      setRound(newRound);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleReveal = async (tileIndex) => {
    if (!round || round.status !== "active" || round.revealedTiles.includes(tileIndex)) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await revealMinesTile({ roundId: round.id, tileIndex });
      setRound(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleCashOut = async () => {
    if (!round || round.status !== "active") return;
    setBusy(true);
    setError(null);
    try {
      const result = await cashOutMines({ roundId: round.id });
      setCashedOut(result);
      setRound(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 4px 0" }}>VAGO — Originals: Mines</h2>
      <p style={{ fontSize: 11, color: "#888", margin: "0 0 8px" }}>
        Real VCoin stake via VAGO's own casino session + provably-fair round -- every tile and multiplier below comes from VAGO's own server.
      </p>

      {!round || round.status !== "active" ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <label style={{ fontSize: 12 }}>
            Stake{" "}
            <input
              type="number" min="1" step="1" style={{ width: 70 }}
              value={stakeAmount} onChange={(e) => setStakeAmount(e.target.value)}
            />
          </label>
          <label style={{ fontSize: 12 }}>
            Mines ({MIN_MINES}-{MAX_MINES}){" "}
            <input
              type="number" min={MIN_MINES} max={MAX_MINES} step="1" style={{ width: 50 }}
              value={minesCount} onChange={(e) => setMinesCount(e.target.value)}
            />
          </label>
          <button onClick={handleStart} disabled={busy}>Start round</button>
        </div>
      ) : (
        <>
          <p style={{ fontSize: 12, color: "#666", margin: "0 0 8px" }}>
            Round #{round.id} — {round.minesCount} mines — current multiplier: {round.currentMultiplier}x
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 32px)", gap: 4, marginBottom: 8 }}>
            {Array.from({ length: BOARD_SIZE }, (_, i) => {
              const revealed = round.revealedTiles.includes(i);
              return (
                <button
                  key={i}
                  onClick={() => handleReveal(i)}
                  disabled={busy || revealed || round.status !== "active"}
                  style={{
                    width: 32, height: 32, fontSize: 11,
                    background: revealed ? "#d4edda" : "#eee",
                  }}
                >
                  {revealed ? "✓" : ""}
                </button>
              );
            })}
          </div>
          <button onClick={handleCashOut} disabled={busy || round.status !== "active"}>
            Cash out ({round.currentMultiplier}x)
          </button>
        </>
      )}

      {round && round.status === "lost" && (
        <p style={{ fontSize: 12, color: "crimson" }}>Round #{round.id} hit a mine — payout: 0.</p>
      )}
      {cashedOut && (
        <p style={{ fontSize: 12, color: "#1a7d3c" }}>Cashed out round #{cashedOut.id} — payout: {cashedOut.payout} VCoin.</p>
      )}
      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
    </div>
  );
}
