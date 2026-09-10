#!/usr/bin/env node
// Put believable content into a running ecosystem, for a live walkthrough.
//
// **The problem this solves.** On a fresh boot, most of the ecosystem is
// empty. Measured rather than assumed: after wiping every store and
// booting all 36 apps, only nine had written a store file at all, and
// those were mostly empty too — VOID had data in 5 of its 41
// collections, CVNVO in 2 of 22. Somebody clicking through this for the
// first time sees a launcher full of apps and then a series of blank
// pages, which reads as broken rather than as new.
//
// Three apps already seed themselves at boot — VOKEN, Vavlt Stvdios and
// VDP each have a `lib/seedDemoData.js`. This is the same idea for the
// rest, done from outside rather than in 30 more copies of that file.
//
// **Everything here goes through the real HTTP API**, as a real
// signed-in user, against the same guards and the same validation any
// other caller meets. Nothing writes a store file directly. That is not
// fastidiousness: content hand-written into a store bypasses the
// validation that makes it coherent, and a demo backed by invalid data
// falls over the moment somebody clicks the thing it forgot.
//
// It also means this doubles as an integration test. If the seed runs
// clean, a real user can do all of these things.
//
// **Idempotent.** Every step checks whether its content already exists
// and skips if so, so running it twice is safe and running it against a
// populated ecosystem changes nothing.
//
// Usage:
//   ./start-ecosystem.sh && node scripts/seed-demo.mjs
//   node scripts/seed-demo.mjs --dry-run     # say what it would do
//
// The service credential comes from VACO_SERVICE_TOKEN, which
// `start-ecosystem.sh` exports. Run it from the same shell, or pass it
// in.

import process from 'node:process';

const DRY = process.argv.includes('--dry-run');
const SERVICE_TOKEN = process.env.VACO_SERVICE_TOKEN || '';

// The cast. Small on purpose: a demo is easier to follow with four
// recognisable people than with forty ids.
//
// Passwords are visible here and that is correct — these are local
// demo accounts on a per-boot dev ecosystem, and the point is that
// somebody watching the demo can sign in as one of them. Do not seed a
// deployment that has real users.
const PEOPLE = [
  { userId: 'demo-elena', displayName: 'Elena Vasquez', password: 'demo-pass-1234' },
  { userId: 'demo-marcus', displayName: 'Marcus Bell', password: 'demo-pass-1234' },
  { userId: 'demo-priya', displayName: 'Priya Anand', password: 'demo-pass-1234' },
  { userId: 'demo-kai', displayName: 'Kai Nakamura', password: 'demo-pass-1234' },
];

const PORTS = {
  shield: 8812, v3: 8811, void: 8793, vxllage: 8796, cvnvo: 8798,
  hvntz: 8792, dreams: 8814, 'vulture-music': 8806,
};

const sessions = new Map();
const created = [];
const skipped = [];
const failed = [];

