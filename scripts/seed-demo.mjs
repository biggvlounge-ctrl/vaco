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
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry-run');

// **The service credential, and why it is read from a file.**
//
// `start-ecosystem.sh` generates a per-boot dev token and exports it.
// An export reaches that script's children -- the 36 apps -- and
// nothing else. `deploy/replit-boot.sh` runs the launcher as one child
// and this script as another, so the export never arrives here and
// `process.env.VACO_SERVICE_TOKEN` was an empty string on every Replit
// boot. The launcher now also drops the token in `logs/service-token`
// (gitignored, mode 600), which is the one place both processes can
// see. The environment still wins when it is set, which is what a real
// deployment does.
const SERVICE_TOKEN = process.env.VACO_SERVICE_TOKEN || readDevServiceToken();

function readDevServiceToken() {
  try {
    return fs.readFileSync(path.join(REPO_ROOT, 'logs', 'service-token'), 'utf8').trim();
  } catch {
    return '';
  }
}

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
  hvntz: 8792, dreams: 8814, 'vulture-music': 8806, 'vacon-c': 8809,
  chopz: 8800, 'chopz-shop': 8801, 'vulture-pods': 8810,
  'vulture-flix': 8807, 'vulture-studios': 8815, venvm: 8813,
  vsafe: 8799, voidmagic: 8797, vaca: 8804, yap: 8802, vacay: 8803,
};

// A missing port here produced `http://localhost:undefined/...`, which
// fetch rejects with "Failed to parse URL" -- caught by `seed()` and
// reported as a failed step rather than crashing, which is the right
// behaviour and still an easy thing to not notice in a long run. Every
// app this script names must have a port, so check rather than trust.
for (const app of Object.keys(PORTS)) {
  if (!Number.isInteger(PORTS[app])) {
    throw new Error(`seed-demo: PORTS.${app} is not a port number`);
  }
}

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
            // **No `bio` here on purpose.** CVNVO's profile card renders
            // `profile.bio || 'No bio yet.'`, but `createUserProfile`
            // accepts only userId, prompts, verifiedBadge and
            // compatibilityInputs -- there is no bio on the model, so a
            // bio sent here is dropped silently and the card still says
            // "No bio yet." Seeding one would be a line of code that
            // looks like it works and does nothing. `chopz-shop` has
            // the same shape of gap: its UI reads `p.name` and
            // `createProduct` has no name field, so every product
            // renders as "Product <id>". Both are app-side gaps, noted
            // rather than papered over from here.
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
// The apps that had nothing at all.
//
// Measured before writing any of this: 14 of the 30 apps that keep a
// store had **zero** records in it after a clean boot. Five of those
// are infrastructure that fills from other apps' activity (the audit
// log, operator credentials, media grants, the identity register, the
// network) and seeding them directly would be writing fiction into a
// ledger. The nine below are user-facing and were simply empty.
//
// **Every payload here was derived by asking the app, not by reading a
// validator and hoping.** Each was driven to a 201 against the running
// ecosystem, one 400 at a time, and the fields are what the app
// actually demanded. Several are non-obvious -- `budgetRequested` not
// `budget`, `check-ins` not `checkins`, an enum of exactly four
// mediums -- and a guess would have produced a seeder that silently
// created nothing.
// ---------------------------------------------------------------------

// Two apps expose creation only to internal schedulers, so these go
// through the service credential rather than a user session. That is
// the guard working: a person does not register a studio title.
async function seedChopz() {
  const videos = [
    ['demo-marcus', 'https://media.vaco.local/demo/corridor-light.mp4', 'Third take, first light.'],
    ['demo-kai', 'https://media.vaco.local/demo/second-pass.mp4', 'Mastering the B-side twice.'],
  ];
  for (const [creatorId, mediaUrl, caption] of videos) {
    await seed(`chopz: video by ${creatorId}`, {
      existing: async () => (alreadySeeded ? 'ecosystem already seeded' : null),
      make: async () => must(
        await call('chopz', 'POST', '/chopz/videos', { as: creatorId, body: { creatorId, mediaUrl, caption } }),
        'createChopzVideo',
      ),
    });
  }
}

async function seedChopzShop() {
  const products = [
    ['demo-elena', 'Riverside House Blend', 18],
    ['demo-priya', 'Reissue bundle — three LPs', 64],
  ];
  for (const [sellerId, name, price] of products) {
    await seed(`chopz-shop: ${name}`, {
      existing: async () => (alreadySeeded ? 'ecosystem already seeded' : null),
      make: async () => must(
        await call('chopz-shop', 'POST', '/chopz-shop/products', { as: sellerId, body: { sellerId, name, price } }),
        'createProduct',
      ),
    });
  }
}

