'use strict';
const { validateProperty, validateEvidence } = require('../validation/validators');

function createPropertyDNA(property, evidence = []) {
  const record = validateProperty(property);
  const validatedEvidence = evidence.map(validateEvidence);
  for (const item of validatedEvidence) {
    if (item.propertyId !== record.id) throw new Error(`Evidence ${item.id} belongs to another property`);
  }
  return {
    property: record,
    evidence: validatedEvidence,
    measurementRules: {
      aboveGradeFinishedArea: 'Reported separately; never includes basement area automatically.',
      belowGradeFinishedArea: 'Reported separately from above-grade living area.',
      belowGradeUnfinishedArea: 'Reported separately from finished areas.',
      parcelArea: 'Unit and source must be retained; inferred image measurements are not legal surveys.'
    },
    dataQuality: {
      evidenceCount: validatedEvidence.length,
      conflictingEvidenceCount: validatedEvidence.filter(x => x.status === 'conflicting').length,
      unverifiedEvidenceCount: validatedEvidence.filter(x => ['unverified','unavailable'].includes(x.status)).length
    }
  };
}
module.exports = { createPropertyDNA };
