import { useState, useEffect, useCallback } from "react";
import { registerScreen, listScreens, getScreenRevenue } from "../lib/dreamsClient.js";
import { TOWN_NAME } from "../lib/town.js";

// The "screen living spaces" city tier: a real ad/DOOH screen a player
// registers in DREAMS' own real network (dreams/server.js), placed
// somewhere in Meridian. DREAMS stays the only place a screen earns
// from an advertiser's campaign; this panel only registers a screen
// under the player's own id and shows DREAMS' own real revenue number
// back -- no revenue logic duplicated here.

export default function DreamsScreensView({ session }) {
  const [screens, setScreens] = useState([]);
  const [revenues, setRevenues] = useState({});
  const [locationName, setLocationName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!session?.userId) return;
    try {
      const all = await listScreens();
      const mine = all.filter((s) => s.screenOwnerId === session.userId);
      setScreens(mine);
      const entries = await Promise.all(
        mine.map(async (s) => [s.id, await getScreenRevenue(s.id)]),
      );
      setRevenues(Object.fromEntries(entries));
    } catch {
      // DREAMS may not be reachable in this environment -- the panel
      // stays empty rather than throwing.
    }
  }, [session?.userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleRegister = async () => {
    if (!locationName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await registerScreen({
        screenOwnerId: session.userId,
        locationName: locationName.trim(),
        locationAddress: `${TOWN_NAME}, VDP`,
      });
      setLocationName("");
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!session) return null;

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 8px 0" }}>DREAMS Screens</h2>
      {error && <p style={{ fontSize: 12, color: "#e04a4a" }}>{error}</p>}

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          type="text"
          placeholder={`screen name (e.g. "${TOWN_NAME} Plaza")`}
          value={locationName}
          onChange={(e) => setLocationName(e.target.value)}
          style={{ fontSize: 12 }}
        />
        <button onClick={handleRegister} disabled={busy || !locationName.trim()}>
          {busy ? "…" : "Register a screen"}
        </button>
      </div>

      {screens.length === 0 && <p style={{ fontSize: 12, color: "#888" }}>No screens registered yet.</p>}
      <ul style={{ fontSize: 12, margin: 0, paddingLeft: 0, listStyle: "none" }}>
        {screens.map((s) => (
          <li key={s.id} style={{ padding: "4px 0" }}>
            {s.locationName} ({s.locationAddress}) — {s.status}
            {revenues[s.id] && <>, {revenues[s.id].totalRevenue ?? 0} VCoin earned ({revenues[s.id].impressionCount ?? 0} impressions)</>}
          </li>
        ))}
      </ul>
    </div>
  );
}
