// Every app has a price, and every price is a decision somebody made.
//
// **What this is really guarding.** The store seeded a listing for each
// registry app and fell through to `free` for anything not in
// `PAID_LISTINGS` — 32 of 36. The prices that produced were right, but
// they were right by default rather than by decision, and the next app
// added would have been free for no reason at all. "Free" that nobody
// chose is indistinguishable from "free" that somebody did, right up
// until you try to explain the business model.
//
// So `FREE_LISTINGS` names every free app with the reason, and this
// requires the two tables together to cover the registry exactly: no
// app unpriced, no price for an app that no longer exists.

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { APPS } = await import(path.join(REPO_ROOT, 'vaco-shell', 'lib', 'registry.js'));
const { PAID_LISTINGS, FREE_LISTINGS } = await import(
  path.join(REPO_ROOT, 'vaco-shell', 'lib', 'seedStore.js'));

// The one app deliberately not sold: the retired V3/Shield mock.
const NOT_LISTED = new Set(['v3-shield']);
const sellable = APPS.filter((a) => !NOT_LISTED.has(a.id)).map((a) => a.id);

test('the pricing tables found a real registry, not an empty one', () => {
  assert.ok(sellable.length > 30, `only ${sellable.length} sellable apps — the registry import is broken`);
  assert.ok(Object.keys(PAID_LISTINGS).length > 0, 'no paid listings at all');
  assert.ok(Object.keys(FREE_LISTINGS).length > 0, 'no free listings at all');
});

test('every app has a pricing decision', () => {
  const priced = new Set([...Object.keys(PAID_LISTINGS), ...Object.keys(FREE_LISTINGS)]);
  const missing = sellable.filter((id) => !priced.has(id));
  assert.deepEqual(missing, [],
    'these apps would be priced by fallthrough rather than by decision — add each to '
    + 'PAID_LISTINGS or FREE_LISTINGS in vaco-shell/lib/seedStore.js');
});

test('no app is in both tables, and none is priced twice', () => {
  const both = Object.keys(PAID_LISTINGS).filter((id) => id in FREE_LISTINGS);
  assert.deepEqual(both, [], 'these apps are listed as both paid and free');
});

test('no price names an app that does not exist', () => {
  const known = new Set(APPS.map((a) => a.id));
  const ghosts = [...Object.keys(PAID_LISTINGS), ...Object.keys(FREE_LISTINGS)]
    .filter((id) => !known.has(id));
  assert.deepEqual(ghosts, [], 'these priced apps are not in the registry any more');
});

test('every paid listing is actually priced', () => {
  // A "paid" app at 0 VCoin is a free app with extra steps, and a
  // subscription with no period does not say what is being billed.
  for (const [id, listing] of Object.entries(PAID_LISTINGS)) {
    assert.ok(['one-time', 'subscription'].includes(listing.pricingModel),
      `${id}: pricingModel "${listing.pricingModel}" is not a paid model`);
    assert.ok(Number.isFinite(listing.priceVcoin) && listing.priceVcoin > 0,
      `${id}: paid listing priced at ${listing.priceVcoin} VCoin`);
    if (listing.pricingModel === 'subscription') {
      assert.ok(listing.subscriptionPeriod,
        `${id}: a subscription with no subscriptionPeriod does not say what is billed`);
    }
  }
});

test('every free listing says why it is free', () => {
  // The reason is the whole point of the table. An empty string would
  // restore the fallthrough while looking like a decision.
  const REASONS = new Set(['transacts', 'infrastructure']);
  for (const [id, reason] of Object.entries(FREE_LISTINGS)) {
    assert.ok(REASONS.has(reason),
      `${id}: "${reason}" is not one of the recorded reasons (${[...REASONS].join(', ')})`);
  }
});
