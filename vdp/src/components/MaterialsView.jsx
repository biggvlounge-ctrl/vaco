import { useState, useEffect, useCallback } from "react";

// Local materials and the old-world import stock (resources.js) have
// been real and tested since Phase 16, but had no way for a player to
// actually dig -- every verification of it went through curl with a
// bearer token, never a button. This is that button.

const VDP_API_URL = import.meta.env?.VITE_VDP_API_URL || "http://localhost:8827";

const RESOURCE_LABELS = {
  wood: "Wood", stone: "Stone", clay: "Clay", ore: "Ore",
  game: "Game (hunted)", crop: "Crop (farmed)",
};

export default function MaterialsView({ session, onChange }) {
  const [materials, setMaterials] = useState(null);
  const [canDig, setCanDig] = useState(true);
  const [oldWorldStock, setOldWorldStock] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [lastDig, setLastDig] = useState(null);

  const refresh = useCallback(async () => {
    if (!session?.userId) return;
    try {
      const userId = encodeURIComponent(session.userId);
      const res = await fetch(`${VDP_API_URL}/api/resources/${userId}`);
      const body = await res.json();
      setMaterials(body.materials);
      setCanDig(body.canDig);
      setOldWorldStock(body.oldWorldStock);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [session?.userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDig = async () => {
    setBusy(true);
    setError(null);
    try {
      const userId = encodeURIComponent(session.userId);
      const res = await fetch(`${VDP_API_URL}/api/resources/${userId}/dig`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.sessionToken}` },
        body: JSON.stringify({}),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `dig failed (${res.status})`);
      setLastDig(`Dug up ${body.amount} ${RESOURCE_LABELS[body.type] || body.type}.`);
      await refresh();
      if (onChange) await onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!session) return null;

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 8px 0" }}>Materials</h2>
      {error && <p style={{ fontSize: 12, color: "#e04a4a" }}>{error}</p>}
      {lastDig && <p style={{ fontSize: 12, color: "#3a9d6f" }}>{lastDig}</p>}

      {materials && (
        <ul style={{ fontSize: 13, margin: "0 0 12px 0", paddingLeft: 0, listStyle: "none" }}>
          {Object.entries(materials).map(([type, amount]) => (
            <li key={type} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
              <span>{RESOURCE_LABELS[type] || type}</span>
              <span>{amount}</span>
            </li>
          ))}
        </ul>
      )}

      <button onClick={handleDig} disabled={busy || !canDig}>
        {busy ? "…" : canDig ? "Dig for resources" : "Still recovering — try again shortly"}
      </button>

      <p style={{ fontSize: 12, color: "#888", marginTop: 8 }}>
        Old-world import stock remaining: {oldWorldStock ?? "…"} — brought from the world the
        first settlers migrated from, and never replenished.
      </p>
    </div>
  );
}
