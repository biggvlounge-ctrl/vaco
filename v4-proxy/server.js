// V4 backend proxy — holds the Anthropic API key server-side.
// The frontend never sees the key; it only ever calls POST /api/agent
// on this server, which attaches the key and forwards to Anthropic.
//
// Run:
//   npm install
//   cp .env.example .env   (then fill in ANTHROPIC_API_KEY)
//   npm start
//
// Test:
//   curl -X POST http://localhost:8787/api/agent \
//     -H "Content-Type: application/json" \
//     -d '{"system":"You are QVAN, a terse security executive. Reply in one sentence.","messages":[{"role":"user","content":"Status check."}]}'

import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import cors from "cors";
import "dotenv/config";

import { describeSurfaces, resolvePresentation, UnknownSurfaceError } from "./lib/surfaces.js";
import {
  getTwinProfile, listTwinProfiles, advanceAnimation, legalTransitionsFrom,
  ANIMATION_STATES, ANIMATION_EVENTS,
} from "./lib/twinProfiles.js";
import { createV4Store } from "./lib/store.js";
import * as maps from "./lib/maps.js";
import {
  placeCall, answerCall, declineCall, endCall, recordCallEvent,
  sweepRingTimeouts, getCall, listCalls, listFallbackMessages, CALL_STATUSES,
} from "./lib/agentCall.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// **This app is `"type": "module"`, so a bare `require` is not defined
// here.** It was called anyway, at the top of the file, which meant
// `node server.js` died with a ReferenceError before it reached the
// API-key check twelve lines below — V4 could not boot at all, and
// had not been able to since the media client was wired in.
//
// Nothing caught it because nothing started this app: its own suite
// covers `lib/maps.js` and never imports the server, and the shared
// runtime sync only checks that a copied module is *required*
// somewhere, not that the requiring app still runs.
//
// `createRequire` is the same bridge `vaco-shell` uses for the same
// reason: the shared modules are `.cjs` on purpose so both CJS and
// ESM apps can load them.
const require = createRequire(import.meta.url);

const { createMediaClient } = require("./lib/mediaClient.cjs");
const { requireActor, requireSession, actorOrService, requireCallingService } =
  require("./lib/shieldAuth.cjs");
const { createServiceAuth } = require("./lib/serviceAuth.cjs");
const { traceMiddleware } = require("./lib/tracing.cjs");

const app = express();

// The agent call flow's missing half. `ring -> connected` was a
// state change nobody could confirm, which is why this file's own
// header recorded that there is no WebRTC and no audio. vaco-media
// reports the join, so `connected` is now a fact rather than an
// assumption. Fails soft: a text-fallback call still works.
const media = createMediaClient({ app: "v4-proxy" });
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// **Mounted before any route, because `app.use` only applies to what
// is registered after it.** This is the whole reason V4 was open: it
// mounted no auth at all, so twenty-eight routes — the maps layer,
// the twin profiles, the call flow, and a live pass-through to the
// Anthropic API — answered anyone who could reach the port.
//
// The audit markers on those routes read "there is no VACO principal
// on this call at all." That was true of the maps arithmetic. It was
// never true of `/api/calls`, which names a `userId` and would list
// anybody's calls to anybody who asked, and it was never true of
// `/api/agent`, where the principal is whoever is spending the key.
// Before serviceAuth, so a refused request still carries a trace id.
app.use(traceMiddleware());

const serviceAuth = createServiceAuth();
app.use(serviceAuth.middleware);

app.use(express.static(path.join(__dirname, "public")));
const PORT = process.env.PORT || 8787;
const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-6";

if (!API_KEY) {
  console.error(
    "FATAL: ANTHROPIC_API_KEY is not set. Copy .env.example to .env and fill it in before starting the server."
  );
  process.exit(1);
}

// Basic per-IP rate limiting so a single client can't hammer the key.
const hits = new Map(); // ip -> [timestamps]
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > MAX_PER_WINDOW;
}

const store = createV4Store();

