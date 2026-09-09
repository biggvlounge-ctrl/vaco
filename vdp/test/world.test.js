// VDP — the walkable world itself.
//
// **The game file.** `src/lib/world.js` is the map every player moves
// through: 23 districts laid out on an 860x2260 grid, arrow-key
// movement, a camera that follows, and buildings you walk up to and
// enter. It is the largest lib module in this project and had no tests
// at all, while three smaller district modules did.
//
// That matters because this world was not designed once — it was grown.
// Its own comments record the history: 580 -> 860 wide for the Village
// District row, then 860 -> 1140 -> 1420 -> 1700 -> 1980 -> 2260 tall
// as each new row of districts arrived. Every one of those growths is a
// chance to place a district outside the world, on top of another one,
// or somewhere the player cannot reach — and none of it is visible
// until somebody walks there.
//
// So the assertions here are mostly geometric invariants rather than
// behaviour. They are the things that cannot be checked by looking at
// the file, and that break silently when the 9th row lands.
//
// One is not geometric and matters most: **every district must have a
// renderer.** `WorldView.jsx` matches on `contentType` and `id`, so a
// district added to `world.js` without a matching branch is a building
// you can walk up to, enter, and see nothing in. That is this project's
// recurring dead-signal failure with a door on it.

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DISTRICTS, WORLD_WIDTH, WORLD_HEIGHT, VIEWPORT_WIDTH, VIEWPORT_HEIGHT,
  MOVE_STEP, BUILDING_ENTRY_RADIUS,
  createWorldState, movePlayer, getCurrentDistrict, getNearbyBuilding,
  enterBuilding, getCameraOffset,
} from '../src/lib/world.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const centerOf = (d) => ({ x: d.x + d.width / 2, y: d.y + d.height / 2 });

// ---------------------------------------------------------------------------
// The map is well formed
// ---------------------------------------------------------------------------

test('there are districts at all, and each is uniquely identified', () => {
  // A guard on every assertion below: a sweep over an empty list passes
  // vacuously.
  assert.ok(DISTRICTS.length >= 20, `only ${DISTRICTS.length} districts`);
  const ids = DISTRICTS.map((d) => d.id);
  assert.equal(new Set(ids).size, ids.length, 'two districts share an id');
  for (const d of DISTRICTS) {
    assert.ok(d.name, `${d.id} has no display name`);
    assert.ok(d.contentType, `${d.id} has no contentType`);
    assert.ok(d.width > 0 && d.height > 0, `${d.id} has no area`);
  }
});

test('every district fits inside the world', () => {
  // The failure this catches: a new row added without growing
  // WORLD_HEIGHT. The district exists, the map renders, and the player
  // simply cannot walk far enough to reach it — movePlayer clamps to
  // WORLD_HEIGHT.
  const escaped = DISTRICTS.filter((d) => d.x < 0 || d.y < 0
    || d.x + d.width > WORLD_WIDTH || d.y + d.height > WORLD_HEIGHT);
  assert.deepEqual(
    escaped.map((d) => `${d.id} at ${d.x},${d.y}`), [],
    `these districts extend past the ${WORLD_WIDTH}x${WORLD_HEIGHT} world and are unreachable`,
  );
});

test('no two districts overlap', () => {
  // getCurrentDistrict returns the FIRST match, so overlapping
  // districts would make "where am I" depend on array order.
  const overlaps = [];
  for (let i = 0; i < DISTRICTS.length; i += 1) {
    for (let j = i + 1; j < DISTRICTS.length; j += 1) {
      const a = DISTRICTS[i];
      const b = DISTRICTS[j];
      if (a.x < b.x + b.width && b.x < a.x + a.width
        && a.y < b.y + b.height && b.y < a.y + a.height) {
        overlaps.push(`${a.id}/${b.id}`);
      }
    }
  }
  assert.deepEqual(overlaps, [], 'overlapping districts make getCurrentDistrict order-dependent');
});

test('the world is not wastefully larger than the districts in it', () => {
  // The other direction of the growth story: a world grown for a row
  // that was later removed leaves a large empty region the player can
  // walk into and find nothing. One row of slack (280px) is fine;
  // several is a sign the map and the layout have drifted apart.
  const lowest = Math.max(...DISTRICTS.map((d) => d.y + d.height));
  assert.ok(
    WORLD_HEIGHT - lowest < 560,
    `${WORLD_HEIGHT - lowest}px of empty world below the last district — two or more dead rows`,
  );
});

