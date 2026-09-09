# Plan — Phase 13: real WebSocket message push

## Goal
Close this project's own self-flagged gap: `lib/messages.js`'s own
header already named it directly ("current messages are polled, not
pushed") — a real, buildable gap, not one needing infrastructure this
session doesn't have.

## Design
`lib/messageSocket.js`: a real `ws` WebSocket server (`ws@^8`, added as
a real new dependency) attached to the same `http.Server` `server.js`
already listens on -- no new port, no new process, no external pub/sub.
A client connects to `/ws/matches?matchId=<id>` and is tracked in a
real `Map<matchId, Set<ws>>`. `broadcastMessage(matchId, message)`
sends a real `{type:'message', matchId, message}` frame to every
currently-connected socket subscribed to that match.

Deliberately kept out of `messages.js`'s own pure `sendMessage(store,
options) -> result`: broadcasting is a real I/O side effect, and this
codebase's own established pattern (every `transferFn`/`voidFetchFn`-
style side effect) keeps those injected/orchestrated from `server.js`,
not buried inside the pure lib layer server.js itself calls. So
`server.js`'s own `POST /api/matches/:id/messages` route calls the
existing `sendMessage` unchanged, then calls `broadcastMessage` with
the real result. `GET /api/matches/:id/messages` (the old polling
route) is untouched and still works -- this is additive, not a
replacement.

## Verification approach
Live, against the real running server, with a real `ws` client (the
same package the server itself uses, imported directly from
`cvnvo/node_modules`): opened a real socket subscribed to a real match
created via a real 1-vs-1 Gale-Shapley pairing, posted a real message
over HTTP, and confirmed the exact real message frame arrived over the
WebSocket. Then opened a second real socket subscribed to a
*different* `matchId` and confirmed it received nothing for that same
post -- proving the subscription scoping is real, not just "some
message eventually arrives on every open socket."

## Done when
A new CVNVO message is pushed to every client subscribed to that
specific match the instant it's sent, with no polling required.
