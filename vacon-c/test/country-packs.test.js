// The first real step of global expansion: a real, cited per-country
// income level, conflict level and government type, reported on the
// region — not yet wired into authority.js's regime system or
// environment.js's weather, on purpose. Read
// `server/countryPacks.js`'s own header before this file.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const countryPacks = require('../server/countryPacks.js');
const ancestryPacks = require('../server/ancestryPacks.js');
const migration = require('../server/migration.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');

test('every key except the explicit baseline is a real ancestryPacks.GROUPS entry', () => {
  for (const key of Object.keys(countryPacks.COUNTRIES)) {
    if (key === 'united-states') continue;
    assert.ok(ancestryPacks.GROUPS.includes(key), `${key} is not in ancestryPacks.GROUPS`);
  }
});

test('countryFor reads a real entry, and null for an unrecognised key', () => {
  assert.equal(countryPacks.countryFor('somali').country, 'Somalia');
  assert.equal(countryPacks.countryFor('martian'), null);
});

test('every entry\'s incomeLevel and conflictLevel are in the stated vocabularies', () => {
  for (const [key, entry] of Object.entries(countryPacks.COUNTRIES)) {
    assert.ok(countryPacks.INCOME_LEVELS.includes(entry.incomeLevel), `${key}: bad incomeLevel`);
    assert.ok(countryPacks.CONFLICT_LEVELS.includes(entry.conflictLevel), `${key}: bad conflictLevel`);
  }
});

test('Russia and Ukraine both read active-armed-conflict — checked directly, not a judgement call', () => {
  assert.equal(countryPacks.countryFor('russian').conflictLevel, 'active-armed-conflict');
  assert.equal(countryPacks.countryFor('ukrainian').conflictLevel, 'active-armed-conflict');
});

test('describeCountry carries the key alongside the entry, and is null for an unrecognised one', () => {
  const described = countryPacks.describeCountry('ghanaian');
  assert.equal(described.key, 'ghanaian');
  assert.equal(described.country, 'Ghana');
  assert.equal(countryPacks.describeCountry('other'), null);
});

// ---------------------------------------------------------------------
// regimeType, militaryExpenditurePctGDP, oilProducer — added after the
// first round, same real/cited/null-if-not-found discipline
// ---------------------------------------------------------------------

test('every entry\'s regimeType is either null or in REGIME_TYPES', () => {
  for (const [key, entry] of Object.entries(countryPacks.COUNTRIES)) {
    assert.ok(entry.regimeType === null || countryPacks.REGIME_TYPES.includes(entry.regimeType),
      `${key}: bad regimeType`);
  }
});

test('Russia reads authoritarian-regime and Ukraine reads hybrid-regime — real EIU 2024 scores', () => {
  assert.equal(countryPacks.countryFor('russian').regimeType, 'authoritarian-regime');
  assert.equal(countryPacks.countryFor('ukrainian').regimeType, 'hybrid-regime');
});

test('Somalia has no EIU score and reads regimeType null rather than a guess', () => {
  assert.equal(countryPacks.countryFor('somali').regimeType, null);
});

test('only Russia and Ukraine carry a sipri-official military expenditure confidence', () => {
  for (const [key, entry] of Object.entries(countryPacks.COUNTRIES)) {
    if (entry.militaryExpenditurePctGDP?.confidence === 'sipri-official') {
      assert.ok(key === 'russian' || key === 'ukrainian', `${key}: unexpected sipri-official confidence`);
    }
  }
  assert.equal(countryPacks.countryFor('ukrainian').militaryExpenditurePctGDP.value, 34);
});

test('Israel is a real entry, added after a direct question about why it was missing', () => {
  // The honest reason was structural: this table is keyed on
  // ancestryPacks.GROUPS, and there was no `israeli` group until this
  // round. Jewish-observance data answered a religion question, not a
  // nationality one, and never created this key.
  assert.ok(ancestryPacks.GROUPS.includes('israeli'));
  const israel = countryPacks.countryFor('israeli');
  assert.equal(israel.country, 'Israel');
  assert.equal(israel.incomeLevel, 'high-income');
  assert.equal(israel.conflictLevel, 'active-armed-conflict');
  assert.equal(israel.regimeType, 'flawed-democracy');
  assert.equal(israel.militaryExpenditurePctGDP.value, 8.8);
  // A real natural-gas producer, not an oil producer — the two are not
  // conflated just because both are "energy".
  assert.equal(israel.oilProducer, null);
});

test('oilProducer is null for the great majority of entries and set only for real major producers', () => {
  const producers = Object.entries(countryPacks.COUNTRIES)
    .filter(([, entry]) => entry.oilProducer !== null)
    .map(([key]) => key);
  assert.ok(producers.includes('russian'));
  assert.ok(producers.includes('norwegian'));
  assert.ok(producers.includes('nigerian'));
  assert.ok(producers.includes('mexican'));
  assert.ok(producers.includes('united-states'));
  // China produces oil domestically but is a net importer, not an exporter —
  // deliberately null, not a forced "producer" row.
  assert.equal(countryPacks.countryFor('chinese').oilProducer, null);
});

// ---------------------------------------------------------------------
// homelessness, immigration, informalEconomyPctGDP — France only, same
// "real, cited, null-if-not-found, never forced onto every entry" rule
// ---------------------------------------------------------------------

test('homelessness and informalEconomyPctGDP are null for countries with no confirmed figure', () => {
  for (const key of ['german', 'irish', 'italian', 'swedish', 'russian', 'ukrainian']) {
    const entry = countryPacks.countryFor(key);
    assert.ok(entry.homelessness === null || entry.homelessness === undefined, `${key}: homelessness should not be forced`);
    assert.ok(entry.informalEconomyPctGDP === null || entry.informalEconomyPctGDP === undefined, `${key}: informalEconomyPctGDP should not be forced`);
  }
});

test('immigration is null for a country with no confirmed figure, even after Germany/UK/Italy were given real data', () => {
  for (const key of ['irish', 'swedish', 'polish']) {
    const entry = countryPacks.countryFor(key);
    assert.ok(entry.immigration === null || entry.immigration === undefined, `${key}: immigration should not be forced`);
  }
});

