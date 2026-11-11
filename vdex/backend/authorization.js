'use strict';

const ROLE_PERMISSIONS = Object.freeze({
  owner: ['*'],
  admin: ['organization:read','organization:manage','properties:read','properties:write','buyers:read','buyers:write','sellers:read','sellers:write','workforce:read','workforce:manage','audit:read'],
  acquisitions: ['properties:read','properties:write','buyers:read','buyers:write','sellers:read','sellers:write'],
  analyst: ['properties:read','buyers:read','audit:read'],
  workforce_manager: ['properties:read','workforce:read','workforce:manage'],
  worker: ['workforce:self:read','workforce:self:write'],
  viewer: ['properties:read','buyers:read']
});

function normalizePrincipal(value) {
  if (!value || typeof value !== 'object') throw new TypeError('An authenticated principal is required');
  const { userId, organizationId, role, status = 'active' } = value;
  if (typeof userId !== 'string' || !userId.trim()) throw new TypeError('Principal userId is required');
  if (typeof organizationId !== 'string' || !organizationId.trim()) throw new TypeError('Principal organizationId is required');
  if (!Object.hasOwn(ROLE_PERMISSIONS, role)) throw new TypeError('Principal role is not recognized');
  if (status !== 'active') throw new TypeError('Principal membership is not active');
  return Object.freeze({ userId: userId.trim(), organizationId: organizationId.trim(), role, status });
}

function hasPermission(principal, permission) {
  let p;
  try { p = normalizePrincipal(principal); } catch { return false; }
  if (typeof permission !== 'string' || !permission.trim()) return false;
  const grants = ROLE_PERMISSIONS[p.role];
  return grants.includes('*') || grants.includes(permission);
}

function assertPermission(principal, permission) {
  const p = normalizePrincipal(principal);
  if (!hasPermission(p, permission)) {
    const error = new Error('Permission denied');
    error.status = 403;
    throw error;
  }
  return p;
}

function tenantPredicate(principal, record) {
  let p;
  try { p = normalizePrincipal(principal); } catch { return false; }
  return Boolean(record && typeof record.tenantId === 'string' && record.tenantId === p.organizationId);
}

module.exports = { ROLE_PERMISSIONS, normalizePrincipal, hasPermission, assertPermission, tenantPredicate };
