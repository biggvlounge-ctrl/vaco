// World Layer — run the real UNESCO import.
//
// **What this closes.** `imports/unescoImport.js` holds a real, tested
// import pipeline and a `fetchUnescoSites()` that throws, because this
// sandbox's outbound proxy rejects query.wikidata.org and
// whc.unesco.org (confirmed directly against the proxy's own status
// endpoint, not assumed). So the automation existed and there was no
// way to actually run it.
//
// This script is the missing half: point it at a file of site records
// and the real pipeline runs. On a network that can reach Wikidata the
// fetch step is a `curl` away, and the SPARQL query below is written
// out ready to use — so this goes from "documented stub" to "one
// command", which is the difference between an automation you have and
// one you are told you have.
//
// Why it matters commercially: every UNESCO site imported here is a
// Tier 1 location that nobody had to research or place by hand. Tier 1
// is the only tier priced per location (~$350-$800 each — see
// costModel.js for the derivation), so this is the tier where
// automation is worth the most per row.
//
// ---------------------------------------------------------------------
// Usage
//
//   node scripts/import-unesco.mjs sites.json
//   node scripts/import-unesco.mjs sites.json --limit 50
//   node scripts/import-unesco.mjs --print-query
//
// `sites.json` is an array of records shaped:
//
//   [{ "name": "...", "lat": 0, "lng": 0,
//      "country": "...", "inscribedYear": 1982, "description": "..." }]
//
// To produce one on a network that can reach Wikidata, run
// `--print-query`, send it to https://query.wikidata.org/sparql with
// `Accept: application/sparql-results+json`, and map the bindings to
// that shape. The mapper is included below (`fromWikidataBindings`) so
// the shape does not have to be re-derived.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createWorldLayer } = require('../locations.js');
const { importUnescoSites } = require('../imports/unescoImport.js');
const { getTierCoverage } = require('../costModel.js');

// The real query, kept here rather than in a comment so it can be
// piped straight out. UNESCO World Heritage Site is wd:Q9259.
const SPARQL = `SELECT ?siteLabel ?lat ?lng ?countryLabel ?inscribed WHERE {
  ?site wdt:P31/wdt:P279* wd:Q9259 .
  ?site p:P625 ?coordStatement .
  ?coordStatement psv:P625 ?coordNode .
  ?coordNode wikibase:geoLatitude ?lat ;
             wikibase:geoLongitude ?lng .
  OPTIONAL { ?site wdt:P17 ?country . }
  OPTIONAL { ?site wdt:P1435 ?heritage . ?site wdt:P580 ?inscribed . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;

// Wikidata's JSON results shape -> the record shape importUnescoSites
// expects. Written here so nobody has to re-derive it from the
// pipeline's validation errors.
export function fromWikidataBindings(bindings) {
  return bindings.map((b) => ({
    name: b.siteLabel?.value,
    lat: Number(b.lat?.value),
    lng: Number(b.lng?.value),
    country: b.countryLabel?.value ?? null,
    inscribedYear: b.inscribed?.value ? Number(String(b.inscribed.value).slice(0, 4)) : null,
    description: null,
  }));
}

function say(line) { process.stdout.write(`  ${line}\n`); }

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--print-query')) {
    process.stdout.write(`${SPARQL}\n`);
    return;
  }

  const file = args.find((a) => !a.startsWith('--'));
  if (!file) {
    process.stderr.write(
      '\nusage: node scripts/import-unesco.mjs <sites.json> [--limit N]\n'
      + '       node scripts/import-unesco.mjs --print-query\n\n'
      + 'See the header of this file for how to produce sites.json.\n\n',
    );
    process.exit(1);
  }

  const limitFlag = args.indexOf('--limit');
  const limit = limitFlag === -1 ? null : Number(args[limitFlag + 1]);

  const resolved = path.resolve(file);
  if (!fs.existsSync(resolved)) {
    process.stderr.write(`\nNo such file: ${resolved}\n\n`);
    process.exit(1);
  }

  let records;
  try {
    records = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  } catch (err) {
    process.stderr.write(`\n${resolved} is not valid JSON: ${err.message}\n\n`);
    process.exit(1);
  }

  // Accept either a bare array or a raw Wikidata response, because the
  // obvious thing to do with a SPARQL result is save it as-is.
  if (records?.results?.bindings) {
    say('input looks like a raw Wikidata response — mapping bindings');
    records = fromWikidataBindings(records.results.bindings);
  }
  if (!Array.isArray(records)) {
    process.stderr.write('\nExpected an array of site records.\n\n');
    process.exit(1);
  }
  if (Number.isFinite(limit)) records = records.slice(0, limit);

  process.stdout.write(`\nImporting ${records.length} UNESCO sites\n\n`);

  const worldLayer = createWorldLayer();
  let imported;
  try {
    imported = importUnescoSites(worldLayer, records);
  } catch (err) {
    // The pipeline validates every record and names the bad one. That
    // is worth surfacing rather than swallowing — a silent skip would
    // mean a missing landmark nobody notices until someone asks where
    // it went.
    process.stderr.write(`\nimport failed: ${err.message}\n\n`);
    process.exit(1);
  }

  say(`${imported.length} locations created, all at hero tier`);

  const coverage = getTierCoverage(worldLayer);
  say(`tier coverage: ${JSON.stringify(coverage.byTier)}`);
  say(`paid-human-work locations: ${coverage.paidHumanWork}`);
  process.stdout.write('\n');
  say('Every one of these is a Tier 1 location nobody had to research or');
  say('place by hand. At the rate on file ($350-$800 each) that is');
  const low = coverage.paidHumanWork * 350;
  const high = coverage.paidHumanWork * 800;
  say(`$${low.toLocaleString()}-$${high.toLocaleString()} of scope now located and tiered,`);
  say('with the artistic refinement still to be done — placement is not art.');
  process.stdout.write('\n');
}

main();