test('France carries a real, cited homelessness figure from the Fondation pour le Logement des Défavorisés', () => {
  const france = countryPacks.countryFor('french');
  assert.equal(france.homelessness.estimatedPeople.value, 350000);
  assert.equal(france.homelessness.estimatedPeople.year, 2025);
  assert.ok(france.homelessness.priorYears.some((p) => p.value === 143000 && p.year === 2012),
    'the 2012 baseline is kept so "more than doubled since 2012" is checkable, not asserted');
  assert.equal(france.homelessness.streetDeaths2024.low, 735);
  assert.equal(france.homelessness.streetDeaths2024.high, 912);
});

test('France carries real asylum/immigration figures, including the Mayotte situation as its own sub-field', () => {
  const france = countryPacks.countryFor('french');
  assert.equal(france.immigration.asylumApplicationsOFPRA.value, 145211);
  assert.equal(france.immigration.asylumApplicationsOFPRA.priorYear.value, 153715);
  assert.equal(france.immigration.asylumRegistrationsInteriorMinistry.value, 160303);
  assert.equal(france.immigration.estimatedUndocumentedPopulation.confidence, 'unconfirmed-secondary-estimate',
    'an unconfirmed figure must say so, not read as solid as OFPRA\'s own count');
  assert.equal(france.immigration.mayotte.maritimeInterceptions[2024], 6764);
  assert.equal(france.immigration.mayotte.nationalityGrantsMayotte[2023], 860);
  assert.ok(france.immigration.mayotte.citizenshipLawChange.includes('1 year'));
});

test('France\'s informal-economy figure is reported as a range with named methodologies, not one invented number', () => {
  const france = countryPacks.countryFor('french');
  assert.equal(france.informalEconomyPctGDP.range.low, 6.3);
  assert.equal(france.informalEconomyPctGDP.range.high, 15);
  assert.ok(france.informalEconomyPctGDP.estimates.length > 1,
    'more than one method is named rather than collapsed into a single figure');
});

// ---------------------------------------------------------------------
// crime, tourism, illicitCigaretteMarket, fraudAndScams,
// schoolProtests2026, politicalFigures — France only, fifth round
// ---------------------------------------------------------------------

test('crime, tourism, illicitCigaretteMarket, fraudAndScams, schoolProtests2026 and politicalFigures are null where not confirmed', () => {
  for (const key of ['german', 'irish', 'italian', 'swedish', 'russian', 'ukrainian']) {
    const entry = countryPacks.countryFor(key);
    for (const field of ['crime', 'tourism', 'illicitCigaretteMarket', 'fraudAndScams', 'schoolProtests2026', 'politicalFigures']) {
      assert.ok(entry[field] === null || entry[field] === undefined, `${key}: ${field} should not be forced`);
    }
  }
});

test('France carries real SSMSI 2025 crime figures', () => {
  const france = countryPacks.countryFor('french');
  assert.equal(france.crime.homicides.value, 982);
  assert.equal(france.crime.attemptedHomicides.value, 4501);
  assert.equal(france.crime.drugTraffickingPersonsImplicated.value, 56600);
  assert.equal(france.crime.cryptoRelatedViolentCrime2026.cases, 90);
});

test('France carries real 2025 tourism figures — the world\'s most-visited country', () => {
  const france = countryPacks.countryFor('french');
  assert.equal(france.tourism.internationalVisitors.value, 102000000);
  assert.equal(france.tourism.worldRanking, 1);
  assert.equal(france.tourism.tourismReceiptsEur.value, 77500000000);
});

test('France\'s illicit-cigarette-market figure keeps the industry-vs-NGO dispute visible, not silently resolved', () => {
  const france = countryPacks.countryFor('french');
  assert.equal(france.illicitCigaretteMarket.kpmgIllicitMarketSharePct.value, 41.4);
  assert.equal(france.illicitCigaretteMarket.kpmgIllicitMarketSharePct.confidence, 'contested-industry-funded');
  assert.ok(france.illicitCigaretteMarket.kpmgIllicitMarketSharePct.note.includes('Philip Morris'));
});

test('France\'s fraud/scam figures keep official, police-recorded and survey measurements separate', () => {
  const france = countryPacks.countryFor('french');
  assert.equal(france.fraudAndScams.officialPaymentFraudEur.value, 1241000000);
  assert.equal(france.fraudAndScams.policeRecordedVictims.value, 445900);
  assert.equal(france.fraudAndScams.surveyEstimateTotalLossesEur.confidence, 'self-reported-survey-not-comparable-to-official-figures');
});

test('France carries the real, ongoing 2026 lycee protest wave', () => {
  const france = countryPacks.countryFor('french');
  assert.equal(france.schoolProtests2026.startDate, '2026-09-18');
  assert.equal(france.schoolProtests2026.originLocation, 'Creteil (Paris suburb)');
  assert.ok(france.schoolProtests2026.spreadToCountries.includes('Belgium'));
  assert.equal(france.schoolProtests2026.arrests.value, 1949);
});

test('France\'s named political figures are present and explicitly flagged as the module\'s most volatile data', () => {
  const france = countryPacks.countryFor('french');
  assert.equal(france.politicalFigures.president.name, 'Emmanuel Macron');
  assert.equal(france.politicalFigures.primeMinister.name, 'Sebastien Lecornu');
  assert.ok(france.politicalFigures.confidence.includes('stale'),
    'this field must say up front that it will go stale, unlike regimeType');
});

test('every immigration entry that has originCountries reports real INSEE stock figures summing sanely', () => {
  const france = countryPacks.countryFor('french');
  const top = france.immigration.originCountries.topSevenByStock;
  assert.ok(top.some((c) => c.country === 'Algeria' && c.sharePct === 12.4));
  const sum = Math.round(top.reduce((s, c) => s + c.sharePct, 0) * 10) / 10;
  assert.equal(sum, france.immigration.originCountries.topSevenShareOfAllImmigrantsPct,
    'the named shares must actually sum to the stated top-seven total');
});

// ---------------------------------------------------------------------
// generateRegion wiring
// ---------------------------------------------------------------------

test('generateRegion reports a real country\'s fields when given a recognised countryKey', () => {
  const w = { regions: [] };
  const region = migration.generateRegion(w, { name: 'Test Region', countryKey: 'bosnian' });
  assert.equal(region.incomeLevel, 'upper-middle-income');
  assert.equal(region.conflictLevel, 'no-active-conflict');
  assert.equal(region.governmentType, 'federal parliamentary republic');
  assert.equal(region.regimeType, 'hybrid-regime');
});

