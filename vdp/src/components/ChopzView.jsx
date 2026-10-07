import { useState } from "react";
import {
  createChopz, getAvailableUnits, leaseUnit, runShift,
  staffWithAIEmployee, getPendingEarnings,
  getStock, restockUnit, LEASE_COST, RESTOCK_COST,
} from "../lib/chopz.js";
import { transferVCoin } from "../lib/v3Client.js";
import { sessionHeaders } from "../lib/shieldAuth.js";

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
//
// **Real, pre-existing bugfix found while adding stock above**:
// `runShift`/`collectEarnings` both pay out a platform-funded leg (the
// platform account -> the unit's owner) and have always required a
// real `payoutFn`, but this view used to pass `transferFn` (a
// user-funded-leg function) to both -- so every "Run shift" and
// "Collect" click has always thrown `requirePayoutFn`'s refusal.
// "Run shift" is fixed for real here: its payout is a flat, server-
// known constant (`SHIFT_PAYOUT`), so VDP's own server now holds the
// service credential for it (`POST /api/chopz/shift-payout`, mirroring
// Food District's real `cook-payout` route). "Collect" is NOT fixed
// the same way: an AI employee's pending earnings are a variable
// amount computed from client-only elapsed time, and CHOPZ has no
// server-side state to verify that amount against (this module is
// deliberately entirely client-side, see chopz.js's own header) --
// trusting a client-supplied variable amount would let anyone claim
// an arbitrary payout. Fully fixing it needs CHOPZ to gain real
// server-side state, which is a bigger change than this pass; until
// then the button stays disabled with an honest explanation instead
// of silently throwing the internal refusal at a real player.

const VDP_API_URL = import.meta.env?.VITE_VDP_API_URL || "http://localhost:8827";

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
      const payoutFn = async (from, to, amount, reason) => {
        const res = await fetch(`${VDP_API_URL}/api/chopz/shift-payout`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...sessionHeaders() },
          body: JSON.stringify({ ownerId: to, unitId }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `shift-payout failed (${res.status})`);
        }
        return { from, to, amount, reason };
      };
      const result = await runShift(store, { unitId, payoutFn });
      setLastAction(`Shift complete on unit #${unitId}: earned ${result.payout} VCoin. Stock: ${result.stock} left.`);
    });

  const handleRestock = (unitId) =>
    withBusy(unitId, async () => {
      const result = await restockUnit(store, { unitId, ownerId: session.userId, transferFn });
      setLastAction(`Restocked unit #${unitId}: +${result.batchSize} units (now ${result.stock}).`);
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
      <p style={{ fontSize: 12, color: "#888", margin: "0 0 8px 0" }}>
        Leasable storefronts themed around CHOPZ's real seller niches (beauty, apparel, gadgets, home, toys) plus screen-based DTC shops.
      </p>

      {store.units.map((unit) => {
        const pending = unit.mode === "ai_employee" ? getPendingEarnings(store, unit.id, Date.now()) : null;
        const stock = getStock(store, unit.id);
        return (
          <div key={unit.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderTop: "1px solid #eee" }}>
            <span>
              #{unit.id} {unit.category}{" "}
              {unit.ownerId ? (
                <span style={{ color: "#888" }}>
                  — leased, {unit.mode === "ai_employee" ? `staffed by ${unit.employeeName} (pending: ${pending} VCoin)` : "self-run"}, stock: {stock}
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
              <span>
                <button onClick={handleRunShift(unit.id)} disabled={busy === unit.id || stock <= 0} title={stock <= 0 ? "Sold out -- restock first" : undefined}>
                  {busy === unit.id ? "Working…" : "Run shift"}
                </button>{" "}
                <button onClick={handleRestock(unit.id)} disabled={busy === unit.id} title={`Source ${RESTOCK_COST} VCoin worth of fresh stock`}>
                  Restock (${RESTOCK_COST})
                </button>
              </span>
            )}
            {unit.ownerId === session.userId && unit.mode === "ai_employee" && (
              <span>
                <button disabled title="AI-employee payouts need a server-verified amount; this needs CHOPZ to gain server-side state, which this pass didn't include -- disabled rather than left to fail silently.">
                  Collect (pending: {pending})
                </button>{" "}
                <button onClick={handleRestock(unit.id)} disabled={busy === unit.id} title={`Source ${RESTOCK_COST} VCoin worth of fresh stock`}>
                  Restock (${RESTOCK_COST})
                </button>
              </span>
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
