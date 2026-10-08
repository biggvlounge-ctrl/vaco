// VDP — a small, VDP-native NPC intelligence layer.
//
// Modeled on VACON-C's proven shapes (needs stepping toward a
// satisfier-derived target, hysteresis goals, habits that strengthen
// and fade, a decision log with an explain()), at roughly 1/20th the
// scale and themed for VDP's own world: building, finance and
// interaction, not violence. VACON-C's own `vacancyClient.js` header
// says mutating VACON-C's world "is a design decision nobody has
// made" — this module does not touch VACON-C at all. It is a wholly
// separate, much smaller engine that happens to borrow the same proven
// ideas: needs that decay without being satisfied, goals that open and
// close with hysteresis so they don't flicker, habits that feed back
// into behavior, and a log that can explain WHY an NPC did something,
// not just that it did.
//
// **Deliberately smaller than VACON-C in every dimension**: 6 traits
// (not 20 families of 114), 4 needs (not 15), one simple pairwise
// friction counter (not a full relationship system), and exactly two
// rare flavor actions borrowed from VACON-C's own two real crime
// triggers (a tiny-probability deprivation draw, and grudge
// escalation) — `pettySwipe` ("simple home break-ins") and `fight`
// ("simple fights"). Both are narrative-only: a logged decision-log
// entry and nothing else. There is no stolen item, no justice system,
// no policing — VACON-C's own audit of its own crime module says those
// two triggers are "the parts worth borrowing for flavor; policing and
// justice are not," and this module takes that advice literally.
//
// **No real money moves here.** An NPC's "trade"/"build" actions are
// cosmetic and narrative — they walk to a themed district and a
// decision-log sentence narrates it, but no VCoin changes hands and no
// NPC is a real V3 account. Wiring NPCs into the real ledger would
// mean minting money from nowhere to fund them, which is exactly the
// kind of invented value every other money path in this ecosystem
// refuses to do. That stays a flagged non-goal, not a silent omission.
//
// **State lives in memory only**, same as every other VDP store
// (`degvchi.js`, `foodDistrict.js`): it resets on reload. VDP has no
// server of its own and this module doesn't give it one.

import { DISTRICTS } from './world.js';

export const TRAIT_NAMES = ['ambition', 'diligence', 'creativity', 'sociability', 'frugality', 'boldness'];
export const NEED_NAMES = ['income', 'purpose', 'social', 'rest'];
export const HABIT_NAMES = ['build', 'trade', 'socialize', 'rest'];
export const FLAVOR_HABIT_NAMES = ['pettySwipe'];
export const ACTIONS = ['build', 'trade', 'socialize', 'rest', 'pettySwipe', 'fight'];

// Which real VDP district an ordinary action sends an NPC to walk
// toward. `rest` has no district — an NPC rests at its own home.
// `pettySwipe`/`fight` have no district either — both happen wherever
// the NPC already is, the same way VACON-C's own escalation fires
// between two people already near each other rather than sending
// anyone anywhere.
const ACTION_DISTRICT = { build: 'fashion', trade: 'food', socialize: 'village' };

// Which need each ordinary action satisfies — the same need<->action
// pairing used both to decide what an unmet need should drive an NPC
// toward, and to tell `stepNeeds` whether that need was recently met.
const NEED_ACTION = { income: 'trade', purpose: 'build', social: 'socialize', rest: 'rest' };

const GOAL_VERBS = {
  income: 'earn a steady living',
  purpose: 'build something meaningful',
  social: 'make a real connection',
  rest: 'get some real rest',
};

const ACTION_SENTENCE = {
  build: 'heading to the Fashion District to build something',
  trade: 'heading to the Food District to trade',
  socialize: 'heading to the Village to socialize',
  rest: 'heading home to rest',
  pettySwipe: 'slipping into an unattended building for a petty, opportunistic swipe',
  fight: 'getting into a shoving match over an old grudge',
};

// Needs step toward their target at different speeds, the same
// fast/steady/slow shape VACON-C's own `motivation.js` uses — `rest`
// and `income` move fastest (felt daily), `purpose` and `social`
// slower (felt over longer stretches).
const NEED_SPEED = { income: 4, rest: 4, social: 2.5, purpose: 2 };

