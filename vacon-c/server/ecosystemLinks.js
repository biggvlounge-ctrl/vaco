// server/ecosystemLinks.js
//
// Phase 4 "Digital Planet" — VACANCY_API_ENDPOINT_MAP.md's own words:
// "outbound link generators, not functional endpoints... VACANCY
// should never implement the actual streaming/commerce/fashion logic
// itself." Five real routes, each doing exactly two things: check a
// real in-world gate, then hand back a real URL into the real sibling
// app. Nothing here plays music, lists a product, or runs a channel.
//
// ---------------------------------------------------------------------
// The gate — reused, not invented
// ---------------------------------------------------------------------
// `media.js`'s own `CHANNELS.social_media` is already "the internet is
// back, world-reaching, needs a real `internet` infrastructure row
// standing in this city" — exactly the fact "can this place reach the
// rest of the digital ecosystem" asks, one tier past `radio`
// (`electricity`) on the same real `technology.ERA_NAMES` ladder
// `weapons.js#MANUFACTURING_ERA` already reuses rather than inventing
// a second threshold. `media.availableChannels(worldState, cityId)
// .includes('social_media')` is both halves of the real check —
// `computing` reached AND a real, non-failed `internet` infrastructure
// row in that specific city (`infrastructure.infrastructureIn`) —
// reused directly rather than re-deriving era+infrastructure logic a
// second time here.
//
// ---------------------------------------------------------------------
// Where a link actually points, checked against each sibling's own
// real route table rather than invented in isolation
// ---------------------------------------------------------------------
// - Vavlt Stvdios: a real, addressable unit is a channel
//   (`GET /api/channels/:id` in `../vavlt-stvdios/server.js`) — the
//   map's `:contentId` is that channel's real id.
// - Vvltvre: the map's own param is `:contentType`, not `:contentId` —
//   taken literally, since Vvltvre is three real sub-apps (Music:
//   `vulture-music`, real unit `GET /api/releases/:id`; Flix:
//   `vulture-flix`, real unit `GET /api/titles/:id`; Tix&Touring has
//   no dedicated app in this repo yet) sharing one `Vvltvre` home —
//   `contentType` picks which one, this file does not invent a single
//   cross-sub-app content id scheme none of them actually share.
// - DREAMS: a real, addressable unit is a screen
//   (`GET /api/screens/:id` in `../dreams/server.js`, filed under
//   HVNTZ) — the map's `:screenId` is that screen's real id.
// - VENVS: a real, addressable unit is a seller
//   (`GET /api/marketplace/sellers/:id` in `../venvs/server.cjs`) —
//   the map's `:storefrontId` is that seller's real id.
// - "Vozzana da Gucci", named in the original map, is a stale name —
//   corrected directly: it is now SVMIKO DEGVCHI, a real 17-brand
//   fashion house that lives INSIDE VENVS, not a separate app
//   (`venvs/src/lib/svmikoDegvchi.js`; VDP's `svmikoDegvchiWearables
//   .js` is the separate avatar-wearables side of the same brand,
//   VDP's concern, not this one). Checked directly before deciding
//   what to build: `seedSvmikoDegvchiStorefronts` registers each
//   brand as an ordinary VENVS marketplace seller via the real
//   `registerSeller`, which assigns a runtime integer `seller.id` —
//   `brand.slug` (e.g. `'degvchi'`, `'vvlgari'`) is a human-readable
//   label on the brand DEFINITION, never stored as or usable as a
//   real lookup key, and VENVS exposes no slug-to-id resolution route
//   anywhere. So a "SVMIKO DEGVCHI product" has no separate, stable
//   ID namespace to link into beyond what `venvs-link` already
//   covers — a brand's storefront IS a real VENVS seller, addressed
//   the identical way. Building a fifth, more-specific route would
//   mean fabricating a slug-resolution capability VENVS does not
//   actually have, the same mistake this project already declined for
//   VULCAN. **Folded entirely into `venvsLink`; there is no separate
//   `vozzanaLink`/fifth route.**
//
// A real, separate finding, worth recording rather than silently
// worked around: VENVS's own real backend (`venvs/server.cjs`)
// defaults to `PORT = process.env.PORT || 8829` — the exact port
// `start-ecosystem.sh` separately assigns to VDEX (home #19, a
// different app entirely), and VENVS's real backend is not in that
// manifest's boot list at all (only its Vite dev server at 5173 is).
// Both are genuine, pre-existing conflicts in those two files, outside
// this round's scope — flagged here rather than fixed, since neither
// file is this task's to touch.
//
// No frontend deep-link convention (hash routes, query-param
// resolvers) exists anywhere in this ecosystem yet — checked directly,
// nothing in `vaco-shell/` or any sibling's own `public/` wires one.
// So every link below is a resource locator into the sibling's own
// real API, not a confirmed UI route — stated plainly in each
// response rather than implied to be more than it is.

'use strict';

