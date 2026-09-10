// Drives an app's frontend in a real browser and reports what broke.
//
// **Why this exists rather than curl.** A page can serve 200, link a
// stylesheet that 200s, and still render nothing — the design system's
// own first draft did exactly that, with every CSS variable resolving to
// empty because of a nested comment. The only way to catch that class of
// failure is to load the page, let it run, and then assert on what the
// browser actually computed.
//
// For each app it checks, in order:
//   1. the page loads and the runtime boots (a masthead exists)
//   2. design tokens actually resolve to values
//   3. every tab renders without throwing
//   4. no console errors, no failed network requests to its own origin
//   5. no tab is left showing the loading placeholder
//
//   node scripts/smoke-frontend.mjs void:8793 voken:8794 ...
//   node scripts/smoke-frontend.mjs --shot=/tmp/out void:8793

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Playwright is resolved at runtime rather than imported by a fixed
// path. It used to be hardcoded to this workstation's global install
// (`/opt/node22/lib/node_modules/playwright/index.mjs`), which worked
// here and would fail on any other machine — including CI, which is
// where an unattended smoke test is worth the most.
//
// Order: a normal resolution first (a local `npm i -D playwright`, or
// NODE_PATH), then PLAYWRIGHT_MODULE if someone needs to point at a
// specific copy, then the known global path as a last resort so this
// keeps working unchanged on the machine it was written on.
async function loadChromium() {
  const candidates = [
    'playwright',
    process.env.PLAYWRIGHT_MODULE,
    '/opt/node22/lib/node_modules/playwright/index.mjs',
  ].filter(Boolean);
  const tried = [];
  for (const candidate of candidates) {
    try {
      return (await import(candidate)).chromium;
    } catch (err) {
      tried.push(`  ${candidate}\n    ${err.message.split('\n')[0]}`);
    }
  }
  process.stderr.write(`smoke-frontend: could not load Playwright. Tried:\n${tried.join('\n')}\n\n`
    + 'Install it (npm i -D playwright) or set PLAYWRIGHT_MODULE to a path.\n');
  process.exit(2);
}

const chromium = await loadChromium();

const args = process.argv.slice(2);
const shotDir = (args.find((a) => a.startsWith('--shot=')) || '').split('=')[1] || null;

// `--all` reads the APPS array in start-ecosystem.sh — the same
// authoritative manifest install-ecosystem.sh, generate-docker-compose.js
// and generate-nginx-conf.js already parse. One source of truth for
// "what apps exist", so a new app is smoke-tested without anyone
// editing a second list here or in a CI workflow.
//
// VENVS and VDP are excluded: they are Vite apps that predate this
// design system and serve a built bundle, so the assertions below
// (masthead, VACO tokens, tab rendering) do not apply to them.
//
// **Headless services are excluded too, and that was a real problem
// until it was.** `vaco-audit`, `vaco-operator` and `vaco-media` have
// no `public/` at all — they are infrastructure other services call,
// never opened by a person. Running the frontend assertions against
// them produced three permanent, meaningless failures on every `--all`
// run: 404, no masthead, no tokens, no tabs. A check that cries wolf
// on three apps by design is a check people learn to skim, and the
// next real frontend failure hides in that noise.
//
// `dev-docs/COMPLETION_BY_APP.md` already treats these three as
// headless for exactly the same reason. The list is re-earned on every
// run below rather than trusted: an app here that grows a `public/`
// fails the run as a stale exemption instead of quietly going
// untested.
// The repo root, needed by the manifest filter above before the
// existing `repoRoot` const is reached.
function repoRootOf(metaUrl) {
  return path.dirname(path.dirname(fileURLToPath(metaUrl)));
}

const HEADLESS = new Set(['vaco-audit', 'vaco-operator', 'vaco-media']);