const GOAL_OPEN_THRESHOLD = 35;
const GOAL_CLOSE_THRESHOLD = 65;
// A need counts as "recently satisfied" if its action fired within
// this many of the NPC's own decision turns — not wall-clock ticks,
// since an NPC's needs/habits only actually re-evaluate on its own
// rota turn (see `advanceWorldTick`).
const RECENCY_WINDOW = 3;
const HABIT_FADE = 0.5;
const HABIT_GAIN_FRACTION = 0.2;
// Deliberately far below VACON-C's own already-tiny deprivation draw
// (0.0006 × pressure) — this is flavor, not a modeled economy of
// theft, and it should almost never fire.
const PETTY_SWIPE_BASE_CHANCE = 0.00015;
const PETTY_SWIPE_INCOME_CEILING = 20;
const FIGHT_FRICTION_THRESHOLD = 8;
const FIGHT_FRICTION_GAIN = 1;
const FIGHT_CHANCE_ONCE_THRESHOLD_MET = 0.05;
const NEARBY_RADIUS = 80;
const NPC_MOVE_STEP = 2;
const ROTA_SIZE = 7;
const DECISION_LOG_CAP = 5;
const HOME_DISTRICT_IDS = ['food', 'fashion', 'village'];
const NAMES = [
  'Mo', 'Ava', 'Kai', 'Priya', 'Theo', 'Nina', 'Deshawn', 'Lucia',
  'Omar', 'Freya', 'Jax', 'Sana', 'Rune', 'Ines', 'Bo', 'Marisol',
];

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function districtCenter(id) {
  const district = DISTRICTS.find((d) => d.id === id);
  if (!district) {
    throw new Error(`districtCenter: no district "${id}"`);
  }
  return { x: district.x + district.width / 2, y: district.y + district.height / 2 };
}

function frictionKey(aId, bId) {
  return aId < bId ? `${aId}:${bId}` : `${bId}:${aId}`;
}

// Exported (not just NPC-internal) because the player-needs system
// reuses it on a player record of the same `{needs}` shape — see
// `createPlayerState` below.
export function mostPressingNeed(npc) {
  return NEED_NAMES.reduce((worst, n) => (npc.needs[n] < npc.needs[worst] ? n : worst), NEED_NAMES[0]);
}

export function topTrait(npc) {
  return TRAIT_NAMES.reduce((best, t) => (npc.traits[t] > npc.traits[best] ? t : best), TRAIT_NAMES[0]);
}

function randomInt(rng, max) {
  return Math.floor(rng() * max);
}

export function createNpc(id, home, rng = Math.random) {
  const traits = {};
  for (const t of TRAIT_NAMES) {
    traits[t] = randomInt(rng, 101);
  }
  const needs = {};
  for (const n of NEED_NAMES) {
    needs[n] = clamp(50 + Math.round((rng() - 0.5) * 40), 0, 100);
  }
  const habits = {};
  for (const h of HABIT_NAMES) {
    habits[h] = randomInt(rng, 31);
  }
  for (const h of FLAVOR_HABIT_NAMES) {
    habits[h] = 0;
  }
  return {
    id,
    name: NAMES[(id - 1) % NAMES.length],
    homeX: home.x,
    homeY: home.y,
    x: home.x,
    y: home.y,
    targetX: home.x,
    targetY: home.y,
    // Fixed at spawn: which of the ROTA_SIZE turns this NPC's needs,
    // habits and decision actually re-evaluate on. Spreads the cost of
    // a growing population across ticks the same way VACON-C's own
    // weekly rota does, rather than re-deciding for everyone every
    // call.
    rotaSlot: (id - 1) % ROTA_SIZE,
    traits,
    needs,
    habits,
    currentAction: 'rest',
    currentGoal: null,
    decisionLog: [],
    lastActionTick: {},
  };
}

// The same needs/habits/traits shape `createNpc` builds, minus the
// NPC-only fields (position, rotaSlot, decision log) a player record
// has no use for — `vdp/server.js` owns the player's actual position
// and tick scheduling. `stepNeeds`/`updateGoal`/`reinforceHabit`/
// `fadeHabits` above all operate on this shape unchanged.
export function createPlayerState(rng = Math.random) {
  const traits = {};
  for (const t of TRAIT_NAMES) {
    traits[t] = randomInt(rng, 101);
  }
  const needs = {};
  for (const n of NEED_NAMES) {
    needs[n] = clamp(50 + Math.round((rng() - 0.5) * 40), 0, 100);
  }
  const habits = {};
  for (const h of HABIT_NAMES) {
    habits[h] = randomInt(rng, 31);
  }
  return {
    traits,
    needs,
    habits,
    currentGoal: null,
    lastActionTick: {},
  };
}

export function createNpcWorld(options = {}) {
  const { count = 14, rng = Math.random } = options;
  const anchors = HOME_DISTRICT_IDS.map(districtCenter);
  const npcs = [];
  for (let i = 1; i <= count; i += 1) {
    npcs.push(createNpc(i, anchors[(i - 1) % anchors.length], rng));
  }
  return { npcs, tick: 0, friction: {} };
}

