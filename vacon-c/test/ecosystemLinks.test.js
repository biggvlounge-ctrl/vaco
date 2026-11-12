// server/ecosystemLinks.js — Phase 4 "Digital Planet" link generators.
// Fixture shape follows test/media.test.js's own `mediaWorld` exactly,
// since the real gate this file reuses (`media.availableChannels`)
// reads the identical era/infrastructure/community rows.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const ecosystemLinks = require('../server/ecosystemLinks.js');
const media = require('../server/media.js');
const technology = require('../server/technology.js');

function linksWorld({ eras = [], internet = 'running', tick = 100 } = {}) {
  const w = {
    tick,
    seed: 'ecosystem-links-test',
    civilizations: [{ id: 1, name: 'Test', era: null, stability_index: 50 }],
    technologyEras: [],
    civilizationTechnologyProgress: [],
    cities: [{ id: 1, name: 'Testbed' }],
    communities: [{ id: 1, city_id: 1, population: 10 }],
    npcs: [{ id: 9001, communityId: 1, status: 'active' }],
    // `social_media` (like `radio`/`local_news`) also requires a real
    // `type: 'media'` outlet to exist (`media.js#outlets`) -- not just
    // the era and the infrastructure. Always present here since none
    // of this file's tests are about outlet-influence variation.
    organizations: [{ id: 500, name: 'The Record', type: 'media', influence: 60 }],
    properties: [],
    relationships: [],
    entityKnowledge: [],
    entityTraits: [],
    governments: [],
    publicOpinion: [],
    beliefs: [],
    infrastructure: [],
  };

  technology.seedTechnologyEras(w);
  const byName = new Map(w.technologyEras.map((e) => [e.name, e]));
  for (const name of eras) {
    const era = byName.get(name);
    assert.ok(era, `${name} is not one of technology.ERA_NAMES`);
    w.civilizationTechnologyProgress.push({ civilization_id: 1, era_id: era.id, unlocked_tick: 1 });
  }

  if (internet !== 'absent') {
    w.infrastructure.push({
      id: 1, city_id: 1, type: 'internet', condition: 80, maintenance_level: 50,
      age: 0, capacity: null, funding: 50,
      failed_since_tick: internet === 'failed' ? tick - 5 : null,
      repair_ticks: internet === 'failed' ? 20 : null,
    });
  }

  return w;
}

const READY = { eras: ['stone_tools', 'agriculture', 'metalworking', 'writing', 'engineering', 'industrialization', 'electricity', 'computing'] };

test('digitalPlanetReady: true only once computing is reached AND real internet infrastructure is standing', () => {
  const noEra = linksWorld({ eras: ['electricity'] });
  assert.equal(ecosystemLinks.digitalPlanetReady(noEra, 1).ready, false);
  assert.match(ecosystemLinks.digitalPlanetReady(noEra, 1).reason, /era "computing" not yet reached/);

  const eraNoInfra = linksWorld({ ...READY, internet: 'absent' });
  assert.equal(ecosystemLinks.digitalPlanetReady(eraNoInfra, 1).ready, false);
  assert.match(ecosystemLinks.digitalPlanetReady(eraNoInfra, 1).reason, /internet/);

  const eraFailedInfra = linksWorld({ ...READY, internet: 'failed' });
  assert.equal(ecosystemLinks.digitalPlanetReady(eraFailedInfra, 1).ready, false);

  const ready = linksWorld(READY);
  assert.equal(ecosystemLinks.digitalPlanetReady(ready, 1).ready, true);

  // Sanity: this is genuinely the same gate `media.js` itself reports,
  // not a second, disagreeing threshold.
  assert.equal(
    media.availableChannels(ready, 1).includes('social_media'),
    ecosystemLinks.digitalPlanetReady(ready, 1).ready,
  );
});

test('digitalPlanetReady: an unresolvable city is refused, never defaulted to ready', () => {
  const ready = linksWorld(READY);
  const result = ecosystemLinks.digitalPlanetReady(ready, null);
  assert.equal(result.ready, false);
  assert.match(result.reason, /no resolvable city/);
});

test('vaultStudiosLink: refused pre-threshold, real channel URL post-threshold', () => {
  const notYet = linksWorld({ eras: ['electricity'] });
  const refused = ecosystemLinks.vaultStudiosLink(notYet, 1, 42);
  assert.equal(refused.ok, false);

  const ready = linksWorld(READY);
  const link = ecosystemLinks.vaultStudiosLink(ready, 1, 42);
  assert.equal(link.ok, true);
  assert.equal(link.app, 'vavlt-stvdios');
  assert.match(link.url, /\/api\/channels\/42$/);
  assert.equal(link.verified, true);
});

test('vultureLink: dispatches to the real sub-app by contentType, refuses an unknown one', () => {
  const ready = linksWorld(READY);

  const music = ecosystemLinks.vultureLink(ready, 1, 'music', 7);
  assert.equal(music.ok, true);
  assert.equal(music.app, 'vulture-music');
  assert.match(music.url, /\/api\/releases\/7$/);

  const flix = ecosystemLinks.vultureLink(ready, 1, 'flix', 8);
  assert.equal(flix.ok, true);
  assert.equal(flix.app, 'vulture-flix');
  assert.match(flix.url, /\/api\/titles\/8$/);

  const touring = ecosystemLinks.vultureLink(ready, 1, 'touring', 1);
  assert.equal(touring.ok, false, '"touring" has no dedicated app in this repo and must be refused, not guessed');

  // The gate still applies before the contentType dispatch is even
  // reached.
  const notYet = linksWorld({ eras: ['electricity'] });
  assert.equal(ecosystemLinks.vultureLink(notYet, 1, 'music', 7).ok, false);
});

test('dreamsLink: real screen URL once ready', () => {
  const ready = linksWorld(READY);
  const link = ecosystemLinks.dreamsLink(ready, 1, 15);
  assert.equal(link.ok, true);
  assert.equal(link.app, 'dreams');
  assert.match(link.url, /\/api\/screens\/15$/);
});

test('venvsLink: real seller/storefront URL once ready', () => {
  const ready = linksWorld(READY);
  const link = ecosystemLinks.venvsLink(ready, 1, 33);
  assert.equal(link.ok, true);
  assert.equal(link.app, 'venvs');
  assert.match(link.url, /\/api\/marketplace\/sellers\/33$/);
});

// SVMIKO DEGVCHI (the renamed "Vozzana da Gucci") has no separate
// route -- a brand storefront is an ordinary VENVS seller with a
// runtime integer id, so the exact same venvsLink call that works for
// any other seller works for a SVMIKO DEGVCHI brand's own real seller
// id. There is nothing SVMIKO-DEGVCHI-specific to assert here beyond
// confirming the same function handles both without special-casing.
test('venvsLink: covers a SVMIKO DEGVCHI brand storefront identically, since it is an ordinary VENVS seller', () => {
  const ready = linksWorld(READY);
  const peerSeller = ecosystemLinks.venvsLink(ready, 1, 12);
  const degvchiBrandSeller = ecosystemLinks.venvsLink(ready, 1, 47);
  assert.equal(peerSeller.app, degvchiBrandSeller.app);
  assert.match(degvchiBrandSeller.url, /\/api\/marketplace\/sellers\/47$/);
});
