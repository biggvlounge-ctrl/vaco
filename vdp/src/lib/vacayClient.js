// VDP's real, thin client for VACAY's own separate API -- same posture
// as `vokenClient.js`/`vagoClient.js`: no booking logic lives here,
// every real mutation and every real number comes back from VACAY's
// own server. Used by `VacayView.jsx`, VDP's new district for VACAY's
// Experiences (Airbnb Experiences model) -- deliberately scoped to
// Experiences rather than Stays, since Experiences is the one real
// route in VACAY's bookings router that supports listing everything
// (`GET /api/bookings/experiences`); Stays only exposes single-listing
// lookup by a known id, no browse-all route exists to embed here.

import { sessionHeaders } from "./shieldAuth.js";

const VACAY_API_URL = import.meta.env?.VITE_VACAY_API_URL || "http://localhost:8803";

async function requestJson(path, options) {
  const res = await fetch(`${VACAY_API_URL}${path}`, options);
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || `${path} failed (${res.status})`);
  }
  return body;
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
