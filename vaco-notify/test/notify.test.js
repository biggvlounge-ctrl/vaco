// VACO Notify — proving that a page actually pages.
//
// **Why this file exists.** This service was built to close a gap that
// was recorded three separate times in `COMPLETION_AUDIT.md`: VSAFE
// escalations, DREAMS alerts and Analytics alerts all *record* and page
// nobody. The one way to build a replacement that has the same problem
// is to accept a message, return 202, and drop it.
//
// So the assertions here are not "send returns a notification". They
// are: **did anything actually receive it**, and **when nothing did,
// did the service say so.**
//
// The failures targeted:
//
//   - a critical escalation with no matching subscriber reported as
//     delivered — the exact shape of the bug being fixed
//   - a channel that throws being swallowed into a success
//   - a subscription's severity floor or app filter being ignored, so
//     an on-call phone gets every ad impression
//   - a stub channel silently accepting a message it cannot send

const test = require('node:test');
const assert = require('node:assert');

const notify = require('../lib/notify');

const NOW = Date.UTC(2026, 5, 1);

function store() {
  return notify.createNotifyStore();
}

// A recording adapter set. `sent` is the whole point: it is the
// difference between "the service says delivered" and "something
// received it".
function adapters({ failing = [], throwOn = null } = {}) {
  const sent = [];
  const make = (channel) => async (notification, subscription) => {
    if (failing.includes(channel) || (throwOn && notification.title === throwOn)) {
      throw new Error(`${channel} is down`);
    }
    sent.push({ channel, subscription: subscription.name, title: notification.title });
    return { channel };
  };
  return {
    console: make('console'), file: make('file'), webhook: make('webhook'), sent,
  };
}

// -- The gap this service closes ------------------------------------------

test('a critical escalation with nobody subscribed is reported UNDELIVERED', async () => {
  const s = store();
  const a = adapters();

  const result = await notify.send(s, {
    app: 'vsafe', severity: 'critical',
    title: 'Missed check-in escalated', context: { checkInId: 7 },
    adapters: a, now: NOW,
  });

  // This is the whole reason the service exists. "Nobody was configured
  // to hear this" and "this was heard" are different facts, and
  // conflating them is what made the original gap invisible.
  assert.strictEqual(result.status, 'undelivered');
  assert.strictEqual(result.deliveries.length, 0);
  assert.strictEqual(a.sent.length, 0);
  assert.strictEqual(notify.listUndelivered(s).length, 1,
    'and it must be findable afterwards, not just returned once');
});

test('when every channel fails, the notification is undelivered — not swallowed', async () => {
  const s = store();
  notify.subscribe(s, { name: 'oncall', channel: 'webhook', target: 'https://example.invalid/hook', minSeverity: 'alert' });
  const a = adapters({ failing: ['webhook'] });

  const result = await notify.send(s, {
    app: 'vsafe', severity: 'critical', title: 'Emergency triggered', adapters: a, now: NOW,
  });

  assert.strictEqual(result.status, 'undelivered');
  assert.strictEqual(result.deliveries[0].ok, false);
  assert.match(result.deliveries[0].error, /webhook is down/,
    'the reason must survive — "it failed" without why is not actionable at 3am');
  assert.strictEqual(notify.listUndelivered(s).length, 1);
});

test('one working channel is enough — a partial failure still pages somebody', async () => {
  const s = store();
  notify.subscribe(s, { name: 'oncall', channel: 'webhook', target: 'https://example.invalid/hook', minSeverity: 'alert' });
  notify.subscribe(s, { name: 'log', channel: 'console', minSeverity: 'alert' });
  const a = adapters({ failing: ['webhook'] });

  const result = await notify.send(s, {
    app: 'vsafe', severity: 'critical', title: 'Emergency triggered', adapters: a, now: NOW,
  });

  assert.strictEqual(result.status, 'delivered');
  assert.strictEqual(a.sent.length, 1);
  assert.strictEqual(a.sent[0].channel, 'console');
  // The failure is still recorded even though the overall send worked —
  // a webhook that has been down for a week should be discoverable.
  assert.ok(result.deliveries.some((d) => !d.ok && d.channel === 'webhook'));
});

