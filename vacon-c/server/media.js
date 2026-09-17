// server/media.js
//
// The channels information actually travels through.
//
// §7's forty urban systems had exactly two left at `absent` —
// **23. Media** and **24. Social Media** — and their own entries in
// `urbanSystems.js` said why: "No news, no radio, no bulletins. §61
// describes it; nothing implements it", and for Social Media,
// "correctly absent in a collapse setting until §39 reemergence
// restores networks — but nothing models that restoration either."
//
// ---------------------------------------------------------------------
// What their absence was actually costing
//
// **`politics.broadcastGovernmentKnowledge` wrote one knowledge row
// per NPC, unconditionally.** Every announcement reached every person
// in the world the instant it was made, wherever they lived, whatever
// had been built, and whatever era the civilization had climbed back
// to. So `computeApproval`'s `spread` — the share of the population who
// have heard of their own government — was a constant **1.0**, measured
// on a 400-tick world: 153 of 153 informed.
//
// `assessRevolutions` needs approval below 35 AND spread at or above
// 0.25. One of its two conditions could therefore never fail, which
// made the "Public Opinion + Information Spread + Government" mechanic
// §63 asks for into a public-opinion mechanic with a decorative second
// term. A collapsed settlement that has never heard of the assembly in
// the next valley is not on the brink of overthrowing it, and until now
// the engine could not express the difference.
//
// **And two more columns nothing had ever written.**
// `worldStore.addKnowledge` takes `spreadRate` and `distortionLevel`,
// both default null, and `grep` found no caller anywhere passing
// either. `perception.js` says as much about the second in its own
// header. A channel is exactly what decides both: how fast a fact
// travels and how much of it survives the trip.
//
// ---------------------------------------------------------------------
// The channels are §61's list, and the gates are the era ladder
//
// §61 MEDIA & COMMUNICATION: "Media systems include local news, radio,
// social media, community bulletins, word-of-mouth, community
// communication ... In the reset era, communication should begin
// locally and reemerge technologically over time."
//
// That last sentence is the whole design, and it needs no invented
// technology tree: `technology.ERA_NAMES` already has ten eras and
// `unlockedEras` already says which a civilization has climbed back to.
// Each channel names the era that makes it possible. A world at
// `stone_tools` has word-of-mouth and nothing else; one that has
// recovered `writing` can post a bulletin and print news; `electricity`
// brings radio; `computing` plus a standing `internet` site brings
// networks back. §39's reemergence is what moves a world up that
// ladder, so the restoration Social Media's entry said nobody modelled
// is modelled by the thing that was already there.
//
// ---------------------------------------------------------------------
// An outlet is an organization, not a new table
//
// Standing rule 4: Organization is the parent table and subtypes are
// not separate root entities. `organizations.type`'s own enumeration in
// the schema already includes **`media`**, so a newspaper or a station
// is an organization of that type and needs no table of its own. Its
// `influence` is what decides how much of its potential audience it
// actually reaches — a station nobody listens to is not a station that
// reaches everybody.

'use strict';

const technology = require('./technology.js');
const infrastructure = require('./infrastructure.js');
const worldStore = require('./worldStore.js');
const perception = require('./perception.js');
const { seededDraw } = require('./seeded.js');

const clamp01 = (n) => Math.max(0, Math.min(1, n));

// ---------------------------------------------------------------------
// The channels
// ---------------------------------------------------------------------
//
//   era          the `technology.ERA_NAMES` entry that makes this
//                channel possible, or null for one that never went
//                away. NOT invented — the ten eras are the spec's.
//   reach        how far one broadcast carries: the community it was
//                made in, the whole city, or everywhere.
//   outlet       whether it needs a `media` organization to run it. A
//                bulletin board does not; a newspaper does.
//   infrastructure  an `infrastructure.type` that has to be standing
//                and not failed.
//   distortion   `entity_knowledge.distortion_level`, 0..1 — how much
//                of the message does not survive the trip.
//   spreadRate   `entity_knowledge.spread_rate`, or null for a channel
//                that does not pass person to person. Only
//                word-of-mouth has one, because only word-of-mouth
//                travels BY being retold.
//
//: **Flagged interpretive: the distortion figures.** §61 says media
//: affects "rumors" and gives no numbers. These are ordered by how many
//: hands a message passes through rather than by any judgement about a
//: medium: word-of-mouth is retold person to person and degrades most;
//: a printed bulletin and a broadcast script are fixed text with one
//: author, so they degrade least; a network where every recipient is
//: also a repeater sits between the two, closer to retelling than to
//: print, because that is structurally what it is.
const CHANNELS = {
  word_of_mouth: {
    era: null, reach: 'community', outlet: false, infrastructure: null,
    distortion: 0.35, spreadRate: 0.08,
  },
  bulletin: {
    era: 'writing', reach: 'community', outlet: false, infrastructure: null,
    distortion: 0.1, spreadRate: null,
  },
  local_news: {
    era: 'writing', reach: 'city', outlet: true, infrastructure: null,
    distortion: 0.15, spreadRate: null,
  },
  radio: {
    era: 'electricity', reach: 'world', outlet: true, infrastructure: null,
    distortion: 0.12, spreadRate: null,
  },
  social_media: {
    era: 'computing', reach: 'world', outlet: true, infrastructure: 'internet',
    distortion: 0.3, spreadRate: 0.04,
  },
};