// **A call belongs to the person on it.** `requireActor` checks a body
// field, and none of answer/decline/end/events carries one — the call
// is named in the path and the party is a property of the stored
// call, not of the request. So the check has to read the call.
//
// CVNVO and VSAFE each wrote their own `requireCallParty` for exactly
// this shape. This is the third, and it is deliberately not lifted
// into `shared/shieldAuth.js`: theirs resolve a party from their own
// stores with their own two-sided rules, and a shared helper would
// have to take a lookup function, at which point it is this file with
// extra indirection. Three small honest copies beat one abstraction
// that fits none of them.
function requireCallParty() {
  return async (req, res, next) => {
    const call = getCall(store, Number(req.params.id));
    // 404 before authorization, deliberately: whether call 91 exists
    // is not a secret, and answering 401 for a call that was never
    // placed sends a caller looking for a session problem they do
    // not have.
    if (!call) return res.status(404).json({ error: `no call with id ${req.params.id}` });

    const token = (req.headers.authorization || "").startsWith("Bearer ");
    if (!token) {
      return res.status(401).json({ error: "requireCallParty: missing Authorization: Bearer <token> header" });
    }
    return requireSession()(req, res, () => {
      if (req.sessionUserId !== call.userId) {
        return res.status(403).json({
          error: "requireCallParty: this session is not the party on that call",
        });
      }
      return next();
    });
  };
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    model: MODEL,
    surfaces: describeSurfaces().map((s) => s.id),
    animationStates: ANIMATION_STATES,
    callStatuses: CALL_STATUSES,
    // Both surfaced the way every other guarded app surfaces them, so
    // an `observe` window with real gaps in it is visible from outside
    // rather than only in a log nobody reads.
    serviceAuth: serviceAuth.describe(),
  });
});

// -- V4 Maps: the shared map layer -----------------------------------
// Closes an asserted-but-unbuilt gap: four VACON agents (Kevin, Kay,
// Gibson, DREA) already tell users "V4's shared map layer" exists.
// Before lib/maps.js it did not. See that file's header.