test('a delivered critical does not appear in the undelivered list', async () => {
  const s = store();
  notify.subscribe(s, { name: 'log', channel: 'console', minSeverity: 'alert' });
  await notify.send(s, { app: 'vsafe', severity: 'critical', title: 'Escalated', adapters: adapters(), now: NOW });
  assert.strictEqual(notify.listUndelivered(s).length, 0);
});

// -- Retries ---------------------------------------------------------------

test('anything claiming to page a human is retried; a signal is not', async () => {
  const s = store();
  notify.subscribe(s, { name: 'log', channel: 'console', minSeverity: 'signal' });

  const critical = await notify.send(s, {
    app: 'vsafe', severity: 'critical', title: 'x', adapters: adapters({ failing: ['console'] }), now: NOW,
  });
  assert.strictEqual(critical.deliveries[0].attempts, notify.ATTEMPTS_BY_SEVERITY.critical);

  const signal = await notify.send(s, {
    app: 'dreams', severity: 'signal', title: 'y', adapters: adapters({ failing: ['console'] }), now: NOW,
  });
  // A dropped impression costs a data point. Retrying it three times
  // spends real capacity on something nobody reads.
  assert.strictEqual(signal.deliveries[0].attempts, 1);
});

test('a retry that eventually succeeds is delivered', async () => {
  const s = store();
  notify.subscribe(s, { name: 'flaky', channel: 'webhook', target: 'https://example.invalid/h', minSeverity: 'alert' });

  let calls = 0;
  const a = {
    webhook: async () => {
      calls += 1;
      if (calls < 3) throw new Error('502 bad gateway');
      return { channel: 'webhook' };
    },
  };

  const result = await notify.send(s, {
    app: 'vaco-analytics', severity: 'alert', title: 'Revenue anomaly', adapters: a, now: NOW,
  });
  assert.strictEqual(result.status, 'delivered');
  assert.strictEqual(result.deliveries[0].attempts, 3);
});

// -- Routing ---------------------------------------------------------------

test('a severity floor keeps ad impressions off the on-call phone', async () => {
  const s = store();
  notify.subscribe(s, { name: 'oncall', channel: 'webhook', target: 'https://example.invalid/h', minSeverity: 'critical' });
  notify.subscribe(s, { name: 'dashboard', channel: 'console', minSeverity: 'signal' });
  const a = adapters();

  await notify.send(s, { app: 'dreams', severity: 'signal', title: 'impression', adapters: a, now: NOW });
  assert.deepStrictEqual(a.sent.map((x) => x.subscription), ['dashboard'],
    'on-call must not hear a signal — a pager that cries wolf gets muted, and then the real one is missed');

  await notify.send(s, { app: 'vsafe', severity: 'critical', title: 'escalation', adapters: a, now: NOW });
  assert.deepStrictEqual(a.sent.slice(1).map((x) => x.subscription).sort(), ['dashboard', 'oncall']);
});

test('an app filter routes a subscription to only the apps it asked for', async () => {
  const s = store();
  notify.subscribe(s, { name: 'safety-team', channel: 'console', minSeverity: 'alert', apps: ['vsafe'] });
  notify.subscribe(s, { name: 'everything', channel: 'file', minSeverity: 'alert', apps: null });
  const a = adapters();

  await notify.send(s, { app: 'dreams', severity: 'alert', title: 'budget exhausted', adapters: a, now: NOW });
  assert.deepStrictEqual(a.sent.map((x) => x.subscription), ['everything'],
    'the safety team does not get paged about an ad budget');

  await notify.send(s, { app: 'vsafe', severity: 'alert', title: 'check-in missed', adapters: a, now: NOW });
  assert.deepStrictEqual(a.sent.slice(1).map((x) => x.subscription).sort(), ['everything', 'safety-team']);
});

// -- Subscriptions ---------------------------------------------------------

test('an unimplemented channel is refused loudly, not stubbed', () => {
  const s = store();

  // A stub that accepts a message and drops it is precisely the bug
  // this service exists to end. Better to fail at subscribe time, when
  // somebody is watching, than at 3am when nobody is.
  for (const channel of notify.UNIMPLEMENTED_CHANNELS) {
    assert.throws(() => notify.subscribe(s, { name: `s-${channel}`, channel, target: 'x' }),
      /not implemented/, `${channel} must be refused`);
  }
  assert.strictEqual(s.subscriptions.length, 0);
});

