import { useState, useEffect, useCallback } from "react";
import { PUBLIC_HOUSING_NAME } from "../lib/property.js";

// The Towers -- public-housing relocation. "Once more people start to
// enter the economy, people that start to accumulate tickets,
// crime... they will be moved out to... a project style, public
// housing style environment... This will also turn into like the red
// zones" (9 Oct 2026, direct instruction). The relocation itself is
// server-side and automatic (`server.cjs`'s own `maybeRelocateToProjectHousing`,
// fired after a real ticket/detention), not a button here -- this
// panel is a real readout: the player's own live, derived social
// class (never stored -- see `socialClass.js`), whether they are
// currently assigned here, and the real crime concentration this
// location has already accumulated through the EXISTING
// `security.js` mechanism (no second, parallel "red zone" tracker was
// built -- see `property.js`'s own header for why that's enough).

const VDP_API_URL = import.meta.env?.VITE_VDP_API_URL || "http://localhost:8827";

export default function TowersView({ session }) {
  const [socialClass, setSocialClass] = useState(null);
  const [home, setHome] = useState(null);
  const [crimeCount, setCrimeCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!session?.userId) return;
    try {
      const userId = encodeURIComponent(session.userId);
      const [classRes, homeRes, crimeRes] = await Promise.all([
        fetch(`${VDP_API_URL}/api/players/${userId}/social-class`),
        fetch(`${VDP_API_URL}/api/property/${userId}`),
        fetch(`${VDP_API_URL}/api/security/by-location`),
      ]);
      setSocialClass((await classRes.json()).socialClass);
      setHome((await homeRes.json()).home);
      const crimeByLocation = (await crimeRes.json()).crimeByLocation || {};
      setCrimeCount(crimeByLocation[PUBLIC_HOUSING_NAME] || 0);
    } catch {
      // Transient fetch failure -- the next refresh tries again.
    }
  }, [session?.userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!session) return null;

  const livesHere = home?.type === "public-housing";

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 4px 0" }}>{PUBLIC_HOUSING_NAME}</h2>
      <p style={{ fontSize: 11, color: "#888", margin: "0 0 8px" }}>
        Non-luxury, project-style public housing -- assigned, not sold.
      </p>

      <p style={{ fontSize: 13 }}>
        Your real social class: <strong>{socialClass || "…"}</strong>
      </p>

      {livesHere ? (
        <p style={{ fontSize: 13 }}>
          You live here{home.reason ? ` (${home.reason})` : ""}.
        </p>
      ) : (
        <p style={{ fontSize: 12, color: "#888" }}>
          You don't live here. Accumulating unpaid tickets or a detention moves an "at-risk" resident
          here automatically -- there's no button for it.
        </p>
      )}

      <p style={{ fontSize: 12, color: crimeCount > 0 ? "#d9a441" : "#888", marginTop: 8 }}>
        {crimeCount} real citation{crimeCount === 1 ? "" : "s"} recorded at this location so far.
      </p>
    </div>
  );
}
