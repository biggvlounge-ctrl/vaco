// The channels information actually travels through.
//
// ---------------------------------------------------------------------
// What this closes, and it was worth more than two entries on a list
//
// §7's forty urban systems had exactly two left at `absent` — 23 Media
// and 24 Social Media — and the cost of their absence was in
// `politics.js`. `broadcastGovernmentKnowledge` wrote one knowledge row
// per NPC, unconditionally, so every announcement reached every person
// in the world the instant it was made: wherever they lived, whatever
// had been built, and whatever era the civilization had climbed back
// to.
//
// **So `computeApproval`'s `spread` was a constant 1.0** — measured,
// 153 of 153 on a 400-tick world. `assessRevolutions` needs approval
// below 35 AND spread at or above 0.25, so one of its two conditions
// could never fail, and §63's "Public Opinion + Information Spread +
// Government" mechanic was a public-opinion mechanic with a decorative
// second term.
//
// Two more columns nothing had ever written, too:
// `worldStore.addKnowledge` takes `spreadRate` and `distortionLevel`,
// both defaulting to null, and no caller anywhere passed either. So no
// fact in any world had ever been passed from one person to another.
//
// ---------------------------------------------------------------------
// The two mistakes this file holds, both made here first
//
//   **A dead gate I had just written about.** The outlet was founded in
//   `worldgen` behind `eraReached('writing')`, and `startingEras` is 2
//   — so at the only moment an outlet was ever created, the gate was
//   shut. `local_news`, `radio` and `social_media` would have been
//   permanently unavailable in every world however far it climbed.
//   Standing rule 14, one commit after adding a rule about it.
//
//   **Announcing everywhere, under a new name.** The first routing
//   made a community-reach broadcast in EVERY community of the city, on
//   the reasoning that it has to be spoken somewhere so it should be
//   spoken everywhere. Measured: `spread` 1.0 on tick 0 of a fresh
//   world and zero facts ever retold, because nobody was left who had
//   not heard. An announcement is made at the seat of government and
//   then it travels.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const media = require('../server/media.js');
const technology = require('../server/technology.js');
const politics = require('../server/politics.js');
const urbanSystems = require('../server/urbanSystems.js');
const statistics = require('../server/statistics.js');