test('generateRegion reports the new military/oil fields, real and confidence-flagged', () => {
  const w = { regions: [] };
  const region = migration.generateRegion(w, { name: 'Test Region', countryKey: 'russian' });
  assert.equal(region.regimeType, 'authoritarian-regime');
  assert.deepEqual(region.militaryExpenditurePctGDP, { value: 7.1, year: 2024, confidence: 'sipri-official' });
  assert.equal(region.oilProducer.status, 'major-exporter');
});

test('generateRegion leaves country fields null with no countryKey or an unrecognised one', () => {
  const w = { regions: [] };
  const noKey = migration.generateRegion(w, { name: 'Test Region A' });
  assert.equal(noKey.incomeLevel, null);
  const badKey = migration.generateRegion(w, { name: 'Test Region B', countryKey: 'martian' });
  assert.equal(badKey.incomeLevel, null);
  assert.equal(badKey.countryKey, 'martian', 'the key itself is still recorded even if unrecognised');
});

test('generateRegion reports France\'s real homelessness/immigration/informal-economy figures', () => {
  const w = { regions: [] };
  const region = migration.generateRegion(w, { name: 'Test Region', countryKey: 'french' });
  assert.equal(region.homelessness.estimatedPeople.value, 350000);
  assert.equal(region.immigration.mayotte.maritimeInterceptions[2024], 6764);
  assert.equal(region.informalEconomyPctGDP.range.low, 6.3);
});

test('generateRegion leaves the three new fields null for a country with no confirmed figure', () => {
  const w = { regions: [] };
  // irish, not german: Germany was given real immigration data in a
  // later round, which is exactly the case the next test covers.
  const region = migration.generateRegion(w, { name: 'Test Region', countryKey: 'irish' });
  assert.equal(region.homelessness, null);
  assert.equal(region.immigration, null);
  assert.equal(region.informalEconomyPctGDP, null);
});

test('generateRegion reports France\'s crime/tourism/cigarette-market/fraud/school-protest/political figures', () => {
  const w = { regions: [] };
  const region = migration.generateRegion(w, { name: 'Test Region', countryKey: 'french' });
  assert.equal(region.crime.homicides.value, 982);
  assert.equal(region.tourism.worldRanking, 1);
  assert.equal(region.illicitCigaretteMarket.kpmgIllicitMarketSharePct.value, 41.4);
  assert.equal(region.fraudAndScams.officialPaymentFraudEur.value, 1241000000);
  assert.equal(region.schoolProtests2026.startDate, '2026-09-18');
  assert.equal(region.politicalFigures.president.name, 'Emmanuel Macron');
});

test('generateRegion leaves the six fifth-round fields null for a country with no confirmed figure', () => {
  const w = { regions: [] };
  const region = migration.generateRegion(w, { name: 'Test Region', countryKey: 'german' });
  for (const field of ['crime', 'tourism', 'illicitCigaretteMarket', 'fraudAndScams', 'schoolProtests2026', 'politicalFigures']) {
    assert.equal(region[field], null, `${field} should stay null`);
  }
});

test('generateRegion reports Germany\'s real immigration figures and Russia\'s current war status', () => {
  const w = { regions: [] };
  const germanyRegion = migration.generateRegion(w, { name: 'Test Region A', countryKey: 'german' });
  assert.equal(germanyRegion.immigration.asylumApplicationsTotal2025.value, 168000);
  assert.equal(germanyRegion.warStatus, null);

  const russiaRegion = migration.generateRegion(w, { name: 'Test Region B', countryKey: 'russian' });
  assert.equal(russiaRegion.warStatus.asOf, '2026-10-24');
  assert.equal(russiaRegion.immigration, null);
});

// ---------------------------------------------------------------------
// immigration (Germany/UK/Italy), EU_MIGRATION_OVERVIEW_2025, and
// warStatus (russian/ukrainian/israeli) — sixth round, proving the
// pattern generalises beyond France
// ---------------------------------------------------------------------

test('Germany, the UK and Italy carry real, country-specific immigration data under the same shared key France uses', () => {
  const germany = countryPacks.countryFor('german');
  assert.equal(germany.immigration.asylumApplicationsTotal2025.value, 168000);
  assert.equal(germany.immigration.ukrainianTemporaryProtection.value, 1294555);

  const uk = countryPacks.countryFor('english');
  assert.equal(uk.immigration.channelCrossings.year2025.value, 41472);
  assert.ok(uk.immigration.netMigration.note.includes('disagree'),
    'a real source disagreement must stay visible, not be silently resolved');

  const italy = countryPacks.countryFor('italian');
  assert.equal(italy.immigration.libyaShareOfDeparturesPct, 83);
});

test('the UK\'s immigration object is the same shared reference across english/scottish/welsh, not three copies that could drift', () => {
  const uk = countryPacks.countryFor('english').immigration;
  assert.strictEqual(countryPacks.countryFor('scottish').immigration, uk);
  assert.strictEqual(countryPacks.countryFor('welsh').immigration, uk);
});

test('immigration stays null for a country with no confirmed figure, even after Germany/UK/Italy were added', () => {
  for (const key of ['polish', 'swedish', 'russian']) {
    assert.ok(countryPacks.countryFor(key).immigration === null || countryPacks.countryFor(key).immigration === undefined,
      `${key}: immigration should not be forced`);
  }
});

test('EU_MIGRATION_OVERVIEW_2025 is a real, bloc-wide Eurostat figure, not per-country', () => {
  assert.equal(countryPacks.EU_MIGRATION_OVERVIEW_2025.firstTimeAsylumApplicants2025.value, 365000);
  assert.ok(countryPacks.EU_MIGRATION_OVERVIEW_2025.totalApplicationsByCountry2025.some((c) => c.country === 'Germany' && c.value === 168000));
  assert.ok(countryPacks.EU_MIGRATION_OVERVIEW_2025.note.includes('Spain'),
    'the real gap (no dedicated Spain entry) must be named, not silently omitted');
});