async function call(app, method, path, { body, as, service } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (as) headers.Authorization = `Bearer ${sessions.get(as)}`;
  if (service) {
    headers['X-Service-Name'] = 'vaco-shell';
    headers['X-Service-Token'] = SERVICE_TOKEN;
  }
  const res = await fetch(`http://localhost:${PORTS[app]}${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = { raw: text.slice(0, 200) }; }
  return { ok: res.ok, status: res.status, body: parsed };
}

// One seeded thing. `existing` decides whether to skip, so the whole
// script is re-runnable.
async function seed(label, { existing, make }) {
  try {
    if (existing) {
      const already = await existing();
      if (already) { skipped.push(`${label} (${already})`); return null; }
    }
    if (DRY) { created.push(`${label} — would create`); return null; }
    const result = await make();
    created.push(label);
    return result;
  } catch (err) {
    failed.push(`${label}: ${err.message}`);
    return null;
  }
}

function must(res, what) {
  if (!res.ok) {
    throw new Error(`${what} → ${res.status} ${JSON.stringify(res.body).slice(0, 160)}`);
  }
  return res.body;
}

// **How "already seeded" is decided, and why not per item.**
//
// The obvious check — fetch the app's list endpoint and look for what
// this would create — does not work, because most of these apps have
// no "list everything" route. VXLLAGE exposes `/api/posts/:id` but not
// `/api/posts`; HVNTZ has `/api/business/:id` but not
// `/api/businesses`. Querying those returned Express's HTML 404, which
// parsed as "nothing there", so every run would have re-created every
// post and every business. Found by curling the routes the checks were
// using rather than by trusting them.
//
// So: one marker account in Shield. Registering it succeeds exactly
// once per ecosystem lifetime, and it lives in the same store that
// holds the content — wipe the stores and the marker goes with them,
// which is precisely the condition under which re-seeding is correct.
const MARKER = { userId: 'demo-seed-marker', displayName: 'Seed Marker', password: 'demo-pass-1234' };
let alreadySeeded = false;

async function checkMarker() {
  const res = await call('shield', 'POST', '/api/shield/register', { body: MARKER });
  // A failure here means the account exists, which means a previous run
  // completed against these stores.
  alreadySeeded = !res.ok;
  return alreadySeeded;
}

// ---------------------------------------------------------------------
// People, first. Everything else acts as one of them.
// ---------------------------------------------------------------------
async function seedPeople() {
  for (const person of PEOPLE) {
    // Register is not idempotent, so try it and fall back to login —
    // which also means a second run reuses the accounts rather than
    // failing on them.
    let res = await call('shield', 'POST', '/api/shield/register', { body: person });
    if (!res.ok) {
      res = await call('shield', 'POST', '/api/shield/login', {
        body: { userId: person.userId, password: person.password },
      });
      skipped.push(`shield: ${person.userId} already registered`);
    } else {
      created.push(`shield: ${person.displayName}`);
    }
    const token = res.body?.sessionToken;
    if (!token) { failed.push(`shield: no session for ${person.userId}`); continue; }
    sessions.set(person.userId, token);
  }
}

// ---------------------------------------------------------------------
// Content, app by app. Each block is small and independent: one app
// being unavailable must not stop the rest, which is why every call
// goes through `seed()` and records rather than throws.
// ---------------------------------------------------------------------
async function seedVxllage() {
  const posts = [
    ['demo-elena', 'Riverside Hub is live. Four drone routes cleared this morning and the north corridor finally has coverage.'],
    ['demo-marcus', 'Three years of shooting in the same block and I still find a wall I have not photographed.'],
    ['demo-priya', 'Anyone else running the Tuesday hunt? The Kings Highway route has changed since last month.'],
    ['demo-kai', 'New release is up. Mastered it twice and the second pass was the one.'],
  ];
  for (const [authorId, text] of posts) {
    await seed(`vxllage: post by ${authorId}`, {
      existing: async () => (alreadySeeded ? 'ecosystem already seeded' : null),
      make: async () => must(
        await call('vxllage', 'POST', '/api/posts', { as: authorId, body: { authorId, text } }),
        'createPost',
      ),
    });
  }
}

async function seedHvntz() {
  const businesses = [
    ['demo-elena', 'Vasquez Coffee Roasters'],
    ['demo-marcus', 'Bell Camera Repair'],
    ['demo-priya', 'Anand Books & Records'],
  ];
  for (const [ownerId, name] of businesses) {
    await seed(`hvntz: ${name}`, {
      existing: async () => (alreadySeeded ? 'ecosystem already seeded' : null),
      make: async () => must(
        await call('hvntz', 'POST', '/api/business', { as: ownerId, body: { ownerId, name } }),
        'registerBusiness',
      ),
    });
  }
}

async function seedDreams() {
  const screens = [
    ['demo-elena', 'Riverside Hub — front window', '4100 N Broadway, St. Louis, MO'],
    ['demo-priya', 'Anand Books — listening booth', '2715 Cherokee St, St. Louis, MO'],
  ];
  for (const [screenOwnerId, locationName, locationAddress] of screens) {
    await seed(`dreams: screen at ${locationName}`, {
      existing: async () => {
        const list = await call('dreams', 'GET', '/api/screens');
        const hit = (list.body?.screens || []).some((s) => s.locationName === locationName);
        return hit ? 'already registered' : null;
      },
      make: async () => must(
        await call('dreams', 'POST', '/api/screens', {
          as: screenOwnerId, body: { screenOwnerId, locationName, locationAddress },
        }),
        'registerScreen',
      ),
    });
  }
}

async function seedMusic() {
  const releases = [
    ['demo-kai', 'Second Pass', 'album'],
    ['demo-marcus', 'Corridor Light', 'single'],
  ];
  for (const [artistId, title, format] of releases) {
    await seed(`vulture-music: "${title}"`, {
      existing: async () => (alreadySeeded ? 'ecosystem already seeded' : null),
      make: async () => must(
        await call('vulture-music', 'POST', '/api/releases', {
          as: artistId,
          body: { artistId, title, format, targetPlatforms: ['Spotify', 'Apple Music', 'SoundCloud'] },
        }),
        'submitRelease',
      ),
    });
  }
}

async function seedCvnvo() {
  for (const person of PEOPLE.slice(0, 3)) {
    await seed(`cvnvo: profile for ${person.displayName}`, {
      existing: async () => {
        const res = await call('cvnvo', 'GET', `/api/profiles/${person.userId}`);
        return res.ok ? 'profile exists' : null;
      },
      make: async () => must(
        await call('cvnvo', 'POST', '/api/profiles', {
          as: person.userId,
          body: {
            userId: person.userId,
            compatibilityInputs: {
              age: 31,
              interests: ['photography', 'cycling', 'record shops'],
              seekingAgeMin: 27,
              seekingAgeMax: 40,
              lat: 38.627,
              lng: -90.199,
            },
            prompts: [
              { question: 'A neighbourhood I know well', answer: 'The blocks north of the old rail line.' },
              { question: 'Something I am working on', answer: 'Getting better at saying no to good ideas.' },
            ],
          },
        }),
        'createUserProfile',
      ),
    });
  }
}

// ---------------------------------------------------------------------

async function main() {
  process.stdout.write(DRY ? 'seed-demo (dry run)\n\n' : 'seed-demo\n\n');

  const health = await fetch(`http://localhost:${PORTS.shield}/api/health`).catch(() => null);
  if (!health || !health.ok) {
    process.stderr.write(
      'seed-demo: Shield is not answering on :8812. Start the ecosystem first:\n'
      + '  ./start-ecosystem.sh\n',
    );
    process.exit(1);
  }

  await checkMarker();
  if (alreadySeeded) {
    process.stdout.write('  (these stores have been seeded before — creating only what is missing)\n\n');
  }

  await seedPeople();
  if (sessions.size === 0) {
    process.stderr.write('seed-demo: no sessions — cannot seed anything as a user.\n');
    process.exit(1);
  }

  await seedVxllage();
  await seedHvntz();
  await seedDreams();
  await seedMusic();
  await seedCvnvo();

  for (const line of created) process.stdout.write(`  +  ${line}\n`);
  for (const line of skipped) process.stdout.write(`  =  ${line}\n`);
  for (const line of failed) process.stdout.write(`  !  ${line}\n`);

  process.stdout.write(
    `\nseed-demo: ${created.length} created, ${skipped.length} already present, `
    + `${failed.length} failed.\n`,
  );

  if (failed.length > 0) {
    process.stdout.write(
      'A failure here is a real one: every call above is the same call a real user makes,\n'
      + 'through the same guards and the same validation. Read the message rather than\n'
      + 'working around it.\n',
    );
    process.exit(1);
  }

  process.stdout.write('\nSign in at the shell as any of:\n');
  for (const p of PEOPLE) process.stdout.write(`  ${p.userId} / ${p.password}\n`);
}

main().catch((err) => {
  process.stderr.write(`seed-demo: ${err.stack}\n`);
  process.exit(1);
});