// ---------------------------------------------------------------------
// A world with exactly what the channels read.
//
// **Standing rule 8**: constructed, not generated, because every
// assertion below is about which channel is open and who is inside its
// reach. `generateWorld` also APPENDS to a shared WorldState, which has
// cost this project two test timeouts.
// ---------------------------------------------------------------------
function mediaWorld({
  eras = [],                 // era NAMES the civilization has recovered
  outletInfluence = null,    // null = no media organization at all
  internet = 'running',      // 'running' | 'failed' | 'absent'
  communities = 2,
  perCommunity = 5,
  tick = 100,
} = {}) {
  const w = {
    tick,
    seed: 'media-test',
    civilizations: [{ id: 1, name: 'Test', era: null, stability_index: 50 }],
    technologyEras: [],
    civilizationTechnologyProgress: [],
    cities: [{ id: 1, name: 'Testbed' }],
    communities: [],
    npcs: [],
    organizations: [],
    properties: [],
    relationships: [],
    entityKnowledge: [],
    entityTraits: [],
    governments: [],
    publicOpinion: [],
    beliefs: [],
    infrastructure: [],
  };

  // The real ladder, so a channel's era gate is checked against the
  // same ten names `technology.js` has rather than a fixture's idea of
  // them.
  technology.seedTechnologyEras(w);
  const byName = new Map(w.technologyEras.map((e) => [e.name, e]));
  for (const name of eras) {
    const era = byName.get(name);
    assert.ok(era, `${name} is not one of technology.ERA_NAMES`);
    w.civilizationTechnologyProgress.push({
      civilization_id: 1, era_id: era.id, unlocked_tick: 1,
    });
  }

  let nextId = 1000;
  for (let c = 0; c < communities; c += 1) {
    const community = { id: c + 1, city_id: 1, population: perCommunity };
    w.communities.push(community);
    for (let p = 0; p < perCommunity; p += 1) {
      w.npcs.push({ id: nextId++, communityId: community.id, status: 'active' });
    }
  }

  if (outletInfluence !== null) {
    w.organizations.push({
      id: 500, name: 'The Record', type: 'media', influence: outletInfluence,
    });
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

const ids = (rows) => new Set(rows.map((r) => r.entity_id));

// ---------------------------------------------------------------------
// The channels are the spec's, and so are the gates
// ---------------------------------------------------------------------

test('every channel requires an era the ladder actually has', () => {
  // Asserted at require time in media.js too, so a renamed era fails
  // loudly in one place instead of silently closing a channel forever.
  for (const [name, channel] of Object.entries(media.CHANNELS)) {
    if (channel.era === null) continue;
    assert.ok(technology.ERA_NAMES.includes(channel.era),
      `channel ${name} requires era ${channel.era}, which is not on the ladder`);
  }
  // §61 names six things; five are channels and "community
  // communication" is the category, not a sixth channel.
  assert.deepEqual(media.CHANNEL_NAMES, [
    'word_of_mouth', 'bulletin', 'local_news', 'radio', 'social_media',
  ]);
});

test('a collapsed world has word of mouth and nothing else', () => {
  // §61: "in the reset era, communication should begin locally and
  // reemerge technologically over time." This is the first half.
  const w = mediaWorld({ eras: ['stone_tools'], outletInfluence: 60 });
  assert.deepEqual(media.availableChannels(w, 1), ['word_of_mouth']);
  assert.equal(media.bestChannel(w, 1), 'word_of_mouth');
});

test('channels reopen as the era ladder is reclimbed', () => {
  // And this is the second half — no invented technology tree, just
  // the ten eras `technology.js` already had.
  const reach = (eras) => media.bestChannel(
    mediaWorld({ eras, outletInfluence: 60 }), 1,
  );
  assert.equal(reach(['stone_tools']), 'word_of_mouth');
  assert.equal(reach(['stone_tools', 'writing']), 'local_news');
  assert.equal(reach(['stone_tools', 'writing', 'electricity']), 'radio');

  // **Radio still, once computing comes back, and that is deliberate.**
  // `bestChannel` is widest reach and then highest fidelity, and radio
  // and social_media both reach the world — so the tie goes to the one
  // that carries the message with one author rather than one where
  // every recipient is also a repeater. The network is open, it is just
  // not what an announcement picks.
  const all = ['stone_tools', 'writing', 'electricity', 'computing'];
  assert.equal(reach(all), 'radio');
  assert.ok(media.availableChannels(
    mediaWorld({ eras: all, outletInfluence: 60 }), 1,
  ).includes('social_media'));
});

test('a world with no civilization still talks', () => {
  // **Centred on the world that has none of this** — standing rule 12's
  // first clause. A fixture, a scenario or a world mid-restore has no
  // civilization row and no technology progress, and the people in it
  // still speak to each other. Returning nothing here would silence
  // every such world completely.
  const w = mediaWorld({ eras: [], outletInfluence: null });
  w.civilizations = [];
  assert.deepEqual(media.availableChannels(w, 1), ['word_of_mouth']);
});

test('the network needs a wire that is actually working', () => {
  const eras = ['stone_tools', 'writing', 'electricity', 'computing'];
  assert.ok(media.availableChannels(
    mediaWorld({ eras, outletInfluence: 60, internet: 'running' }), 1,
  ).includes('social_media'));
  // A failed site is not a site. This is the reader that made §7's
  // Social Media entry's own "nothing models that restoration" false.
  assert.ok(!media.availableChannels(
    mediaWorld({ eras, outletInfluence: 60, internet: 'failed' }), 1,
  ).includes('social_media'));
  assert.ok(!media.availableChannels(
    mediaWorld({ eras, outletInfluence: 60, internet: 'absent' }), 1,
  ).includes('social_media'));
});

test('a channel that needs an outlet is shut when there is none', () => {
  const eras = ['stone_tools', 'writing', 'electricity'];
  const withOutlet = media.availableChannels(mediaWorld({ eras, outletInfluence: 60 }), 1);
  const without = media.availableChannels(mediaWorld({ eras, outletInfluence: null }), 1);

  assert.ok(withOutlet.includes('local_news') && withOutlet.includes('radio'));
  assert.deepEqual(without, ['word_of_mouth', 'bulletin'],
    'a printed sheet or a broadcast happened with nobody to run it');
});

// ---------------------------------------------------------------------
// Who hears it
// ---------------------------------------------------------------------

test('reach decides the audience, and a community broadcast is not a city one', () => {
  const w = mediaWorld({ eras: ['stone_tools', 'writing', 'electricity'], outletInfluence: 100 });
  assert.equal(media.audienceFor(w, 'word_of_mouth', { communityId: 1 }).length, 5);
  assert.equal(media.audienceFor(w, 'local_news', { cityId: 1 }).length, 10);
  assert.equal(media.audienceFor(w, 'radio', {}).length, 10);
});

test('a community broadcast with no community named reaches nobody', () => {
  // **Not everybody.** Defaulting to the whole world here is exactly
  // how the old behaviour would creep back in under a new name.
  const w = mediaWorld({ eras: ['stone_tools'] });
  assert.equal(media.audienceFor(w, 'word_of_mouth', {}).length, 0);
  assert.equal(media.broadcast(w, {
    factContent: 'government:1 said a thing', channel: 'word_of_mouth',
  }).length, 0);
});

test('an announcement is made in one place, and only the people there hear it', () => {
  const w = mediaWorld({ eras: ['stone_tools'], outletInfluence: null });
  const written = media.broadcast(w, {
    factContent: 'government:1 raised the levy',
    channel: 'word_of_mouth',
    communityId: 1,
  });
  assert.equal(written.length, 5);
  // Nobody in the other community, which is the whole point.
  const heard = ids(written);
  for (const npc of w.npcs.filter((n) => n.communityId === 2)) {
    assert.ok(!heard.has(npc.id), 'the next community over heard a local announcement');
  }
});

test('an outlet with no influence reaches nobody, and a strong one reaches everybody', () => {
  const eras = ['stone_tools', 'writing', 'electricity'];
  const broadcastWith = (influence) => {
    const w = mediaWorld({ eras, outletInfluence: influence });
    return media.broadcast(w, {
      factContent: 'government:1 raised the levy', channel: 'radio',
    }).length;
  };
  assert.equal(broadcastWith(0), 0, 'an outlet nobody listens to reached everybody');
  assert.equal(broadcastWith(100), 10);
  const middling = broadcastWith(50);
  assert.ok(middling > 0 && middling < 10, `a half-influential outlet reached ${middling} of 10`);
});

test('a broadcast writes the two columns nothing had ever written', () => {
  const w = mediaWorld({ eras: ['stone_tools'] });
  const [row] = media.broadcast(w, {
    factContent: 'government:1 raised the levy', channel: 'word_of_mouth', communityId: 1,
  });
  assert.equal(row.spread_rate, media.CHANNELS.word_of_mouth.spreadRate);
  assert.equal(row.distortion_level, media.CHANNELS.word_of_mouth.distortion);

  // And a channel that does not travel by being retold carries no
  // spread rate — a printed bulletin does not retell itself.
  const posted = mediaWorld({ eras: ['stone_tools', 'writing'] });
  const [sheet] = media.broadcast(posted, {
    factContent: 'government:1 raised the levy', channel: 'bulletin', communityId: 1,
  });
  assert.equal(sheet.spread_rate, null);
  assert.ok(sheet.distortion_level < row.distortion_level,
    'print degraded as much as retelling');
});

// ---------------------------------------------------------------------
// Word of mouth
// ---------------------------------------------------------------------

test('a fact travels along relationships, and only to people who have one', () => {
  const w = mediaWorld({ eras: ['stone_tools'], communities: 1, perCommunity: 6 });
  const [a, b, c, ...rest] = w.npcs;
  // a speaks to b, b speaks to c. Nobody speaks to the rest.
  w.relationships.push(
    { id: 1, entity_a_id: a.id, entity_b_id: b.id, interaction_count: 40, conflict: 0 },
    { id: 2, entity_a_id: b.id, entity_b_id: c.id, interaction_count: 40, conflict: 0 },
  );
  media.broadcast(w, {
    factContent: 'government:1 raised the levy', channel: 'word_of_mouth', communityId: 1,
  });
  // The broadcast reached the whole community; keep only `a` so the
  // assertion is about travel rather than about the announcement.
  w.entityKnowledge = w.entityKnowledge.filter((k) => k.entity_id === a.id);

  // Long enough for a rate of 0.08 to carry two hops with near
  // certainty; the assertion is about WHO, not how fast.
  for (let t = 0; t < 400; t += 1) media.runWordOfMouth(w, w.tick + t);

  const knows = new Set(w.entityKnowledge.map((k) => k.entity_id));
  assert.ok(knows.has(b.id), 'a fact did not reach somebody spoken to directly');
  assert.ok(knows.has(c.id), 'a fact did not travel a second hop');
  for (const npc of rest) {
    assert.ok(!knows.has(npc.id),
      'somebody with no relationship to anybody heard the news anyway');
  }
});

test('only facts carrying a spread rate travel', () => {
  const w = mediaWorld({ eras: ['stone_tools', 'writing'], communities: 1, perCommunity: 4 });
  const [a, b] = w.npcs;
  w.relationships.push(
    { id: 1, entity_a_id: a.id, entity_b_id: b.id, interaction_count: 40, conflict: 0 },
  );
  media.broadcast(w, {
    factContent: 'government:1 posted a notice', channel: 'bulletin', communityId: 1,
  });
  w.entityKnowledge = w.entityKnowledge.filter((k) => k.entity_id === a.id);

  for (let t = 0; t < 400; t += 1) media.runWordOfMouth(w, w.tick + t);
  assert.equal(w.entityKnowledge.length, 1,
    'a printed notice retold itself');
});

test('a retelling is hearsay, and it degrades', () => {
  const w = mediaWorld({ eras: ['stone_tools'], communities: 1, perCommunity: 3 });
  const [a, b] = w.npcs;
  w.relationships.push(
    { id: 1, entity_a_id: a.id, entity_b_id: b.id, interaction_count: 40, conflict: 0 },
  );
  media.broadcast(w, {
    factContent: 'government:1 raised the levy', channel: 'word_of_mouth',
    communityId: 1, factType: 'verified', confidence: 0.9,
  });
  const original = w.entityKnowledge.find((k) => k.entity_id === a.id);
  w.entityKnowledge = [original];

  for (let t = 0; t < 400; t += 1) media.runWordOfMouth(w, w.tick + t);
  const retold = w.entityKnowledge.find((k) => k.entity_id === b.id);
  assert.ok(retold, 'nothing was retold');

  // `fact_type` is what `keys.knowledgeCharge` and `perception.js` read
  // to decide how much weight somebody puts on what they know, and a
  // thing a neighbour told you is not a thing you verified.
  assert.equal(retold.fact_type, 'rumor');
  assert.ok(retold.confidence_level < original.confidence_level,
    'a retelling was held as firmly as the announcement');
  assert.ok(retold.distortion_level > original.distortion_level);
  assert.equal(retold.source_entity_id, a.id, 'the teller was not recorded');
});

test('the same seed retells the same rumours', () => {
  // §88. Seeded on the telling — who, to whom, about what, when — not
  // on a counter.
  const run = (seed) => {
    const w = mediaWorld({ eras: ['stone_tools'], communities: 1, perCommunity: 8 });
    w.seed = seed;
    for (let i = 0; i < w.npcs.length - 1; i += 1) {
      w.relationships.push({
        id: i + 1, entity_a_id: w.npcs[i].id, entity_b_id: w.npcs[i + 1].id,
        interaction_count: 40, conflict: 0,
      });
    }
    media.broadcast(w, {
      factContent: 'government:1 raised the levy', channel: 'word_of_mouth', communityId: 1,
    });
    w.entityKnowledge = w.entityKnowledge.filter((k) => k.entity_id === w.npcs[0].id);
    const trail = [];
    for (let t = 0; t < 60; t += 1) {
      for (const row of media.runWordOfMouth(w, w.tick + t)) {
        trail.push(`${row.entity_id}@${w.tick + t}`);
      }
    }
    return trail.join(',');
  };
  assert.equal(run('alpha'), run('alpha'), 'the same seed did not replay');
  assert.notEqual(run('alpha'), run('beta'), 'the seed does not reach the telling');
});

test('the dead neither hear nor tell', () => {
  const w = mediaWorld({ eras: ['stone_tools'], communities: 1, perCommunity: 3 });
  const [a, b] = w.npcs;
  w.relationships.push(
    { id: 1, entity_a_id: a.id, entity_b_id: b.id, interaction_count: 40, conflict: 0 },
  );
  media.broadcast(w, {
    factContent: 'government:1 raised the levy', channel: 'word_of_mouth', communityId: 1,
  });
  w.entityKnowledge = w.entityKnowledge.filter((k) => k.entity_id === a.id);

  // `mortality` moves the row out of `npcs`, which is what everything
  // that iterates people relies on.
  w.npcs = w.npcs.filter((n) => n.id !== b.id);
  for (let t = 0; t < 400; t += 1) media.runWordOfMouth(w, w.tick + t);
  assert.equal(w.entityKnowledge.length, 1, 'a corpse was told the news');
});

// ---------------------------------------------------------------------
// Awareness, and what it unblocks
// ---------------------------------------------------------------------

test('awareness is the share of the LIVING who have heard', () => {
  // **`spread` could exceed 1, and did — measured at 1.0272.**
  // `mortality` deliberately leaves a dead person's `entity_knowledge`
  // alone, because what somebody knew is part of the record, so a world
  // that had buried anybody reported more people informed than it had
  // people.
  const w = mediaWorld({ eras: ['stone_tools'], communities: 1, perCommunity: 4 });
  media.broadcast(w, {
    factContent: 'government:1 raised the levy', channel: 'word_of_mouth', communityId: 1,
  });
  assert.equal(media.awarenessOf(w, 'government:1'), 1);

  w.npcs = w.npcs.slice(0, 2);            // two of the four have died
  const share = media.awarenessOf(w, 'government:1');
  assert.ok(share <= 1, `awareness read ${share}, which is not a share`);
  assert.equal(share, 1);

  // And the same guard in the function the revolution mechanic reads.
  w.governments = [{ organization_id: 1, system_type: 'council' }];
  const reading = politics.computeApproval(w, { topic: 'government:1' });
  assert.ok(reading.spread <= 1, `spread read ${reading.spread}`);
});

test('an empty settlement is not an uninformed one', () => {
  const w = mediaWorld({ eras: ['stone_tools'], communities: 1, perCommunity: 0 });
  assert.equal(media.awarenessOf(w, 'government:1'), null);
});

test('§7 has no absent systems left, and the new statistics answer', () => {
  const byName = Object.fromEntries(urbanSystems.SYSTEMS.map((s) => [s.name, s]));
  assert.notEqual(byName.Media.level, 'absent');
  assert.notEqual(byName['Social Media'].level, 'absent');
  assert.equal(urbanSystems.summarise().absent, 0,
    'something is absent again — check the note explains why');

  const keys = new Set(statistics.CATALOGUE.map((d) => d.key));
  for (const key of ['public_awareness', 'media_channels']) {
    assert.ok(keys.has(key), `${key} is not in the catalogue`);
  }
});

test('describeMedia says why a shut channel is shut', () => {
  // A gap you cannot see the reason for is not a gap anybody can act
  // on — the same argument `technology.canUnlock` makes about §40.
  const w = mediaWorld({ eras: ['stone_tools'], outletInfluence: null, internet: 'absent' });
  const description = media.describeMedia(w, 1);
  const why = Object.fromEntries(description.unreachable.map((u) => [u.name, u.why]));
  assert.match(why.bulletin, /era writing not recovered/);
  assert.match(why.radio, /era electricity not recovered/);
  assert.equal(description.best, 'word_of_mouth');
  assert.equal(description.outlets, 0);
});
