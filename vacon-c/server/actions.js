// server/actions.js
//
// The player action dispatcher — `POST /api/players/:id/action`.
//
// ---------------------------------------------------------------------
// **Why this exists now and did not before.**
//
// server.js has carried this note since the Phase 3 routing pass:
//
//   > POST /api/players/:id/action is a "generic action dispatcher"
//   > with no specification of what actions exist. Guessing at that
//   > would invent game design, not expose it.
//
// That was correct when it was written and is obsolete now. Nothing
// about the map changed — the engine did. It has since grown a set of
// concrete verbs that a person can actually perform, each already
// built, already tested, and each with rules of its own:
//
//   accept a mission · resolve a mission · take up a routine ·
//   pick up a habit · enter a contest · resolve one of the seven Keys
//
// So this file invents no game design. It is a registry over verbs that
// already exist, which is exactly what the map asks for: "routes to the
// right Key/decision".
//
// ---------------------------------------------------------------------
// **The one property that matters: a player acts as themselves.**
//
// Every action below is performed by `player.linked_entity_id`, taken
// from the player record. The actor is NEVER read from the request
// body, and that is not a stylistic preference — the mission state
// machine enforces "only the holder can resolve a mission, because
// otherwise somebody finishes another player's mission and collects for
// it", and a dispatcher that forwarded a caller-supplied `entityId`
// would hand that check its own bypass. Anything an action needs beyond
// the actor comes from the body; the actor does not.
//
// A body that names an `entityId` is REFUSED rather than ignored.
// Silently dropping it would let a caller believe they had acted as
// somebody else and had it work.
//
// ---------------------------------------------------------------------
// **This dispatches. It does not decide — and it requires nothing.**
//
// Note the absence of imports below. The first version of this file
// required `missions.js`, `behavior.js` and `contest.js` directly, and
// that was wrong in a way that only showed up when a completed mission
// paid nothing: `engine.js#resolveMission` supplies a `payReward`
// callback that the raw `missions.resolveMission` has no way to know
// about, so calling the lower layer silently skipped the money.
//
// A dispatcher reaching past the bound layer is how it grows a second,
// disagreeing copy of the rules — which this header warned about while
// the file did it. So the verbs are INJECTED by engine.js, and
// `assertVerbsPresent()` refuses a set that is missing any of them
// rather than failing later on whichever single action nobody tried.

'use strict';

