'use strict';
function calculateOpportunityScore(dimensions = [], blockingRisks = []) {
  const normalized = dimensions.map(d => {
    const score = d.score === undefined || d.score === null ? undefined : Number(d.score);
    const weight = Number(d.weight);
    const confidence = d.confidence === undefined ? 0 : Number(d.confidence);
    if (!Number.isFinite(weight) || weight < 0) throw new TypeError(`Invalid weight for ${d.key || 'dimension'}`);
    if (score !== undefined && (!Number.isFinite(score) || score < 0 || score > 100)) throw new RangeError(`Score for ${d.key || 'dimension'} must be 0..100`);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new RangeError(`Confidence for ${d.key || 'dimension'} must be 0..1`);
    return { ...d, score, weight, confidence };
  });
  const usable = normalized.filter(d => d.score !== undefined && d.weight > 0 && !['missing','conflicting'].includes(d.status));
  const totalWeight = usable.reduce((s,d) => s + d.weight, 0);
  const overallScore = totalWeight ? Math.round(usable.reduce((s,d) => s + d.score*d.weight,0)/totalWeight) : undefined;
  const confidenceDenominator = usable.reduce((s,d) => s+d.weight,0);
  const confidence = confidenceDenominator ? Number((usable.reduce((s,d) => s+d.confidence*d.weight,0)/confidenceDenominator).toFixed(3)) : 0;
  return {
    overallScore,
    confidence,
    dimensions: normalized,
    blockingRisks: [...new Set(blockingRisks)],
    decisionNote: blockingRisks.length ? 'Blocking risks require review regardless of the aggregate score.' : 'Screening result only; not an appraisal or profit guarantee.',
    methodologyVersion: 'vdex-opportunity-0.1'
  };
}
module.exports = { calculateOpportunityScore };
