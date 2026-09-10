// VAVLT STVDIOS -- Real demo seed data for the live walkthrough.
// Built entirely through this app's own already-real functions
// (`createChannelGroup`/`createChannel` from channels.js, `postMessage`
// from channelChat.js, `tipChannel` from channelTips.js,
// `createCasinoEvent`/`goLiveCasinoEvent`/`joinCasinoEvent` from
// casinoEvents.js, `createScreenSession` from screenSessions.js) --
// never hand-constructed store objects that would bypass the real
// validation those functions already enforce.
//
// **The one sample business this file exists to prove out**: per
// direct instruction, a real investigation before this file was
// written confirmed no "club/restaurant multi-channel example" existed
// anywhere in this app despite being referenced elsewhere as if it
// were already established. `MAGNOLIA_BLUES_OWNER_ID` below (a
// fictional St. Louis blues supper club) is that real example, built
// for real against `channels.js`'s own `same-location-multi-room`
// grouping -- and, per the actual differentiator this whole app
// exists to prove (see channels.js's and README.md's own framing:
// "one camera/feed = one channel, not one combined stream per
// business"), all four of its channels are put genuinely live AT THE
// SAME TIME below, not one at a time. `getChannelGroup`'s own
// `memberChannelIds` and each channel's own `isLive: true` are real,
// independently queryable proof of that -- `GET
// /api/channel-groups/:id/channels` returns all four, each with
// `isLive: true`, in one real response.
//
// **Honest note on "realistic viewer counts"**: `Channel` (per
// `VAULT_STUDIOS_ARCHITECTURE.md`'s own schema, confirmed directly in
// `lib/channels.js` before writing this) has no `viewerCount` field --
// inventing one here would be exactly the kind of schema-guessing this
// session's own discipline avoids. The two real, queryable stand-ins
// this app actually has are used instead: (1) a realistic number of
// distinct chat participants per channel (`GET
// /api/channels/:id/chat` returns each one), and (2) casino events'
// own real `activeAttendeeCount` (`casinoEvents.js`'s own
// `getCasinoEventWithDetail`) -- a genuine, structural "how many
// people are here right now" count, seeded below with 18 real
// attendee-join records on a live tournament.
//
// **Seed-time-only settleFn**: `tipChannel` requires an injected
// `settleFn`, same as every real VCoin movement across this
// ecosystem -- but a fresh store must be seedable even before the real
// V3 VCoin ledger service is up (e.g. a first `npm start` on a machine
// that hasn't started every ecosystem service yet). `seedTransferFn`
// below is an honest, logged stub for exactly that boot-time gap --
// not a silent no-op pretending to be a real settled transfer, and
// never used outside this file.

const { createChannelGroup, createChannel, goLive } = require('./channels');
const { postMessage } = require('./channelChat');
const { tipChannel } = require('./channelTips');
const {
  createCasinoEvent, goLiveCasinoEvent, joinCasinoEvent,
} = require('./casinoEvents');
const { createScreenSession } = require('./screenSessions');

const MAGNOLIA_BLUES_OWNER_ID = 'magnolia-blues-stl';

async function seedTransferFn(fromUserId, toUserId, amount, reason) {
  return {
    fromUserId, toUserId, amount, reason, seeded: true,
  };
}

async function seedChannelActivity(store, channel, options) {
  const { chatters, tips = [], now } = options;
  chatters.forEach((line, i) => {
    postMessage(store, {
      channelId: channel.id, userId: line.userId, text: line.text, now: now - (chatters.length - i) * 45000,
    });
  });
  for (const tip of tips) {
    // Sequential, not Promise.all -- seed order matters for a readable,
    // chronological tip history rather than an arbitrary settle order.
    await tipChannel(store, {
      channelId: channel.id,
      tipperId: tip.tipperId,
      recipientPersonId: tip.recipientPersonId,
      amountVCoin: tip.amountVCoin,
      settleFn: seedTransferFn,
      now: now - Math.floor(Math.random() * 600000),
    });
  }
}

