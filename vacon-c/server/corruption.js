// server/corruption.js
//
// By direct instruction: "pervasive corruption across institutions"
// plus "looting/rioting/B&E during collapse" — two real, separate
// mechanics that share one real trait and one real area-of-the-world
// measure, neither of them invented for this file.
//
// ---------------------------------------------------------------------
// "Pervasive... across institutions" — the real, already-measured cut
// generalized to every real employer, not a second one invented here
// ---------------------------------------------------------------------
// `roguePolice.js` already closed "a lot of them already were
// crooked" for police, and `justice.js`/`drugTrade.js` already close
// it for prison guards/wardens — all three read the identical real
// `leadership.'Corruption Risk'` trait against the identical real,
// measured `CORRUPTION_DEFECTION_THRESHOLD` (the trait scale's own
// neutral centre, 50 — see that file's own header). "Pervasive" is
// taken literally: `runEmbezzlement` applies that SAME reused trait
// and threshold to every real, currently-active employment record at
// every real organization with real `assets` to skim from, never a
// second corruption vocabulary scoped to one institution type.
//
// ---------------------------------------------------------------------
// "Looting/rioting/B&E during collapse" — the real trigger and the
// real mechanic both already existed, unconnected
// ---------------------------------------------------------------------
// `authority.writOf`/`regimeFor` already compute, every tick, whether
// a community has gone `lawless` — the real, measured "collapse" this
// engine already tracks, confirmed directly rather than inventing a
// second "has society collapsed here" flag. `salvage.stripProperty`
// already exists too — a real, working break-in: it refuses an
// occupied home or an operated business on its own (a real, already-
// enforced "this is somebody's home or livelihood, not salvage" rule)
// and reduces the building's own real `condition` by its own real,
// already-used `STRIP_CONDITION_COST`. It had exactly one caller
// before this file — a player's own `strip-building` verb.
// `runCollapseLooting` is the AMBIENT version: in a real lawless area,
// a real resident of that same area breaks into a real, eligible,
// vacant building there, through the identical function a player
// would call, recorded as a real `property` offence.

'use strict';

const economy = require('./economy.js');
const crime = require('./crime.js');
const roguePolice = require('./roguePolice.js');
const authority = require('./authority.js');
const salvage = require('./salvage.js');
const { seededDraw } = require('./seeded.js');

// Reused directly from `crime.BASE_DEPRIVATION_RISK` — the real,
// already-calibrated "per person, per tick" order of magnitude this
// engine already uses for a pressure-driven offence, rather than a
// second invented rate living at a different scale.
const EMBEZZLEMENT_RATE = crime.BASE_DEPRIVATION_RISK;
// Flagged interpretive — no document gives a real embezzlement
// fraction — kept small on purpose: pervasive corruption reads as
// many small, ongoing skims across many institutions, not one person
// draining an organization dry.
const EMBEZZLEMENT_SKIM_FRACTION = 0.01;

const LOOT_RATE = crime.BASE_DEPRIVATION_RISK;

function runEmbezzlement(worldState, tick = worldState.tick ?? 0) {
  const incidents = [];
  for (const record of worldState.employmentRecords || []) {
    if (record.status !== 'active') continue;
    const risk = roguePolice.corruptionRiskOf(worldState, record.entity_id);
    if (risk === null || risk < roguePolice.CORRUPTION_DEFECTION_THRESHOLD) continue;

    const org = (worldState.organizations || []).find((o) => o.id === record.employer_organization_id);
    if (!org) continue;
    const assets = Number(org.assets) || 0;
    if (assets <= 0) continue;

    const draw = seededDraw([worldState.seed ?? 'world', 'embezzlement', record.entity_id, org.id, tick]);
    if (draw >= EMBEZZLEMENT_RATE) continue;

    const skim = Math.round(assets * EMBEZZLEMENT_SKIM_FRACTION * 100) / 100;
    if (skim <= 0) continue;
    org.assets = Math.round((assets - skim) * 100) / 100;

    const current = economy.getLatestFinances(worldState, record.entity_id);
    economy.generateIndividualFinances(worldState, record.entity_id, {
      income: current?.income ?? 0,
      savings: Math.round(((current?.savings ?? 0) + skim) * 100) / 100,
      debt: current?.debt ?? 0,
      assets: current?.assets ?? 0,
      tick,
    });

    // **Never the perpetrator's own id.** A leader can embezzle from
    // their own organization — real self-dealing, not a special case
    // to exclude — but `justice.answerByGroup`'s own real restitution
    // path (`inventory.transfer(fromId: offender, toId: victim)`)
    // throws "cannot transfer to itself" the moment offender and
    // victim are the same living person, which this engine's own
    // sixteenth standing rule already names as the kind of thing a
    // fixture never runs long enough to find. The organization itself
    // has no entity id to name as the victim, so this stays null the
    // same honest way `runCollapseLooting`'s own victimless incidents
    // already do.
    const victimId = (org.leader_id !== null && org.leader_id !== undefined
      && org.leader_id !== record.entity_id) ? org.leader_id : null;

    incidents.push(crime.recordCrime(worldState, {
      category: 'fraud',
      perpetratorId: record.entity_id,
      victimId,
      tick,
      detail: `entity ${record.entity_id} (${record.position ?? 'employee'}) embezzled ${skim} from organization ${org.id}`,
    }));
  }
  return incidents;
}

// A real, eligible building in a real lawless community: vacant, not
// operated by an organization, and not already stripped to nothing —
// `salvage.stripProperty`'s own real refusals, checked here first so
// a selection never has to discover them by catching a thrown error.
function eligiblePropertiesIn(worldState, communityId) {
  return (worldState.properties || []).filter((p) => p.community_id === communityId
    && (!Array.isArray(p.occupants) || p.occupants.length === 0)
    && (p.operating_organization_id === null || p.operating_organization_id === undefined)
    && Number(p.condition ?? 0) > 0);
}

function runCollapseLooting(worldState, tick = worldState.tick ?? 0) {
  const incidents = [];
  for (const community of worldState.communities || []) {
    const writ = authority.writOf(worldState, community.id);
    if (writ.regime !== 'lawless') continue;

    const properties = eligiblePropertiesIn(worldState, community.id);
    if (properties.length === 0) continue;

    const residents = (worldState.npcs || []).filter((n) => n.communityId === community.id);
    if (residents.length === 0) continue;

    for (const looter of residents) {
      const draw = seededDraw([worldState.seed ?? 'world', 'collapse-loot', looter.id, community.id, tick]);
      if (draw >= LOOT_RATE) continue;

      const targetIndex = Math.floor(
        seededDraw([worldState.seed ?? 'world', 'collapse-loot-target', looter.id, community.id, tick])
          * properties.length,
      );
      const target = properties[targetIndex];

      salvage.stripProperty(worldState, looter.id, target.id, { tick });
      incidents.push(crime.recordCrime(worldState, {
        category: 'property',
        perpetratorId: looter.id,
        victimId: null,
        communityId: community.id,
        tick,
        detail: `broke into vacant property ${target.id} during a lawless collapse and stripped it`,
      }));
    }
  }
  return incidents;
}

module.exports = {
  EMBEZZLEMENT_RATE,
  EMBEZZLEMENT_SKIM_FRACTION,
  LOOT_RATE,
  runEmbezzlement,
  eligiblePropertiesIn,
  runCollapseLooting,
};
