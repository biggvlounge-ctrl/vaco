# Tasks — Phase 13: real WebSocket message push

- [x] Added `ws` as a real npm dependency (`npm install ws --save`).
- [x] Wrote `lib/messageSocket.js` (`createMessageSocketServer`,
      `broadcastMessage`), kept separate from `messages.js`'s own pure
      `sendMessage`.
- [x] Switched `server.js` from bare `app.listen` to
      `http.createServer(app)` + `server.listen`, so the WebSocket
      server can attach to the same port.
- [x] Wired `broadcastMessage` into `POST /api/matches/:id/messages`,
      called after the existing `sendMessage` succeeds.
- [x] `node --check server.js` / `lib/messageSocket.js` -- clean.
- [x] Live pass: created 2 real profiles, a real match via 1-vs-1
      Gale-Shapley, opened a real `ws` client subscribed to that
      match, posted a real message over HTTP, confirmed the exact
      message frame arrived over the socket.
- [x] Confirmed subscription scoping is real: a second socket
      subscribed to a different `matchId` received nothing for the
      same post.
- [x] Confirmed the old polling route (`GET
      /api/matches/:id/messages`) is untouched.
- [x] Updated `README.md` (new Phase 13 section, corrected the "Not
      yet built" bullet that named this exact gap).

## Next
Read receipts/typing indicators are real, separate, still-unbuilt
scope on top of this -- this phase closes the transport gap
(push vs. poll), not those specific UX features.