const CHANNEL_NAMES = Object.keys(CHANNELS);

// Widest first, so `bestChannel` is a lookup rather than a comparison.
const REACH_ORDER = { community: 0, city: 1, world: 2 };

// Fail at require time rather than at broadcast time if a channel names
// an era the ladder does not have — the same guard `competition.js`
// puts on its disciplines.
(function assertErasExist() {
  for (const [name, channel] of Object.entries(CHANNELS)) {
    if (channel.era === null) continue;
    if (!technology.ERA_NAMES.includes(channel.era)) {
      throw new Error(
        `media.js: channel "${name}" requires era "${channel.era}", which is not one of `
        + `technology.ERA_NAMES (${technology.ERA_NAMES.join(', ')}).`,
      );
    }
  }
}());

// ---------------------------------------------------------------------
// What a world can actually use
// ---------------------------------------------------------------------

// Has this civilization climbed back to this era?
//
// **True for a null era, and that is the floor the whole file rests
// on.** A world with no civilization row, no technology progress and no
// outlets still has people who talk to each other. Returning false here
// would silence a fresh world completely, which is standing rule 12's
// first clause — the modifier has to leave the world that has none of
// this exactly as it was.
function eraReached(worldState, eraName) {
  if (eraName === null || eraName === undefined) return true;
  const civilizations = worldState.civilizations || [];
  if (civilizations.length === 0) return false;
  for (const civilization of civilizations) {
    const unlocked = technology.unlockedEras(worldState, civilization.id);
    if (unlocked.some((u) => u.era?.name === eraName)) return true;
  }
  return false;
}

// The media organizations that could carry a broadcast. Organizations
// have no city column, so an outlet is world-scoped — a newspaper is
// not a building and the schema gives it no address.
function outlets(worldState) {
  return (worldState.organizations || []).filter((o) => o.type === 'media');
}

// Is the infrastructure a channel needs standing and running here?
//
// Null `cityId` with a channel that needs infrastructure means nobody
// said where, so it cannot be confirmed — false rather than true,
// because a network is the one thing that genuinely does not exist
// without the wire.
function infrastructureReady(worldState, channel, cityId) {
  if (channel.infrastructure === null) return true;
  if (cityId === null || cityId === undefined) return false;
  const rows = infrastructure.infrastructureIn(worldState, cityId, channel.infrastructure);
  return rows.length > 0 && rows.some((row) => !infrastructure.isFailed(row));
}

// Which channels this world can use, optionally for one city.
function availableChannels(worldState, cityId = null) {
  const hasOutlet = outlets(worldState).length > 0;
  return CHANNEL_NAMES.filter((name) => {
    const channel = CHANNELS[name];
    if (!eraReached(worldState, channel.era)) return false;
    if (channel.outlet && !hasOutlet) return false;
    if (!infrastructureReady(worldState, channel, cityId)) return false;
    return true;
  });
}

// The furthest-reaching channel available, or null. `word_of_mouth`
// needs nothing, so null means a world with no people to speak.
//
// **Widest reach, and among equals the one that carries the message
// most faithfully.** `radio` and `social_media` both reach the world,
// so without the tie-break this depended on the order of
// `Object.keys(CHANNELS)` — which is a real answer arrived at by
// accident, and would have silently changed if the channel list were
// ever reordered. Radio wins that tie on purpose: a broadcast script
// has one author and a network where every recipient is also a repeater
// does not.
function bestChannel(worldState, cityId = null) {
  const available = availableChannels(worldState, cityId);
  if (available.length === 0) return null;
  return available.reduce((best, name) => {
    const reach = REACH_ORDER[CHANNELS[name].reach] - REACH_ORDER[CHANNELS[best].reach];
    if (reach !== 0) return reach > 0 ? name : best;
    return CHANNELS[name].distortion < CHANNELS[best].distortion ? name : best;
  });
}