test('Russia and Ukraine share the same current war-status object, flagged as fast-moving and unverified on casualties', () => {
  const russia = countryPacks.countryFor('russian');
  const ukraine = countryPacks.countryFor('ukrainian');
  assert.strictEqual(russia.warStatus, ukraine.warStatus, 'one war, one shared status object, not two that could drift');
  assert.equal(russia.warStatus.asOf, '2026-10-24');
  assert.ok(russia.warStatus.casualties.note.includes('no verified'));
  assert.ok(russia.warStatus.confidence.includes('staleness'));
});

test('Israel carries the real, distinct Israel-Iran war, and explicitly notes Iran has no entry here', () => {
  const israel = countryPacks.countryFor('israeli');
  assert.equal(israel.warStatus.name, 'israel-iran-war');
  assert.equal(israel.warStatus.startDate, '2026-02-28');
  assert.ok(israel.warStatus.note.includes('no "iranian"'),
    'the real structural gap (no Iran entry without a new ancestry group) must be stated, not silently skipped');
  // conflictLevel was already active-armed-conflict before this round
  // (for the Gaza war) and must stay that way — this is a second real
  // reason for the same existing value, not a change to it.
  assert.equal(israel.conflictLevel, 'active-armed-conflict');
});

test('warStatus stays null for a country not currently in one', () => {
  assert.ok(countryPacks.countryFor('french').warStatus === null || countryPacks.countryFor('french').warStatus === undefined);
  assert.ok(countryPacks.countryFor('german').warStatus === null || countryPacks.countryFor('german').warStatus === undefined);
});

// ---------------------------------------------------------------------
// Seventh round: Haiti's gangCrisis2026 (a real COUNTRIES entry), and
// six standalone constants with no matching ancestry group
// ---------------------------------------------------------------------

test('Haiti carries the real, current gang crisis, naming Jimmy "Barbecue" Cherizier directly', () => {
  const haiti = countryPacks.countryFor('haitian');
  assert.equal(haiti.gangCrisis2026.gangControlOfPortAuPrincePct.value, 90);
  assert.equal(haiti.gangCrisis2026.displacedPersons.value, 1500000);
  assert.equal(haiti.gangCrisis2026.foodInsecurity.sharePctOfPopulation, 52);
  assert.equal(haiti.gangCrisis2026.gangLeaderProfile.name, 'Jimmy Cherizier');
  assert.equal(haiti.gangCrisis2026.gangLeaderProfile.alias, 'Barbecue');
  assert.equal(haiti.gangCrisis2026.gangLeaderProfile.recentEvent.date, '2026-01-14');
  assert.ok(haiti.gangCrisis2026.casualties.length === 2, 'two real BINUH reporting periods, not collapsed into one total');
});

test('gangCrisis2026 is null for a country not in one', () => {
  assert.ok(countryPacks.countryFor('french').gangCrisis2026 === null || countryPacks.countryFor('french').gangCrisis2026 === undefined);
});

test('generateRegion reports Haiti\'s real gang crisis', () => {
  const w = { regions: [] };
  const region = migration.generateRegion(w, { name: 'Test Region', countryKey: 'haitian' });
  assert.equal(region.gangCrisis2026.gangLeaderProfile.alias, 'Barbecue');
});

test('Venezuela\'s real political crisis is reported — Maduro\'s capture, not a change internal to the government', () => {
  const v = countryPacks.VENEZUELA_SITUATION_2026;
  assert.ok(v.politicalCrisis.summary.includes('captured by US forces'));
  assert.ok(v.politicalCrisis.governance.includes('Delcy Rodriguez'));
  assert.equal(v.politicalCrisis.politicalPrisonerReleases.confirmedReleased, 621);
});

test('Cuba\'s crisis constant is honest about what it does and does not cover', () => {
  const c = countryPacks.CUBA_CRISIS_2026;
  assert.equal(c.electricityGrid.deficitMW.value, 1700);
  assert.ok(c.note.includes('no reliable 2025/2026 figures on crime, immigration, poverty or gas'),
    'a real gap must be declared, not silently left looking covered');
});

test('Colombia\'s real crime figures keep disagreeing sources separate, not reconciled into one number', () => {
  const col = countryPacks.COLOMBIA_CRIME_2026;
  assert.equal(col.homicideRate2025.perHundredThousand.value, 25.8);
  assert.equal(col.homicideRate2025.openDataCount.value, 14038);
  assert.equal(col.homicideRate2025.ombudsmanRate.value, 23.08);
  assert.equal(col.armedGroups.eln.members, 6300);
});

test('the Dominican Republic\'s real Haitian-migration enforcement figures are reported without a fabricated crime link', () => {
  const dr = countryPacks.DOMINICAN_REPUBLIC_2026;
  assert.equal(dr.haitianMigrationEnforcement.deportationsQ1_2026.value, 68000);
  assert.equal(dr.haitianMigrationEnforcement.borderDetentions.value, 12556);
  assert.ok(dr.crimeNote.includes('no source found this round ties Haitian migration to a higher crime rate'));
});

test('Canada\'s real 2026 migration figures are reported standalone, with no countryKey to attach them to', () => {
  const ca = countryPacks.CANADA_MIGRATION_OVERVIEW_2026;
  assert.equal(ca.permanentResidents.target2026, 380000);
  assert.equal(ca.temporaryResidents.changeToJuly2026.value, -154614);
});

test('Africa\'s migration overview explicitly declares it covers a handful of crises, not the whole continent', () => {
  const africa = countryPacks.AFRICA_MIGRATION_OVERVIEW_2026;
  assert.equal(africa.sudan.forciblyDisplacedTotal.value, 14400000);
  assert.equal(africa.sahelFive.countries.length, 5);
  assert.ok(africa.scopeNote.includes('NOT a 54-country survey'),
    'the scope limit must be stated up front, not discovered by noticing what is missing');
});

test('Israel\'s war status carries the real global oil-market spillover, with an honest gap on UAE/Dubai/India', () => {
  const israel = countryPacks.countryFor('israeli');
  const spillover = israel.warStatus.globalEconomicSpillover;
  assert.equal(spillover.hormuzClosure.scaleOfOilSupplyDisruptedPct, 20);
  assert.ok(spillover.gapNote.includes('UAE, Dubai, or India'),
    'the real gap (no country-specific figure found) must be named, not filled with an invented number');
});

// ---------------------------------------------------------------------
// Eighth round: notableFigures, cartelsAndGangs2026, Yemen, and the
// Caribbean deep dive
// ---------------------------------------------------------------------