test('the refusal names the way forward rather than just saying no', () => {
  const s = store();
  assert.throws(() => notify.subscribe(s, { name: 'sms', channel: 'sms', target: '+15551234567' }),
    /webhook/, 'an error that does not say what to do instead gets worked around');
});

test('a webhook subscription without a target is refused', () => {
  const s = store();
  assert.throws(() => notify.subscribe(s, { name: 'nowhere', channel: 'webhook' }), /requires a target URL/);
});

test('duplicate subscription names are refused', () => {
  const s = store();
  notify.subscribe(s, { name: 'oncall', channel: 'console' });
  assert.throws(() => notify.subscribe(s, { name: 'oncall', channel: 'console' }), /already exists/);
  assert.strictEqual(s.subscriptions.length, 1);
});

test('unsubscribing stops delivery, and an unknown name is an error', async () => {
  const s = store();
  notify.subscribe(s, { name: 'oncall', channel: 'console', minSeverity: 'alert' });
  const a = adapters();

  await notify.send(s, { app: 'vsafe', severity: 'alert', title: 'first', adapters: a, now: NOW });
  assert.strictEqual(a.sent.length, 1);

  notify.unsubscribe(s, 'oncall');
  const after = await notify.send(s, { app: 'vsafe', severity: 'alert', title: 'second', adapters: a, now: NOW });
  assert.strictEqual(a.sent.length, 1, 'no new delivery');
  assert.strictEqual(after.status, 'undelivered');

  assert.throws(() => notify.unsubscribe(s, 'ghost'), /no subscription named/);
});

// -- Input ------------------------------------------------------------------

test('a notification needs an app and a title', async () => {
  const s = store();
  await assert.rejects(() => notify.send(s, { severity: 'alert', title: 'x' }), /requires an app/);
  await assert.rejects(() => notify.send(s, { app: 'vsafe', severity: 'alert' }), /requires a title/);
  assert.strictEqual(s.notifications.length, 0, 'a refused send must not be recorded as anything');
});

test('an unknown severity is refused rather than defaulted', async () => {
  const s = store();
  // Defaulting an unrecognised severity down to `signal` would silently
  // demote a typo'd `criticial` escalation to something nobody is paged
  // about.
  await assert.rejects(() => notify.send(s, { app: 'vsafe', severity: 'criticial', title: 'x' }),
    /invalid severity/);
});

test('context travels with the notification so a responder can act on it', async () => {
  const s = store();
  notify.subscribe(s, { name: 'log', channel: 'console', minSeverity: 'alert' });

  const result = await notify.send(s, {
    app: 'vsafe', severity: 'critical',
    title: 'Missed check-in escalated',
    body: 'ada did not confirm safe within the window.',
    context: { checkInId: 7, userId: 'ada', trustedContactIds: ['rio', 'kai'], sourceApp: 'cvnvo' },
    adapters: adapters(), now: NOW,
  });

  // "Something happened to somebody" is not actionable. The trusted
  // contacts are the entire point of a VSAFE escalation.
  assert.deepStrictEqual(result.context.trustedContactIds, ['rio', 'kai']);
  assert.strictEqual(result.context.checkInId, 7);
  assert.strictEqual(notify.getNotification(s, result.id).context.userId, 'ada');
});

test('the history is queryable by app and severity', async () => {
  const s = store();
  notify.subscribe(s, { name: 'log', channel: 'console', minSeverity: 'signal' });
  const a = adapters();
  await notify.send(s, { app: 'vsafe', severity: 'critical', title: 'a', adapters: a, now: NOW });
  await notify.send(s, { app: 'dreams', severity: 'signal', title: 'b', adapters: a, now: NOW });
  await notify.send(s, { app: 'vsafe', severity: 'alert', title: 'c', adapters: a, now: NOW });

  assert.strictEqual(notify.listNotifications(s, { app: 'vsafe' }).length, 2);
  assert.strictEqual(notify.listNotifications(s, { severity: 'critical' }).length, 1);
  assert.strictEqual(notify.listNotifications(s)[0].title, 'c', 'newest first');
});