const justice = require('./justice.js');

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------
// Data, not a switch. Each action names the modes it is available in,
// the parameters it requires, and the one call it makes.
//
// `modes` is here because Leader and Simulation modes were deferred by
// CLAUDE.md, not because they were unimplemented details: an action
// list that silently offered a Leader verb would have advertised a
// mode nobody could enter. Leader mode reopened the scope by explicit
// instruction (see `leadership.js`'s own header) — every existing verb
// below now lists `'leader'` too, because a leader is still a person
// who can accept missions, hold meetings, adopt a routine and so on;
// `direct-mission` and `broadcast-message` are the two genuinely new
// verbs Leader mode adds, and they list `'leader'` alone, for the same
// reason this comment gave before: a citizen has no subordinates to
// direct and no outlet to broadcast through. Simulation mode is still
// deferred and still untouched.
const ACTIONS = {
  'accept-mission': {
    summary: 'Take on an available mission.',
    modes: ['citizen', 'leader'],
    requires: ['missionId'],
    verbs: ['acceptMission'],
    run: (verbs, actorId, body) => ({
      mission: verbs.acceptMission(body.missionId, actorId),
      paid: null,
    }),
  },

  'resolve-mission': {
    summary: 'Complete, fail or abandon a mission you are holding.',
    modes: ['citizen', 'leader'],
    requires: ['missionId', 'outcome'],
    verbs: ['resolveMission'],
    run: (verbs, actorId, body) => verbs.resolveMission(body.missionId, {
      outcome: body.outcome,
      // The actor, from the player record. The state machine refuses a
      // mission held by somebody else, and this is what lets it.
      entityId: actorId,
      note: body.note,
    }),
  },

  'adopt-routine': {
    summary: 'Add a recurring event to your own schedule.',
    modes: ['citizen', 'leader'],
    requires: ['eventType', 'frequency'],
    verbs: ['addScheduleEvent'],
    run: (verbs, actorId, body) => verbs.addScheduleEvent(actorId, {
      eventType: body.eventType,
      frequency: body.frequency,
      timeSlot: body.timeSlot,
      locationPropertyId: body.locationPropertyId ?? null,
    }),
  },

  'practise-habit': {
    summary: 'Reinforce a habit of your own, for better or worse.',
    modes: ['citizen', 'leader'],
    requires: ['name'],
    verbs: ['reinforceHabit'],
    run: (verbs, actorId, body) => verbs.reinforceHabit(actorId, body.name, {
      harmful: body.harmful,
      amount: body.amount,
      locationPropertyId: body.locationPropertyId ?? null,
    }),
  },

  // **Sitting down with people.** The spec's NPC vocabulary names
  // `negotiate` three separate times and `teach`, `recruit` and `form
  // alliance` once each, and none of the four had a home anywhere in
  // the engine — five verbs about two or more people doing something
  // together, in a simulation whose entire subject is people.
  //
  // `attendeeIds` is a list of OTHER people, and the actor is added to
  // it by the dispatcher rather than being nameable. It is not in
  // `ACTOR_FIELDS` because it does not claim to be the actor — but a
  // player who could omit themselves from their own meeting would be
  // arranging one between other people and calling it theirs, which is
  // the same mistake `enter-contest` refuses.
  'call-meeting': {
    summary: 'Sit down with people you know — to plan, negotiate, teach or recruit.',
    modes: ['citizen', 'leader'],
    requires: ['attendeeIds'],
    verbs: ['holdMeeting'],
    run: (verbs, actorId, body) => verbs.holdMeeting(actorId, {
      attendeeIds: (Array.isArray(body.attendeeIds) ? body.attendeeIds : [body.attendeeIds])
        .map(Number),
      purpose: body.purpose,
      topic: body.topic ?? null,
    }),
  },

  // **§22 Communication's own missing half.** A meeting needs everyone
  // in the same room; this reaches one named person wherever they
  // actually are, through `media.js`'s real letter/telephone channels
  // — refused rather than silently falling back to a meeting's shape
  // when a world has climbed to neither era yet.
  'send-message': {
    summary: 'Tell one specific person something you know — by letter or by phone, however far away they are.',
    modes: ['citizen', 'leader'],
    requires: ['toEntityId'],
    verbs: ['sendMessage'],
    run: (verbs, actorId, body) => verbs.sendMessage(actorId, {
      toEntityId: Number(body.toEntityId),
      subjectEntityId: body.subjectEntityId ?? null,
    }),
  },

  // **A building's past does not fix its future.** Take the Arch and
  // make it a fortress. Only an owner may — which is what gives the
  // takeover key a consequence beyond a line in the history.
  'repurpose-property': {
    summary: 'Change what a building you hold is for. Its history stays with it.',
    modes: ['citizen', 'leader'],
    requires: ['propertyId', 'toType'],
    verbs: ['repurposeProperty'],
    run: (verbs, actorId, body) => verbs.repurposeProperty(actorId, {
      propertyId: Number(body.propertyId),
      toType: body.toType,
      note: body.note ?? null,
    }),
  },

  // **The takeover key, as two verbs rather than one.**
  // `COMPOSITION_REQUIREMENTS_TRIBE_COHESION.md` splits the shapes the
  // same way: `ControlKeyComposition` is what a target requires and
  // `TakeoverAttemptResolution` is what happened. A player has to be
  // able to look before they leap — "a Tribe can meet every technical
  // requirement and still fail" is only a meaningful risk if they can
  // see the requirement first.
  'assess-takeover': {
    summary: 'See what it would take for your tribe to hold a place, and your odds -- '
      + 'optionally pooling in allied tribes.',
    modes: ['citizen', 'leader'],
    requires: ['scale', 'locationId'],
    verbs: ['assessTakeover'],
    // Task #143. `allyTribeIds` is optional and is the one real
    // exception to "the tribe is not a parameter" below it: an ally is
    // somebody else's tribe by definition, so naming one here names a
    // tribe other than the actor's own. `control.coalitionAllies` is
    // the real gate on whether naming one does anything at all.
    run: (verbs, actorId, body) => ({
      resolution: verbs.assessTakeover(actorId, {
        scale: body.scale, locationId: Number(body.locationId),
        allyTribeIds: Array.isArray(body.allyTribeIds)
          ? body.allyTribeIds.map(Number) : undefined,
      }),
    }),
  },

  'attempt-takeover': {
    summary: 'Try to take control of a place, with your tribe behind you -- '
      + 'optionally pooling in allied tribes.',
    modes: ['citizen', 'leader'],
    requires: ['scale', 'locationId'],
    verbs: ['attemptTakeover'],
    // The tribe is NOT a parameter. `engine.tribeIdFor` reads it off
    // the actor's family membership, for the same reason the actor is
    // never a parameter: a player acts as themselves, and that means
    // for their own family. `allyTribeIds` (task #143) is the real
    // exception, same reasoning as `assess-takeover` above.
    run: (verbs, actorId, body) => verbs.attemptTakeover(actorId, {
      scale: body.scale, locationId: Number(body.locationId),
      allyTribeIds: Array.isArray(body.allyTribeIds)
        ? body.allyTribeIds.map(Number) : undefined,
    }),
  },

  'build-barricade': {
    summary: 'Fortify a block your own faction holds — a real, bounded nudge toward "fortified," not an instant win.',
    modes: ['citizen', 'leader'],
    requires: ['blockId'],
    verbs: ['buildBarricade'],
    run: (verbs, actorId, body) => verbs.buildBarricade(actorId, {
      blockId: Number(body.blockId),
    }),
  },

  // Task #97 — the same `{scale, locationId}` pair `assess-takeover`
  // already requires, kept on a list. The requirements card itself is
  // never in the body here: `GET /api/players/:id/saved-locations`
  // computes it live, same shape as `survival-status`/`tutorial-progress`.
  'save-location': {
    summary: 'Bookmark a place, by scale and id, to watch its takeover-key requirements over time.',
    modes: ['citizen', 'leader'],
    requires: ['scale', 'locationId'],
    verbs: ['saveLocation'],
    run: (verbs, actorId, body) => verbs.saveLocation(actorId, {
      scale: body.scale, locationId: Number(body.locationId),
    }),
  },

  'unsave-location': {
    summary: 'Remove one of your own bookmarked locations.',
    modes: ['citizen', 'leader'],
    requires: ['savedLocationId'],
    verbs: ['unsaveLocation'],
    run: (verbs, actorId, body) => verbs.unsaveLocation(actorId, Number(body.savedLocationId)),
  },

  // **Salvage, as three verbs.** `server/salvage.js` is the one system
  // in the engine a player is meant to touch constantly rather than at
  // a turning point — you take things apart and make things all day —
  // so all three are plain and none of them takes an actor.
  //
  // Note which way round the refusals go. `make` and `break-down` throw
  // when they cannot proceed, because the player asked for a specific
  // thing; `can-make` is the one that answers "no" without throwing,
  // and it is separate for the same reason `assess-takeover` is
  // separate from `attempt-takeover` — a player has to be able to look
  // before they spend what they are carrying.
  'break-down': {
    summary: 'Take something you carry apart for what it is made of.',
    modes: ['citizen', 'leader'],
    requires: ['itemName'],
    verbs: ['breakDownItem'],
    run: (verbs, actorId, body) => verbs.breakDownItem(actorId, {
      itemName: body.itemName,
      quantity: body.quantity === undefined ? 1 : Number(body.quantity),
    }),
  },

  'strip-building': {
    summary: 'Strip an empty building for materials. It will not survive many visits. A locked one must be forced.',
    modes: ['citizen', 'leader'],
    requires: ['propertyId'],
    verbs: ['stripBuilding'],
    run: (verbs, actorId, body) => verbs.stripBuilding(actorId, {
      propertyId: Number(body.propertyId),
      force: body.force === true,
    }),
  },

  'lock-property': {
    summary: 'Lock a real property you occupy, staff, or own.',
    modes: ['citizen', 'leader'],
    requires: ['propertyId'],
    verbs: ['lockProperty'],
    run: (verbs, actorId, body) => verbs.lockProperty(actorId, { propertyId: Number(body.propertyId) }),
  },

  'unlock-property': {
    summary: 'Unlock a real property you occupy, staff, or own.',
    modes: ['citizen', 'leader'],
    requires: ['propertyId'],
    verbs: ['unlockProperty'],
    run: (verbs, actorId, body) => verbs.unlockProperty(actorId, { propertyId: Number(body.propertyId) }),
  },

  // **Searching a landmark for what is in it.** The other half of
  // `strip-building`: salvage takes a building apart for what it is
  // MADE of, this carries out what it HELD. A library is worth
  // searching and worth nothing to a scrapper.
  'search-location': {
    summary: 'Search a landmark for what is still inside it.',
    modes: ['citizen', 'leader'],
    requires: ['propertyId'],
    verbs: ['searchLocation'],
    run: (verbs, actorId, body) => verbs.searchLocation(actorId, {
      propertyId: Number(body.propertyId),
    }),
  },

  // **`weapons.js`'s manufacturing gate, the player-facing half.** Real
  // business employment as `MANUFACTURING_OCCUPATION`, a real era
  // reached, one real bounded batch — see that file's own header for
  // why ammunition does not craft through `make-thing`'s ordinary loop.
  'manufacture-ammunition': {
    summary: 'Produce a bounded batch of ammunition, if you work at a real manufacturing business and the world has reached the industrial era.',
    modes: ['citizen', 'leader'],
    requires: ['ammoName'],
    verbs: ['manufactureAmmunition'],
    run: (verbs, actorId, body) => verbs.manufactureAmmunition(actorId, { ammoName: body.ammoName }),
  },

  // **`contacts.js#findOrCreateContact`'s player-facing half.** Real
  // existing friends/classmates/associates/family are searched first;
  // a new one is only ever generated when none qualifies — see that
  // file's own header for the worked example this closes (a cousin
  // outside the player's home city standing in for a real distribution
  // contact) and why "outside home region" is honestly scoped to the
  // CITY, the one geography grain this engine actually generates more
  // than one of.
  // **`bluff.js`'s three real verbs** — see that file's own header for
  // why `assess-threat` never reveals the real `isFunctioningFirearm`
  // ground truth and why `call-bluff` has two deterministic, real
  // branches rather than a second invented draw.
  intimidate: {
    summary: 'Brandish the firearm you have equipped, real or empty, to make someone afraid of you.',
    modes: ['citizen', 'leader'],
    requires: ['targetId'],
    verbs: ['intimidate'],
    run: (verbs, actorId, body) => verbs.intimidate(actorId, { targetId: Number(body.targetId) }),
  },

  'assess-threat': {
    summary: 'Check how afraid you currently are of someone, without finding out whether their threat is real.',
    modes: ['citizen', 'leader'],
    requires: ['targetId'],
    verbs: ['assessThreat'],
    run: (verbs, actorId, body) => verbs.assessThreat(actorId, { targetId: Number(body.targetId) }),
  },

  'call-bluff': {
    summary: 'Challenge someone\'s threat for real. If they are actually armed, this goes badly; if not, their standing with you falls.',
    modes: ['citizen', 'leader'],
    requires: ['targetId'],
    verbs: ['callBluff'],
    run: (verbs, actorId, body) => verbs.callBluff(actorId, { targetId: Number(body.targetId) }),
  },

  'ask-around': {
    summary: 'Ask around your own neighbourhood for whatever anybody there really knows about someone -- the most confident real rumor among your neighbours, or nothing at all if nobody does.',
    modes: ['citizen', 'leader'],
    requires: ['subjectEntityId'],
    verbs: ['askAround'],
    run: (verbs, actorId, body) => verbs.askAround(actorId, { subjectEntityId: Number(body.subjectEntityId) }),
  },

  'find-contact': {
    summary: 'Find a real friend, classmate, associate or family member matching what you need -- or, failing that, meet somebody new who fits.',
    modes: ['citizen', 'leader'],
    requires: [],
    verbs: ['findOrCreateContact'],
    run: (verbs, actorId, body) => verbs.findOrCreateContact(actorId, {
      relationshipTypes: body.relationshipTypes,
      outsideHomeCity: !!body.outsideHomeCity,
    }),
  },

  'make-thing': {
    summary: 'Make something from the materials you carry.',
    modes: ['citizen', 'leader'],
    requires: ['product'],
    verbs: ['makeThing', 'canMakeThing'],
    run: (verbs, actorId, body) => (
      body.check === true
        ? { check: verbs.canMakeThing(actorId, { product: body.product }) }
        : verbs.makeThing(actorId, { product: body.product })
    ),
  },

  // Task #133's real gap: `produce.harvest` had no player-facing verb
  // at all — `canMakeThing`'s own check-flag shape immediately above,
  // for the other half of "producible" (land/water/animal rather than
  // held materials).
  harvest: {
    summary: 'Grow, raise, catch or gather a real primary-produce item where you already are.',
    modes: ['citizen', 'leader'],
    requires: ['name'],
    verbs: ['harvest', 'canHarvest'],
    run: (verbs, actorId, body) => (
      body.check === true
        ? { check: verbs.canHarvest(actorId, { name: body.name }) }
        : verbs.harvest(actorId, { name: body.name })
    ),
  },

  // **§24, the player-facing half.** `knowledge.study()` has moved real
  // traits — the field's skill, Literacy, Self-Taught Aptitude — since
  // the file that built it, and nothing ever let a player trigger it.
  // `source`/`field` name one of `knowledge.sourcesFor`'s own real
  // candidates (a book you carry, a library in your city, somebody
  // nearby who holds a trade) — validated against what this entity can
  // actually reach right now, same posture `generateMission` already
  // holds for an artifact or location: never trust a caller-declared
  // pair, confirm it against real state first.
  study: {
    summary: 'Study from a book you carry, a place in your city, or somebody nearby.',
    modes: ['citizen', 'leader'],
    requires: ['source', 'field'],
    verbs: ['studySource'],
    run: (verbs, actorId, body) => verbs.studySource(actorId, {
      source: body.source, field: body.field, teacherId: body.teacherId ?? null,
    }),
  },

  // **§26/§27/§28, the player-facing half.** `barter.exchange` moves
  // real value and a real held object between two entities and has
  // been reachable by nobody since it was written — no route, no
  // verb, `study`'s own gap one file over. `check` is the same
  // look-before-you-spend flag `make-thing` already carries: a quote
  // (`quoteTrade`/`barter.agreedPrice`) costs nothing, a trade
  // (`tradeWith`/`barter.exchange`) can fail for real reasons
  // (savings, what the seller actually holds) and returns why.
  trade: {
    summary: 'Trade with somebody nearby for what they hold — or check the price first.',
    modes: ['citizen', 'leader'],
    requires: ['sellerId', 'itemName'],
    verbs: ['tradeWith', 'quoteTrade'],
    run: (verbs, actorId, body) => (
      body.check === true
        ? {
          quote: verbs.quoteTrade(actorId, {
            sellerId: body.sellerId, itemName: body.itemName, quantity: body.quantity,
          }),
        }
        : verbs.tradeWith(actorId, {
          sellerId: body.sellerId, itemName: body.itemName, quantity: body.quantity,
        })
    ),
  },

  // **`investments` — genuinely unbuilt rather than deferred until
  // this.** Real money the actor already holds, moved into a named
  // target's own capital. `category` is the schema's own enum
  // (`investments.js.CATEGORIES`); an organization target grows its
  // real `assets` and starts paying a real, bounded dividend back
  // each tick, proportional to the actor's own stake.
  invest: {
    summary: 'Put money you hold into a business, a person\'s education, or another real target.',
    modes: ['citizen', 'leader'],
    requires: ['targetEntityId', 'category', 'amount'],
    verbs: ['investInTarget'],
    run: (verbs, actorId, body) => verbs.investInTarget(actorId, {
      targetEntityId: body.targetEntityId, category: body.category, amount: body.amount,
    }),
  },

  'enter-contest': {
    summary: 'Compete against a named opponent.',
    modes: ['citizen', 'leader'],
    requires: ['opponentId'],
    verbs: ['resolveContest'],
    run: (verbs, actorId, body) => verbs.resolveContest({
      // The actor is always a participant. A player cannot enter a
      // contest between two other people and have it count as theirs.
      participantIds: [actorId, Number(body.opponentId)],
      discipline: body.discipline,
      contestId: body.contestId ?? null,
    }),
  },

  'found-business': {
    summary: 'Found a real business -- real startup capital moved from your own real savings, '
      + 'your own first real job at it, quitting any existing job to do it.',
    modes: ['citizen', 'leader'],
    requires: ['name'],
    verbs: ['foundBusiness'],
    run: (verbs, actorId, body) => verbs.foundBusiness(actorId, { name: body.name }),
  },

  'produce-marijuana': {
    summary: 'Grow and harvest a real batch of marijuana -- real gang membership required, no cartel '
      + 'connection needed.',
    modes: ['citizen', 'leader'],
    requires: [],
    verbs: ['produceMarijuana'],
    run: (verbs, actorId) => verbs.produceMarijuana(actorId),
  },

  'convert-crack': {
    summary: 'Convert your real held cocaine into crack cocaine -- a domestic conversion, no cartel '
      + 'connection needed.',
    modes: ['citizen', 'leader'],
    requires: [],
    verbs: ['convertCrack'],
    run: (verbs, actorId) => verbs.convertCrack(actorId),
  },

  'import-substance': {
    summary: "Import a real cartel-sourced substance -- requires your own real organization's earned "
      + 'cartel connection.',
    modes: ['citizen', 'leader'],
    requires: ['substanceName'],
    verbs: ['importSubstance'],
    run: (verbs, actorId, body) => verbs.importSubstance(actorId, body.substanceName),
  },

  'deal-drugs': {
    summary: 'Deal a real held substance on the street right now -- real gang soldier/associate tier '
      + 'required, rather than waiting on the random per-tick sweep.',
    modes: ['citizen', 'leader'],
    requires: ['itemName'],
    verbs: ['dealDrugs'],
    run: (verbs, actorId, body) => verbs.dealDrugs(actorId, { itemName: body.itemName, quantity: body.quantity }),
  },

  'demand-tribute': {
    summary: 'Demand tribute from a real, specific business your own organization genuinely holds '
      + 'ground over -- right now, rather than waiting on the random per-tick sweep.',
    modes: ['citizen', 'leader'],
    requires: ['factionOrganizationId', 'targetOrganizationId'],
    verbs: ['demandTribute'],
    run: (verbs, actorId, body) => verbs.demandTribute(actorId, {
      factionOrganizationId: Number(body.factionOrganizationId),
      targetOrganizationId: Number(body.targetOrganizationId),
    }),
  },

  'apply-hold': {
    summary: 'Apply a real choke, knee-on-neck, or arm hold to a named opponent -- a live, '
      + 'round-by-round pressure bar (contest.resolveHold), not an instant result.',
    modes: ['citizen', 'leader'],
    requires: ['victimId', 'technique'],
    verbs: ['applyHold'],
    run: (verbs, actorId, body) => verbs.applyHold(actorId, {
      victimId: Number(body.victimId),
      technique: body.technique,
      contestId: body.contestId ?? null,
    }),
  },

  // -- Leader mode's two genuinely new verbs — see leadership.js's own
  // header for the full design and why each one is NOT guaranteed to
  // succeed just because the actor holds the seat.

  'direct-mission': {
    // `organizationId` is deliberately not in `requires` any more --
    // leadership.js's own organization-free path (influence.js) needs
    // none. Omitted here means omitted there; this dispatcher still
    // decides nothing, it only stops forcing a `Number(undefined)`
    // (NaN) through where leadership.js wants a real `null`.
    summary: 'Order a subordinate onto a real mission -- your own organization\'s real member, or anyone you hold real influence over.',
    modes: ['leader'],
    requires: ['subordinateEntityId'],
    verbs: ['directMission'],
    run: (verbs, actorId, body) => verbs.directMission(actorId, {
      organizationId: body.organizationId != null ? Number(body.organizationId) : null,
      subordinateEntityId: Number(body.subordinateEntityId),
      objective: body.objective ?? null,
      reward: body.reward ?? null,
      artifactId: body.artifactId != null ? Number(body.artifactId) : null,
      locationId: body.locationId != null ? Number(body.locationId) : null,
    }),
  },

  'assign-role': {
    summary: 'Assign one of your own real people -- an organization member or a family member '
      + 'you head -- to a real, named task rather than a mission.',
    modes: ['citizen', 'leader'],
    requires: ['subordinateEntityId', 'role'],
    verbs: ['assignRole'],
    run: (verbs, actorId, body) => verbs.assignRole(actorId, {
      organizationId: body.organizationId != null ? Number(body.organizationId) : null,
      familyId: body.familyId != null ? Number(body.familyId) : null,
      subordinateEntityId: Number(body.subordinateEntityId),
      role: body.role,
    }),
  },

  'reveal-cache': {
    summary: 'Open a real hidden cache you hold the real key to, really have an architect\'s own '
      + 'knowledge to find, or have genuinely heard about by word of mouth.',
    modes: ['citizen', 'leader'],
    requires: ['cacheId'],
    verbs: ['revealCache'],
    run: (verbs, actorId, body) => verbs.revealCache(actorId, { cacheId: Number(body.cacheId) }),
  },

  'designate-stash-house': {
    summary: 'Mark a real property your own real people actually hold as your organization\'s '
      + 'or family\'s stash house.',
    modes: ['citizen', 'leader'],
    requires: ['propertyId'],
    verbs: ['designateStashHouse'],
    run: (verbs, actorId, body) => verbs.designateStashHouse(actorId, {
      propertyId: Number(body.propertyId),
      organizationId: body.organizationId != null ? Number(body.organizationId) : null,
      familyId: body.familyId != null ? Number(body.familyId) : null,
    }),
  },

  'attempt-heist': {
    summary: 'Send a real crew (2-4 of your own people matter most) to rob a real organization\'s '
      + 'own real assets.',
    modes: ['citizen', 'leader'],
    requires: ['crewEntityIds', 'targetOrganizationId'],
    verbs: ['attemptHeist'],
    run: (verbs, actorId, body) => verbs.attemptHeist(actorId, {
      organizationId: body.organizationId != null ? Number(body.organizationId) : null,
      familyId: body.familyId != null ? Number(body.familyId) : null,
      crewEntityIds: Array.isArray(body.crewEntityIds) ? body.crewEntityIds.map(Number) : [],
      targetOrganizationId: Number(body.targetOrganizationId),
    }),
  },

  'assemble-party': {
    summary: 'Gather real members of your organization or family into a standing escort that '
      + 'travels with you until released -- each complies or refuses on their own real loyalty.',
    modes: ['citizen', 'leader'],
    requires: ['memberEntityIds'],
    verbs: ['assembleParty'],
    run: (verbs, actorId, body) => verbs.assembleParty(actorId, {
      organizationId: body.organizationId != null ? Number(body.organizationId) : null,
      familyId: body.familyId != null ? Number(body.familyId) : null,
      memberEntityIds: Array.isArray(body.memberEntityIds) ? body.memberEntityIds.map(Number) : [],
    }),
  },

  'release-from-party': {
    summary: 'Release a real member of your own standing escort.',
    modes: ['citizen', 'leader'],
    requires: ['memberEntityId'],
    verbs: ['releaseFromParty'],
    run: (verbs, actorId, body) => verbs.releaseFromParty(actorId, Number(body.memberEntityId)),
  },

  'assign-party-role': {
    summary: 'Give a real member of your own standing escort a role -- '
      + 'routes through the same real leadership.assignRole an ordinary org/family member gets.',
    modes: ['citizen', 'leader'],
    requires: ['memberEntityId', 'role'],
    verbs: ['assignPartyRole'],
    run: (verbs, actorId, body) => verbs.assignPartyRole(
      actorId, Number(body.memberEntityId), body.role,
    ),
  },

  'apply-recommended-split': {
    summary: 'Assign each real member of your own party the real tactical approach type the AI '
      + 'advisor (GET /api/entities/:id/recommend-split) recommended for them -- routes through '
      + 'the real party.assignPartyRole/leadership.assignRole chain, one real compliance draw per person.',
    modes: ['citizen', 'leader'],
    requires: ['groups'],
    verbs: ['applyRecommendedSplit'],
    run: (verbs, actorId, body) => verbs.applyRecommendedSplit(actorId, { groups: body.groups }),
  },

  'guess-fugitive-location': {
    summary: 'Guess where a real at-large fugitive is right now -- correct catches them through the '
      + 'real justice.js chain; wrong gives them one real, bounded chance to run again. '
      + 'See GET /api/fugitives and GET /api/fugitives/:incidentId/clue.',
    modes: ['citizen', 'leader'],
    requires: ['incidentId', 'communityId'],
    verbs: ['guessFugitiveLocation'],
    run: (verbs, actorId, body) => verbs.guessFugitiveLocation(
      actorId, Number(body.incidentId), Number(body.communityId),
    ),
  },

  'guess-missing-relation-location': {
    summary: 'Guess where a real family member or contact you have lost touch with is right now -- '
      + 'no justice consequence either way; a wrong guess costs nothing and never relocates them. '
      + 'See GET /api/entities/:id/missing-relations.',
    modes: ['citizen', 'leader'],
    requires: ['targetEntityId', 'communityId'],
    verbs: ['guessMissingRelationLocation'],
    run: (verbs, actorId, body) => verbs.guessMissingRelationLocation(
      actorId, Number(body.targetEntityId), Number(body.communityId),
    ),
  },

  // **`fugitives.js`'s own "Party integration" half** -- cover as many
  // real candidate communities as you have real people (yourself plus
  // your real party, `party.partyOf`) to send, in one real attempt,
  // rather than guessing one at a time. One real correctness check and
  // at most one real flight draw either way -- see that file's own
  // header for why N guesses never means N independent flight rolls.
  'guess-fugitive-location-with-party': {
    summary: 'Cover several real candidate communities at once for a real at-large fugitive, one real '
      + 'person per place (yourself plus your real party) -- correct catches them through the real '
      + 'justice.js chain; wrong gives them one real, bounded chance to run again.',
    modes: ['citizen', 'leader'],
    requires: ['incidentId', 'communityIds'],
    verbs: ['guessFugitiveLocationWithParty'],
    run: (verbs, actorId, body) => verbs.guessFugitiveLocationWithParty(
      actorId, Number(body.incidentId),
      Array.isArray(body.communityIds) ? body.communityIds.map(Number) : [],
    ),
  },

  'guess-missing-relation-location-with-party': {
    summary: 'Cover several real candidate communities at once for a real family member or contact you '
      + 'have lost touch with, one real person per place (yourself plus your real party) -- no justice '
      + 'consequence either way.',
    modes: ['citizen', 'leader'],
    requires: ['targetEntityId', 'communityIds'],
    verbs: ['guessMissingRelationLocationWithParty'],
    run: (verbs, actorId, body) => verbs.guessMissingRelationLocationWithParty(
      actorId, Number(body.targetEntityId),
      Array.isArray(body.communityIds) ? body.communityIds.map(Number) : [],
    ),
  },

  'send-spy': {
    summary: 'Send a real member of your organization or family to listen, infiltrate or watch a '
      + 'real community -- a range (close/mid/far), a stance (low_profile/close_watch/'
      + 'deep_infiltration), and optionally a specific organization to infiltrate.',
    modes: ['citizen', 'leader'],
    requires: ['spyEntityId', 'targetCommunityId'],
    verbs: ['sendSpy'],
    run: (verbs, actorId, body) => verbs.sendSpy(actorId, {
      organizationId: body.organizationId != null ? Number(body.organizationId) : null,
      familyId: body.familyId != null ? Number(body.familyId) : null,
      spyEntityId: Number(body.spyEntityId),
      targetCommunityId: Number(body.targetCommunityId),
      targetOrganizationId: body.targetOrganizationId != null ? Number(body.targetOrganizationId) : null,
      range: body.range ?? 'mid',
      stance: body.stance ?? 'close_watch',
    }),
  },

  'broadcast-message': {
    summary: 'Put a real fact in front of your own outlet\'s audience.',
    modes: ['leader'],
    requires: ['organizationId', 'factContent'],
    verbs: ['broadcastMessage'],
    run: (verbs, actorId, body) => verbs.broadcastMessage(actorId, {
      organizationId: Number(body.organizationId),
      factContent: body.factContent,
      factType: body.factType ?? 'known',
      subjectEntityId: body.subjectEntityId != null ? Number(body.subjectEntityId) : null,
      communityId: body.communityId != null ? Number(body.communityId) : null,
      cityId: body.cityId != null ? Number(body.cityId) : null,
      channel: body.channel ?? null,
    }),
  },

  // Tasks #184/#225: a real leader draws a named, reusable coordinated
  // play -- who defends which real property, how aggressively, to
  // what end -- then runs it. See plays.js's own header.
  'draw-play': {
    summary: 'Draw up a named, reusable play: real subordinates assigned to real positions, each with '
      + 'an aggression level (light/medium/aggressive) and an intent (education/defense/offense). '
      + 'How many positions a play can hold scales with your own real influence.',
    modes: ['leader'],
    requires: ['name', 'assignments'],
    verbs: ['drawPlay'],
    run: (verbs, actorId, body) => verbs.drawPlay(actorId, {
      name: body.name,
      organizationId: body.organizationId != null ? Number(body.organizationId) : null,
      familyId: body.familyId != null ? Number(body.familyId) : null,
      assignments: Array.isArray(body.assignments) ? body.assignments.map((a) => ({
        subordinateEntityId: Number(a.subordinateEntityId),
        locationPropertyId: Number(a.locationPropertyId),
        aggression: a.aggression,
        intent: a.intent,
      })) : [],
    }),
  },

  'run-play': {
    summary: 'Call a previously drawn play. Every assigned subordinate gets their own real compliance '
      + 'draw against their loyalty to you -- never guaranteed, and reported per-position.',
    modes: ['leader'],
    requires: ['playId'],
    verbs: ['runPlay'],
    run: (verbs, actorId, body) => verbs.runPlay(actorId, Number(body.playId)),
  },

  // Task #216: a real post-encounter disposition choice, following a
  // real contest.resolveContest loss (task #137). See disposition.js's
  // own header.
  'capture-entity': {
    summary: 'Take a real defeated or submitted opponent captive -- never someone who fled.',
    modes: ['citizen', 'leader'],
    requires: ['capturedEntityId', 'loserOutcome'],
    verbs: ['captureEntity'],
    run: (verbs, actorId, body) => verbs.captureEntity(actorId, {
      capturedEntityId: Number(body.capturedEntityId),
      loserOutcome: body.loserOutcome,
    }),
  },

  'dispose-of-capture': {
    summary: 'Decide a real captive\'s fate: recruit, exile, hold in custody, or release.',
    modes: ['citizen', 'leader'],
    requires: ['captureId', 'disposition'],
    verbs: ['disposeOfCapture'],
    run: (verbs, actorId, body) => verbs.disposeOfCapture(actorId, Number(body.captureId), {
      disposition: body.disposition,
      organizationId: body.organizationId != null ? Number(body.organizationId) : null,
      toCommunityId: body.toCommunityId != null ? Number(body.toCommunityId) : null,
      toPropertyId: body.toPropertyId != null ? Number(body.toPropertyId) : null,
    }),
  },

  // **`travel.js`'s real player-facing half** — Oregon Trail-style
  // group travel: a real haversine distance between two real cities at
  // a real, cited historical pace, consuming real food/water from
  // whatever the leader and their own real party (`party.partyOf`)
  // actually carry. `roundTrip: true` turns around at the destination
  // and comes home, closing `migration.js`'s own declared "nothing
  // returns somebody to where they came from" gap. See that file's own
  // header for the full design.
  'begin-journey': {
    summary: 'Set out overland for a real city with your own real party (if you have one) -- real '
      + 'food/water consumed per day, real risk of not making it, real resettlement on arrival '
      + 'unless roundTrip is set, in which case the group comes back home instead.',
    modes: ['citizen', 'leader'],
    requires: ['destinationCityId'],
    verbs: ['beginJourney'],
    run: (verbs, actorId, body) => verbs.beginJourney(actorId, {
      destinationCityId: Number(body.destinationCityId),
      roundTrip: !!body.roundTrip,
      vehicleType: body.vehicleType ?? null,
    }),
  },

  // **`vehicles.js`'s own two genuinely new real actions** — crafting
  // a new car/motorcycle/scooter already goes through `make-thing`
  // (they are real `salvage.js` PRODUCTS); see that file's own header
  // for why theft and restoration are not.
  'steal-vehicle': {
    summary: 'Attempt to steal a real car, motorcycle or scooter a specific real person currently '
      + 'holds -- a real chance from your own real robbery aptitude, a real named technique either '
      + 'way, and a real crime.js incident on success.',
    modes: ['citizen', 'leader'],
    requires: ['victimEntityId', 'vehicleType'],
    verbs: ['stealVehicle'],
    run: (verbs, actorId, body) => verbs.stealVehicle(actorId, Number(body.victimEntityId), body.vehicleType),
  },

  'restore-vehicle': {
    summary: 'Repair a real vehicle you already hold, from real salvaged materials -- the same real '
      + 'mechanic Tier-3/Technology gate building one from scratch needs, at half the materials.',
    modes: ['citizen', 'leader'],
    requires: ['vehicleType'],
    verbs: ['restoreVehicle'],
    run: (verbs, actorId, body) => verbs.restoreVehicle(actorId, body.vehicleType),
  },

  // **`camps.js`'s real player-facing half** — off-grid wilderness
  // camps: woods, caves, lakes. `cave` requires a real, already-
  // generated cave-system/natural-formation landmark; `woods` checks
  // this community's own real land-cover class when one exists;
  // `lake` is honestly ungated, since no real signal for it exists in
  // this registry. See that file's own header.
  'establish-camp': {
    summary: 'Set up a real off-grid camp (woods, cave, or lake) in a community, with your own '
      + 'real party if you have one -- a cave camp needs a real cave/natural-formation landmark '
      + 'there, a woods camp is checked against real land-cover data where it exists.',
    modes: ['citizen', 'leader'],
    requires: ['communityId', 'campType'],
    verbs: ['establishCamp'],
    run: (verbs, actorId, body) => verbs.establishCamp(actorId, {
      communityId: Number(body.communityId),
      campType: body.campType,
    }),
  },

  'join-camp': {
    summary: 'Join an existing real camp -- a free act, not a persuasion draw.',
    modes: ['citizen', 'leader'],
    requires: ['campId'],
    verbs: ['joinCamp'],
    run: (verbs, actorId, body) => verbs.joinCamp(actorId, Number(body.campId)),
  },

  'leave-camp': {
    summary: 'Leave the real camp you are currently at.',
    modes: ['citizen', 'leader'],
    requires: [],
    verbs: ['leaveCamp'],
    run: (verbs, actorId) => verbs.leaveCamp(actorId),
  },

  'break-camp': {
    summary: 'Strike a real camp you founded, for everyone still there.',
    modes: ['citizen', 'leader'],
    requires: ['campId'],
    verbs: ['breakCamp'],
    run: (verbs, actorId, body) => verbs.breakCamp(actorId, Number(body.campId)),
  },

  // **`casino.js`'s real staked wagering — see that file's own header
  // for why this is a separate mechanic from `contest.js`'s stakes-
  // free `precision`/`wits` house games, under CLAUDE.md's own
  // standing override of the gambling/casino compliance gate.**
  'place-wager': {
    summary: 'Place a real wager (roulette, blackjack, or slots) at an operating casino, staking your own real savings.',
    modes: ['citizen', 'leader'],
    requires: ['propertyId', 'game', 'stake'],
    verbs: ['placeWager'],
    run: (verbs, actorId, body) => verbs.placeWager(actorId, {
      propertyId: Number(body.propertyId),
      game: body.game,
      stake: Number(body.stake),
    }),
  },
};