test('notableFigures names real current heads of state, tied to a claim already in that entry\'s warStatus', () => {
  assert.equal(countryPacks.countryFor('russian').notableFigures[0].name, 'Vladimir Putin');
  assert.equal(countryPacks.countryFor('ukrainian').notableFigures[0].name, 'Volodymyr Zelenskyy');
  assert.equal(countryPacks.countryFor('israeli').notableFigures[0].name, 'Benjamin Netanyahu');
  // Both entries share the same RUSSIA_UKRAINE_WAR_STATUS_OCT2026
  // object, but each must have its OWN notableFigures -- a Russian and
  // a Ukrainian head of state are not the same person.
  assert.notStrictEqual(countryPacks.countryFor('russian').notableFigures, countryPacks.countryFor('ukrainian').notableFigures);
});

test('Mexico\'s real cartel leadership change is reported: El Mencho killed, a real named successor', () => {
  const mexico = countryPacks.countryFor('mexican');
  assert.equal(mexico.cartelsAndGangs2026.cjng.formerLeader.alias, 'El Mencho');
  assert.ok(mexico.cartelsAndGangs2026.cjng.formerLeader.status.includes('killed'));
  assert.equal(mexico.cartelsAndGangs2026.cjng.currentLeader.name, 'Valencia Gonzalez');
  assert.equal(mexico.cartelsAndGangs2026.retaliationViolence.roadblocks, 252);
});

test('El Salvador\'s crackdown keeps the real "dismantled vs rebuilding" disagreement visible', () => {
  const sv = countryPacks.countryFor('salvadoran');
  assert.equal(sv.cartelsAndGangs2026.politicalContext.leader.name, 'Nayib Bukele');
  assert.ok(sv.cartelsAndGangs2026.realStateOfGangsDisputed.includes('genuinely contested'));
  assert.equal(sv.cartelsAndGangs2026.usDesignation.year, 2025);
});

test('Guatemala and Honduras declare the real gap instead of inventing cartel figures', () => {
  assert.ok(countryPacks.countryFor('guatemalan').cartelsAndGangs2026.note.includes('no current'));
  assert.ok(countryPacks.countryFor('honduran').cartelsAndGangs2026.note.includes('no current'));
});

test('Haiti\'s gang-leader profile (added last round) is confirmed to be the real "Barbecue" reference', () => {
  const haiti = countryPacks.countryFor('haitian');
  assert.equal(haiti.gangCrisis2026.gangLeaderProfile.name, 'Jimmy Cherizier');
  assert.equal(haiti.gangCrisis2026.gangLeaderProfile.alias, 'Barbecue');
});

test('YEMEN_CONFLICT_2026 reports the real Houthi-Saudi escalation, standalone', () => {
  const yemen = countryPacks.YEMEN_CONFLICT_2026;
  assert.equal(yemen.escalation.saudiTankerStrike.date, '2026-08-24');
  assert.equal(yemen.escalation.portSeizure.port, 'Mocha');
  assert.equal(yemen.policyResponse.date, '2026-10-23');
});

test('the Caribbean deep dive is explicitly bounded, not every island', () => {
  const pr = countryPacks.PUERTO_RICO_2026;
  assert.equal(pr.population.value, 3184835);
  assert.ok(pr.note.includes('no 2025/2026 crime statistics found'));

  const cv = countryPacks.CAPE_VERDE_2026;
  assert.equal(cv.economy.gdpUsdBillion2025, 2.79);

  const vi = countryPacks.VIRGIN_ISLANDS_2026;
  assert.equal(vi.usVirginIslands.tourism.q1_2026Arrivals.value, 303388);
  assert.equal(vi.britishVirginIslands.population.value, 39993);

  const cruise = countryPacks.CARIBBEAN_CRUISE_TOURISM_2026;
  assert.equal(cruise.regionTotal2025.passengers, 16270000);
  assert.ok(cruise.portLevelFigures.some((p) => p.port.includes('Nassau')));
});

test('generateRegion reports the new eighth-round fields', () => {
  const w = { regions: [] };
  const region = migration.generateRegion(w, { name: 'Test Region', countryKey: 'mexican' });
  assert.equal(region.cartelsAndGangs2026.cjng.currentLeader.name, 'Valencia Gonzalez');
  assert.equal(region.notableFigures, null);

  const putinRegion = migration.generateRegion(w, { name: 'Test Region B', countryKey: 'russian' });
  assert.equal(putinRegion.notableFigures[0].name, 'Vladimir Putin');
  assert.equal(putinRegion.cartelsAndGangs2026, null);
});

// ---------------------------------------------------------------------
// Ninth round: regionalContextFor, the honest fallback chain
// ---------------------------------------------------------------------

test('regionalContextFor prefers a dedicated COUNTRIES entry over any fallback', () => {
  const ctx = countryPacks.regionalContextFor('nigerian');
  assert.ok(ctx.dedicatedEntry, 'Nigeria has a real COUNTRIES entry');
  assert.equal(ctx.region, 'africa');
  assert.equal(ctx.coverageNote, 'a dedicated, country-specific COUNTRIES entry exists');
});

test('regionalContextFor falls back to a standalone reference when no COUNTRIES entry exists', () => {
  const ctx = countryPacks.regionalContextFor('cuba');
  assert.equal(ctx.dedicatedEntry, null);
  assert.strictEqual(ctx.standaloneEntry, countryPacks.CUBA_CRISIS_2026);
  assert.ok(ctx.coverageNote.includes('standalone reference exists'));
});

test('regionalContextFor falls back to the region\'s own real overview when neither a dedicated nor standalone entry exists', () => {
  // somali has no standalone reference and (check) no dedicated field
  // beyond income/conflict -- but IS in COUNTRIES, so use a key that
  // is genuinely in neither: a Caribbean key with no entry of its own.
  const ctx = countryPacks.regionalContextFor('west-indian');
  assert.equal(ctx.dedicatedEntry, null);
  assert.equal(ctx.standaloneEntry, null);
  assert.equal(ctx.region, 'caribbean');
  assert.strictEqual(ctx.regionalOverview, countryPacks.CARIBBEAN_CRUISE_TOURISM_2026);
  assert.ok(ctx.coverageNote.includes('falling back to its region'));
});

