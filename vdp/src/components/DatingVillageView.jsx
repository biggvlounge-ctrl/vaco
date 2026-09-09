import { useState, useEffect, useCallback } from "react";
import {
  enterDatingVillage, leaveDatingVillage, getDatingVillageFeed, sendDatingVillageFlashNote,
} from "../lib/datingVillage.js";

// CVNVO's real Dating Village, inhabited inside VDP -- a real BarBuddy
// venue check-in the moment a player walks in, real proximity
// crossings recorded with every other real, currently-visible player
// here, and a real FlashNote form to break the ice before any match
// exists. See `datingVillage.js`'s own header for why this district is
// one real venue rather than a second interior map.

export default function DatingVillageView({ session }) {
  const [visibleUsers, setVisibleUsers] = useState(null);
  const [feed, setFeed] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [flashTarget, setFlashTarget] = useState(null);
  const [flashText, setFlashText] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  const refreshFeed = useCallback(() => {
    getDatingVillageFeed(session.userId).then(setFeed).catch((err) => setActionError(err.message));
  }, [session.userId]);

  useEffect(() => {
    let cancelled = false;
    enterDatingVillage(session.userId)
      .then((result) => {
        if (cancelled) return;
        setVisibleUsers(result.visibleUsers);
        refreshFeed();
      })
      .catch((err) => !cancelled && setLoadError(err.message));

    return () => {
      cancelled = true;
      leaveDatingVillage(session.userId).catch(() => { /* real, best-effort cleanup on unmount */ });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.userId]);

  const handleSendFlashNote = async () => {
    if (!flashTarget || !flashText.trim()) return;
    setBusy(true);
    setActionError(null);
    try {
      await sendDatingVillageFlashNote(session.userId, flashTarget, flashText.trim());
      setFlashText("");
      setFlashTarget(null);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loadError) return <p style={{ color: "crimson" }}>Error loading the Dating Village: {loadError}</p>;
  if (visibleUsers === null) return <p style={{ fontSize: 12, color: "#888" }}>Checking in at the Dating Village…</p>;

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 8px 0" }}>CVNVO Dating Village</h2>
      <p style={{ fontSize: 12, color: "#666" }}>
        A real BarBuddy venue, live from CVNVO. Everyone here right now is a real, visible check-in.
      </p>

      <div style={{ marginTop: 8 }}>
        <p style={{ fontSize: 13, fontWeight: "bold", margin: "0 0 4px" }}>Here right now</p>
        {visibleUsers.length === 0 && <p style={{ fontSize: 12, color: "#888" }}>No one else checked in yet.</p>}
        {visibleUsers.map((userId) => (
          <div key={userId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0" }}>
            <span>{userId}</span>
            <button onClick={() => setFlashTarget(userId)}>Send a FlashNote</button>
          </div>
        ))}
      </div>

      {flashTarget && (
        <div style={{ marginTop: 12, borderTop: "1px dashed #ccc", paddingTop: 8 }}>
          <p style={{ fontSize: 13 }}>FlashNote to <strong>{flashTarget}</strong> (no match required yet):</p>
          <div style={{ display: "flex", gap: 4 }}>
            <input value={flashText} onChange={(e) => setFlashText(e.target.value)} placeholder="Say hi…" style={{ flex: 1 }} />
            <button onClick={handleSendFlashNote} disabled={busy || !flashText.trim()}>Send</button>
            <button onClick={() => setFlashTarget(null)} disabled={busy}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 12, borderTop: "1px dashed #ccc", paddingTop: 8 }}>
        <p style={{ fontSize: 13, fontWeight: "bold", margin: "0 0 4px" }}>Your real crossing feed</p>
        {feed.length === 0 && <p style={{ fontSize: 12, color: "#888" }}>No crossings recorded yet.</p>}
        {feed.map((event) => (
          <p key={event.id} style={{ fontSize: 12, margin: "2px 0" }}>
            Crossed paths with <strong>{event.userId === session.userId ? event.otherUserId : event.userId}</strong>
            {" "}({event.distanceKm}km apart)
          </p>
        ))}
      </div>

      {actionError && <p style={{ color: "crimson" }}>Error: {actionError}</p>}
    </div>
  );
}