const ACTION_NAMES = Object.keys(ACTIONS);

// The actor is never named by the caller. Listed explicitly so the
// refusal below can say WHICH field was the problem.
const ACTOR_FIELDS = ['entityId', 'entity_id', 'actorId', 'participantIds'];

function listActions(mode = 'citizen') {
  return ACTION_NAMES
    .filter((name) => ACTIONS[name].modes.includes(mode))
    .map((name) => ({
      action: name,
      summary: ACTIONS[name].summary,
      requires: ACTIONS[name].requires,
    }));
}

// ---------------------------------------------------------------------------
// dispatch()
// ---------------------------------------------------------------------------
// Every verb any action names, so a set can be checked once rather
// than per-action.
const REQUIRED_VERBS = [...new Set(
  Object.values(ACTIONS).flatMap((a) => a.verbs),
)].sort();

function assertVerbsPresent(verbs) {
  const missing = REQUIRED_VERBS.filter((v) => typeof verbs?.[v] !== 'function');
  if (missing.length) {
    throw new Error(
      `dispatchAction was given a verb set missing: ${missing.join(', ')}. `
      + 'Actions call the ENGINE\'s bound functions, never the modules underneath — '
      + 'calling the module directly is what made a completed mission pay nothing.',
    );
  }
}

function dispatchAction(worldState, playerId, body = {}, verbs) {
  assertVerbsPresent(verbs);
  const player = (worldState.players || []).find((p) => p.id === Number(playerId));
  if (!player) throw new Error(`no player with id ${playerId}`);

  const { action } = body;
  if (!action) {
    throw new Error(
      `an action is required — one of: ${listActions(player.mode).map((a) => a.action).join(', ')}`,
    );
  }

  const spec = ACTIONS[action];
  if (!spec) {
    throw new Error(
      `"${action}" is not an action. Available: ${ACTION_NAMES.join(', ')}`,
    );
  }
  if (!spec.modes.includes(player.mode)) {
    throw new Error(
      `"${action}" is not available in ${player.mode} mode (it needs one of: ${spec.modes.join(', ')})`,
    );
  }

  // Refused, not ignored. See the header: a caller who supplies an
  // actor and has it silently dropped believes they acted as somebody
  // else and that it worked.
  const smuggled = ACTOR_FIELDS.filter((f) => body[f] !== undefined);
  if (smuggled.length) {
    throw new Error(
      `a player acts as themselves — remove ${smuggled.join(', ')}. `
      + `This action is performed by entity ${player.linked_entity_id}, from the player record.`,
    );
  }

  const missing = spec.requires.filter((field) => body[field] === undefined || body[field] === null);
  if (missing.length) {
    throw new Error(`"${action}" requires ${missing.join(', ')}`);
  }

  // **A player serving a sentence cannot act.** `npcs.status` gained
  // `imprisoned` with server/justice.js, and without this check the one
  // person in the world with a keyboard would be the only one for whom
  // being convicted changed nothing: every NPC loses their job, their
  // routine and their place in the household, while the player accepts
  // missions and enters contests from a cell.
  //
  // Refused with the reason and the release tick rather than a bare
  // error, because "why can I not do anything" is the question this
  // will be asked.
  const actor = (worldState.npcs || []).find((n) => n.id === player.linked_entity_id);
  if (actor && actor.status === 'imprisoned') {
    const serving = justice.servingCase(worldState, actor.id);
    const releaseAt = serving
      ? Number(serving.charged_tick) + Number(serving.sentence_ticks)
      : null;
    throw new Error(
      `entity ${actor.id} is serving a sentence${serving ? ` for ${serving.category}` : ''} `
      + `and cannot act${releaseAt === null ? '' : ` until tick ${releaseAt}`}.`,
    );
  }

  const actorId = player.linked_entity_id;
  const result = spec.run(verbs, actorId, body);

  return {
    playerId: player.id,
    action,
    actorEntityId: actorId,
    tick: worldState.tick,
    result,
  };
}