test('Latin America is a real, classified region, and now has a real overview (filled in the eleventh round)', () => {
  assert.equal(Object.values(countryPacks.REGION_BY_KEY).includes('latin-america'), true);
  assert.strictEqual(countryPacks.REGION_OVERVIEWS['latin-america'], countryPacks.LATIN_AMERICA_MIGRATION_2026);
});

test('regionalContextFor is honest about a key it has never classified at all', () => {
  const ctx = countryPacks.regionalContextFor('brazil');
  assert.equal(ctx.dedicatedEntry, null);
  assert.equal(ctx.standaloneEntry, null);
  assert.equal(ctx.region, null);
  assert.equal(ctx.regionalOverview, null);
  assert.ok(ctx.coverageNote.includes('real, undone gap'),
    'an unclassified key must say so plainly, not return a silent null with no explanation');
});

test('REGION_OVERVIEWS only names regions that have a real, built overview', () => {
  assert.strictEqual(countryPacks.REGION_OVERVIEWS.europe, countryPacks.EU_MIGRATION_OVERVIEW_2025);
  assert.strictEqual(countryPacks.REGION_OVERVIEWS.africa, countryPacks.AFRICA_MIGRATION_OVERVIEW_2026);
  assert.strictEqual(countryPacks.REGION_OVERVIEWS.caribbean, countryPacks.CARIBBEAN_CRUISE_TOURISM_2026);
  // As of the eleventh round, every region this module classifies at
  // all finally has a real overview -- this test's own history (it
  // used to assert Latin America was undefined) is the record of that.
  assert.strictEqual(countryPacks.REGION_OVERVIEWS['latin-america'], countryPacks.LATIN_AMERICA_MIGRATION_2026);
  assert.strictEqual(countryPacks.REGION_OVERVIEWS.asia, countryPacks.ASIA_MIGRATION_OVERVIEW_2026);
  assert.strictEqual(countryPacks.REGION_OVERVIEWS['middle-east'], countryPacks.MIDDLE_EAST_MIGRATION_2026);
});

test('generateRegion reports regionalContext, additively, alongside the existing flat fields', () => {
  const w = { regions: [] };
  const region = migration.generateRegion(w, { name: 'Test Region', countryKey: 'cuba' });
  assert.strictEqual(region.regionalContext.standaloneEntry, countryPacks.CUBA_CRISIS_2026);
  // cuba is not an ancestryPacks.GROUPS key, so the existing flat
  // fields correctly stay null -- regionalContext is additive, not a
  // replacement for them.
  assert.equal(region.homelessness, null);
});

test('generateRegion leaves regionalContext null when no countryKey is given at all', () => {
  const w = { regions: [] };
  const region = migration.generateRegion(w, { name: 'Test Region' });
  assert.equal(region.regionalContext, null);
});

// ---------------------------------------------------------------------
// Tenth round: real political parties and war factions, named
// ---------------------------------------------------------------------

test('France, Russia, Ukraine and Israel each carry real, named ruling parties and real opposition', () => {
  assert.equal(countryPacks.countryFor('french').politicalParties.ruling.name, 'Renaissance');
  assert.equal(countryPacks.countryFor('french').politicalParties.opposition[0].leader, 'Marine Le Pen');

  assert.equal(countryPacks.countryFor('russian').politicalParties.ruling.name, 'United Russia');
  assert.equal(countryPacks.countryFor('russian').politicalParties.nominalOpposition.length, 2);

  assert.equal(countryPacks.countryFor('ukrainian').politicalParties.ruling.name, 'Servant of the People (Sluha Narodu)');
  assert.ok(countryPacks.countryFor('ukrainian').politicalParties.note.includes('no national election'));

  assert.equal(countryPacks.countryFor('israeli').politicalParties.ruling.name, 'Likud');
});

test('Mexico and El Salvador carry real, current ruling parties', () => {
  assert.equal(countryPacks.countryFor('mexican').politicalParties.ruling.name, 'Morena');
  assert.ok(countryPacks.countryFor('mexican').politicalParties.ruling.note.includes('Sheinbaum'));
  assert.equal(countryPacks.countryFor('salvadoran').politicalParties.ruling.name, 'Nuevas Ideas');
});

test('Haiti honestly reports no functioning multi-party system, rather than naming a fictional one', () => {
  const haiti = countryPacks.countryFor('haitian');
  assert.ok(haiti.politicalParties.note.includes('Transitional Presidential Council'));
  assert.equal(haiti.politicalParties.ruling, undefined, 'there is no ruling party to name here');
});

test('Venezuela\'s real opposition leader is named, including her Nobel Peace Prize and the current standoff over her return', () => {
  const v = countryPacks.VENEZUELA_SITUATION_2026;
  assert.equal(v.politicalParties.ruling.name, 'PSUV (United Socialist Party of Venezuela)');
  assert.equal(v.politicalParties.opposition.leader.name, 'Maria Corina Machado');
  assert.equal(v.politicalParties.opposition.leader.party, 'Vente Venezuela');
  assert.ok(v.politicalParties.opposition.note.includes('Nobel Peace Prize'));
});

test('Colombia\'s real incoming president is now named, corroborated across a second source', () => {
  const col = countryPacks.COLOMBIA_CRIME_2026;
  assert.equal(col.newPresident.name, 'Abelardo de la Espriella');
  assert.equal(col.politicalParties.incomingPresident.name, 'Abelardo de la Espriella');
  assert.equal(col.politicalParties.outgoingRulingMovement.name, 'Pacto Historico');
});

test('Yemen\'s Houthi movement is named by its real official name, against the internationally recognized government', () => {
  const yemen = countryPacks.YEMEN_CONFLICT_2026;
  assert.equal(yemen.politicalParties.houthiMovement.officialName, 'Ansar Allah ("Supporters/Defenders of God")');
  assert.ok(yemen.politicalParties.opposingSide.name.includes('Presidential Leadership Council'));
});

test('generateRegion reports politicalParties, additively', () => {
  const w = { regions: [] };
  const region = migration.generateRegion(w, { name: 'Test Region', countryKey: 'mexican' });
  assert.equal(region.politicalParties.ruling.name, 'Morena');
});

test('politicalParties is null for a country with no confirmed party data', () => {
  assert.ok(countryPacks.countryFor('german').politicalParties === null || countryPacks.countryFor('german').politicalParties === undefined);
});

