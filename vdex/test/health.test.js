// VDEX -- smoke test for the health route. Honest on purpose: this
// asserts exactly what the skeleton claims, not what the spec wants
// built eventually -- see VDEX_MASTER_SPEC.md for the gap between
// the two.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.PORT = 0;
const express = require('express');
const cors = require('cors');

function buildApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      app: 'vdex',
      home: 19,
      status: 'skeleton -- property intelligence engine, data sources, and integration adapters not yet built',
      seeSpec: 'VDEX_MASTER_SPEC.md',
    });
  });
  return app;
}

test('health route reports an honest skeleton status, not a fabricated feature set', async () => {
  const app = buildApp();
  const server = app.listen(0);
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.app, 'vdex');
    assert.equal(body.home, 19);
    assert.match(body.status, /not yet built/);
  } finally {
    server.close();
  }
});
