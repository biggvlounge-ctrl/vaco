// VDP — robots.js: the real robot type ladder and who controls one.

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ROBOT_TYPES, SECURITY_TIER_ROBOT_TYPE, getRobotType, robotTypeForSecurityTier,
  createRobotsStore, deployRobot, decommissionRobot, listActiveRobots, robotsControlledBy, getRobot,
} from '../src/lib/robots.js';

test('the robot ladder runs from basic patrol through household up to military, each a real, distinct type', () => {
  assert.ok(ROBOT_TYPES['patrol-drone']);
  assert.ok(ROBOT_TYPES['household-robot']);
  assert.ok(ROBOT_TYPES['military-robot']);
  // Military is the hardest to overpower of every real type.
  const maxStrength = Math.max(...Object.values(ROBOT_TYPES).map((t) => t.overpowerStrength));
  assert.equal(ROBOT_TYPES['military-robot'].overpowerStrength, maxStrength);
});

test('household robots are never enforcement-capable, unlike every real security robot type', () => {
  assert.equal(ROBOT_TYPES['household-robot'].canDetain, false);
  assert.equal(ROBOT_TYPES['household-robot'].canSeal, false);
  for (const typeId of Object.values(SECURITY_TIER_ROBOT_TYPE)) {
    assert.equal(ROBOT_TYPES[typeId].canDetain, true, `${typeId} must be enforcement-capable to police a real tier`);
  }
});

test('getRobotType refuses an unknown type', () => {
  assert.throws(() => getRobotType('toaster-bot'), /no robot type/);
});

test('robotTypeForSecurityTier names the real escalating type per real security tier', () => {
  assert.equal(robotTypeForSecurityTier('Basic').id, 'patrol-drone');
  assert.equal(robotTypeForSecurityTier('Maximum Security').id, 'military-robot');
  assert.equal(robotTypeForSecurityTier('Nonexistent Tier'), null);
});

test('deployRobot creates a real, standing robot with a real controller', () => {
  const store = createRobotsStore();
  const robot = deployRobot(store, { typeId: 'security-robot', districtId: 'void', controlledBy: 'npc-15' });
  assert.equal(robot.status, 'active');
  assert.equal(robot.controlledBy, 'npc-15');
  assert.deepEqual(listActiveRobots(store), [robot]);
  assert.deepEqual(robotsControlledBy(store, 'npc-15'), [robot]);
  assert.equal(getRobot(store, robot.id), robot);
});

test('deployRobot refuses an unknown robot type', () => {
  const store = createRobotsStore();
  assert.throws(() => deployRobot(store, { typeId: 'toaster-bot' }), /no robot type/);
});

test('a human player can control a robot too -- controlledBy is any real id, not NPC-only', () => {
  const store = createRobotsStore();
  const robot = deployRobot(store, { typeId: 'patrol-drone', controlledBy: 'real-player-42' });
  assert.deepEqual(robotsControlledBy(store, 'real-player-42'), [robot]);
});

test('decommissionRobot removes exactly one real robot from the active list, once', () => {
  const store = createRobotsStore();
  const robot = deployRobot(store, { typeId: 'patrol-drone' });
  const decommissioned = decommissionRobot(store, robot.id);
  assert.equal(decommissioned.status, 'decommissioned');
  assert.equal(listActiveRobots(store).length, 0);
  assert.throws(() => decommissionRobot(store, robot.id), /already decommissioned/);
});

test('decommissionRobot refuses an unknown robot', () => {
  const store = createRobotsStore();
  assert.throws(() => decommissionRobot(store, 999), /no robot/);
});
