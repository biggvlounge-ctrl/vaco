// VACA -- `req.operator` must exist whenever a route guarded by
// `requireOperator` calls `next()`, in every mode. Routes read
// `req.operator.operatorName` unconditionally (e.g. the decision log on
// approve/reject) because the enforce/observe paths always set it --
// but the `off` branch used to bypass straight to `next()` with no
// `req.operator` at all, so any operator-gated route crashed the
// instant someone ran the service locally with VACO_OPERATOR_MODE=off.
// Caught live: booting this app with `off` and hitting
// `POST /api/verifications/:id/approve` threw
// "Cannot read properties of undefined (reading 'operatorName')".

const test = require('node:test');
const assert = require('node:assert');
const { createOperatorAuth } = require('../lib/operatorAuth.cjs');

function runGuard(guard) {
  return new Promise((resolve, reject) => {
    const req = { headers: {} };
    const res = {
      status(code) { this.statusCode = code; return this; },
      json(body) { resolve({ req, res: this, body }); return this; },
    };
    guard(req, res, (err) => {
      if (err) return reject(err);
      resolve({ req, res, next: true });
    });
  });
}

test('off mode calls next() with a usable req.operator, not nothing', async () => {
  const { requireOperator } = createOperatorAuth({ mode: 'off' });
  const guard = requireOperator('vaca:verify');
  const { req, next } = await runGuard(guard);
  assert.strictEqual(next, true, 'off mode must not refuse the request');
  assert.ok(req.operator, 'off mode must set req.operator before calling next()');
  assert.strictEqual(typeof req.operator.operatorName, 'string',
    'a route that logs decidedBy: req.operator.operatorName must not crash in off mode');
});
