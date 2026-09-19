// scripts/playtest.mjs
//
// **Play the world.** Not a fixture and not a measurement — build a
// world, run it long, and print what a PLAYER would see: how many jobs
// there are, whether anybody finished school, whether any two
// neighbourhoods differ, what the event log is actually full of, and
// whether anything has reached a state it can never leave.
//
// CLAUDE.md's sixteenth standing rule is this file. The first run of it
// found three defects that 876 passing tests and a green ecosystem
// sweep could not see, because all three were mechanisms that worked
// perfectly and were never reached — including one that threw out of
// `advanceTick` and stopped the world outright.
//
//     node vacon-c/scripts/playtest.mjs [ticks]     # default 400
//
// Read it for the shape, not for a pass/fail. Nothing here asserts;
// the point is to look.

import { createRequire } from 'node:module';
const require = createRequire(new URL('../server/', import.meta.url));

const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');
const statecraft = require('../server/statecraft.js');
const territory = require('../server/territory.js');
const authority = require('../server/authority.js');
const economy = require('../server/economy.js');
const mortality = require('../server/mortality.js');
const behavior = require('../server/behavior.js');

const TICKS = Number(process.argv[2] || 400);
const w = engine.WorldState;
const summary = worldgen.generateWorld({ seed: 'playtest' });

const snap = () => ({
  tick: w.tick,
  living: w.npcs.length,
  dead: (w.deceased || []).length,
  events: w.events.length,
  missionsOpen: (w.missions || []).filter(m => m.status === 'available').length,
  missionsDone: (w.missions || []).filter(m => m.status === 'completed').length,
  crimes: (w.crimeIncidents || []).length,
  cases: (w.courtCases || []).length,
  imprisoned: w.npcs.filter(n => n.status === 'imprisoned').length,
  employed: (w.employmentRecords || []).filter(r => r.status === 'active').length,
  netWorthMed: median(w.npcs.map(n => economy.getNetWorth(w, n.id)).filter(Number.isFinite)),
  supply: sum((w.resources||[]).map(r => Number(r.supply)||0)),
  demand: sum((w.resources||[]).map(r => Number(r.demand)||0)),
});
const sum = xs => xs.reduce((a,b)=>a+b,0);
function median(xs){ if(!xs.length) return null; const s=[...xs].sort((a,b)=>a-b); return s[Math.floor(s.length/2)]; }

const marks = [];
marks.push(snap());
for (let t = 0; t < TICKS; t += 1) {
  engine.advanceTick();
  if ((t+1) % 100 === 0) marks.push(snap());
}

console.log('=== the arc ===');
console.log(['tick','living','dead','events','mAvail','mDone','crimes','cases','jail','jobs','medNW','supply','demand'].join('\t'));
for (const m of marks) {
  console.log([m.tick,m.living,m.dead,m.events,m.missionsOpen,m.missionsDone,m.crimes,m.cases,m.imprisoned,m.employed,m.netWorthMed,Math.round(m.supply),Math.round(m.demand)].join('\t'));
}

console.log('\n=== what happened, by event type ===');
const byType = {};
for (const e of w.events) byType[e.type] = (byType[e.type]||0)+1;
for (const [k,v] of Object.entries(byType).sort((a,b)=>b[1]-a[1])) console.log(String(v).padStart(6), k);

console.log('\n=== do areas differ? ===');
for (const c of w.communities) {
  const st = statecraft.communityStability(w, c.id);
  const wr = authority.writOf(w, c.id);
  console.log(`c${c.id} city${c.city_id} pop${String(c.population).padStart(3)} health${String(territory.getCommunityHealth(c)).padStart(4)} stab${String(st).padStart(4)} ${statecraft.stabilityBand(st)||'-'} writ${wr.writ===null?'  null':wr.writ.toFixed(2)} ${wr.regime||'-'} crime${String(c.crime).padStart(4)} emp${String(c.employment).padStart(4)} edu${String(c.education).padStart(4)}`);
}

console.log('\n=== do cities differ? ===');
for (const c of w.cities) {
  const d = statecraft.describeStatecraft(w, c.id);
  console.log(`city${c.id} "${c.name}" dna=${d.dna} econ=${c.economy} infra=${c.infrastructure} safety=${c.safety} growth=${c.growth} tourism=${d.tourism} appeal=${d.tourismAppeal} stab=${d.stability}/${d.stabilityBand} garrison=${d.garrison?.toFixed(2)} budget=${d.budget} funding=${JSON.stringify(d.funding)}`);
}

console.log('\n=== can a player act? ===');
const actor = w.npcs[0];
console.log('actions available:', engine.listActions ? engine.listActions().length : 'n/a');
console.log('missions available to a citizen:', engine.availableMissions ? engine.availableMissions(actor.id).length : 'n/a');
console.log('sample NPC mood:', behavior.describeBehavior ? JSON.stringify(behavior.describeBehavior(w, actor.id)).slice(0,300) : 'n/a');