// ---------------------------------------------------------------------
// Eleventh round: Poland/Nigeria/Ethiopia/Vietnam/China/Philippines/
// India deepened, plus the three missing regional overviews
// ---------------------------------------------------------------------

test('Poland, China and Vietnam each carry real, current named heads of government/state', () => {
  assert.equal(countryPacks.countryFor('polish').politicalParties.ruling.name, 'Civic Coalition (KO)');
  assert.equal(countryPacks.countryFor('polish').politicalParties.president.name, 'Karol Nawrocki');
  assert.equal(countryPacks.countryFor('chinese').notableFigures[0].name, 'Xi Jinping');
  assert.equal(countryPacks.countryFor('vietnamese').notableFigures[0].name, 'To Lam');
});

test('Nigeria carries real current security incidents without an invented aggregate total', () => {
  const nigeria = countryPacks.countryFor('nigerian');
  assert.equal(nigeria.securitySituation2026.globalTerrorismIndexRank.value, 6);
  assert.ok(nigeria.securitySituation2026.notableAttacks2026.length >= 3);
  assert.ok(nigeria.securitySituation2026.note.includes('not an aggregated count'));
});

test('Ethiopia\'s real 2026 Tigray re-escalation is reported without silently reclassifying conflictLevel', () => {
  const ethiopia = countryPacks.countryFor('ethiopian');
  assert.equal(ethiopia.conflictLevel, 'localized-conflict', 'unchanged -- the comment above explains why');
  assert.equal(ethiopia.tigrayConflict2026.clashes[1].location, 'western Tigray, near the Sudan border');
  assert.equal(ethiopia.politicalParties.ruling.name, 'Prosperity Party');
});

test('the Philippines and India carry real, current ruling coalitions', () => {
  const ph = countryPacks.countryFor('filipino');
  assert.equal(ph.politicalParties.ruling.name, 'PFP (Partido Federal ng Pilipinas)');
  assert.equal(ph.notableFigures[1].name, 'Sara Duterte');

  const india = countryPacks.countryFor('asian-indian');
  assert.equal(india.politicalParties.ruling.name, 'BJP (Bharatiya Janata Party)');
  assert.equal(india.politicalParties.coalition.seats, 293);
});

test('generateRegion reports securitySituation2026 and tigrayConflict2026, additively', () => {
  const w = { regions: [] };
  const nigeriaRegion = migration.generateRegion(w, { name: 'Test Region A', countryKey: 'nigerian' });
  assert.equal(nigeriaRegion.securitySituation2026.globalTerrorismIndexRank.value, 6);
  assert.equal(nigeriaRegion.tigrayConflict2026, null);

  const ethiopiaRegion = migration.generateRegion(w, { name: 'Test Region B', countryKey: 'ethiopian' });
  assert.equal(ethiopiaRegion.tigrayConflict2026.clashes.length, 3);
  assert.equal(ethiopiaRegion.securitySituation2026, null);
});

test('the three previously-missing regional overviews now exist, bounded and sourced', () => {
  assert.equal(countryPacks.ASIA_MIGRATION_OVERVIEW_2026.asiaArabLabourCorridor.migrantsFromCentralSouthernAsia.value, 18400000);
  assert.ok(countryPacks.ASIA_MIGRATION_OVERVIEW_2026.scopeNote.includes('not a full Asia-wide'));

  assert.equal(countryPacks.MIDDLE_EAST_MIGRATION_2026.syria.stillDisplaced.internallyDisplaced, 7100000);
  assert.ok(countryPacks.MIDDLE_EAST_MIGRATION_2026.scopeNote.includes('not a country-by-country'));

  assert.equal(countryPacks.LATIN_AMERICA_MIGRATION_2026.venezuelanDiaspora.totalAbroad.value, 7900000);
  assert.ok(countryPacks.LATIN_AMERICA_MIGRATION_2026.scopeNote.includes('dominant real migration story'));
});

test('REGION_OVERVIEWS now covers all six classified regions, no gaps left unaddressed', () => {
  for (const region of ['europe', 'africa', 'caribbean', 'asia', 'middle-east']) {
    assert.ok(countryPacks.REGION_OVERVIEWS[region], `${region} should have a real overview by now`);
  }
  // latin-america was deliberately left without one in the ninth
  // round's own test -- confirm it is now filled.
  assert.strictEqual(countryPacks.REGION_OVERVIEWS['latin-america'], countryPacks.LATIN_AMERICA_MIGRATION_2026);
});

test('regionalContextFor now falls back to a real overview for a Chinese or Vietnamese key\'s region too', () => {
  assert.equal(countryPacks.regionalContextFor('chinese').region, 'asia');
  assert.strictEqual(countryPacks.regionalContextFor('chinese').regionalOverview, countryPacks.ASIA_MIGRATION_OVERVIEW_2026);
});

// ---------------------------------------------------------------------
// A world built with it
// ---------------------------------------------------------------------

test('a world built with a real countryKey reports it on the generated region', () => {
  const w = engine.WorldState;
  worldgen.generateWorld({ seed: 'country-pack-world-test', countryKey: 'somali', communitiesPerCity: 1, populationPerCommunity: 5 });
  const region = w.regions[w.regions.length - 1];
  assert.equal(region.countryKey, 'somali');
  assert.equal(region.incomeLevel, 'low-income');
  assert.equal(region.conflictLevel, 'active-armed-conflict');
});

test('a world with no countryKey reports null country fields, same as before this existed', () => {
  const w = engine.WorldState;
  worldgen.generateWorld({ seed: 'no-country-pack-world-test', communitiesPerCity: 1, populationPerCommunity: 5 });
  const region = w.regions[w.regions.length - 1];
  assert.equal(region.countryKey, null);
  assert.equal(region.incomeLevel, null);
});

// ---------------------------------------------------------------------
// Twelfth round: real global crime (homicide), hunger, climate and
// road-safety figures -- real but sparse, same `oilProducer` posture
// this table already established, plus the real tooling-limitation
// gaps this round names rather than fakes
// ---------------------------------------------------------------------

test('every entry carries a globalIndicators2026 object, never a missing key', () => {
  for (const [key, entry] of Object.entries(countryPacks.COUNTRIES)) {
    assert.ok('globalIndicators2026' in entry, `${key}: globalIndicators2026 must be present, even if every field inside it is null`);
    assert.ok('homicideRatePer100k' in entry.globalIndicators2026, `${key}: homicideRatePer100k must be present`);
  }
});

