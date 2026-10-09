// VDP — Robots: real machine types, from a basic patrol drone up to
// military hardware, and who is actually directing one.
//
// Per direct instruction (9 Oct 2026): "there also will be stages of
// robots, from your basic robot that just roams around and does basic
// things, to your household robot, all the way up to your military
// style robot, and variations in between." Before this module,
// "robot" existed in VDP only as a number -- `security.js`'s own
// `robotCount` per tier and flavor strings in `server.cjs`'s news
// events -- never a real, typed thing. This is that real type ladder,
// checked directly against the one robot concept that already existed
// (`security.js`'s four-tier `DEFAULT_SECURITY_TIERS`) rather than
// inventing a parallel one: `SECURITY_TIER_ROBOT_TYPE` below names
// which real type the government actually deploys at each real tier,
// so "the robots will increase for policing" (8 Oct 2026, the
// instruction `security.js` was built from) now names what increases,
// not just how many.
//
// **`overpowerStrength` is a flagged interpretive number, same footing
// every other unspecified figure in this app already stands on** -- no
// document gives VDP a real robot combat-strength table. It is read by
// `dissent.js`'s own `attemptUprising`, per the same day's further
// instruction: "it takes a lot of people to overpower certain robots,
// and depending on what type of robot... it does [vary]." A higher
// number means more real, combined human strength is needed to
// overpower one of that type -- see `dissent.js` for the actual
// calculus; this module only names the real fact per robot type.
//
// **Household robots are deliberately not enforcement-capable.**
// "Variations in between" names a real robot that exists on this
// planet but is not part of "the robots... for policing" at all --
// `canDetain`/`canSeal` are both `false` for it, and
// `SECURITY_TIER_ROBOT_TYPE` never maps to it. A household robot is a
// domestic fact about the new-world technology (per `VDP_FOUNDING.md`'s
// own "new-world technology" section), not a second security tier.
//
// **"There also will be humans or NPCs that will be basically in
// control of the robots."** `deployRobot`'s `controlledBy` is any
// real string -- a real player id or `npc-<id>`, the same open
// convention `contracts.js`'s `builderId` and `property.js`'s
// `ownerId` already use for "any real person, NPC included." This
// module creates no robot "AI" of its own to decide anything; a
// deployed robot's actions (detaining, sealing a spot) are the real
// acts its controller performs through `immigration.js`'s own real
// functions, the same way `jobs.js`'s `robot-patrol-officer` already
// documents a player "directing that robot patrol, not playing a
// robot themselves."

export const ROBOT_TYPES = {
  'patrol-drone': {
    name: 'Patrol Drone', tier: 1, role: 'basic-patrol',
    description: 'Roams and performs basic patrol tasks -- the weakest real enforcement type, deployed at the Basic security tier.',
    overpowerStrength: 1, canDetain: true, canSeal: true,
  },
  'household-robot': {
    name: 'Household Robot', tier: 1, role: 'domestic',
    description: 'A domestic assistant robot, not an enforcement machine.',
    overpowerStrength: 1, canDetain: false, canSeal: false,
  },
  'security-robot': {
    name: 'Security Robot', tier: 2, role: 'enforcement',
    description: 'Basic enforcement: can detain and seal.',
    overpowerStrength: 2, canDetain: true, canSeal: true,
  },
  'combat-robot': {
    name: 'Combat Robot', tier: 3, role: 'enforcement',
    description: 'Heavier enforcement hardware.',
    overpowerStrength: 4, canDetain: true, canSeal: true,
  },
  'military-robot': {
    name: 'Military Robot', tier: 4, role: 'enforcement',
    description: 'The government\'s top-tier enforcement hardware.',
    overpowerStrength: 8, canDetain: true, canSeal: true,
  },
};

// Which real type the government actually deploys at each real
// `security.js` tier -- read by name, not duplicated as a second tier
// table. `Basic` gets the least capable real enforcement robot in this
// file, `Maximum Security` the most, the same escalation
// `security.js`'s own `cameraCount`/`robotCount` ladder already uses
// for everything else about that tier.
export const SECURITY_TIER_ROBOT_TYPE = {
  Basic: 'patrol-drone',
  Elevated: 'security-robot',
  'High Alert': 'combat-robot',
  'Maximum Security': 'military-robot',
};

export function getRobotType(typeId) {
  const type = ROBOT_TYPES[typeId];
  if (!type) throw new Error(`robots: no robot type "${typeId}" (expected one of ${Object.keys(ROBOT_TYPES).join(', ')})`);
  return type;
}

// The real robot type deployed for enforcement at a given real
// security tier name -- `null` for a tier this ladder has no mapping
// for, never a guessed default.
export function robotTypeForSecurityTier(tierName) {
  const typeId = SECURITY_TIER_ROBOT_TYPE[tierName];
  return typeId ? { id: typeId, ...getRobotType(typeId) } : null;
}

export function createRobotsStore() {
  return { robots: [], nextRobotId: 1 };
}

// A real, standing machine in the world -- not consumed or spent, the
// same "a real instance exists" shape `npcs.js`'s own NPCs use, at a
// much smaller scale (no behavior loop of its own; see header).
export function deployRobot(store, { typeId, districtId = null, controlledBy = null, now = Date.now() } = {}) {
  getRobotType(typeId); // throws on an unknown type
  const robot = {
    id: store.nextRobotId++,
    typeId,
    districtId,
    controlledBy,
    status: 'active',
    deployedAt: now,
    decommissionedAt: null,
  };
  store.robots.push(robot);
  return robot;
}

export function decommissionRobot(store, robotId, { now = Date.now() } = {}) {
  const robot = store.robots.find((r) => r.id === robotId);
  if (!robot) throw new Error(`decommissionRobot: no robot #${robotId}`);
  if (robot.status === 'decommissioned') throw new Error(`decommissionRobot: robot #${robotId} is already decommissioned`);
  robot.status = 'decommissioned';
  robot.decommissionedAt = now;
  return robot;
}

export function listActiveRobots(store) {
  return store.robots.filter((r) => r.status === 'active');
}

export function robotsControlledBy(store, controllerId) {
  return store.robots.filter((r) => r.controlledBy === controllerId);
}

export function getRobot(store, robotId) {
  return store.robots.find((r) => r.id === robotId) || null;
}
