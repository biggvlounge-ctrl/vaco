// CVNVO -- real-time message push, closing this project's own
// self-flagged gap ("real-time messaging UX -- lib/messages.js is a
// real, persisted, polled-not-pushed message store; no WebSocket/
// real-time layer exists"). A real WebSocket server attached to the
// same HTTP server `server.js` already listens on -- no new port, no
// new process, no external pub/sub infrastructure. Deliberately kept
// separate from `messages.js`'s own pure `sendMessage` (store, options)
// -> result shape: broadcasting is a real I/O side effect, and this
// codebase's own established pattern keeps side effects (transferFn,
// voidFetchFn, etc.) injected/orchestrated from server.js, not buried
// inside the pure lib layer server.js itself calls.
//
// Real, minimal protocol: a client connects to `/ws/matches?matchId=5`
// and receives a real `{type: 'message', matchId, message}` frame the
// moment `POST /api/matches/:id/messages` (server.js) successfully
// stores a new message for that match -- no polling `GET
// /api/matches/:id/messages` in a loop required anymore, though that
// route still works unchanged for a client that wants a one-time read.

const { WebSocketServer } = require('ws');
const { URL } = require('url');

function createMessageSocketServer(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws/matches' });
  const subscribersByMatchId = new Map(); // matchId -> Set<ws>

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const matchId = Number(url.searchParams.get('matchId'));
    if (!Number.isInteger(matchId)) {
      ws.close(1008, 'connect with ?matchId=<real match id>');
      return;
    }
    if (!subscribersByMatchId.has(matchId)) {
      subscribersByMatchId.set(matchId, new Set());
    }
    subscribersByMatchId.get(matchId).add(ws);

    ws.on('close', () => {
      const set = subscribersByMatchId.get(matchId);
      if (!set) return;
      set.delete(ws);
      if (set.size === 0) subscribersByMatchId.delete(matchId);
    });
  });

  function broadcastMessage(matchId, message) {
    const set = subscribersByMatchId.get(matchId);
    if (!set || set.size === 0) return 0;
    const frame = JSON.stringify({ type: 'message', matchId, message });
    let sent = 0;
    for (const ws of set) {
      if (ws.readyState === ws.OPEN) {
        ws.send(frame);
        sent += 1;
      }
    }
    return sent;
  }

  return { wss, broadcastMessage };
}

module.exports = { createMessageSocketServer };