test('homicideRatePer100k is real and cited for most entries, and explicitly null where genuinely not found or rejected', () => {
  const withFigure = Object.entries(countryPacks.COUNTRIES)
    .filter(([, entry]) => entry.globalIndicators2026.homicideRatePer100k !== null);
  // 28 of 37 entries carry a real figure -- most of the table, not all of it.
  assert.equal(withFigure.length, 28);
  for (const [key, entry] of withFigure) {
    const h = entry.globalIndicators2026.homicideRatePer100k;
    assert.ok(typeof h.value === 'number' && h.value >= 0, `${key}: homicide rate must be a real non-negative number`);
    assert.ok(typeof h.year === 'number', `${key}: homicide rate must carry a real year`);
    assert.ok(typeof h.source === 'string' && h.source.length > 0, `${key}: homicide rate must name a source`);
  }
});

test('Somalia\'s homicide rate is null because the only figure found combines homicide with other causes of death, not because nothing was found', () => {
  const somalia = countryPacks.countryFor('somali');
  assert.equal(somalia.globalIndicators2026.homicideRatePer100k, null);
  // The real figure that WAS found (53.2% undernourishment) is kept --
  // this is not a blanket "nothing found for Somalia" null.
  assert.equal(somalia.globalIndicators2026.undernourishmentPct.value, 53.2);
});

test('Nigeria, Guatemala and Honduras have real but conflicting homicide figures, and stay null rather than picking a side', () => {
  for (const key of ['nigerian', 'guatemalan', 'honduran']) {
    assert.equal(countryPacks.countryFor(key).globalIndicators2026.homicideRatePer100k, null, `${key}: should stay null, not pick between disagreeing sources`);
  }
});

test('stale figures are kept with their real year rather than hidden or treated as current', () => {
  const russia = countryPacks.countryFor('russian').globalIndicators2026.homicideRatePer100k;
  assert.equal(russia.year, 2018);
  assert.ok(russia.confidence.includes('stale'));
  const ethiopia = countryPacks.countryFor('ethiopian').globalIndicators2026.homicideRatePer100k;
  assert.equal(ethiopia.year, 2012);
});

test('undernourishmentPct, avgTemperatureC and roadTrafficDeathRatePer100k are real but deliberately sparse -- present only where found, null everywhere else', () => {
  const withUndernourishment = Object.values(countryPacks.COUNTRIES).filter((e) => e.globalIndicators2026.undernourishmentPct !== null);
  const withTemp = Object.values(countryPacks.COUNTRIES).filter((e) => e.globalIndicators2026.avgTemperatureC !== null);
  const withRoad = Object.values(countryPacks.COUNTRIES).filter((e) => e.globalIndicators2026.roadTrafficDeathRatePer100k !== null);
  assert.equal(withUndernourishment.length, 5);
  assert.equal(withTemp.length, 5);
  assert.equal(withRoad.length, 4);
  // Most entries are null on all three -- same sparse posture oilProducer already has.
  assert.ok(countryPacks.countryFor('german').globalIndicators2026.undernourishmentPct === null);
  assert.ok(countryPacks.countryFor('german').globalIndicators2026.avgTemperatureC === null);
  assert.ok(countryPacks.countryFor('german').globalIndicators2026.roadTrafficDeathRatePer100k === null);
});

test('India carries real hunger, temperature and road-safety figures, with a disagreeing secondary road-safety figure named rather than dropped', () => {
  const india = countryPacks.countryFor('asian-indian').globalIndicators2026;
  assert.equal(india.undernourishmentPct.value, 9.8);
  assert.equal(india.avgTemperatureC.value, 24.94);
  assert.equal(india.roadTrafficDeathRatePer100k.value, 11.6);
  assert.ok(india.roadTrafficDeathRatePer100k.note.includes('15'), 'the conflicting secondary figure must stay visible');
});

test('temperature figures from a different real methodology/period are flagged, not blended with the 1991-2020 baseline figures', () => {
  const kenya = countryPacks.countryFor('kenyan').globalIndicators2026.avgTemperatureC;
  assert.ok(kenya.confidence.includes('different-baseline'));
  const mexico = countryPacks.countryFor('mexican').globalIndicators2026.avgTemperatureC;
  assert.ok(mexico.confidence.includes('different-baseline'));
});

test('generateRegion reports globalIndicators2026, additively, and leaves it null with no countryKey', () => {
  const w = { regions: [] };
  const haiti = migration.generateRegion(w, { name: 'Test Region A', countryKey: 'haitian' });
  assert.equal(haiti.globalIndicators2026.homicideRatePer100k.value, 41.2);
  assert.equal(haiti.globalIndicators2026.undernourishmentPct.value, 54.2);

  const noKey = migration.generateRegion(w, { name: 'Test Region B' });
  assert.equal(noKey.globalIndicators2026, null);
});

// ---------------------------------------------------------------------
// What this round explicitly declined or deferred, and why -- asserted
// so a future round can see the decision was deliberate, not missed
// ---------------------------------------------------------------------

test('this round did not add a conflict-event figure, an eating-conditions field, an animals field, or a cultures field -- checked for by their absence', () => {
  for (const entry of Object.values(countryPacks.COUNTRIES)) {
    assert.equal(entry.conflictEventCount, undefined, 'conflict events were deliberately not added this round -- conflictLevel stands unchanged');
    assert.equal(entry.dietarySupplyKcalPerCapitaDay, undefined, 'eating-conditions data was not attempted this round -- no usable compiled figures were found');
    assert.equal(entry.threatenedSpeciesCount, undefined, 'IUCN wildlife data was not attempted this round');
    assert.equal(entry.livestockHeadCount, undefined, 'FAO livestock data was not attempted this round');
    assert.equal(entry.culturalDimensions, undefined, 'Hofstede/WVS cultural data is declined outright this round -- see this file\'s own header');
  }
});

test('occupations needed no new building this round -- enforcer/officer are already ungated by ethnicity or nationality', () => {
  const occupations = require('../server/occupations.js');
  assert.ok(occupations.OCCUPATIONS.enforcer, 'enforcer must already exist and be available to any NPC regardless of ancestry/nationality context');
});
