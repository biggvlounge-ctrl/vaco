// VDP — real-time shared world, modeled on `cvnvo/lib/messageSocket.js`
// (the only real WebSocket server in this repo before this one): a
// `WebSocketServer` attached to the same `http.Server` `server.cjs`
// already listens on, no new port, no new process.
//
// Adapted rather than reused as-is, because the shape differs in the
// one way that matters: CVNVO's sockets are per-`matchId`, server
// pushes only, no client-to-server message. VDP's world is ONE shared
// channel — every connected player needs to see the same NPCs and
// every other connected player's position — and a player's own
// position updates arrive FROM the client, not just TO it. So this
// keeps CVNVO's close-cleanup discipline (a disconnected socket is
// removed from the broadcast set, never left to accumulate) and adds
// the inbound half CVNVO never needed.

const { WebSocketServer } = require('ws');

function createMessageSocketServer(httpServer, { path = '/ws/world', onSnapshotRequest, onMessage } = {}) {
  const wss = new WebSocketServer({ server: httpServer, path });
  const clients = new Set();

  wss.on('connection', (ws) => {
    clients.add(ws);

    // A newly connected client has missed every broadcast so far — a
    // real snapshot on connect is what makes a late joiner see the
    // same world instead of an empty one until the next tick.
    if (typeof onSnapshotRequest === 'function') {
      ws.send(JSON.stringify(onSnapshotRequest()));
    }

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return; // malformed frame, not this layer's problem to diagnose
      }
      if (typeof onMessage === 'function') onMessage(ws, msg);
    });

    ws.on('close', () => clients.delete(ws));
  });

  function broadcast(frame) {
    const payload = JSON.stringify(frame);
    let sent = 0;
    for (const ws of clients) {
      if (ws.readyState === ws.OPEN) {
        ws.send(payload);
        sent += 1;
      }
    }
    return sent;
  }

  return { wss, broadcast };
}

module.exports = { createMessageSocketServer };