console.log('\n=== absorbing states? ===');
const ages = w.npcs.map(n => mortality.ageInYears(w, n, w.tick)).filter(Number.isFinite);
console.log('age min/med/max:', Math.min(...ages), median(ages), Math.max(...ages));
console.log('education spread:', JSON.stringify(w.npcs.reduce((a,n)=>{a[n.education??'null']=(a[n.education??'null']||0)+1;return a;},{})));
console.log('net worth min/med/max:', (()=>{const v=w.npcs.map(n=>economy.getNetWorth(w,n.id)).filter(Number.isFinite);return [Math.min(...v),median(v),Math.max(...v)];})());
console.log('resources at zero supply:', (w.resources||[]).filter(r=>Number(r.supply)<=0).length, 'of', (w.resources||[]).length);
console.log('properties at condition 0:', (w.properties||[]).filter(p=>Number(p.condition)<=0).length, 'of', (w.properties||[]).length);
console.log('infrastructure failed now:', (w.infrastructure||[]).filter(r=>r.failed_since_tick!==null).length, 'of', (w.infrastructure||[]).length);
console.log('relationships above conflict 30:', (w.relationships||[]).filter(r=>Number(r.conflict)>30).length, 'of', (w.relationships||[]).length);

// ---------------------------------------------------------------------
// Added 19 Sep 2026, after a session that put four new systems into the
// world. Everything above was blind to all of them — which is the
// eleventh rule's shape pointed at the playtest itself: a system the
// playtest cannot see is a system the playtest cannot find a bug in.
// ---------------------------------------------------------------------
const salvage = require('../server/salvage.js');
const discovery = require('../server/discovery.js');
const merchandise = require('../server/merchandise.js');
const landmarks = require('../server/landmarks.js');

console.log('\n=== is there anything to find, and did anybody find it? ===');
{
  const marks = (w.properties || []).filter((p) => p.landmark_category);
  const named = marks.filter((p) => p.name);
  console.log('landmarks:', marks.length, '| named:', named.length,
    '| categories present:', new Set(marks.map((p) => p.landmark_category)).size,
    'of', landmarks.ALL_CATEGORIES.length);
  const areas = {};
  for (const m of marks) areas[m.community_id] = (areas[m.community_id] || 0) + 1;
  console.log('landmarks per area:', JSON.stringify(areas));
  console.log('areas with none:',
    (w.communities || []).filter((c) => !areas[c.id]).length, 'of', (w.communities || []).length);

  const d = discovery.describeDiscovery(w);
  console.log('finds: held', d.findsHeld, '| remaining', d.findsRemaining,
    '| taken', d.findsHeld - d.findsRemaining);
  // **The labels have to name what is actually printed.** This read
  // "worthless/unreachable/unmakeable" — salvage's three, copied onto
  // discovery's three, which are different things. `poolless` is
  // documented in discovery.js as expected and not a defect, so the
  // mislabelled 7 read as seven broken items and sent somebody looking
  // for a bug that was a category with no pool, on purpose.
  console.log('discovery guard — poolless/emptyCategories/unreachableFields:',
    d.poolless.length, '/', d.emptyCategories.length, '/', d.unreachableFields.length,
    `(poolless is expected: ${d.poolless.length} of ${d.categories} Key categories have no `
    + 'pool in the documents. The other two are the real guards.)');
  console.log('artifacts:', (w.artifacts || []).length,
    '| with a location:', (w.artifacts || []).filter((a) => a.location_id != null).length);
}

console.log('\n=== does anything get made, and out of what? ===');
{
  const held = {};
  for (const h of w.inventory || []) held[h.item_name] = (held[h.item_name] || 0) + Number(h.quantity);
  const materials = salvage.MATERIAL_NAMES.filter((m) => held[m]);
  const products = salvage.PRODUCT_NAMES.filter((p) => held[p]);
  console.log('materials in circulation:', materials.length, 'of', salvage.MATERIAL_NAMES.length,
    '| units:', materials.reduce((a, m) => a + held[m], 0));
  console.log('products made:', products.length, 'of', salvage.PRODUCT_NAMES.length,
    '| units:', products.reduce((a, p) => a + held[p], 0));
  const s = salvage.describeSalvage(w);
  console.log('salvage guard — worthless/unreachable/unused/unmakeable:',
    s.worthless.length, '/', s.unreachableMaterials.length, '/',
    s.unusedMaterials.length, '/', s.unmakeableProducts.length);
  const m = merchandise.describeMerchandise(w);
  console.log('stocked locations:', m.stockedLocations, '| already taken:', m.alreadyTaken,
    '| empty categories:', m.emptyCategories.length);
}

console.log('\n=== the new event types, which the log above lumps in ===');
{
  const wanted = ['thing_made', 'discovery_made', 'takeover_succeeded', 'takeover_failed',
    'meeting_held', 'family_discord', 'partnership_formed', 'feud_opened'];
  const counts = {};
  for (const e of w.events || []) if (wanted.includes(e.type)) counts[e.type] = (counts[e.type] || 0) + 1;
  for (const type of wanted) console.log(' ', type.padEnd(20), counts[type] || 0);
}