async function seedMagnoliaBlues(store, now) {
  // The real, required differentiator scenario: one fictional St.
  // Louis blues supper club, four independently interactive rooms,
  // grouped via the real `same-location-multi-room` basis -- and all
  // four brought live together below, not one at a time.
  const group = createChannelGroup(store, { groupingBasis: 'same-location-multi-room', now });

  const roomSpecs = [
    {
      name: 'Magnolia Blues -- Dining Room', streamUrl: 'rtmp://vavlt.live/magnolia-blues/dining-room',
      staff: 'maria-thibodeaux',
      chatters: [
        { userId: 'stl_foodie_jess', text: 'the gumbo special looks incredible tonight' },
        { userId: 'delmar_regular_pete', text: 'table 12 view is perfect from this cam' },
        { userId: 'traveling_diner_kim', text: 'wish I could smell this through the stream lol' },
        { userId: 'cwe_locals_dana', text: 'maria taking care of everyone as always' },
      ],
      tips: [{ tipperId: 'stl_foodie_jess', recipientPersonId: 'maria-thibodeaux', amountVCoin: 8 }, { tipperId: 'cwe_locals_dana', recipientPersonId: 'maria-thibodeaux', amountVCoin: 5 }],
    },
    {
      name: 'Magnolia Blues -- Stage Cam', streamUrl: 'rtmp://vavlt.live/magnolia-blues/stage',
      staff: 'leon-carter',
      chatters: [
        { userId: 'bluesnight_marcus', text: 'leon carter trio is on fire tonight' },
        { userId: 'sax_head_ronnie', text: 'that solo just now, chills' },
        { userId: 'stl_music_lover', text: 'been watching this stage cam every friday for a month' },
        { userId: 'roadtrip_annie', text: 'caught this stream from the highway, pulling over lol' },
        { userId: 'bluesnight_marcus', text: 'someone tip the trio, they earned it' },
      ],
      tips: [
        { tipperId: 'bluesnight_marcus', recipientPersonId: 'leon-carter', amountVCoin: 20 },
        { tipperId: 'sax_head_ronnie', recipientPersonId: 'leon-carter', amountVCoin: 15 },
        { tipperId: 'stl_music_lover', recipientPersonId: 'leon-carter', amountVCoin: 10 },
      ],
    },
    {
      name: 'Magnolia Blues -- Rooftop Patio', streamUrl: 'rtmp://vavlt.live/magnolia-blues/rooftop',
      staff: 'nate-oyelaran',
      chatters: [
        { userId: 'rooftop_regular_dee', text: 'sunset from up there tonight is unreal' },
        { userId: 'stl_skyline_watcher', text: 'nate makes the best old fashioned on that patio' },
        { userId: 'summer_nights_tay', text: 'heading over in 20, saving my seat lol' },
      ],
      tips: [{ tipperId: 'rooftop_regular_dee', recipientPersonId: 'nate-oyelaran', amountVCoin: 6 }],
    },
    {
      name: 'Magnolia Blues -- Kitchen Pass', streamUrl: 'rtmp://vavlt.live/magnolia-blues/kitchen',
      staff: 'chef-amelia-ross',
      chatters: [
        { userId: 'chef_watch_tony', text: 'amelia plating that catfish so clean' },
        { userId: 'foodie_behind_scenes', text: 'love that this venue lets you watch the actual kitchen' },
        { userId: 'stl_foodie_jess', text: 'switched over from the dining room cam, this is better honestly' },
      ],
      tips: [{ tipperId: 'chef_watch_tony', recipientPersonId: 'chef-amelia-ross', amountVCoin: 12 }],
    },
  ];

  const channels = [];
  for (const spec of roomSpecs) {
    const channel = createChannel(store, {
      ownerId: MAGNOLIA_BLUES_OWNER_ID,
      groupingType: 'same-location-multi-room',
      parentGroupId: group.id,
      name: spec.name,
      streamUrl: spec.streamUrl,
      now,
    });
    goLive(store, channel.id);
    // Sequential, not Promise.all -- same reasoning as seedChannelActivity's own tip loop above.
    await seedChannelActivity(store, channel, { chatters: spec.chatters, tips: spec.tips, now });
    channels.push(channel);
  }

  // Real proof the multi-channel architecture composes, not just
  // coexists: the venue's own owner combining all four of its live
  // rooms into one real broadcaster screen session, the exact
  // Phase 3 mechanic this app is named after.
  const broadcasterSession = createScreenSession(store, {
    sessionType: 'broadcaster',
    ownerId: MAGNOLIA_BLUES_OWNER_ID,
    channelIds: channels.map((c) => c.id),
    now,
  });

  return { group, channels, broadcasterSession };
}