// Where an organization sits, as `{ cityId, communityId }`, or nulls.
//
// **`organizations` has no address and does not need one.**
// `properties.operating_organization_id` is the schema's own link from
// a building to whoever runs it, and a property carries `community_id`
// and `city_id` — so an institution's location is a fact about the
// building it operates, not a column somebody has to keep in step.
//
// This is what lets an announcement be made SOMEWHERE. Without it the
// only honest option was to announce everywhere at once, which is the
// behaviour this whole file exists to replace.
function seatOf(worldState, organizationId) {
  if (organizationId === null || organizationId === undefined) {
    return { cityId: null, communityId: null };
  }
  const seat = (worldState.properties || [])
    .find((p) => p.operating_organization_id === organizationId);
  return {
    cityId: seat?.city_id ?? null,
    communityId: seat?.community_id ?? null,
  };
}

// ---------------------------------------------------------------------
// Who hears it
// ---------------------------------------------------------------------

//: How much of its potential audience an outlet actually reaches, at
//: full influence. **Flagged interpretive.** At 1.0 a maximally
//: influential outlet reaches everybody its channel can carry to and a
//: powerless one reaches nobody, with `organizations.influence`
//: (0..100, a real column) scaling between — so an outlet is a thing
//: that can be weak rather than a switch.
const OUTLET_REACH_AT_FULL = 1;

function outletReach(worldState) {
  const values = outlets(worldState)
    .map((o) => Number(o.influence))
    .filter(Number.isFinite);
  if (values.length === 0) return 0;
  // The best outlet in the world carries the broadcast, not the average
  // of them. Two weak papers are not one strong one.
  return clamp01((Math.max(...values) / 100) * OUTLET_REACH_AT_FULL);
}

// The people a broadcast on this channel can reach, before its reach
// fraction is applied.
function audienceFor(worldState, channelName, options = {}) {
  const channel = CHANNELS[channelName];
  if (!channel) throw new Error(`media: "${channelName}" is not a channel.`);

  const npcs = (worldState.npcs || []).filter((n) => n.status !== 'deceased');
  if (channel.reach === 'world') return npcs;

  // **A world with no geography at all is a different case from a
  // broadcast with nowhere named, and conflating them breaks both.**
  //
  // `authority.proximity` settled this principle already: it scores 1
  // when there is no geography to read, "because an unplaced world is
  // one where distance is unknown, and an unknown distance is not an
  // infinite one". A fixture or a scenario with people and no
  // communities is exactly that — there is no geography to divide them
  // by, so a narrow channel is not narrow, and returning nobody would
  // silence every such world.
  //
  // Not the same as the case below it: a world that HAS communities and
  // a broadcast that names none reaches nobody, because defaulting
  // there to everybody is precisely how the old
  // announce-to-the-whole-world behaviour creeps back under a new name.
  const placed = (worldState.communities || []).length > 0;
  if (!placed) return npcs;

  const { communityId = null, cityId = null } = options;
  if (channel.reach === 'community') {
    if (communityId === null || communityId === undefined) return [];
    return npcs.filter((n) => n.communityId === communityId);
  }

  // City reach: everybody in any of its communities.
  if (cityId === null || cityId === undefined) return [];
  const here = new Set((worldState.communities || [])
    .filter((c) => c.city_id === cityId)
    .map((c) => c.id));
  return npcs.filter((n) => here.has(n.communityId));
}

// ---------------------------------------------------------------------
// Broadcasting
// ---------------------------------------------------------------------

