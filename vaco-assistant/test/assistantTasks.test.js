// Vaco Assistant -- Goals, Connectors, Subscriptions, Reminders.
//
// The one safety-critical fact this file exists to prove: a goal
// whose kind needs a real external connector (paying a real bill,
// booking a real appointment) is NEVER marked completed by this
// module on its own, and NEVER silently reports success. Every
// assertion was watched failing against a reintroduced bug before
// being trusted, per
// `dev-docs/STANDING_INSTRUCTION_TEST_VERIFICATION.md`.

const test = require('node:test');
const assert = require('node:assert');

const { createVacoAssistantStore } = require('../lib/store');
const {
  GOAL_STATUSES, CONNECTOR_REQUIRED_KINDS, connectorStatus,
  createGoal, getGoal, listGoals, completeGoal, cancelGoal,
  addSubscription, listSubscriptions, requestCancellation,
  createReminder, acknowledgeReminder, dueReminders,
  proactiveSuggestions,
} = require('../lib/assistantTasks');

// -- The safety-critical core: no connector, no completion -------------

test('connectorStatus is honestly unavailable for every real connector-required kind', () => {
  for (const kind of CONNECTOR_REQUIRED_KINDS) {
    const status = connectorStatus(kind);
    assert.equal(status.available, false, `${kind} reported available with no connector registered`);
    assert.ok(status.reason, `${kind} gave no reason for being unavailable`);
  }
});

test('a goal whose kind needs a connector starts blocked-no-connector, never requested', () => {
  const store = createVacoAssistantStore();
  const goal = createGoal(store, { userId: 'u1', kind: 'pay-bill', description: 'Pay the electric bill' });
  assert.equal(goal.status, 'blocked-no-connector');
  assert.ok(goal.blockedReason);
  assert.ok(GOAL_STATUSES.includes(goal.status));
});

test('completeGoal refuses to complete a blocked goal, with the real reason in the error', () => {
  const store = createVacoAssistantStore();
  const goal = createGoal(store, { userId: 'u1', kind: 'pay-bill', description: 'Pay the electric bill' });
  assert.throws(() => completeGoal(store, { goalId: goal.id }), /blocked on a real connector/);
  assert.equal(getGoal(store, goal.id).status, 'blocked-no-connector', 'the refused call must not have changed anything');
});

test('a goal with a kind that needs no connector starts requested and can be completed', () => {
  const store = createVacoAssistantStore();
  const goal = createGoal(store, { userId: 'u1', kind: 'general', description: 'Remember my favorite restaurant' });
  assert.equal(goal.status, 'requested');
  const completed = completeGoal(store, { goalId: goal.id });
  assert.equal(completed.status, 'completed');
});

test('completeGoal refuses an already-completed or cancelled goal', () => {
  const store = createVacoAssistantStore();
  const goal = createGoal(store, { userId: 'u1', kind: 'general', description: 'x' });
  completeGoal(store, { goalId: goal.id });
  assert.throws(() => completeGoal(store, { goalId: goal.id }), /already "completed"/);

  const goal2 = createGoal(store, { userId: 'u1', kind: 'general', description: 'y' });
  cancelGoal(store, { goalId: goal2.id });
  assert.throws(() => completeGoal(store, { goalId: goal2.id }), /already "cancelled"/);
});

test('listGoals returns only this user\'s own goals, most recent first', () => {
  const store = createVacoAssistantStore();
  createGoal(store, { userId: 'u1', kind: 'general', description: 'first', now: 1000 });
  createGoal(store, { userId: 'u2', kind: 'general', description: 'someone else' });
  createGoal(store, { userId: 'u1', kind: 'general', description: 'second', now: 2000 });

  const goals = listGoals(store, 'u1');
  assert.equal(goals.length, 2);
  assert.equal(goals[0].description, 'second', 'most recent should be first');
});

// -- Subscriptions --------------------------------------------------------

test('addSubscription requires a positive amount', () => {
  const store = createVacoAssistantStore();
  assert.throws(() => addSubscription(store, { userId: 'u1', name: 'Streaming', amount: 0 }), /positive amount/);
});

test('requestCancellation marks the subscription and opens a real blocked goal, does not cancel anything', () => {
  const store = createVacoAssistantStore();
  const sub = addSubscription(store, { userId: 'u1', name: 'Streaming Plus', amount: 15, cadence: 'monthly' });
  const { subscription, goal } = requestCancellation(store, { subscriptionId: sub.id });
  assert.equal(subscription.cancellationRequested, true);
  assert.equal(goal.kind, 'cancel-external-subscription');
  assert.equal(goal.status, 'blocked-no-connector', 'cancelling an external subscription needs a real connector too');
});

test('requestCancellation refuses a subscription already requested for cancellation', () => {
  const store = createVacoAssistantStore();
  const sub = addSubscription(store, { userId: 'u1', name: 'Streaming', amount: 10 });
  requestCancellation(store, { subscriptionId: sub.id });
  assert.throws(() => requestCancellation(store, { subscriptionId: sub.id }), /already requested/);
});

test('listSubscriptions returns only this user\'s own subscriptions', () => {
  const store = createVacoAssistantStore();
  addSubscription(store, { userId: 'u1', name: 'A', amount: 5 });
  addSubscription(store, { userId: 'u2', name: 'B', amount: 5 });
  assert.equal(listSubscriptions(store, 'u1').length, 1);
});

// -- Reminders -------------------------------------------------------

test('dueReminders only returns reminders at or past their real due time, and not yet acknowledged', () => {
  const store = createVacoAssistantStore();
  const past = createReminder(store, { userId: 'u1', text: 'Past due', dueAt: 1000 });
  createReminder(store, { userId: 'u1', text: 'Future', dueAt: 5000 });
  const acked = createReminder(store, { userId: 'u1', text: 'Already handled', dueAt: 900 });
  acknowledgeReminder(store, acked.id);

  const due = dueReminders(store, 'u1', 2000);
  assert.deepEqual(due.map((r) => r.id), [past.id]);
});

test('acknowledgeReminder refuses an unknown reminder id', () => {
  const store = createVacoAssistantStore();
  assert.throws(() => acknowledgeReminder(store, 999), /no reminder with id/);
});

// -- Proactive suggestions ------------------------------------------

test('proactiveSuggestions surfaces due reminders, blocked goals and pending cancellations, nothing invented', () => {
  const store = createVacoAssistantStore();
  createReminder(store, { userId: 'u1', text: 'Call the dentist', dueAt: 1000 });
  createGoal(store, { userId: 'u1', kind: 'pay-bill', description: 'Pay rent' });
  const sub = addSubscription(store, { userId: 'u1', name: 'Gym', amount: 40 });
  requestCancellation(store, { subscriptionId: sub.id });

  const suggestions = proactiveSuggestions(store, 'u1', 2000);
  const kinds = suggestions.map((s) => s.kind).sort();
  // Two real blocked goals: the "pay rent" one created directly above,
  // and the one requestCancellation itself opens for the gym
  // subscription -- both are real and both must surface.
  assert.deepEqual(kinds, ['goal-blocked', 'goal-blocked', 'reminder-due', 'subscription-cancellation-pending']);
});

test('proactiveSuggestions for a user with nothing stored returns a real, empty list', () => {
  const store = createVacoAssistantStore();
  assert.deepEqual(proactiveSuggestions(store, 'ghost', Date.now()), []);
});