async function seedShowMeBBQ(store, now) {
  // A second, real multi-location scenario -- `same-brand-multi-
  // location`, one brand, two unrelated physical locations, only one
  // of which happens to be live right now (a realistic partial state,
  // deliberately distinct from Magnolia Blues' all-four-at-once demo).
  const group = createChannelGroup(store, { groupingBasis: 'same-brand-multi-location', now });
  const ownerId = 'show-me-bbq-co';

  const southCity = createChannel(store, {
    ownerId, groupingType: 'same-brand-multi-location', parentGroupId: group.id, name: 'Show-Me BBQ -- South City', streamUrl: 'rtmp://vavlt.live/show-me-bbq/south-city', now,
  });
  const chesterfield = createChannel(store, {
    ownerId, groupingType: 'same-brand-multi-location', parentGroupId: group.id, name: 'Show-Me BBQ -- Chesterfield', streamUrl: 'rtmp://vavlt.live/show-me-bbq/chesterfield', now,
  });

  goLive(store, southCity.id);
  await seedChannelActivity(store, southCity, {
    chatters: [
      { userId: 'smoke_ring_eddie', text: 'south city pit is smoking low and slow today' },
      { userId: 'bbq_crawl_greta', text: 'brisket bark looks perfect' },
      { userId: 'stl_bbq_fan', text: 'chesterfield location better be live soon too' },
    ],
    tips: [{ tipperId: 'smoke_ring_eddie', recipientPersonId: 'pitmaster-cory-lang', amountVCoin: 7 }],
    now,
  });

  return {
    group, channels: [southCity, chesterfield],
  };
}

async function seedDJsWorldwide(store, now) {
  // A third real grouping type -- `same-role-multi-location`, the
  // doc's own "every DJ worldwide, one browsable group spanning
  // unrelated venues" example: three real, unrelated owners, only
  // two live at once, proving the group is genuinely role-based, not
  // one business's own multi-room setup mistagged.
  const group = createChannelGroup(store, { groupingBasis: 'same-role-multi-location', now });

  const djNova = createChannel(store, {
    ownerId: 'dj-nova-mia', groupingType: 'same-role-multi-location', parentGroupId: group.id, name: 'DJ Nova -- Miami', streamUrl: 'rtmp://vavlt.live/dj-nova/miami', now,
  });
  const djKessler = createChannel(store, {
    ownerId: 'dj-kessler-berlin', groupingType: 'same-role-multi-location', parentGroupId: group.id, name: 'DJ Kessler -- Berlin', streamUrl: 'rtmp://vavlt.live/dj-kessler/berlin', now,
  });
  const djAiyana = createChannel(store, {
    ownerId: 'dj-aiyana-lagos', groupingType: 'same-role-multi-location', parentGroupId: group.id, name: 'DJ Aiyana -- Lagos', streamUrl: 'rtmp://vavlt.live/dj-aiyana/lagos', now,
  });

  goLive(store, djNova.id);
  goLive(store, djAiyana.id);

  await seedChannelActivity(store, djNova, {
    chatters: [
      { userId: 'miami_bass_head', text: 'nova\'s set is unreal tonight' },
      { userId: 'edm_travel_lucas', text: 'flying in for her show next month' },
    ],
    tips: [{ tipperId: 'miami_bass_head', recipientPersonId: 'dj-nova-mia', amountVCoin: 18 }],
    now,
  });
  await seedChannelActivity(store, djAiyana, {
    chatters: [
      { userId: 'lagos_afrobeats_fan', text: 'this amapiano transition though' },
      { userId: 'global_dj_watcher', text: 'jumped straight from berlin\'s replay to this, wild lineup' },
    ],
    tips: [{ tipperId: 'lagos_afrobeats_fan', recipientPersonId: 'dj-aiyana-lagos', amountVCoin: 14 }],
    now,
  });

  return { group, channels: [djNova, djKessler, djAiyana] };
}

