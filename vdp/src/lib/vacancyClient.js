// VDP's real, thin client for VACON-C's own separate API -- same
// posture as `vagoClient.js`/`vokenClient.js`: no simulation logic
// lives here, every real tick/NPC/property/culture number comes back
// from VACON-C's own server.
//
// **Extended 29 Aug 2026, because the thing it was waiting for
// happened.** This file used to cover exactly VACON-C's 5-endpoint
// contract and said so: "VACON-C's own locked Phase 1 roadmap has ~40
// further endpoints across later phases, real future scope, not
// pretended to exist here." Those phases landed. VACON-C now serves 64
// routes, including the shared entity types
// `VDP_VACANCY_SHARED_ENGINE_COST_REDUCTION.md` names by name --
// properties, organizations, entities, cities.
//
// That document's whole argument is that the schema, API, trait system
// and Key framework get built ONCE. A client frozen at five endpoints
// is how "once" quietly becomes twice: VDP cannot read VACON-C's
// properties, so the next person who needs a venue record builds a
// second one here.
//
// **Reads only, deliberately.** Every function below is a GET except
// the four that already existed. VDP observing VACON-C's world is
// safe; VDP mutating it is a design decision nobody has made -- the
// tick alone advances state for every consumer at once, and it is
// operator-guarded on VACON-C's side for exactly that reason.
//
// **Still over HTTP, not a shared import.** `vdp` must not import from
// `vacon-c` -- separate Docker build contexts, see
// `sync-shared-runtime.sh`'s header. The API is the seam.
//
// **Extended again 13 Nov 2026 -- see this file's own tail for what
// closed and why.** The real problem by then was not that VACON-C had
// outgrown this file a second time (it had: 150+ routes against this
// file's ~25 functions) but that nothing in VDP imported most of what
// was already here.

import { sessionHeaders } from "./shieldAuth.js";

const VACANCY_API_URL = import.meta.env?.VITE_VACANCY_API_URL || "http://localhost:8809";

async function requestJson(path, options) {
  const res = await fetch(`${VACANCY_API_URL}${path}`, options);
  if (!res.ok) {
    const text = await res.text();
    let message = `${path} failed (${res.status})`;
    try { message = JSON.parse(text).error || message; } catch { /* not JSON */ }
    throw new Error(message);
  }
  return res.json();
}

export async function getWorldState() {
  return requestJson("/api/state");
}

export async function advanceTick() {
  return requestJson("/api/tick", { method: "POST" });
}

export async function generateNPC(options = {}) {
  return requestJson("/api/npc/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify(options),
  });
}

export async function generateArtifact({ name, origin, era, rarity }) {
  return requestJson("/api/artifacts", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify({ name, origin, era, rarity }),
  });
}

export async function generateMission({ artifactId, objective, reward }) {
  return requestJson("/api/mission", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify({ artifactId, objective, reward }),
  });
}

// ---------------------------------------------------------------------------
// The shared entity types
// ---------------------------------------------------------------------------
// These are the four `vacancySchema.js` maps VDP's own world objects
// onto: a resort venue IS a property, a fight promotion IS an
// organization, a fighter IS an entity, a simulated area IS a city.
// Until now none of them could be read.

// `properties` — VDP's resort venues and the casino floor.
// Every response carries `value` (the assessed number on the row) and
// `currentValue` (derived on read from condition and lifecycle stage,
// never stored). Show both or neither; showing only `value` reports a
// building in ruins at its book price.
export async function listProperties(params = {}) {
  const query = new URLSearchParams(params).toString();
  return requestJson(`/api/properties${query ? `?${query}` : ""}`);
}

export async function getProperty(id) {
  return requestJson(`/api/properties/${id}`);
}

// Who holds a thing, read out of append-only ownership history rather
// than an owner column — which is why a property has no owner field.
export async function getHoldings(entityId) {
  return requestJson(`/api/entities/${entityId}/holdings`);
}

// `organizations` — fight promotions, resort operators, factions.
export async function listOrganizations() {
  return requestJson("/api/organizations");
}