// ---------------------------------------------------------------------------
// Every district is reachable, and rendersomething
// ---------------------------------------------------------------------------

test('every district has a renderer in WorldView', () => {
  // **The one that is not geometry.** WorldView.jsx matches on
  // contentType and (for most) id. A district in world.js with no
  // matching branch is a building you can walk up to, enter, and see
  // nothing in — the dead-signal failure with a door on it.
  const view = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'components', 'WorldView.jsx'), 'utf8',
  );
  const unrenderable = DISTRICTS.filter((d) => {
    // A branch either names the id explicitly, or handles the whole
    // contentType without one (as `venvs-embed` does).
    const byId = view.includes(`enteredDistrict.id === '${d.id}'`);
    const byTypeAlone = new RegExp(
      `enteredDistrict\\.contentType === '${d.contentType}' && \\(`,
    ).test(view);
    return !byId && !byTypeAlone;
  });
  assert.deepEqual(
    unrenderable.map((d) => `${d.id} (${d.contentType})`), [],
    'these districts can be entered and render nothing',
  );
});

test('a player can physically reach every building', () => {
  // Placing a building is not the same as making it enterable: the
  // entry radius is 40px around a district's CENTER, and a district
  // whose center sits outside the walkable world would be permanently
  // un-enterable even though it draws correctly.
  const unreachable = DISTRICTS.filter((d) => {
    const c = centerOf(d);
    return c.x < 0 || c.x > WORLD_WIDTH || c.y < 0 || c.y > WORLD_HEIGHT;
  });
  assert.deepEqual(unreachable.map((d) => d.id), [], 'these buildings cannot be walked to');

  // And positively: standing on each center detects that building.
  for (const d of DISTRICTS) {
    const nearby = getNearbyBuilding(centerOf(d));
    assert.equal(nearby?.id, d.id, `standing in the middle of ${d.id} does not detect it`);
  }
});

test('no two buildings are close enough to fight over the same spot', () => {
  // Two centers within one entry radius of each other would make
  // getNearbyBuilding's "closest wins" tiebreak decide which door a
  // player gets, which is not something a layout should leave to
  // arithmetic.
  const tooClose = [];
  for (let i = 0; i < DISTRICTS.length; i += 1) {
    for (let j = i + 1; j < DISTRICTS.length; j += 1) {
      const a = centerOf(DISTRICTS[i]);
      const b = centerOf(DISTRICTS[j]);
      if (Math.hypot(a.x - b.x, a.y - b.y) <= BUILDING_ENTRY_RADIUS) {
        tooClose.push(`${DISTRICTS[i].id}/${DISTRICTS[j].id}`);
      }
    }
  }
  assert.deepEqual(tooClose, [], 'these buildings share an entry zone');
});

// ---------------------------------------------------------------------------
// Spawning
// ---------------------------------------------------------------------------

test('the player spawns in neutral space, not inside a district', () => {
  // world.js says so explicitly ("not inside any district"), and it is
  // the kind of claim that quietly stops being true when a row is added
  // or the world is re-centred.
  const spawn = createWorldState();
  const inside = getCurrentDistrict(spawn);
  assert.equal(inside, null, `spawned inside ${inside?.id}`);
});

test('the player spawns inside the world', () => {
  const spawn = createWorldState();
  assert.ok(spawn.x >= 0 && spawn.x <= WORLD_WIDTH);
  assert.ok(spawn.y >= 0 && spawn.y <= WORLD_HEIGHT);
});

test('spawning twice gives two independent players', () => {
  // movePlayer mutates its argument. A shared spawn object would make
  // one player's movement move everybody.
  const a = createWorldState();
  const b = createWorldState();
  movePlayer(a, MOVE_STEP, 0);
  assert.notEqual(a.x, b.x, 'moving one player moved the other');
});

// ---------------------------------------------------------------------------
// Movement
// ---------------------------------------------------------------------------

test('the player moves by what they are told to move by', () => {
  const p = createWorldState();
  const { x, y } = { ...p };
  movePlayer(p, MOVE_STEP, 0);
  assert.equal(p.x, x + MOVE_STEP);
  assert.equal(p.y, y);
  movePlayer(p, 0, MOVE_STEP);
  assert.equal(p.y, y + MOVE_STEP);
});