// ---------------------------------------------------------------------------
// Every registered action must actually be callable, checked at require
// time. A `run` pointing at a function that no longer exists would fail
// only when somebody tried that one action — and the whole point of a
// registry is that nothing enumerates it by hand.
// ---------------------------------------------------------------------------
function assertActionsAreReal() {
  const bad = [];
  for (const [name, spec] of Object.entries(ACTIONS)) {
    if (typeof spec.run !== 'function') bad.push(`${name}: run is not a function`);
    if (!Array.isArray(spec.requires)) bad.push(`${name}: requires must be a list`);
    if (!Array.isArray(spec.modes) || !spec.modes.length) bad.push(`${name}: no modes`);
    if (!spec.summary) bad.push(`${name}: no summary — the action list is a player-facing menu`);
    if (!Array.isArray(spec.verbs) || !spec.verbs.length) {
      bad.push(`${name}: names no verbs, so nothing checks its wiring`);
    }
  }
  if (bad.length) throw new Error(`actions.js registry is malformed:\n  ${bad.join('\n  ')}`);
}

assertActionsAreReal();

module.exports = {
  ACTIONS,
  ACTION_NAMES,
  ACTOR_FIELDS,
  REQUIRED_VERBS,
  listActions,
  dispatchAction,
  assertVerbsPresent,
  assertActionsAreReal,
};