export async function listBusinesses() {
  return requestJson("/api/businesses");
}

export async function listFactions() {
  return requestJson("/api/factions");
}

// `entities` — a fighter is a person, not a role.
export async function getEntity(id) {
  return requestJson(`/api/entities/${id}`);
}

export async function listNPCs() {
  return requestJson("/api/npcs");
}

// `cities` — VDP's simulated backdrop areas.
// Reemergence comes back computed, with its sub-indices labelled `city`
// or `world` scope: NPCs carry no location in this engine, so the
// people half of the composite is the world's and says so.
export async function listCities() {
  return requestJson("/api/cities");
}

export async function getCity(id) {
  return requestJson(`/api/cities/${id}`);
}

export async function getCityReemergence(id) {
  return requestJson(`/api/cities/${id}/reemergence`);
}

export async function listCommunities(cityId) {
  return requestJson(`/api/communities${cityId ? `?cityId=${cityId}` : ""}`);
}

// ---------------------------------------------------------------------------
// World readouts with no VDP equivalent — read, do not rebuild
// ---------------------------------------------------------------------------

// Culture DNA is tier-level: a district, promotion or city BELONGS to a
// culture. Individuals never carry one, and VACON-C refuses to attach
// one to an NPC.
export async function listCultures() {
  return requestJson("/api/cultures");
}

export async function getCultureFor(tierEntityId) {
  return requestJson(`/api/culture/${tierEntityId}`);
}

// Named Flow Templates — held as data, not as functions. `readable:
// false` means this world has nothing to read for that signal, which is
// not the same as the signal reading zero.
export async function listFlows() {
  return requestJson("/api/flows");
}

// `events` — VDP maps a Combat Sports match onto this table. Events are
// outputs of the tick's phases, never rolled independently, so a match
// appearing here means the world produced it.
export async function listEvents(params = {}) {
  const query = new URLSearchParams(params).toString();
  return requestJson(`/api/events${query ? `?${query}` : ""}`);
}

export async function getEconomySnapshot() {
  return requestJson("/api/economy/snapshot");
}

// ---------------------------------------------------------------------------
// Extended 13 Nov 2026 -- the real gap was not another contract boundary.
// ---------------------------------------------------------------------------
// This file's own 29 Aug 2026 extension already built every function
// above, and `grep -rln "vacancyClient" vdp/src` before this pass found
// nobody importing them except `VacancyView.jsx` -- and that component
// still only called the original five (state/tick/npc/artifact/mission),
// its own header still claiming "Scope matches VACON-C's own real,
// currently-live API exactly (5 endpoints)" more than two months after
// that stopped being true. VACON-C's own eleventh standing rule, pointed
// at this file: a generator nothing calls is indistinguishable from one
// that does not exist, and every shared-entity-type function here was
// exactly that -- built, exported, never once imported.
//
// `VacancyView.jsx` is fixed in the same pass to actually read these.
// Three more real routes close the newer gap, each checked against
// VACON-C's own current `server.js` route table rather than guessed:

// A community's real local power hierarchy -- criminal (holds real
// territory), political (real government scoped here), religious (a
// real order), business (highest-influence operator of a real
// property). Any of the four can be honestly `null`; VACON-C's own
// sixtieth standing rule covers why.
export async function getMainCharacters(communityId) {
  return requestJson(`/api/communities/${communityId}/main-characters`);
}

// Real, tick-driven environmental conditions (drought, storm, and so
// on) currently active somewhere in the world -- real backdrop color
// for a simulated resort district, not a VDP-side invention.
export async function listConditions() {
  return requestJson("/api/conditions");
}

// Searchable real history -- `VACANCY_API_ENDPOINT_MAP.md`'s own
// cross-cutting section. A fighter or promotion's own real record,
// filterable by entity/location/tick range, never a second log kept
// here.
export async function listHistoricalRecords(params = {}) {
  const query = new URLSearchParams(params).toString();
  return requestJson(`/api/historical-records${query ? `?${query}` : ""}`);
}
