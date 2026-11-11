'use strict';

const YEAR = 2024;
const DATASET = 'acs/acs5';
const BASE_URL = `https://api.census.gov/data/${YEAR}/${DATASET}`;
const VARIABLES = Object.freeze([
  'NAME',
  'B01003_001E', 'B01003_001M', // population estimate and margin of error
  'B25001_001E', 'B25001_001M', // housing units
  'B25002_003E', 'B25002_003M', // vacant housing units
  'B25003_002E', 'B25003_002M', // owner-occupied units
  'B25003_003E', 'B25003_003M', // renter-occupied units
  'B19013_001E', 'B19013_001M', // median household income
  'B25064_001E', 'B25064_001M'  // median gross rent
]);
const METRICS = Object.freeze({
  population: ['B01003_001E', 'B01003_001M'],
  housingUnits: ['B25001_001E', 'B25001_001M'],
  vacantHousingUnits: ['B25002_003E', 'B25002_003M'],
  ownerOccupiedUnits: ['B25003_002E', 'B25003_002M'],
  renterOccupiedUnits: ['B25003_003E', 'B25003_003M'],
  medianHouseholdIncomeUsd: ['B19013_001E', 'B19013_001M'],
  medianGrossRentUsd: ['B25064_001E', 'B25064_001M']
});

function validFips(value, length, name) {
  const s = String(value ?? '').trim();
  if (!new RegExp(`^\\d{${length}}$`).test(s)) throw new Error(`${name} must be exactly ${length} digits`);
  return s;
}
function parseEstimate(value) {
  if (value === null || value === undefined || value === '' || value === '-' || value === 'N') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function toObservation(row, stateFips, countyFips, observedAt) {
  const attrs = {};
  for (const [key, [estimateKey, moeKey]] of Object.entries(METRICS)) {
    attrs[key] = { estimate: parseEstimate(row[estimateKey]), marginOfError: parseEstimate(row[moeKey]), unit: key.endsWith('Usd') ? 'USD' : 'count' };
  }
  const total = attrs.housingUnits.estimate;
  const vacant = attrs.vacantHousingUnits.estimate;
  attrs.vacancyRatePercent = total > 0 && vacant !== null ? Number((vacant / total * 100).toFixed(2)) : null;
  attrs.vacancyRateNote = 'Derived from ACS estimated vacant units / estimated total housing units; not a property-level vacancy determination.';
  return {
    externalId: `${YEAR}-acs5-county-${stateFips}${countyFips}`,
    sourceUrl: BASE_URL,
    observedAt,
    jurisdiction: String(row.NAME || `County ${countyFips}, state ${stateFips}`),
    geography: { stateFips, countyFips, geoid: `${stateFips}${countyFips}` },
    attributes: {
      dataset: DATASET,
      vintage: YEAR,
      geographyLevel: 'county',
      estimates: attrs,
      methodology: 'American Community Survey 5-year estimates; margins of error preserved where supplied.'
    }
  };
}
function buildUrl({ stateFips, countyFips, apiKey }) {
  const state = validFips(stateFips, 2, 'stateFips');
  const params = new URLSearchParams({ get: VARIABLES.join(','), for: countyFips ? `county:${validFips(countyFips, 3, 'countyFips')}` : 'county:*', in: `state:${state}`, key: apiKey });
  return `${BASE_URL}?${params.toString()}`;
}
async function fetchCountyObservations({ stateFips, countyFips, apiKey = process.env.CENSUS_API_KEY, fetchImpl = globalThis.fetch, now = () => new Date() } = {}) {
  if (!apiKey || !String(apiKey).trim()) throw Object.assign(new Error('CENSUS_API_KEY is required to query the Census Data API'), { code: 'CENSUS_API_KEY_MISSING' });
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required');
  const url = buildUrl({ stateFips, countyFips, apiKey: String(apiKey).trim() });
  const response = await fetchImpl(url, { headers: { Accept: 'application/json', 'User-Agent': 'VDEX-public-data-adapter/0.3.21' }, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw Object.assign(new Error(`Census API returned HTTP ${response.status}`), { code: 'CENSUS_HTTP_ERROR', status: response.status });
  const payload = await response.json();
  if (!Array.isArray(payload) || payload.length < 2 || !Array.isArray(payload[0])) throw Object.assign(new Error('Census API returned an unexpected table format'), { code: 'CENSUS_INVALID_RESPONSE' });
  const headers = payload[0];
  const required = ['NAME', ...Object.values(METRICS).flat()];
  for (const field of required) if (!headers.includes(field)) throw Object.assign(new Error(`Census response is missing expected field ${field}`), { code: 'CENSUS_SCHEMA_MISMATCH' });
  const observedAt = now().toISOString();
  const rows = payload.slice(1).map(values => Object.fromEntries(headers.map((h, i) => [h, values[i]])));
  const observations = rows.map(row => {
    const state = validFips(row.state, 2, 'response state');
    const county = validFips(row.county, 3, 'response county');
    return toObservation(row, state, county, observedAt);
  });
  return { observations, metadata: { publisher: 'U.S. Census Bureau', dataset: DATASET, vintage: YEAR, geography: countyFips ? 'county' : 'all counties in state', retrievedAt: observedAt, sourceUrl: BASE_URL, recordCount: observations.length } };
}
function adapterStatus({ configured = Boolean(process.env.CENSUS_API_KEY) } = {}) {
  return { key: 'census_acs_api', adapter: 'live_read_only_adapter', configured, connectionStatus: 'not_verified', requiredEnvironment: 'CENSUS_API_KEY', dataset: DATASET, vintage: YEAR, geography: 'county', supportedFilters: ['stateFips', 'countyFips'], sourceUrl: BASE_URL, note: configured ? 'Credentials are present; run a query to verify connectivity. No connection is claimed until a successful fetch.' : 'No API key configured. Obtain a Census API key and set CENSUS_API_KEY before running.' };
}
module.exports = { YEAR, DATASET, VARIABLES, METRICS, buildUrl, fetchCountyObservations, adapterStatus };
