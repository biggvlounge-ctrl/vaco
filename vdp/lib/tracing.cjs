// VACO — W3C trace context, propagated across every service.
//
// **This file is the source. Do not edit the copies.**
// `./sync-shared-runtime.sh` places it, same as `serviceAuth.js`, and
// for the same reason: each app builds from its own directory.
//
// **What this is, and what it deliberately is not.**
//
// The gap it closes is real and easy to state: a single user action
// crosses six or seven services — Shell → Shield → V4 → V3 → VACA →
// VOID → settlement → notify — and *nothing carries an identifier
// across that boundary*. Every app logs its own half of a story. When
// a transfer goes wrong there is no way to line up the eight log
// streams that describe it.
//
// The Acceleration Directive proposed adopting OpenTelemetry for this.
// That is the right standard and the wrong first step. The OTel SDK is
// a real dependency graph in thirty-three services whose entire
// runtime is `express`, `cors` and `dotenv`, plus a collector to run
// and a backend to choose — and none of it is needed for the part that
// actually has to happen first.
//
// **The part that has to happen first is propagation.** A trace id has
// to be minted at the edge and carried, unchanged, through every
// hop. Once that is true, adopting an OTel exporter later is a
// change to how spans are *reported*; skip it now and every request
// already in flight is unattributable no matter what you install.
//
// So this implements the W3C Trace Context header — `traceparent` —
// which is the same wire format OpenTelemetry itself uses. Ninety
// lines, no dependency, and an OTel SDK dropped in later reads and
// continues these traces rather than starting new ones.
//
// Format, from the W3C recommendation:
//
//   traceparent: 00-<32 hex trace id>-<16 hex span id>-<2 hex flags>
//                 ^version          ^this hop          ^01 = sampled
//
// A malformed or absent header starts a new trace rather than being
// rejected. This is diagnostic plumbing: it must never be the reason a
// request fails.

const crypto = require('crypto');

const VERSION = '00';
const SAMPLED = '01';
const NOT_SAMPLED = '00';

// 32 hex / 16 hex, per the spec. All-zero is explicitly invalid for
// both, which is why they are checked rather than assumed.
const TRACEPARENT_RE = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;
const ZERO_TRACE = '0'.repeat(32);
const ZERO_SPAN = '0'.repeat(16);

function newTraceId() { return crypto.randomBytes(16).toString('hex'); }
function newSpanId() { return crypto.randomBytes(8).toString('hex'); }

/**
 * Parse an incoming `traceparent`. Returns null for anything that is
 * not a valid, non-zero, version-00 header.
 *
 * Version is checked but a *higher* version is accepted rather than
 * refused, per the spec's forward-compatibility rule: a future version
 * still leads with the same trace-id and parent-id fields, and
 * dropping the trace because the version byte moved would silently
 * break propagation the day anything upstream upgrades.
 */
function parseTraceparent(header) {
  if (typeof header !== 'string') return null;
  const m = TRACEPARENT_RE.exec(header.trim().toLowerCase());
  if (!m) return null;
  const [, version, traceId, spanId, flags] = m;
  if (version === 'ff') return null;                 // spec: invalid
  if (traceId === ZERO_TRACE || spanId === ZERO_SPAN) return null;
  return { version, traceId, parentId: spanId, flags };
}

function formatTraceparent({ traceId, spanId, sampled = true }) {
  return `${VERSION}-${traceId}-${spanId}-${sampled ? SAMPLED : NOT_SAMPLED}`;
}

/**
 * Express middleware. Continues an incoming trace or starts a new one,
 * and puts the result on `req.trace`.
 *
 * Mount it early — before the auth middleware — so that a request
 * *refused* by serviceAuth still carries a trace id. A 401 you cannot
 * correlate is exactly the one you want to correlate.
 */
function traceMiddleware(options = {}) {
  const header = options.header || 'traceparent';
  return (req, res, next) => {
    const incoming = parseTraceparent(req.headers[header]);
    const traceId = incoming ? incoming.traceId : newTraceId();
    const spanId = newSpanId();
    const sampled = incoming ? incoming.flags !== NOT_SAMPLED : true;

    req.trace = {
      traceId,
      spanId,
      parentId: incoming ? incoming.parentId : null,
      // True when this service minted the id — the edge of the trace.
      root: !incoming,
      sampled,
      traceparent: formatTraceparent({ traceId, spanId, sampled }),
    };

    // Echoed so a caller — or a human with curl — can read the id of a
    // request they just made without access to any log.
    res.setHeader('traceparent', req.trace.traceparent);
    return next();
  };
}

/**
 * Headers to attach to an outbound call, so the next service continues
 * this trace instead of starting its own.
 *
 * The span id sent is *this* hop's, which becomes the next hop's
 * parent. Sending the incoming parent instead would flatten the trace
 * into a list and lose the shape, which is the whole reason to have it.
 *
 * Returns `{}` when there is no trace, so a caller can always spread it
 * unconditionally:
 *
 *     headers: { 'Content-Type': 'application/json', ...traceHeaders(req) }
 */
function traceHeaders(req) {
  const trace = req && req.trace;
  if (!trace) return {};
  return { traceparent: trace.traceparent };
}

/**
 * One log line, in a shape a collector can parse later without this
 * repo committing to one now.
 */
function traceLine(req, message, extra = {}) {
  const trace = (req && req.trace) || {};
  return JSON.stringify({
    ts: new Date().toISOString(),
    traceId: trace.traceId || null,
    spanId: trace.spanId || null,
    method: req && req.method,
    path: req && (req.originalUrl || req.url),
    msg: message,
    ...extra,
  });
}

module.exports = {
  VERSION,
  parseTraceparent,
  formatTraceparent,
  newTraceId,
  newSpanId,
  traceMiddleware,
  traceHeaders,
  traceLine,
};