test('the player cannot walk out of the world in any direction', () => {
  const p = createWorldState();
  movePlayer(p, -99999, -99999);
  assert.deepEqual({ x: p.x, y: p.y }, { x: 0, y: 0 }, 'clamped at the top-left');
  movePlayer(p, 99999, 99999);
  assert.deepEqual({ x: p.x, y: p.y }, { x: WORLD_WIDTH, y: WORLD_HEIGHT }, 'and the bottom-right');
});

test('walking into a district reports being in it', () => {
  const target = DISTRICTS[0];
  const p = { ...centerOf(target) };
  assert.equal(getCurrentDistrict(p)?.id, target.id);

  // And the neutral gaps between districts belong to nobody — that is
  // what makes them a real corridor rather than an invisible edge.
  assert.equal(getCurrentDistrict({ x: 0, y: 0 }), null, 'the margin is not inside a district');
});

// ---------------------------------------------------------------------------
// Entering a building
// ---------------------------------------------------------------------------

test('standing far from every building detects none', () => {
  // `null`, not an arbitrary nearest — otherwise the "press E to enter"
  // prompt would show permanently, wherever the player stood.
  assert.equal(getNearbyBuilding({ x: 0, y: 0 }), null);
});

test('the entry radius is a real boundary', () => {
  const d = DISTRICTS[0];
  const c = centerOf(d);
  const justInside = { x: c.x + BUILDING_ENTRY_RADIUS - 1, y: c.y };
  const justOutside = { x: c.x + BUILDING_ENTRY_RADIUS + 1, y: c.y };
  assert.equal(getNearbyBuilding(justInside)?.id, d.id);
  assert.equal(getNearbyBuilding(justOutside), null, 'one pixel past the radius is outside it');
});

test('entering the building you are standing at succeeds', () => {
  const d = DISTRICTS[0];
  const out = enterBuilding(centerOf(d), d.id);
  assert.equal(out.entered, true);
  assert.equal(out.district.id, d.id);
});

test('entering a building you are not near is refused', () => {
  // The rule that makes the world a place rather than a menu: you have
  // to walk there.
  const near = DISTRICTS[0];
  const far = DISTRICTS[DISTRICTS.length - 1];
  assert.throws(
    () => enterBuilding(centerOf(near), far.id),
    /is not near the "/,
    'a player standing at one building entered a different one',
  );
  assert.throws(() => enterBuilding({ x: 0, y: 0 }, near.id), /is not near/);
  assert.throws(() => enterBuilding(centerOf(near), 'no-such-district'), /is not near/);
});

// ---------------------------------------------------------------------------
// The camera
// ---------------------------------------------------------------------------

test('the camera centres on the player in open ground', () => {
  const middle = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
  const cam = getCameraOffset(middle);
  assert.equal(cam.x, middle.x - VIEWPORT_WIDTH / 2);
  assert.equal(cam.y, middle.y - VIEWPORT_HEIGHT / 2);
});

test('the camera never scrolls past the edges of the world', () => {
  // Otherwise the player walks into a corner and the view fills with
  // empty space outside the map.
  const topLeft = getCameraOffset({ x: 0, y: 0 });
  assert.deepEqual(topLeft, { x: 0, y: 0 });

  const bottomRight = getCameraOffset({ x: WORLD_WIDTH, y: WORLD_HEIGHT });
  assert.deepEqual(bottomRight, {
    x: WORLD_WIDTH - VIEWPORT_WIDTH,
    y: WORLD_HEIGHT - VIEWPORT_HEIGHT,
  });
});

test('the viewport is smaller than the world, or the camera is meaningless', () => {
  // A viewport at least as large as the world would make every clamp
  // above produce a negative offset, and the camera tests would pass
  // while showing nothing sensible.
  assert.ok(VIEWPORT_WIDTH < WORLD_WIDTH);
  assert.ok(VIEWPORT_HEIGHT < WORLD_HEIGHT);
});

test('the camera keeps the player on screen everywhere in the world', () => {
  // The property that actually matters, swept across the whole map
  // rather than asserted at three points: wherever you stand, you can
  // see yourself.
  for (let x = 0; x <= WORLD_WIDTH; x += 43) {
    for (let y = 0; y <= WORLD_HEIGHT; y += 113) {
      const cam = getCameraOffset({ x, y });
      const onScreenX = x >= cam.x && x <= cam.x + VIEWPORT_WIDTH;
      const onScreenY = y >= cam.y && y <= cam.y + VIEWPORT_HEIGHT;
      assert.ok(onScreenX && onScreenY, `player at ${x},${y} is off screen (camera ${cam.x},${cam.y})`);
    }
  }
});
