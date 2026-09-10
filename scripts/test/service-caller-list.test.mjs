// Every place that names V3's service callers must name the same set.
//
// **This list has drifted twice, in two different files, for the same
// reason: it was copied.**
//
// `.env.example` held 16 names while the derivation found 19 —
// chopz-shop, vaco-analytics and vsafe had been wired since and nobody
// re-copied them. `generate-service-tokens.mjs` fixed that by deriving
// the file instead of maintaining it, and its own header predicted the
// drift it then found.
//
// `start-ecosystem.sh` was the copy nobody checked. It held 19 names
// against a derived 27, so a local boot allowlisted 19 services and the
// other eight — chopz, v4-proxy, vaca, vaco-notify, vaco-operator,
// vacon, vacon-c, venvm — got 403 from V3 on every service call they
// made. That was confirmed against a running stack, not reasoned:
// V3's own `/api/health` reported `allowlistedServices` of exactly 19.
//
// Both now derive. This is the check that says so, because "both
// derive" is itself a claim that can quietly stop being true.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function derivedCallers() {
  const r = spawnSync(process.execPath, ['scripts/generate-service-tokens.mjs', '--list'],
    { cwd: REPO_ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, `generate-service-tokens --list failed: ${r.stderr}`);
  const names = r.stdout.trim().split(/\s+/).filter(Boolean);
  assert.ok(names.length > 0, '--list produced no callers, which is almost certainly a broken scan');
  return names;
}

test('start-ecosystem.sh derives its caller list rather than hardcoding one', () => {
  const script = fs.readFileSync(path.join(REPO_ROOT, 'start-ecosystem.sh'), 'utf8');
  const assignment = script.match(/^VACO_CALLERS=(.*)$/m);
  assert.ok(assignment, 'start-ecosystem.sh no longer sets VACO_CALLERS at all');

  // A literal list of names is exactly the shape that drifted. It must
  // be a command substitution, not a string somebody keeps up to date.
  assert.match(assignment[1], /\$\(.*generate-service-tokens\.mjs.*--list.*\)/,
    'VACO_CALLERS is hardcoded again. A local boot then allowlists whichever names happen to be '
    + 'in that string, and every app missing from it gets 403 from V3 — silently, because service '
    + 'calls fail soft on signals.');
});

test('a boot that cannot derive the list refuses rather than falling back', () => {
  // Falling back to a shorter list is precisely what caused the
  // failure: a stack that boots with eight services silently unable to
  // reach V3 is worse than one that will not boot.
  const script = fs.readFileSync(path.join(REPO_ROOT, 'start-ecosystem.sh'), 'utf8');
  assert.match(script, /if \[ -z "\$VACO_CALLERS" \]/,
    'start-ecosystem.sh no longer checks that the derivation produced anything');
  assert.match(script, /exit 1/,
    'start-ecosystem.sh no longer exits when the caller list cannot be derived');
});

test('.env.example still matches the derived list', () => {
  // `generate-service-tokens.mjs --check` owns this comparison; running
  // it here means the whole caller-list question fails in one place.
  const r = spawnSync(process.execPath, ['scripts/generate-service-tokens.mjs', '--check'],
    { cwd: REPO_ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
});

test('every derived caller is a real app in the manifest', () => {
  // The derivation reads `V3_API_URL` usage, so a stale reference in a
  // deleted app's leftover file would invent a caller that cannot be
  // allowlisted because it does not exist.
  const manifest = fs.readFileSync(path.join(REPO_ROOT, 'start-ecosystem.sh'), 'utf8');
  const block = manifest.match(/APPS=\(([\s\S]*?)\n\)/);
  assert.ok(block, 'start-ecosystem.sh has no APPS manifest');
  const apps = new Set(block[1].split('\n').map((l) => l.trim()).filter((l) => l.startsWith('"'))
    .map((l) => l.slice(1, -1).split(':')[0]));

  const notAnApp = derivedCallers().filter((name) => !apps.has(name));
  assert.deepEqual(notAnApp, [],
    'these are derived as V3 callers but are not apps in the manifest');
});
