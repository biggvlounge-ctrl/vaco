// W3C trace context — the propagation contract.
//
// Every assertion here is about one property: **a trace id minted at
// the edge must survive every hop unchanged.** If it does not, the
// eight log streams that describe one transfer still cannot be lined
// up, which is the entire reason this module exists.
//
// Tested against the spec's own edge cases rather than the happy path,
// because the happy path is four lines and the failures are all at the
// boundaries: an absent header, a malformed one, an all-zero id, a
// future version.

import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);
const tracing = require(path.join(REPO_ROOT, 'shared', 'tracing.js'));

const {
  parseTraceparent, formatTraceparent, newTraceId, newSpanId,
  traceMiddleware, traceHeaders,
} = tracing;

// Minimal express-shaped doubles: this module touches headers and
// nothing else, so a real server would prove nothing extra.
const reqWith = (headers = {}) => ({ headers, method: 'POST', url: '/api/x' });
const resDouble = () => {
  const sent = {};
  return { sent, setHeader(k, v) { sent[k] = v; } };
};
function run(req) {
  const res = resDouble();
  let called = false;
  traceMiddleware()(req, res, () => { called = true; });
  assert.ok(called, 'the middleware did not call next() — it must never block a request');
  return { req, res };
}

const VALID = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';

// -- parsing -------------------------------------------------------------

test('a valid traceparent is parsed into its parts', () => {
  const t = parseTraceparent(VALID);
  assert.equal(t.traceId, '4bf92f3577b34da6a3ce929d0e0e4736');
  assert.equal(t.parentId, '00f067aa0ba902b7');
  assert.equal(t.flags, '01');
});

test('malformed headers are refused rather than half-read', () => {
  for (const bad of [
    undefined, null, '', 'garbage', 42, {},
    '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7',        // too few parts
    '00-4bf92f3577b34da6-00f067aa0ba902b7-01',                     // short trace id
    '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa-01',             // short span id
    '00-4bf92f3577b34da6a3ce929d0e0e473g-00f067aa0ba902b7-01',     // non-hex
    'ff-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',     // version ff is invalid
    `00-${'0'.repeat(32)}-00f067aa0ba902b7-01`,                    // all-zero trace id
    `00-4bf92f3577b34da6a3ce929d0e0e4736-${'0'.repeat(16)}-01`,    // all-zero span id
  ]) {
    assert.equal(parseTraceparent(bad), null, `accepted a bad traceparent: ${JSON.stringify(bad)}`);
  }
});

test('a future version is continued, not dropped', () => {
  // The spec's forward-compatibility rule. Refusing an unknown version
  // would break propagation the day anything upstream upgrades — and
  // break it silently, as a new trace rather than an error.
  const t = parseTraceparent('01-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');
  assert.ok(t, 'a version-01 header was dropped');
  assert.equal(t.traceId, '4bf92f3577b34da6a3ce929d0e0e4736');
});

test('case is normalised, since the spec requires lowercase hex', () => {
  const t = parseTraceparent(VALID.toUpperCase());
  assert.equal(t.traceId, '4bf92f3577b34da6a3ce929d0e0e4736');
});

// -- the middleware ------------------------------------------------------

test('an incoming trace is continued, with a new span for this hop', () => {
  const { req } = run(reqWith({ traceparent: VALID }));
  assert.equal(req.trace.traceId, '4bf92f3577b34da6a3ce929d0e0e4736', 'the trace id changed across a hop');
  assert.equal(req.trace.parentId, '00f067aa0ba902b7');
  assert.notEqual(req.trace.spanId, '00f067aa0ba902b7', 'this hop reused its parent span id');
  assert.equal(req.trace.root, false);
});

test('a request with no header starts a trace and says it is the root', () => {
  const { req } = run(reqWith());
  assert.match(req.trace.traceId, /^[0-9a-f]{32}$/);
  assert.equal(req.trace.parentId, null);
  assert.equal(req.trace.root, true, 'the edge of a trace must be identifiable');
});

test('the trace id is echoed on the response', () => {
  // So a human with curl can read the id of the request they just made
  // without access to any log.
  const { req, res } = run(reqWith({ traceparent: VALID }));
  assert.equal(res.sent.traceparent, req.trace.traceparent);
});

test('a sampling decision made upstream is honoured', () => {
  const { req } = run(reqWith({ traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00' }));
  assert.equal(req.trace.sampled, false, 'an upstream not-sampled decision was overridden downstream');
});

test('a malformed header starts a new trace instead of failing the request', () => {
  // Diagnostic plumbing must never be the reason a request 400s.
  const { req } = run(reqWith({ traceparent: 'not-a-traceparent' }));
  assert.match(req.trace.traceId, /^[0-9a-f]{32}$/);
  assert.equal(req.trace.root, true);
});

// -- propagation ---------------------------------------------------------

test('outbound headers carry this hop as the next hop parent', () => {
  const { req } = run(reqWith({ traceparent: VALID }));
  const out = parseTraceparent(traceHeaders(req).traceparent);
  assert.equal(out.traceId, req.trace.traceId, 'the outbound call left the trace');
  assert.equal(
    out.parentId, req.trace.spanId,
    'the outbound call named its own parent instead of this hop — the trace would flatten into a list',
  );
});

test('traceHeaders is safe to spread when there is no trace', () => {
  assert.deepEqual(traceHeaders(undefined), {});
  assert.deepEqual(traceHeaders({}), {});
});

test('a trace survives a chain of hops unchanged', () => {
  // **The property the whole module exists for**, checked end to end
  // rather than inferred from the two halves above.
  const first = run(reqWith()).req;
  const origin = first.trace.traceId;

  let carry = traceHeaders(first);
  const spans = [first.trace.spanId];
  for (let hop = 0; hop < 6; hop += 1) {
    const next = run(reqWith(carry)).req;
    assert.equal(next.trace.traceId, origin, `the trace id changed at hop ${hop + 2}`);
    assert.equal(next.trace.parentId, spans[spans.length - 1], `hop ${hop + 2} lost its parent`);
    spans.push(next.trace.spanId);
    carry = traceHeaders(next);
  }
  assert.equal(new Set(spans).size, spans.length, 'two hops shared a span id');
});

// -- the generators ------------------------------------------------------

test('generated ids are the right shape and do not repeat', () => {
  const traces = new Set(Array.from({ length: 500 }, newTraceId));
  const spans = new Set(Array.from({ length: 500 }, newSpanId));
  assert.equal(traces.size, 500, 'trace ids collided');
  assert.equal(spans.size, 500, 'span ids collided');
  assert.ok([...traces].every((t) => /^[0-9a-f]{32}$/.test(t)));
  assert.ok([...spans].every((s) => /^[0-9a-f]{16}$/.test(s)));
});

test('what we format is what we can parse', () => {
  const traceId = newTraceId();
  const spanId = newSpanId();
  const parsed = parseTraceparent(formatTraceparent({ traceId, spanId }));
  assert.equal(parsed.traceId, traceId);
  assert.equal(parsed.parentId, spanId);
});