// Put a fact into the world through one channel.
//
// Returns the knowledge rows written. Every row goes through
// `worldStore.addKnowledge` — not pushed directly — so distortion,
// spread rate and source tracking behave the same way they do for
// every other fact, which is the property the old blanket broadcast
// was careful about and worth keeping.
function broadcast(worldState, options = {}) {
  const {
    factContent, factType = 'known', subjectEntityId = null, sourceEntityId = null,
    confidence = 0.8, communityId = null, cityId = null,
    tick = worldState.tick ?? 0,
  } = options;
  if (!factContent) throw new Error('media.broadcast requires factContent.');

  const channelName = options.channel ?? bestChannel(worldState, cityId);
  if (channelName === null) return [];
  const channel = CHANNELS[channelName];
  if (!channel) throw new Error(`media: "${channelName}" is not a channel.`);

  const audience = audienceFor(worldState, channelName, { communityId, cityId });
  if (audience.length === 0) return [];

  // An outlet channel reaches its share of the audience; a channel
  // that needs no outlet reaches all of it. Seeded per person so the
  // same world replays (§88), and on the person's ID here rather than
  // on a loop position because the person IS the subject of the draw.
  const share = channel.outlet ? outletReach(worldState) : 1;

  const written = [];
  for (const npc of audience) {
    if (share < 1) {
      const draw = seededDraw([
        worldState.seed ?? 'world', 'media', channelName, factContent, npc.id, tick,
      ]);
      if (draw >= share) continue;
    }
    written.push(worldStore.addKnowledge(worldState, {
      entityId: npc.id,
      subjectEntityId,
      factType,
      factContent,
      // Announced once, received differently — `perception.js` decides
      // how firmly THIS person ends up holding it, and the channel's
      // distortion is applied on top, because a fact that arrives
      // garbled is held less confidently than one that arrives clean.
      confidenceLevel: clamp01(
        perception.receivedConfidence(worldState, npc.id, confidence) * (1 - channel.distortion),
      ),
      sourceEntityId,
      spreadRate: channel.spreadRate,
      distortionLevel: channel.distortion,
      tick,
    }));
  }
  return written;
}

// ---------------------------------------------------------------------
// Word of mouth — the channel that travels by being retold
// ---------------------------------------------------------------------
//
// **This is what makes awareness a function of time and of who knows
// whom.** Every other channel puts a fact in front of its audience at
// once. Word-of-mouth does not have an audience; it has a next person.
// So a settlement with no press and no radio still learns things, over
// weeks, along the relationships it actually has — and a person with no
// relationships never hears anything, which is the fact `spread_rate`
// existed to carry and nothing ever wrote.
//
// Only facts whose row carries a `spread_rate` propagate. That is why
// the column is written rather than assumed: a printed bulletin does
// not retell itself.

//: The strength a relationship needs before somebody passes news along
//: it. **Flagged interpretive**, and deliberately low: people tell
//: acquaintances things. It reads `interaction_count` rather than trust
//: or love, because the question is whether these two SPEAK, not
//: whether they like each other.
const RETELL_CONTACT_FLOOR = 1;

// One tick of talk. Returns the rows written.
//
// Runs in the Social phase — it moves along `relationships`, which is
// what that phase is about, and the pipeline is locked at eleven.
function runWordOfMouth(worldState, tick = worldState.tick ?? 0) {
  const rows = worldState.entityKnowledge || [];
  if (rows.length === 0) return [];

  // Index once for the whole pass rather than filtering per person —
  // `traitDrift.indexRows` and `crime.dangerByCommunity` both cost this
  // lesson.
  const knownBy = new Map();          // entity id -> Set of fact_content
  const spreadable = [];              // rows that travel
  for (const row of rows) {
    let set = knownBy.get(row.entity_id);
    if (!set) { set = new Set(); knownBy.set(row.entity_id, set); }
    set.add(row.fact_content);
    const rate = Number(row.spread_rate);
    if (Number.isFinite(rate) && rate > 0) spreadable.push(row);
  }
  if (spreadable.length === 0) return [];

  const contacts = new Map();         // entity id -> [other entity ids]
  for (const relationship of worldState.relationships || []) {
    if (relationship.entity_a_id === relationship.entity_b_id) continue;
    if ((Number(relationship.interaction_count) || 0) < RETELL_CONTACT_FLOOR) continue;
    for (const [from, to] of [
      [relationship.entity_a_id, relationship.entity_b_id],
      [relationship.entity_b_id, relationship.entity_a_id],
    ]) {
      const list = contacts.get(from);
      if (list) list.push(to); else contacts.set(from, [to]);
    }
  }
  if (contacts.size === 0) return [];

  const living = new Set((worldState.npcs || [])
    .filter((n) => n.status !== 'deceased')
    .map((n) => n.id));

  const written = [];
  for (const row of spreadable) {
    if (!living.has(row.entity_id)) continue;
    const listeners = contacts.get(row.entity_id);
    if (!listeners) continue;
    const rate = Number(row.spread_rate);

    for (const listenerId of listeners) {
      if (!living.has(listenerId)) continue;
      if (knownBy.get(listenerId)?.has(row.fact_content)) continue;

      // Seeded on the telling — who, to whom, about what, when — so a
      // replay of the same world produces the same rumour mill (§88).
      const draw = seededDraw([
        worldState.seed ?? 'world', 'retell',
        row.entity_id, listenerId, row.fact_content, tick,
      ]);
      if (draw >= rate) continue;

      const distortion = clamp01((Number(row.distortion_level) || 0) + CHANNELS.word_of_mouth.distortion);
      const fresh = worldStore.addKnowledge(worldState, {
        entityId: listenerId,
        subjectEntityId: row.subject_entity_id,
        // **A retelling is hearsay, whatever the original was.** The
        // fact_type is what `keys.knowledgeCharge` and
        // `perception.js` read to decide how much weight somebody puts
        // on what they know, and a thing you were told by a neighbour
        // is not a thing you verified.
        factType: 'rumor',
        factContent: row.fact_content,
        // Degrades with every hand it passes through, and each teller
        // holds it less firmly than the one before.
        confidenceLevel: clamp01(
          perception.receivedConfidence(worldState, listenerId, Number(row.confidence_level) || 0.5)
          * (1 - CHANNELS.word_of_mouth.distortion),
        ),
        sourceEntityId: row.entity_id,
        spreadRate: rate,
        distortionLevel: distortion,
        tick,
      });
      written.push(fresh);
      // Within this pass too, so one fact does not reach the same
      // person twice from two tellers on the same tick.
      let set = knownBy.get(listenerId);
      if (!set) { set = new Set(); knownBy.set(listenerId, set); }
      set.add(row.fact_content);
    }
  }
  return written;
}