async function seedPods() {
  const shows = [
    ['demo-kai', 'The Corridor', 'culture', 'Field recordings and the people who make them.'],
    ['demo-priya', 'Counter Culture', 'business', 'Independent shops, and what it costs to keep one open.'],
  ];
  for (const [creatorId, title, category, description] of shows) {
    await seed(`vulture-pods: "${title}"`, {
      existing: async () => (alreadySeeded ? 'ecosystem already seeded' : null),
      make: async () => must(
        await call('vulture-pods', 'POST', '/api/shows', { as: creatorId, body: { creatorId, title, category, description } }),
        'createShow',
      ),
    });
  }
}

// Studios greenlights, Flix carries the finished thing. Seeded as one
// chain because Flix genuinely requires a real studioProjectId -- it
// refuses a title that no project produced, which is the integrity
// rule the two apps exist to demonstrate.
async function seedStudiosAndFlix() {
  const project = await seed('vulture-studios: "Corridor Light" greenlit', {
    existing: async () => (alreadySeeded ? 'ecosystem already seeded' : null),
    make: async () => must(
      await call('vulture-studios', 'POST', '/api/projects', {
        service: true,
        body: {
          title: 'Corridor Light', medium: 'film', source: 'original', format: 'feature',
          synopsis: 'A mastering engineer and the take he cannot let go.',
          budgetRequested: 250000,
        },
      }),
      'greenlightProject',
    ),
  });

  if (!project) return;
  await seed('vulture-flix: "Corridor Light" on the service', {
    make: async () => must(
      await call('vulture-flix', 'POST', '/api/titles/studio-produced', {
        service: true,
        body: {
          studioId: 'vavlt-stvdios', studioProjectId: project.id, type: 'film',
          title: 'Corridor Light',
          synopsis: 'A mastering engineer and the take he cannot let go.',
        },
      }),
      'registerStudioProducedTitle',
    ),
  });
}

async function seedVenvm() {
  await seed('venvm: a trailer script request', {
    existing: async () => (alreadySeeded ? 'ecosystem already seeded' : null),
    make: async () => must(
      await call('venvm', 'POST', '/api/scripts', {
        service: true,
        body: {
          ownerId: 'demo-kai', requesterApp: 'vulture-studios',
          title: 'Corridor Light — trailer',
          brief: 'Sixty seconds, one location, no dialogue.',
        },
      }),
      'submitScriptRequest',
    ),
  });
}

async function seedVsafe() {
  await seed('vsafe: a check-in with trusted contacts', {
    existing: async () => (alreadySeeded ? 'ecosystem already seeded' : null),
    make: async () => must(
      await call('vsafe', 'POST', '/api/check-ins', {
        as: 'demo-priya',
        body: {
          userId: 'demo-priya', sourceApp: 'hvntz', activityType: 'hunt',
          trustedContactIds: ['demo-elena', 'demo-kai'],
          checkInWindowMinutes: 90,
          expectedReturn: new Date(Date.now() + 3600e3).toISOString(),
          location: 'Kings Highway route', note: 'Tuesday hunt.',
        },
      }),
      'createSafetyCheckIn',
    ),
  });
}

// VACAY had 30 records and an empty front page: its seeded content sat
// in other collections while the Stays tab -- the first thing anyone
// sees -- read `/api/bookings/listings`, which had nothing in it. A
// reminder that "the store is populated" and "the app looks alive" are
// different measurements, and only the second one matters to a demo.
async function seedVacay() {
  const stays = [
    ['demo-elena', 'Loft above the roastery', 'individual', 120,
      'One room over the roasting floor. Quiet after four, and the whole place smells like the morning batch.'],
    ['demo-priya', 'Rooms at the record shop', 'professional', 85,
      'Two rooms behind the listening booth, on the Cherokee Street side.'],
  ];
  for (const [hostId, title, hostType, pricePerNight, description] of stays) {
    await seed(`vacay: "${title}"`, {
      // Per listing, not per app. Checking "are there any listings?"
      // meant the first one created made every later one skip, so this
      // seeded exactly one of two stays and reported success.
      existing: async () => {
        const res = await call('vacay', 'GET', '/api/bookings/listings', { as: hostId });
        const rows = res.body?.listings || [];
        return rows.some((l) => l.title === title) ? 'already listed' : null;
      },
      make: async () => must(
        await call('vacay', 'POST', '/api/bookings/listings', {
          as: hostId,
          body: {
            hostId, hostType, type: 'stay', title, description,
            pricePerNight, location: 'St. Louis, MO',
          },
        }),
        'createListing',
      ),
    });
  }
}