function mapHandle(res, fn, ok = 200) {
  try {
    res.status(ok).json(fn());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

app.get("/api/maps", (_req, res) => mapHandle(res, () => maps.describeMaps(store)));

app.post("/api/maps/place", actorOrService(requireSession()), (req, res) => mapHandle(res,
  () => maps.registerPlace(store, req.body || {}), 201));

app.get("/api/maps/place/:id", (req, res) => {
  const place = maps.getPlace(store, req.params.id);
  if (!place) return res.status(404).json({ error: `no place "${req.params.id}"` });
  return res.json(place);
});

app.delete("/api/maps/place/:id", actorOrService(requireSession()), (req, res) => mapHandle(res,
  () => ({ removed: maps.removePlace(store, req.params.id) })));

// audit-route-guards: open -- LLM/maps proxy; there is no VACO principal on this call at all
app.post("/api/maps/nearby", (req, res) => mapHandle(res,
  () => maps.nearby(store, req.body || {})));

// audit-route-guards: open -- LLM/maps proxy; there is no VACO principal on this call at all
app.post("/api/maps/bounds", (req, res) => mapHandle(res,
  () => maps.withinBounds(store, req.body || {})));

// audit-route-guards: open -- LLM/maps proxy; there is no VACO principal on this call at all
app.post("/api/maps/distance", (req, res) => mapHandle(res, () => {
  const { fromLat, fromLng, toLat, toLng, speedKmh } = req.body || {};
  return {
    distanceKm: maps.distanceKm(fromLat, fromLng, toLat, toLng),
    travelMinutes: maps.travelMinutes(fromLat, fromLng, toLat, toLng, speedKmh),
  };
}));

// audit-route-guards: open -- LLM/maps proxy; there is no VACO principal on this call at all
app.post("/api/maps/route", (req, res) => mapHandle(res,
  () => maps.routeThrough((req.body || {}).stops, req.body || {})));

app.post("/api/maps/sighting", actorOrService(requireSession()), (req, res) => mapHandle(res,
  () => maps.recordSighting(store, req.body || {}), 201));

// **The marker this route used to carry said "there is no VACO
// principal on this call at all." It takes a `userId`.** This asks
// where one named person crossed paths with other named people, and
// it answered anyone. Of everything on this port it is the most
// sensitive, and it was the least protected.
app.post("/api/maps/crossings", actorOrService(requireActor("userId")), (req, res) => mapHandle(res,
  () => maps.findCrossings(store, req.body || {})));

// Aggregate rather than personal — but aggregated out of the same
// sightings, and a tight enough radius over a short enough window is
// not aggregate at all. A session, at minimum.
app.post("/api/maps/foot-traffic", actorOrService(requireSession()), (req, res) => mapHandle(res,
  () => maps.footTraffic(store, req.body || {})));

// -- AI Human Twin: presentation profiles and the animation state
// machine. See lib/twinProfiles.js for the scope clarification this
// closes (three different things in this project are called "twin").

app.get("/api/twins", (_req, res) => {
  res.json({ twins: listTwinProfiles() });
});

app.get("/api/twins/:agentId", (req, res) => {
  try {
    res.json(getTwinProfile(req.params.agentId));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// audit-route-guards: open -- LLM/maps proxy; there is no VACO principal on this call at all
app.post("/api/twins/:agentId/presentation", (req, res) => {
  try {
    const twin = getTwinProfile(req.params.agentId);
    const { surfaceId, requestedFraming = twin.preferredFraming, vehicleMoving } = req.body || {};
    res.json({ ...resolvePresentation({ surfaceId, requestedFraming, vehicleMoving }), agentId: twin.agentId });
  } catch (err) {
    res.status(err instanceof UnknownSurfaceError ? 404 : 400).json({ error: err.message });
  }
});

// audit-route-guards: open -- LLM/maps proxy; there is no VACO principal on this call at all
app.post("/api/twins/animation/advance", (req, res) => {
  try {
    const { currentState, event } = req.body || {};
    res.json(advanceAnimation({ currentState, event }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/twins/animation/states", (_req, res) => {
  res.json({
    states: ANIMATION_STATES,
    events: ANIMATION_EVENTS,
    transitions: Object.fromEntries(ANIMATION_STATES.map((s) => [s, legalTransitionsFrom(s)])),
  });
});

// -- Display surfaces: TV Play, CarPlay, FaceTime.

app.get("/api/surfaces", (_req, res) => {
  res.json({ surfaces: describeSurfaces() });
});

// -- The FaceTime-style call flow: ring -> live call -> text fallback.

app.post("/api/calls", actorOrService(requireActor("userId")), (req, res) => {
  try {
    res.status(201).json(placeCall(store, req.body || {}));
  } catch (err) {
    res.status(err instanceof UnknownSurfaceError ? 404 : 400).json({ error: err.message });
  }
});

// **Scoped to the caller, not filtered by whatever they ask for.**
// This route took `?userId=` and returned that user's calls to anyone
// — the query string was the only thing deciding whose records came
// back. A session now sets the scope; a service may still ask on
// someone's behalf, which is what `listCalls` was built for.
app.get("/api/calls", actorOrService(requireSession()), (req, res) => {
  const { agentId, status } = req.query;
  const userId = req.callingService ? req.query.userId : req.sessionUserId;
  res.json({ calls: listCalls(store, { userId, agentId, status }) });
});

app.get("/api/calls/:id", actorOrService(requireCallParty()), (req, res) => {
  const call = getCall(store, Number(req.params.id));
  if (!call) return res.status(404).json({ error: `no call with id ${req.params.id}` });
  res.json(call);
});

app.post("/api/calls/:id/answer", actorOrService(requireCallParty()), async (req, res) => {
  let call;
  try { call = answerCall(store, { callId: Number(req.params.id) }); }
  catch (err) { return res.status(400).json({ error: err.message }); }

  // **The half this file's own header said was missing.** It recorded
  // plainly that there is no WebRTC, no SIP, no audio and no video --
  // so `ring -> connected` was a state change nobody could confirm,
  // and the text fallback existed because of it.
  //
  // vaco-media reports the join, so `connected` becomes a fact. The
  // text fallback stays: this fails soft, and a call that cannot carry
  // audio is still a call that works the way it always did.
  const session = await media.openSession(call.id, "call", { maxParticipants: 2 });
  const invite = session
    ? await media.inviteParticipant(session.id, call.userId ?? "caller")
    : null;

  return res.json({
    ...call,
    media: invite
      ? { sessionId: session.id, joinCredential: invite.credential, joinAt: "/api/join" }
      : { available: false, reason: "vaco-media did not answer; the call continues with the text fallback" },
  });
});

app.post("/api/calls/:id/decline", actorOrService(requireCallParty()), (req, res) => {
  try { res.json(declineCall(store, { callId: Number(req.params.id) })); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

app.post("/api/calls/:id/events", actorOrService(requireCallParty()), (req, res) => {
  try { res.json(recordCallEvent(store, { callId: Number(req.params.id), event: (req.body || {}).event })); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

app.post("/api/calls/:id/end", actorOrService(requireCallParty()), (req, res) => {
  try { res.json(endCall(store, { callId: Number(req.params.id) })); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

// Swept rather than timer-driven, so a restart cannot leave calls
// ringing forever because a timer was lost.
app.post("/api/calls/sweep-timeouts", requireCallingService(), (_req, res) => {
  res.json({ missed: sweepRingTimeouts(store) });
});

// Same leak, same fix: these are the messages an agent left when a
// call went unanswered, and they are addressed to one person.
app.get("/api/fallback-messages", actorOrService(requireSession()), (req, res) => {
  const userId = req.callingService ? req.query.userId : req.sessionUserId;
  res.json({ messages: listFallbackMessages(store, { userId }) });
});

// **The most autonomous action in the ecosystem, and until now the
// least governed.** This route spends a real API key against a real
// model on behalf of a caller it never identified. Every VOKEN
// auction and every VOID dispatch leaves an attributed, auditable
// trail; an agent invocation left nothing.
//
// `actorOrService(requireSession())` now asks *who is this* — a
// signed-in person, or a named internal service — and there is no
// longer a way to reach this route without answering.
//
// **Attribution is recorded upstream, in VACON, not here.** This was
// first wired to `decisionLog` and vaco-audit refused the record:
// `agent-invocation` is not one of its six outcome kinds, and reading
// that service's header the refusal was right. It holds irreversible
// decisions, not an application log. By the time a call reaches this
// file the agent is only a persona string anyway; VACON knows which
// named agent was asked and by whom, and records it there.
app.post("/api/agent", actorOrService(requireSession()), async (req, res) => {
  const ip = req.ip;
  if (rateLimited(ip)) {
    return res.status(429).json({ error: "Too many requests. Slow down." });
  }

  const { system, messages } = req.body || {};

  if (typeof system !== "string" || !system.trim()) {
    return res.status(400).json({ error: "Missing or invalid 'system' (agent persona) string." });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Missing or invalid 'messages' array." });
  }
  for (const m of messages) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") {
      return res.status(400).json({ error: "Each message needs role 'user'|'assistant' and string content." });
    }
  }

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1000,
        system,
        messages,
      }),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      // Forward Anthropic's error status/message without leaking the key.
      return res.status(upstream.status).json({
        error: data?.error?.message || "Upstream API error.",
      });
    }

    const textBlock = Array.isArray(data.content) ? data.content.find((b) => b.type === "text") : null;
    return res.json({ text: textBlock?.text || "" });
  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(502).json({ error: "Could not reach the Anthropic API." });
  }
});

app.listen(PORT, () => {
  console.log(`V4 agent proxy listening on http://localhost:${PORT}`);
  console.log(`Health check: curl http://localhost:${PORT}/api/health`);
});
