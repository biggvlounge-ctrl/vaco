import { useState } from "react";
import {
  createChopz, getAvailableUnits, leaseUnit, runShift,
  staffWithAIEmployee, getPendingEarnings, collectEarnings, LEASE_COST,
} from "../lib/chopz.js";
import { transferVCoin } from "../lib/v3Client.js";

// Phase 6 demo: CHOPZ District. Real leasing, real self-run shifts
// with a real cooldown, and real AI-employee passive income computed
// from actual elapsed time. Not the full CHOPZ UI (Digital Twin
// levels, DREAMS billboards) -- proves the leasing/shift/passive-
// income mechanics against the real wallet.
//
// One unit is staged as already AI-staffed 2 real hours in the past
// (backdated, same demo technique as Phase 3's abandoned-cart
// backdating) so "Collect earnings" shows a real nonzero payout
// immediately, without the demo requiring an actual 2-hour wait.

export default function ChopzView({ session, onPurchase }) {
  const [store] = useState(() => createChopz());
  const [, forceRender] = useState(0);
  const [error, setError] = useState(null);
  const [lastAction, setLastAction] = useState(null);
  const [busy, setBusy] = useState(null);
  const [staged, setStaged] = useState(false);

  const transferFn = (from, to, amount, reason) =>
    transferVCoin({ fromUserId: from, toUserId: to, amount, reason });

  const withBusy = (unitId, fn) => async () => {
    setBusy(unitId);
    setError(null);
    try {
      await fn();
      await onPurchase();
      forceRender((n) => n + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const handleLease = (unitId) => withBusy(unitId, () => leaseUnit(store, { unitId, ownerId: session.userId, transferFn }));
  const handleRunShift = (unitId) =>
    withBusy(unitId, async () => {
      const result = await runShift(store, { unitId, transferFn });
      setLastAction(`Shift complete on unit #${unitId}: earned ${result.payout} VCoin.`);
    });
  const handleCollect = (unitId) =>
    withBusy(unitId, async () => {
      const result = await collectEarnings(store, { unitId, transferFn });
      setLastAction(`Collected ${result.collected} VCoin in passive AI-employee income from unit #${unitId}.`);
    });

  const handleStageDemo = withBusy("stage", async () => {
    const unit = getAvailableUnits(store)[0];
    await leaseUnit(store, { unitId: unit.id, ownerId: session.userId, transferFn });
    staffWithAIEmployee(store, unit.id, "Marcus (AI)", Date.now() - 2 * 60 * 60 * 1000);
    setStaged(true);
  });

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 8px 0" }}>CHOPZ District</h2>

      {store.units.map((unit) => {
        const pending = unit.mode === "ai_employee" ? getPendingEarnings(store, unit.id, Date.now()) : null;
        return (
          <div key={unit.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderTop: "1px solid #eee" }}>
            <span>
              #{unit.id} {unit.category}{" "}
              {unit.ownerId ? (
                <span style={{ color: "#888" }}>
                  — leased, {unit.mode === "ai_employee" ? `staffed by ${unit.employeeName} (pending: ${pending} VCoin)` : "self-run"}
                </span>
              ) : (
                <span style={{ color: "#888" }}>— available (${LEASE_COST} to lease)</span>
              )}
            </span>
            {!unit.ownerId && (
              <button onClick={handleLease(unit.id)} disabled={busy === unit.id}>
                {busy === unit.id ? "Leasing…" : "Lease"}
              </button>
            )}
            {unit.ownerId === session.userId && unit.mode === "self_run" && (
              <button onClick={handleRunShift(unit.id)} disabled={busy === unit.id}>
                {busy === unit.id ? "Working…" : "Run shift"}
              </button>
            )}
            {unit.ownerId === session.userId && unit.mode === "ai_employee" && (
              <button onClick={handleCollect(unit.id)} disabled={busy === unit.id || pending <= 0}>
                {busy === unit.id ? "Collecting…" : `Collect (${pending})`}
              </button>
            )}
          </div>
        );
      })}

      {!staged && (
        <div style={{ marginTop: 8 }}>
          <button onClick={handleStageDemo} disabled={busy === "stage"}>
            Demo: lease + AI-staff a unit as if 2 hours ago
          </button>
        </div>
      )}

      {lastAction && <p style={{ fontSize: 12, color: "#2a7" }}>{lastAction}</p>}
      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
    </div>
  );
}
