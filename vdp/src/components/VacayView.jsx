import { useState, useCallback, useEffect } from "react";
import { listOpenExperiences, createExperience, bookExperience, cancelExperienceBooking } from "../lib/vacayClient.js";

// VDP's real VACAY district -- a live client of VACAY's own
// Experiences (Airbnb Experiences) API. Same real-cross-app-fetch
// shape as VADO/VAGO ('voken-embed'-style embed): no booking logic
// here, every real experience, booking, and cancellation comes back
// from VACAY's own server. Scoped to Experiences rather than Stays --
// see vacayClient.js's own header for why (Stays has no browse-all
// route to embed).

export default function VacayView({ session }) {
  const [experiences, setExperiences] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [bookings, setBookings] = useState({});

  const refresh = useCallback(() => {
    listOpenExperiences().then(setExperiences).catch((err) => setLoadError(err.message));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleHostExperience = async () => {
    setBusy(true);
    setActionError(null);
    try {
      await createExperience({
        hostId: `host-${session.userId}`,
        description: "VDP-hosted walking tour",
        durationHours: 2,
        price: 25,
        capacity: 6,
        scheduledAt: Date.now() + 3 * 24 * 3600000,
      });
      refresh();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleBook = async (experience) => {
    setBusy(true);
    setActionError(null);
    try {
      const booking = await bookExperience({ experienceId: experience.id, guestId: session.userId });
      setBookings((prev) => ({ ...prev, [experience.id]: booking }));
      refresh();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async (experienceId) => {
    const booking = bookings[experienceId];
    if (!booking) return;
    setBusy(true);
    setActionError(null);
    try {
      const updated = await cancelExperienceBooking(booking.id);
      setBookings((prev) => ({ ...prev, [experienceId]: updated }));
      refresh();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loadError) return <p style={{ color: "crimson" }}>Error loading VACAY: {loadError}</p>;
  if (!experiences) return <p style={{ fontSize: 12, color: "#888" }}>Loading VACAY Experiences…</p>;

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 4px 0" }}>VACAY — real Experiences</h2>
      <p style={{ fontSize: 11, color: "#888", margin: "0 0 8px" }}>
        Airbnb Experiences model: scheduled, capacity-limited tours booked with real VCoin escrow.
      </p>

      <button onClick={handleHostExperience} disabled={busy} style={{ marginBottom: 8 }}>
        Host a demo experience
      </button>

      {experiences.length === 0 && <p style={{ fontSize: 12, color: "#888" }}>No open experiences yet — host one above.</p>}
      {experiences.map((exp) => {
        const booking = bookings[exp.id];
        return (
          <div key={exp.id} style={{ borderTop: "1px dashed #ccc", padding: "8px 0" }}>
            <p style={{ fontSize: 13, margin: "0 0 4px" }}>
              #{exp.id} — {exp.description} ({exp.durationHours}h, capacity {exp.remainingCapacity}/{exp.capacity})
            </p>
            <p style={{ fontSize: 12, color: "#666", margin: "0 0 4px" }}>
              {exp.price} VCoin — scheduled {new Date(exp.scheduledAt).toLocaleString()}
            </p>
            {!booking && (
              <button onClick={() => handleBook(exp)} disabled={busy || exp.remainingCapacity < 1}>Book</button>
            )}
            {booking && booking.status === "booked" && (
              <>
                <span style={{ fontSize: 12, color: "#1a7d3c", marginRight: 8 }}>Booked (booking #{booking.id})</span>
                <button onClick={() => handleCancel(exp.id)} disabled={busy}>Cancel</button>
              </>
            )}
            {booking && booking.status === "cancelled" && (
              <span style={{ fontSize: 12, color: "#888" }}>Cancelled.</span>
            )}
          </div>
        );
      })}

      {actionError && <p style={{ color: "crimson" }}>Error: {actionError}</p>}
    </div>
  );
}