const media = require('./media.js');

const GATE_ERA = 'computing';
const GATE_CHANNEL = 'social_media';

function envUrl(name, fallback) {
  return process.env[name] || fallback;
}

const BASE_URLS = {
  vaultStudios: () => envUrl('VAVLT_STVDIOS_URL', 'http://localhost:8808'),
  vultureMusic: () => envUrl('VULTURE_MUSIC_URL', 'http://localhost:8806'),
  vultureFlix: () => envUrl('VULTURE_FLIX_URL', 'http://localhost:8807'),
  dreams: () => envUrl('DREAMS_URL', 'http://localhost:8814'),
  venvs: () => envUrl('VENVS_URL', 'http://localhost:8829'),
};

// The one real check every link-out shares: has this specific city's
// world reached the point where the digital ecosystem can be reached
// at all? `cityId === null` (no resolvable location) is honestly
// refused rather than defaulted to "everywhere" — the same posture
// `events.js#communityIdForEntity`'s own null case already holds for
// an unresolvable location, not invented fresh here.
function digitalPlanetReady(worldState, cityId) {
  if (cityId === null || cityId === undefined) {
    return { ready: false, reason: 'no resolvable city for this request' };
  }
  const available = media.availableChannels(worldState, cityId);
  if (!available.includes(GATE_CHANNEL)) {
    const eraReached = media.eraReached(worldState, GATE_ERA);
    const reason = !eraReached
      ? `era "${GATE_ERA}" not yet reached`
      : 'no working internet infrastructure in this city';
    return { ready: false, reason };
  }
  return { ready: true, reason: null };
}

function gatedLink(worldState, cityId, build) {
  const gate = digitalPlanetReady(worldState, cityId);
  if (!gate.ready) {
    return { ok: false, reason: gate.reason, gateEra: GATE_ERA };
  }
  return { ok: true, ...build() };
}

function vaultStudiosLink(worldState, cityId, contentId) {
  return gatedLink(worldState, cityId, () => ({
    app: 'vavlt-stvdios',
    url: `${BASE_URLS.vaultStudios()}/api/channels/${encodeURIComponent(contentId)}`,
    verified: true,
    note: 'Resource locator into Vavlt Stvdios’ real channel resource; not a confirmed UI deep link (no frontend route convention exists yet).',
  }));
}

const VULTURE_CONTENT_TYPES = {
  music: { base: BASE_URLS.vultureMusic, path: '/api/releases' },
  flix: { base: BASE_URLS.vultureFlix, path: '/api/titles' },
};

function vultureLink(worldState, cityId, contentType, contentId) {
  return gatedLink(worldState, cityId, () => {
    const target = VULTURE_CONTENT_TYPES[contentType];
    if (!target) {
      return {
        ok: false,
        reason: `unknown Vvltvre contentType "${contentType}" (expected one of: ${Object.keys(VULTURE_CONTENT_TYPES).join(', ')}; "touring" has no dedicated app in this repo yet)`,
      };
    }
    const base = target.base();
    const suffix = contentId !== undefined && contentId !== null
      ? `/${encodeURIComponent(contentId)}` : '';
    return {
      app: `vulture-${contentType}`,
      url: `${base}${target.path}${suffix}`,
      verified: true,
      note: 'Resource locator into Vvltvre’s real sub-app resource; not a confirmed UI deep link.',
    };
  });
}

function dreamsLink(worldState, cityId, screenId) {
  return gatedLink(worldState, cityId, () => ({
    app: 'dreams',
    url: `${BASE_URLS.dreams()}/api/screens/${encodeURIComponent(screenId)}`,
    verified: true,
    note: 'Resource locator into DREAMS’ real screen resource; not a confirmed UI deep link.',
  }));
}

// `storefrontId` is a real VENVS seller id — whether that seller is an
// ordinary peer reseller or one of SVMIKO DEGVCHI's 17 real brands
// (registered through the identical `registerSeller` call, see this
// file's own header) makes no difference to this function; both are
// the same real resource at the same real granularity.
function venvsLink(worldState, cityId, storefrontId) {
  return gatedLink(worldState, cityId, () => ({
    app: 'venvs',
    url: `${BASE_URLS.venvs()}/api/marketplace/sellers/${encodeURIComponent(storefrontId)}`,
    verified: true,
    note: 'Resource locator into VENVS’ real seller/storefront resource (covers SVMIKO DEGVCHI brand storefronts too — same real sellers, same route); not a confirmed UI deep link. VENVS’ own backend defaults to the same port VDEX is assigned in start-ecosystem.sh — a real, pre-existing conflict in those two files, unrelated to this app.',
  }));
}

module.exports = {
  GATE_ERA,
  GATE_CHANNEL,
  digitalPlanetReady,
  vaultStudiosLink,
  vultureLink,
  dreamsLink,
  venvsLink,
  VULTURE_CONTENT_TYPES,
};
