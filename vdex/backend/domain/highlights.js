'use strict';
const ALLOWED = new Set(['opportunity','property_feature','risk_consideration']);

/** Build exactly three primary highlights from supplied evidence-backed candidates.
 * Candidates without evidence are not stated as facts. Empty slots disclose insufficient information.
 */
function generateTopThree(propertyId, candidates = [], { generatedAt = new Date().toISOString(), version = 1 } = {}) {
  if (!propertyId) throw new TypeError('propertyId is required');
  const usable = candidates.filter(c => c && ALLOWED.has(c.category) && Array.isArray(c.evidenceIds) && c.evidenceIds.length > 0 && typeof c.headline === 'string' && c.headline.trim() && typeof c.explanation === 'string' && c.explanation.trim());
  usable.sort((a,b) => (Number(b.priority)||0) - (Number(a.priority)||0));
  const selected = usable.slice(0,3).map((c,index) => ({
    id: `${propertyId}-highlight-${version}-${index+1}`,
    propertyId,
    headline: c.headline.trim(),
    explanation: c.explanation.trim(),
    category: c.category,
    evidenceIds: [...new Set(c.evidenceIds)],
    confidence: Number.isFinite(Number(c.confidence)) ? Math.max(0,Math.min(1,Number(c.confidence))) : 0,
    verificationStatus: c.verificationStatus || 'unverified',
    generatedAt,
    version
  }));
  while (selected.length < 3) {
    const index = selected.length + 1;
    selected.push({
      id: `${propertyId}-highlight-${version}-${index}`,
      propertyId,
      headline: 'Insufficient verified information',
      explanation: 'The available evidence does not support another property-specific conclusion. Additional records or professional review may be required.',
      category: 'risk_consideration',
      evidenceIds: [],
      confidence: 0,
      verificationStatus: 'insufficient_information',
      generatedAt,
      version
    });
  }
  return selected;
}
module.exports = { generateTopThree };