function targetsFromManifest() {
  const manifest = fs.readFileSync(
    path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'start-ecosystem.sh'),
    'utf8',
  );
  const block = manifest.match(/^APPS=\(([\s\S]*?)^\)/m);
  if (!block) throw new Error('smoke-frontend: could not find the APPS array in start-ecosystem.sh');
  const all = [...block[1].matchAll(/"([^"]+)"/g)]
    .map((match) => match[1].split(':'))
    .map(([name, appPath, , port]) => ({ name, appPath, port: Number(port) }))
    // **Split on the entry point, not the command string.** This read
    // `command === 'npm start'` until the manifest changed those to
    // `node server.js` to save a process per app — at which point this
    // filter would have matched nothing and the smoke test would have
    // passed having checked zero pages. A filter that yields an empty
    // set is not a failure to any test framework; it is a silent one.
    .filter((a) => fs.existsSync(path.join(repoRootOf(import.meta.url), a.appPath, 'server.js')));

  if (all.length === 0) {
    throw new Error(
      'smoke-frontend: no app in the manifest has a server.js. This check would report success '
      + 'having loaded nothing, so it refuses instead.',
    );
  }

  // The headless exemption re-earns itself. An app on the list that now
  // serves a page is a stale exemption hiding a real, untested
  // frontend, which is worse than the noise the list removes.
  const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const stale = all.filter((a) => HEADLESS.has(a.name)
    && fs.existsSync(path.join(repoRoot, a.appPath, 'public', 'index.html')));
  if (stale.length > 0) {
    throw new Error(`smoke-frontend: ${stale.map((a) => a.name).join(', ')} `
      + 'is treated as headless but now serves public/index.html. '
      + 'Remove it from HEADLESS so its frontend is actually smoke-tested.');
  }

  const missing = [...HEADLESS].filter((n) => !all.some((a) => a.name === n));
  if (missing.length > 0) {
    throw new Error(`smoke-frontend: ${missing.join(', ')} is on the headless list `
      + 'but is not a backend in start-ecosystem.sh\'s manifest — the app was renamed or removed.');
  }

  const skipped = all.filter((a) => HEADLESS.has(a.name)).map((a) => a.name);
  if (skipped.length > 0) {
    process.stdout.write(`skipping ${skipped.length} headless service(s) with no frontend by design: `
      + `${skipped.join(', ')}\n\n`);
  }
  return all.filter((a) => !HEADLESS.has(a.name));
}

const targets = args.includes('--all')
  ? targetsFromManifest()
  : args.filter((a) => !a.startsWith('--')).map((a) => {
    const [name, port] = a.split(':');
    return { name, port: Number(port) };
  });

const browser = await chromium.launch();
let failures = 0;

for (const target of targets) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const problems = [];
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
  page.on('requestfailed', (r) => {
    // Only this app's own requests matter; a sibling service being down
    // is a different problem than this page being broken.
    if (r.url().includes(`:${target.port}`)) problems.push('requestfailed: ' + r.url());
  });

  const url = `http://localhost:${target.port}/`;
  let tabs = [];
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });

    const booted = await page.locator('.vaco-masthead').count();
    if (!booted) problems.push('runtime did not boot (no .vaco-masthead)');

    const tokens = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      return {
        space: cs.getPropertyValue('--vaco-space-4').trim(),
        accent: cs.getPropertyValue('--vaco-accent').trim(),
        bg: getComputedStyle(document.body).backgroundColor,
      };
    });
    if (tokens.space !== '16px') problems.push(`design tokens did not resolve (--vaco-space-4="${tokens.space}")`);
    if (!tokens.accent) problems.push('no accent colour set');

    tabs = await page.locator('.vaco-tab').allTextContents();
    if (!tabs.length) problems.push('no tabs rendered');

    for (let i = 0; i < tabs.length; i++) {
      await page.locator('.vaco-tab').nth(i).click();
      await page.waitForTimeout(700);
      const stuck = await page.locator('#vaco-main .vaco-empty', { hasText: 'Loading…' }).count();
      if (stuck) problems.push(`tab "${tabs[i]}" stuck on Loading…`);
      const failed = await page.locator('#vaco-main .vaco-notice-danger').count();
      if (failed) {
        const text = await page.locator('#vaco-main .vaco-notice-danger').first().innerText();
        problems.push(`tab "${tabs[i]}" failed: ${text.replace(/\s+/g, ' ').slice(0, 140)}`);
      }
      if (shotDir && i === 0) {
        await page.screenshot({ path: `${shotDir}/${target.name}.png` });
      }
    }
  } catch (err) {
    problems.push('fatal: ' + err.message);
  }

  const ok = problems.length === 0;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${target.name.padEnd(18)} tabs=${tabs.length}`);
  problems.forEach((p) => console.log(`        - ${p}`));
  await page.close();
}

await browser.close();
console.log(failures ? `\n${failures} app(s) failed.` : `\nAll ${targets.length} app(s) passed.`);
process.exit(failures ? 1 : 0);
