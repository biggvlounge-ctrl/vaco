'use strict';

const EVIDENCE_STATUSES = new Set(['verified','reported','estimated','inferred','conflicting','unverified','unavailable']);
const PROPERTY_TYPES = new Set(['residential','multifamily','commercial','industrial','vacant_land','mixed_use','historic','other']);

function requiredString(value, field, max = 500) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${field} is required`);
  if (value.trim().length > max) throw new RangeError(`${field} exceeds ${max} characters`);
  return value.trim();
}
function optionalFiniteNonNegative(value, field) {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new TypeError(`${field} must be a finite non-negative number`);
  return n;
}
function validateProperty(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('property must be an object');
  const propertyType = requiredString(input.propertyType, 'propertyType', 40);
  if (!PROPERTY_TYPES.has(propertyType)) throw new TypeError('propertyType is not supported');
  const measurements = input.measurements || {};
  const unit = measurements.parcelAreaUnit;
  if (unit && !['sqft','acres','sqm','hectares'].includes(unit)) throw new TypeError('parcelAreaUnit is not supported');
  return {
    ...input,
    id: requiredString(input.id, 'id', 100),
    propertyType,
    measurements: {
      ...measurements,
      parcelArea: optionalFiniteNonNegative(measurements.parcelArea, 'parcelArea'),
      aboveGradeFinishedArea: optionalFiniteNonNegative(measurements.aboveGradeFinishedArea, 'aboveGradeFinishedArea'),
      belowGradeFinishedArea: optionalFiniteNonNegative(measurements.belowGradeFinishedArea, 'belowGradeFinishedArea'),
      belowGradeUnfinishedArea: optionalFiniteNonNegative(measurements.belowGradeUnfinishedArea, 'belowGradeUnfinishedArea')
    }
  };
}
function validateEvidence(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('evidence must be an object');
  const status = requiredString(input.status, 'status', 40);
  if (!EVIDENCE_STATUSES.has(status)) throw new TypeError('evidence status is not supported');
  const source = input.source || {};
  const retrievedAt = requiredString(source.retrievedAt, 'source.retrievedAt', 80);
  const confidence = input.confidence === undefined ? undefined : Number(input.confidence);
  if (confidence !== undefined && (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)) throw new RangeError('confidence must be between 0 and 1');
  if (source.sourceUrl) {
    const u = new URL(source.sourceUrl);
    if (!['http:', 'https:'].includes(u.protocol)) throw new TypeError('sourceUrl must use HTTP or HTTPS');
  }
  return { ...input, id: requiredString(input.id, 'id', 100), propertyId: requiredString(input.propertyId, 'propertyId', 100), statement: requiredString(input.statement, 'statement', 2000), status, confidence, source: { ...source, name: requiredString(source.name, 'source.name', 200), retrievedAt } };
}
module.exports = { EVIDENCE_STATUSES, PROPERTY_TYPES, requiredString, optionalFiniteNonNegative, validateProperty, validateEvidence };