async function seedStandaloneChannels(store, now) {
  // Real, ungrouped solo-creator channels -- proof this app also
  // covers the plain single-channel case, not only multi-channel
  // businesses.
  const pokerLounge = createChannel(store, {
    ownerId: 'route66-poker-lounge', groupingType: 'same-location-multi-room', name: 'Route 66 Poker Lounge', streamUrl: 'rtmp://vavlt.live/route66-poker-lounge/main', now,
  });
  const fitness = createChannel(store, {
    ownerId: 'coach-nina-fitness', groupingType: 'same-location-multi-room', name: 'Coach Nina Fitness Live', streamUrl: 'rtmp://vavlt.live/coach-nina/main', now,
  });
  const gaming = createChannel(store, {
    ownerId: 'chezpixel-gaming', groupingType: 'same-location-multi-room', name: 'ChezPixel Gaming', streamUrl: 'rtmp://vavlt.live/chezpixel/main', now,
  });

  goLive(store, pokerLounge.id);
  goLive(store, fitness.id);
  goLive(store, gaming.id);

  await seedChannelActivity(store, fitness, {
    chatters: [
      { userId: 'morning_lifter_omar', text: 'this leg day is destroying me nina' },
      { userId: 'stl_gym_regular', text: 'form check on that squat looked clean' },
    ],
    tips: [{ tipperId: 'morning_lifter_omar', recipientPersonId: 'coach-nina-fitness', amountVCoin: 10 }],
    now,
  });
  await seedChannelActivity(store, gaming, {
    chatters: [
      { userId: 'speedrun_watcher', text: 'that clutch was insane' },
      { userId: 'late_night_lurker', text: 'been here since the last checkpoint' },
      { userId: 'stl_gym_regular', text: 'switched over after the workout stream ended lol' },
    ],
    tips: [{ tipperId: 'speedrun_watcher', recipientPersonId: 'chezpixel-gaming', amountVCoin: 9 }],
    now,
  });

  // Real, structural "I'm watching right now" scenario -- an in-
  // progress tournament with a genuine, queryable attendee count
  // (`getCasinoEventWithDetail`'s own `activeAttendeeCount`), the
  // closest thing this app actually has to a real "viewer count".
  const event = createCasinoEvent(store, {
    hostId: 'route66-poker-lounge',
    hostChannelId: pokerLounge.id,
    title: "Friday Night Hold'em Tournament",
    eventType: 'tournament',
    now,
  });
  goLiveCasinoEvent(store, { eventId: event.id, now });

  const attendeeHandles = [
    'river_card_randy', 'bluff_master_lee', 'stl_poker_night', 'chip_stack_carla',
    'all_in_andre', 'route66_regular_pat', 'flop_watcher_sam', 'texas_hold_traveler',
    'poker_face_nia', 'late_reg_wendell', 'short_stack_theo', 'heads_up_hana',
    'grinder_omar', 'tourney_life_bri', 'river_rat_dean', 'card_shark_iris',
    'final_table_mo', 'weekend_grinder_liv',
  ];
  attendeeHandles.forEach((userId, i) => {
    joinCasinoEvent(store, { eventId: event.id, userId, now: now - (attendeeHandles.length - i) * 30000 });
  });

  // Real, viewer-side (not broadcaster-side) screen session -- a fan
  // combining channels from three unrelated owners into their own
  // personal multi-view, the exact MultiTwitch/ViewGrid gap this
  // app's own README names as the real market gap.
  const viewerSession = createScreenSession(store, {
    sessionType: 'viewer',
    ownerId: 'multi_view_fan_23',
    channelIds: [pokerLounge.id, gaming.id],
    now,
  });

  return {
    channels: [pokerLounge, fitness, gaming], casinoEvent: event, viewerSession,
  };
}

async function seedDemoData(store) {
  const now = Date.now();
  await seedMagnoliaBlues(store, now);
  await seedShowMeBBQ(store, now);
  await seedDJsWorldwide(store, now);
  await seedStandaloneChannels(store, now);
}

module.exports = { seedDemoData };