// Grows the real, server-ticked population by exactly one NPC, past
// the founding count `createNpcWorld` seeds at boot -- the real hook
// "we will just grow the planet off of [migration]" needs (8 Oct
// 2026, direct instruction). `immigration.js`'s `generateMigrationWave`
// calls this once per new real NPC arrival, through whichever server
// wires the two together (`server.cjs`) -- this file does not import
// `immigration.js`, nor the reverse, the same decoupled-by-injection
// shape every cross-module money/state call in this directory already
// uses. The new id is real and never reused: one past the highest id
// already in the world, not a count that could collide after NPCs are
// later removed.
export function addNpcToWorld(world, { home, rng = Math.random } = {}) {
  const nextId = world.npcs.length ? Math.max(...world.npcs.map((n) => n.id)) + 1 : 1;
  const anchors = HOME_DISTRICT_IDS.map(districtCenter);
  const anchor = home || anchors[(nextId - 1) % anchors.length];
  const npc = createNpc(nextId, anchor, rng);
  world.npcs.push(npc);
  return npc;
}

// Removes a real NPC outright -- the inverse of `addNpcToWorld`. Real
// use: deportation (`immigration.js`'s `deportPerson`) removing an NPC
// migrant from the live, server-ticked population, not just marking
// their own arrival record.
export function removeNpcFromWorld(world, npcId) {
  const idx = world.npcs.findIndex((n) => n.id === npcId);
  if (idx === -1) throw new Error(`removeNpcFromWorld: no NPC #${npcId}`);
  const [removed] = world.npcs.splice(idx, 1);
  return removed;
}

export function getNpc(world, npcId) {
  return world.npcs.find((n) => n.id === npcId) || null;
}

export function listNpcs(world) {
  return world.npcs;
}

export function latestDecision(npc) {
  return npc.decisionLog.length ? npc.decisionLog[npc.decisionLog.length - 1] : null;
}

// One sentence, built only from fields already on a decision-log
// entry — the same "because / chose" shape VACON-C's own `decisions.js`
// `explain()` renders, at a tenth of the fields.
export function explainDecision(entry) {
  if (!entry) return '';
  const because = entry.need ? ` because ${entry.need} was low` : '';
  return `${entry.name}${because} and values ${capitalize(entry.topTrait)} — ${entry.name} is ${ACTION_SENTENCE[entry.chosenAction]}.`;
}

// Exported: the player-needs system (`vdp/server.js`) steps a player
// record through the identical need/goal/habit math an NPC uses, on
// the same `{needs, lastActionTick, currentGoal, traits, habits}`
// shape `createPlayerState` below produces — one engine for both, so
// a goal panel reads the same way whether it's describing an NPC or
// the person playing.
export function stepNeeds(npc, tick) {
  for (const need of NEED_NAMES) {
    const action = NEED_ACTION[need];
    const lastTick = npc.lastActionTick[action];
    const recentlySatisfied = lastTick !== undefined && tick - lastTick <= RECENCY_WINDOW;
    const target = recentlySatisfied ? 100 : 0;
    const speed = NEED_SPEED[need];
    const current = npc.needs[need];
    const gap = target - current;
    const delta = Math.sign(gap) * Math.min(speed, Math.abs(gap));
    npc.needs[need] = clamp(current + delta, 0, 100);
  }
}

export function updateGoal(npc) {
  if (npc.currentGoal) {
    if (npc.needs[npc.currentGoal.need] >= GOAL_CLOSE_THRESHOLD) {
      npc.currentGoal = null;
    }
    return;
  }
  const pressing = mostPressingNeed(npc);
  if (npc.needs[pressing] < GOAL_OPEN_THRESHOLD) {
    npc.currentGoal = {
      need: pressing,
      description: `${GOAL_VERBS[pressing]} (${capitalize(topTrait(npc))})`,
    };
  }
}

export function reinforceHabit(npc, habitName) {
  if (!(habitName in npc.habits)) return;
  const room = 100 - npc.habits[habitName];
  npc.habits[habitName] = clamp(npc.habits[habitName] + room * HABIT_GAIN_FRACTION, 0, 100);
}

export function fadeHabits(npc) {
  for (const h of Object.keys(npc.habits)) {
    npc.habits[h] = clamp(npc.habits[h] - HABIT_FADE, 0, 100);
  }
}

// Gated hard on need + traits, then scaled a little by the habit
// itself — a repeat "offender" is marginally more likely, the same
// feedback shape VACON-C's own harmful habits carry, but the gate
// alone keeps this at the edge of never happening for the vast
// majority of NPCs, who are never this bold and this broke at once.
function pettySwipeChance(npc) {
  if (npc.needs.income >= PETTY_SWIPE_INCOME_CEILING) return 0;
  if (npc.traits.boldness < 60 || npc.traits.frugality > 40) return 0;
  return PETTY_SWIPE_BASE_CHANCE * (1 + npc.habits.pettySwipe / 100);
}

