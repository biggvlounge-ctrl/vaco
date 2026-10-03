// VDP's real, thin client for VACAY's own separate API -- same posture
// as `vokenClient.js`/`vagoClient.js`: no booking logic lives here,
// every real mutation and every real number comes back from VACAY's
// own server. Used by `VacayView.jsx`, VDP's district for VACAY's
// Experiences (Airbnb Experiences model) and, per direct instruction
// ("every village will have hotels in them"), VACAY's Stay listings
// too.
//
// **Correction to an earlier limitation note**: this file used to say
// Stays had no browse-all route, only single-listing lookup by a
// known id -- checked directly against VACAY's current
// `lib/bookings/routes.js`, that's no longer true. `GET
// /api/bookings/listings` is real now (its own comment there: "They
// could be created and fetched by id, but never enumerated -- so a
// guest had no way to browse," since fixed). `listStays`/`createStay`
// below use it. A VACAY "hotel" is a real Stay listing with
// `hostType: 'professional'` -- VACAY's own Booking.com-style
// inventory split within the one real Airbnb-shaped booking flow, not
// a second system.

import { sessionHeaders } from "./shieldAuth.js";

const VACAY_API_URL = import.meta.env?.VITE_VACAY_API_URL || "http://localhost:8803";

async function requestJson(path, options) {
  const res = await fetch(`${VACAY_API_URL}${path}`, options);
  if (!res.ok) {
    const text = await res.text();
    let message = `${path} failed (${res.status})`;
    try { message = JSON.parse(text).error || message; } catch { /* not JSON */ }
    throw new Error(message);
  }
  return res.json();
}

function postJson(path, payload) {
  return requestJson(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify(payload),
  });
}

export async function listOpenExperiences() {
  const body = await requestJson("/api/bookings/experiences");
  return body.experiences;
}

export async function createExperience({
  hostId, description, durationHours, price, capacity, scheduledAt,
}) {
  return postJson("/api/bookings/experiences", {
    hostId, description, durationHours, price, capacity, scheduledAt,
  });
}

export async function bookExperience({ experienceId, guestId }) {
  return postJson("/api/bookings/experience-bookings", { experienceId, guestId });
}

export async function cancelExperienceBooking(bookingId) {
  return postJson(`/api/bookings/experience-bookings/${bookingId}/cancel`, {});
}

export async function listStays() {
  const body = await requestJson("/api/bookings/listings");
  return body.listings;
}

export async function getStay(listingId) {
  return requestJson(`/api/bookings/listings/${listingId}`);
}

export async function createStay({ hostId, title, pricePerNight, hostType = "professional" }) {
  return postJson("/api/bookings/listings", {
    hostId, title, pricePerNight, hostType,
  });
}
