'use strict';
const crypto = require('node:crypto');
const { normalizePrincipal } = require('./authorization');

function decodePart(value) {
  try { return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')); }
  catch { throw Object.assign(new Error('Invalid bearer token'), { status: 401 }); }
}
function verifyAccessToken(token, secret, options = {}) {
  if (typeof secret !== 'string' || Buffer.byteLength(secret) < 32) {
    throw Object.assign(new Error('Authentication is not configured securely'), { status: 503 });
  }
  if (typeof token !== 'string' || token.length > 8192) throw Object.assign(new Error('Bearer token is missing or invalid'), { status: 401 });
  const parts = token.split('.');
  if (parts.length !== 3) throw Object.assign(new Error('Invalid bearer token'), { status: 401 });
  const header = decodePart(parts[0]);
  const claims = decodePart(parts[1]);
  if (header.alg !== 'HS256' || header.typ !== 'JWT') throw Object.assign(new Error('Unsupported bearer token'), { status: 401 });
  const expected = crypto.createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest();
  let supplied;
  try { supplied = Buffer.from(parts[2], 'base64url'); } catch { supplied = Buffer.alloc(0); }
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) throw Object.assign(new Error('Invalid bearer token signature'), { status: 401 });
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(claims.exp) || claims.exp <= now) throw Object.assign(new Error('Bearer token has expired'), { status: 401 });
  if (claims.nbf !== undefined && (!Number.isFinite(claims.nbf) || claims.nbf > now)) throw Object.assign(new Error('Bearer token is not active'), { status: 401 });
  if (options.issuer && claims.iss !== options.issuer) throw Object.assign(new Error('Bearer token issuer is invalid'), { status: 401 });
  if (options.audience && !(claims.aud === options.audience || (Array.isArray(claims.aud) && claims.aud.includes(options.audience)))) throw Object.assign(new Error('Bearer token audience is invalid'), { status: 401 });
  try {
    return normalizePrincipal({ userId: claims.sub, organizationId: claims.org, role: claims.role, status: claims.membership_status || 'active' });
  } catch { throw Object.assign(new Error('Bearer token principal is invalid'), { status: 401 }); }
}
function authenticateRequest(req, env = process.env) {
  const match = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
  if (!match) throw Object.assign(new Error('A bearer access token is required'), { status: 401 });
  return verifyAccessToken(match[1], env.VDEX_JWT_SECRET, { issuer: env.VDEX_JWT_ISSUER || 'vdex', audience: env.VDEX_JWT_AUDIENCE || 'vdex-api' });
}
function signTestToken(claims, secret) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const head = encode({ alg: 'HS256', typ: 'JWT' });
  const body = encode(claims);
  const signature = crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${signature}`;
}
module.exports = { verifyAccessToken, authenticateRequest, signTestToken };