// Friction only builds between two NPCs who are both genuinely
// prickly — bold and not very sociable. Two easygoing NPCs standing in
// the same district never accrue anything. This is VACON-C's own
// grudge/escalation shape flattened to a single counter instead of a
// full relationship model.
function buildFriction(world, a, b) {
  const prickly = (npc) => npc.traits.boldness >= 55 && npc.traits.sociability <= 45;
  if (!prickly(a) || !prickly(b)) return;
  const key = frictionKey(a.id, b.id);
  world.friction[key] = (world.friction[key] || 0) + FIGHT_FRICTION_GAIN;
}

function nearbyNpcs(world, npc) {
  return world.npcs.filter(
    (other) => other.id !== npc.id && Math.hypot(other.x - npc.x, other.y - npc.y) <= NEARBY_RADIUS,
  );
}

// The resolver. Rare flavor gates are checked first and independently
// — each is its own tiny probability, not competing on a shared scale
// with the ordinary need-driven pick below. Everything else follows
// the single open goal's need, or the single most pressing need if no
// goal has opened yet.
export function pickAction(npc, context = {}, rng = Math.random) {
  const { nearbyNpcIds = [], friction = {} } = context;

  if (rng() < pettySwipeChance(npc)) {
    return { action: 'pettySwipe', targetNpcId: null };
  }
  for (const otherId of nearbyNpcIds) {
    const key = frictionKey(npc.id, otherId);
    if ((friction[key] || 0) >= FIGHT_FRICTION_THRESHOLD && rng() < FIGHT_CHANCE_ONCE_THRESHOLD_MET) {
      return { action: 'fight', targetNpcId: otherId };
    }
  }

  const need = npc.currentGoal ? npc.currentGoal.need : mostPressingNeed(npc);
  return { action: NEED_ACTION[need], targetNpcId: null };
}

function logDecision(npc, tick, action) {
  npc.decisionLog.push({
    tick,
    name: npc.name,
    chosenAction: action,
    need: npc.currentGoal ? npc.currentGoal.need : null,
    topTrait: topTrait(npc),
  });
  if (npc.decisionLog.length > DECISION_LOG_CAP) {
    npc.decisionLog.shift();
  }
}

function applyAction(world, npc, action, targetNpcId) {
  npc.currentAction = action;

  if (action === 'pettySwipe') {
    reinforceHabit(npc, 'pettySwipe');
  } else if (action === 'fight') {
    if (targetNpcId != null) {
      // The blow-up resolves the immediate grudge, the same way
      // VACON-C's own escalation resolving a quarrel is what the
      // threshold crossing represents.
      world.friction[frictionKey(npc.id, targetNpcId)] = 0;
    }
  } else {
    npc.lastActionTick[action] = world.tick;
    reinforceHabit(npc, action);
    if (ACTION_DISTRICT[action]) {
      const center = districtCenter(ACTION_DISTRICT[action]);
      npc.targetX = center.x;
      npc.targetY = center.y;
    } else {
      npc.targetX = npc.homeX;
      npc.targetY = npc.homeY;
    }
  }

  logDecision(npc, world.tick, action);
}

function stepPosition(npc) {
  const dx = npc.targetX - npc.x;
  const dy = npc.targetY - npc.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= NPC_MOVE_STEP) {
    npc.x = npc.targetX;
    npc.y = npc.targetY;
    return;
  }
  npc.x += (dx / dist) * NPC_MOVE_STEP;
  npc.y += (dy / dist) * NPC_MOVE_STEP;
}

// Advances the whole world by one step. Every NPC's position moves
// toward wherever it last decided to go — cheap, and keeps movement
// visibly smooth — but needs, habits, goals and the decision itself
// only re-evaluate for the NPCs whose turn has come up in the
// `ROTA_SIZE`-slot rotation, the same cost-bounding trick VACON-C's
// own Decision phase uses so a growing population never make a single
// tick more expensive than the last.
export function advanceWorldTick(world, rng = Math.random) {
  world.tick += 1;
  const slot = world.tick % ROTA_SIZE;
  const decided = [];

  for (const npc of world.npcs) {
    stepPosition(npc);
    if (npc.rotaSlot !== slot) continue;

    stepNeeds(npc, world.tick);
    fadeHabits(npc);
    updateGoal(npc);

    const nearby = nearbyNpcs(world, npc);
    for (const other of nearby) {
      buildFriction(world, npc, other);
    }

    const { action, targetNpcId } = pickAction(
      npc,
      { nearbyNpcIds: nearby.map((n) => n.id), friction: world.friction },
      rng,
    );
    applyAction(world, npc, action, targetNpcId);
    decided.push(npc.id);
  }

  return decided;
}
