// VENVS Publishing — royalty calculators.
// Source of truth: VENVS_PUBLISHING_ADDITION.md, "Real royalty/pricing
// structure (2026)". Pure functions, no VCoin/network calls here —
// catalog.js orchestrates actual payment using these.

export function calculateEbookRoyalty(listPrice, deliveryFee = 0) {
  if (!Number.isFinite(listPrice) || listPrice <= 0) {
    throw new Error('calculateEbookRoyalty requires a positive listPrice');
  }
  if (!Number.isFinite(deliveryFee) || deliveryFee < 0) {
    throw new Error('calculateEbookRoyalty requires a non-negative deliveryFee');
  }

  const inBand = listPrice >= 2.99 && listPrice <= 9.99;
  const rate = inBand ? 0.7 : 0.35;
  // The doc ties "minus a small delivery fee" specifically to the
  // 70% band (matching the real KDP mechanic this is modeled on) --
  // the 35% band isn't described as having a delivery fee deduction.
  const raw = inBand ? listPrice * rate - deliveryFee : listPrice * rate;
  const royaltyAmount = Math.max(0, Math.round(raw * 100) / 100);

  return { rate, royaltyAmount, band: inBand ? 'in_band_70' : 'out_of_band_35' };
}

export function calculatePrintRoyalty(listPrice, printingCost) {
  if (!Number.isFinite(listPrice) || listPrice <= 0) {
    throw new Error('calculatePrintRoyalty requires a positive listPrice');
  }
  if (!Number.isFinite(printingCost) || printingCost < 0) {
    throw new Error('calculatePrintRoyalty requires a non-negative printingCost');
  }

  const raw = listPrice * 0.6 - printingCost;
  // A print run priced below its own printing cost can't pay a real
  // author royalty -- clamped to 0 rather than returning a negative
  // payout, and flagged so the caller (or a future pricing-guidance
  // UI) can warn the author their price is unprofitable.
  const belowCost = raw < 0;
  const royaltyAmount = belowCost ? 0 : Math.round(raw * 100) / 100;

  return { rate: 0.6, royaltyAmount, belowCost };
}

// The doc describes the per-page rate as coming "from a shared
// monthly fund" -- i.e. it's not a fixed constant, it's
// fund_size / total_pages_read_platform-wide, same mechanic as the
// real program this is modeled on. $0.004-0.005/page is given as the
// typical real-world range, used here as a sanity check, not a hard
// constraint (the real fund fluctuates and could genuinely land
// outside it in an unusual month).
export function calculateSubscriptionFundRate(totalMonthlyFund, totalPagesReadPlatformWide) {
  if (!Number.isFinite(totalMonthlyFund) || totalMonthlyFund <= 0) {
    throw new Error('calculateSubscriptionFundRate requires a positive totalMonthlyFund');
  }
  if (!Number.isFinite(totalPagesReadPlatformWide) || totalPagesReadPlatformWide <= 0) {
    throw new Error('calculateSubscriptionFundRate requires positive totalPagesReadPlatformWide');
  }
  const rate = totalMonthlyFund / totalPagesReadPlatformWide;
  const typicalRange = rate >= 0.004 && rate <= 0.005;
  return { rate: Math.round(rate * 100000) / 100000, typicalRange };
}

export function calculateSubscriptionPayout(pagesRead, ratePerPage) {
  if (!Number.isFinite(pagesRead) || pagesRead < 0) {
    throw new Error('calculateSubscriptionPayout requires a non-negative pagesRead');
  }
  if (!Number.isFinite(ratePerPage) || ratePerPage < 0) {
    throw new Error('calculateSubscriptionPayout requires a non-negative ratePerPage');
  }
  return Math.round(pagesRead * ratePerPage * 100) / 100;
}

// AI narration ("Virtual Voice"-style) has a real, specified flat
// rate (40%). Traditional narrator-royalty deals do NOT have a
// specified rate anywhere in the source doc ("traditional
// narrator-royalty deals" is named but not quantified, and the doc
// explicitly flags Audible's own royalty model as still-shifting as
// of May 2026) -- so narratorRoyaltyRate is a required input for that
// path, not a default this function invents.
export function calculateAudiobookRoyalty(listPrice, options = {}) {
  if (!Number.isFinite(listPrice) || listPrice <= 0) {
    throw new Error('calculateAudiobookRoyalty requires a positive listPrice');
  }
  const { narrationType, narratorRoyaltyRate } = options;

  if (narrationType === 'ai') {
    return { rate: 0.4, royaltyAmount: Math.round(listPrice * 0.4 * 100) / 100, narrationType: 'ai' };
  }
  if (narrationType === 'narrator') {
    if (!Number.isFinite(narratorRoyaltyRate) || narratorRoyaltyRate <= 0 || narratorRoyaltyRate > 1) {
      throw new Error(
        'calculateAudiobookRoyalty: narrationType "narrator" requires an explicit narratorRoyaltyRate ' +
        '(0-1) -- no default rate is specified for traditional narrator deals in any source doc'
      );
    }
    const royaltyAmount = Math.round(listPrice * narratorRoyaltyRate * 100) / 100;
    return { rate: narratorRoyaltyRate, royaltyAmount, narrationType: 'narrator' };
  }
  throw new Error('calculateAudiobookRoyalty requires narrationType "ai" or "narrator"');
}