// ---------------------------------------------------------------------
// Reading it
// ---------------------------------------------------------------------

// The share of the living population holding any fact whose content
// starts with this prefix, 0..1. Null for a world with nobody in it —
// an empty settlement is not an uninformed one.
//
// This is the same quantity `politics.computeApproval` reports as
// `spread`, exposed on its own so a statistic can ask about any subject
// rather than only about a government.
function awarenessOf(worldState, prefix) {
  const npcs = (worldState.npcs || []).filter((n) => n.status !== 'deceased');
  if (npcs.length === 0) return null;
  const ids = new Set(npcs.map((n) => n.id));
  const informed = new Set();
  for (const row of worldState.entityKnowledge || []) {
    if (!ids.has(row.entity_id)) continue;
    if (typeof row.fact_content !== 'string' || !row.fact_content.startsWith(prefix)) continue;
    informed.add(row.entity_id);
  }
  return Math.round((informed.size / npcs.length) * 10000) / 10000;
}

function describeMedia(worldState, cityId = null) {
  const available = availableChannels(worldState, cityId);
  return {
    cityId,
    channels: available.map((name) => ({
      name,
      reach: CHANNELS[name].reach,
      era: CHANNELS[name].era,
      distortion: CHANNELS[name].distortion,
      // **Summed across the city's communities for a community-reach
      // channel**, because that is what one announcement actually does:
      // `politics.broadcastGovernmentKnowledge` makes it in every
      // community of the city — a crier in each square, not one shout
      // heard everywhere. A single `audienceFor` call with only a
      // cityId returns 0 for those channels, correctly, and reporting
      // that here would read as "nobody can hear this" rather than
      // "this needs to be said in each place".
      audience: CHANNELS[name].reach === 'community'
        ? (worldState.communities || [])
          .filter((c) => c.city_id === cityId)
          .reduce((total, c) => total + audienceFor(
            worldState, name, { communityId: c.id },
          ).length, 0)
        : audienceFor(worldState, name, { cityId }).length,
    })),
    best: bestChannel(worldState, cityId),
    outlets: outlets(worldState).length,
    outletReach: outletReach(worldState),
    unreachable: CHANNEL_NAMES.filter((n) => !available.includes(n)).map((name) => ({
      name,
      why: !eraReached(worldState, CHANNELS[name].era)
        ? `era ${CHANNELS[name].era} not recovered`
        : (CHANNELS[name].outlet && outlets(worldState).length === 0)
          ? 'no media organization exists'
          : `no working ${CHANNELS[name].infrastructure}`,
    })),
  };
}

module.exports = {
  CHANNELS,
  CHANNEL_NAMES,
  REACH_ORDER,
  OUTLET_REACH_AT_FULL,
  RETELL_CONTACT_FLOOR,
  eraReached,
  seatOf,
  outlets,
  outletReach,
  infrastructureReady,
  availableChannels,
  bestChannel,
  audienceFor,
  broadcast,
  runWordOfMouth,
  awarenessOf,
  describeMedia,
};
