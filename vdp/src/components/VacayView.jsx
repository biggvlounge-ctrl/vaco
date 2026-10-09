import { useState, useCallback, useEffect } from "react";
import {
  listOpenExperiences, createExperience, bookExperience, cancelExperienceBooking,
  createStay, getStay, listHomeListings,
} from "../lib/vacayClient.js";
import { sessionHeaders } from "../lib/shieldAuth.js";

// VDP's real VACAY district -- a live client of VACAY's own real API:
// Experiences (Airbnb Experiences) and, per direct instruction
// ("every village will have hotels in them... tier one might just
// have one hotel, up to tier five might have three"), Stay listings
// too (VACAY's own real Booking.com-style `hostType: 'professional'`
// inventory -- see vacayClient.js's header). No booking logic here,
// every real experience/stay/booking comes back from VACAY's own
// server; VDP's own server (`GET`/`POST /api/vacay-hotels`) only
// tracks which real listing ids count as Meridian's, since VACAY's
// Listing has no location field to filter by.

const VDP_API_URL = import.meta.env?.VITE_VDP_API_URL || "http://localhost:8827";

export default function VacayView({ session }) {
  const [experiences, setExperiences] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [bookings, setBookings] = useState({});
  const [hotelCap, setHotelCap] = useState(null);
  const [hotels, setHotels] = useState([]);
  const [hotelError, setHotelError] = useState(null);
  const [homeListings, setHomeListings] = useState(null);
  const [homeError, setHomeError] = useState(null);

  const refreshHotels = useCallback(async () => {
    try {
      const res = await fetch(`${VDP_API_URL}/api/vacay-hotels`);
      const body = await res.json();
      setHotelCap(body);
      const listings = await Promise.all(body.listingIds.map((id) => getStay(id).catch(() => null)));
      setHotels(listings.filter(Boolean));
    } catch (err) {
      setHotelError(err.message);
    }
  }, []);

  const handleListHotel = async () => {
    setBusy(true);
    setHotelError(null);
    try {
      const listing = await createStay({
        hostId: session.userId,
        title: `${session.userId}'s Meridian Hotel`,
        pricePerNight: 120,
        hostType: "professional",
      });
      const res = await fetch(`${VDP_API_URL}/api/vacay-hotels/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...sessionHeaders() },
        body: JSON.stringify({ listingId: listing.id, registeredBy: session.userId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `register failed (${res.status})`);
      }
      await refreshHotels();
    } catch (err) {
      setHotelError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const refresh = useCallback(() => {
    listOpenExperiences().then(setExperiences).catch((err) => setLoadError(err.message));
  }, []);

  const refreshHomeListings = useCallback(() => {
    listHomeListings().then(setHomeListings).catch((err) => setHomeError(err.message));
  }, []);

  useEffect(() => { refresh(); refreshHotels(); refreshHomeListings(); }, [refresh, refreshHotels, refreshHomeListings]);

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

      <div style={{ borderTop: "1px dashed #ccc", marginTop: 12, paddingTop: 8 }}>
        <h3 style={{ fontSize: 13, margin: "0 0 4px 0" }}>Meridian's Hotels</h3>
        <p style={{ fontSize: 11, color: "#888", margin: "0 0 8px" }}>
          {hotelCap
            ? `${hotels.length}/${hotelCap.maxHotels} hotel slots used (${hotelCap.tierName})`
            : "Checking Meridian's real hotel cap…"}
        </p>
        {hotels.map((h) => (
          <p key={h.id} style={{ fontSize: 12, color: "#666", margin: "0 0 4px" }}>
            {h.title} — {h.pricePerNight} VCoin/night ({h.hostType})
          </p>
        ))}
        {hotelCap && hotels.length < hotelCap.maxHotels && (
          <button onClick={handleListHotel} disabled={busy}>List a hotel in Meridian</button>
        )}
        {hotelError && <p style={{ color: "crimson" }}>Error: {hotelError}</p>}
      </div>

      <div style={{ borderTop: "1px dashed #ccc", marginTop: 12, paddingTop: 8 }}>
        <h3 style={{ fontSize: 13, margin: "0 0 4px 0" }}>VACAY Homes — real estate</h3>
        <p style={{ fontSize: 11, color: "#888", margin: "0 0 8px" }}>
          Browse real homes for sale and rentals (Zillow's model). A sale or long-term
          lease settles outside VCoin, same as the real world — browsing only here.
        </p>
        {homeError && <p style={{ color: "crimson" }}>Error: {homeError}</p>}
        {homeListings === null && !homeError && (
          <p style={{ fontSize: 12, color: "#888" }}>Loading VACAY Homes listings…</p>
        )}
        {homeListings && homeListings.length === 0 && (
          <p style={{ fontSize: 12, color: "#888" }}>No active listings yet.</p>
        )}
        {homeListings && homeListings.length > 0 && (
          <>
            <p style={{ fontSize: 11, color: "#888", margin: "0 0 4px" }}>For sale:</p>
            {homeListings.filter((l) => l.purpose === "for-sale").map((l) => (
              <p key={l.id} style={{ fontSize: 12, color: "#666", margin: "0 0 4px" }}>
                {l.address} — {l.price} VCoin — {l.bedrooms}bd/{l.bathrooms}ba, {l.sqft} sqft
              </p>
            ))}
            <p style={{ fontSize: 11, color: "#888", margin: "8px 0 4px" }}>For rent:</p>
            {homeListings.filter((l) => l.purpose === "for-rent").map((l) => (
              <p key={l.id} style={{ fontSize: 12, color: "#666", margin: "0 0 4px" }}>
                {l.address} — {l.price} VCoin/mo — {l.bedrooms}bd/{l.bathrooms}ba, {l.sqft} sqft
                {l.bedrooms === 0 ? " (commercial)" : ""}
              </p>
            ))}
          </>
        )}
        <button onClick={refreshHomeListings} disabled={busy} style={{ marginTop: 8 }}>
          Refresh listings
        </button>
      </div>
    </div>
  );
}