async function seedVoidmagic() {
  await seed('voidmagic: a hosted experience', {
    existing: async () => (alreadySeeded ? 'ecosystem already seeded' : null),
    make: async () => must(
      await call('voidmagic', 'POST', '/api/experiences', {
        as: 'demo-elena',
        body: {
          hostId: 'demo-elena', title: 'Roastery tour & cupping',
          type: 'meet-greet', format: 'physical',
          location: '4100 N Broadway, St. Louis, MO',
          price: 35, capacity: 12, durationMinutes: 90,
          scheduledAt: Date.now() + 7 * 24 * 3600e3,
        },
      }),
      'createExperience',
    ),
  });
}

// **VACA is seeded as far as a machine may take it, and no further.**
//
// A verification is *submitted* here and left `pending`. Approving one
// is refused to a service credential on purpose:
//
//   vaca:verify required: this route decides an outcome somebody
//   loses, so it needs a human operator credential.
//
// So the demo shows a real verification queue with something in it,
// awaiting a human — which is the honest depiction of how this works.
//
// **This is why YAP is not seeded.** Yap accepts a report only from a
// reporter whose CVNVO profile carries `verifiedBadge`, and that badge
// is fetched live from VACA and is true only once an operator has
// approved the identity claim. Seeding a Yap report would therefore
// mean auto-approving an identity verification, and Yap's guard exists
// precisely to stop unverified accusations. An empty Yap is the
// correct state for an ecosystem where no human has reviewed anything
// yet; a populated one would misrepresent the guard.
async function seedVaca() {
  for (const person of PEOPLE.slice(0, 2)) {
    await seed(`vaca: identity claim for ${person.displayName}`, {
      existing: async () => (alreadySeeded ? 'ecosystem already seeded' : null),
      make: async () => must(
        await call('vaca', 'POST', '/api/verifications', {
          service: true,
          body: {
            subjectType: 'cvnvo-user', subjectId: person.userId, claimType: 'identity',
            signature: `${person.userId}-signature`,
            evidence: 'Government ID checked against a live selfie.',
          },
        }),
        'submitVerification',
      ),
    });
  }
}

// ---------------------------------------------------------------------
// VACON-C, by delegating to the seeder it already ships.
//
// **This was already written and nothing ran it.** `vacon-c/scripts/
// seed-world.mjs` builds 12 people, three households with finances, two
// factions, a city with three wards, territory, an economy, two
// cultures and six buildings -- 72 objects. It existed, it worked, and
// no boot path called it, so the simulation's dashboard showed 32
// counters all reading zero on a freshly booted ecosystem. That is the
// app most worth showing anyone, presenting as the most broken.
//
// Delegated rather than restated: that script knows the shape of a
// world worth looking at and this one does not, and two copies of that
// knowledge would drift. It is spawned with a real signed-in user's
// session, so every object is created through the same guards as any
// other caller.
//
// The drought it tries last needs an operator credential and is refused
// without one. That refusal is correct -- conditions and ticks change
// the world for everybody -- and the seeder treats it as a clean stop,
// leaving a fully populated world behind. Nothing here relaxes a guard
// to get a better demo.
async function seedVaconC() {
  await seed('vacon-c: a populated world', {
    existing: async () => {
      const res = await call('vacon-c', 'GET', '/api/families', { as: PEOPLE[0].userId });
      const rows = Array.isArray(res.body) ? res.body : (res.body?.families || []);
      return rows.length > 0 ? `${rows.length} families already` : null;
    },
    make: async () => {
      const token = sessions.get(PEOPLE[0].userId);
      if (!token) throw new Error('no session to seed the world with');

      const run = spawnSync(
        process.execPath, [path.join('scripts', 'seed-world.mjs')],
        {
          cwd: path.join(REPO_ROOT, 'vacon-c'),
          encoding: 'utf8',
          env: { ...process.env, VACON_C_TOKEN: token, VACON_C_URL: `http://localhost:${PORTS['vacon-c']}` },
        },
      );
      if (run.error) throw run.error;
      if (run.status !== 0) {
        throw new Error(`seed-world.mjs exited ${run.status}: ${(run.stderr || run.stdout || '').trim().slice(0, 200)}`);
      }
      const count = (run.stdout.match(/(\d+) objects created/) || [])[1];
      if (!count || Number(count) === 0) {
        throw new Error('seed-world.mjs reported no objects created');
      }
      return { objects: Number(count) };
    },
  });
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

  // VACA first: CVNVO reads identity status live when a profile is
  // created and stores the answer, so a claim submitted afterwards
  // would not be reflected on a profile that already exists.
  await seedVaca();

  await seedVxllage();
  await seedHvntz();
  await seedDreams();
  await seedMusic();
  await seedCvnvo();
  await seedChopz();
  await seedChopzShop();
  await seedPods();
  await seedStudiosAndFlix();
  await seedVenvm();
  await seedVsafe();
  await seedVacay();
  await seedVoidmagic();
  await seedVaconC();

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
