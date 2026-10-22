// Vaco Assistant -- Goals, Connectors, Subscriptions and Reminders:
// the real, buildable half of a Meta-Muse-style personal agent.
//
// ---------------------------------------------------------------------
// What Muse actually does, checked directly before building anything
// ---------------------------------------------------------------------
// Meta's Muse runs in a dedicated secure cloud VM with its own real
// browser, logs into a person's actual accounts, fills out forms, and
// pays real bills through Link by Stripe using one-time-use virtual
// card numbers -- including bills with services entirely outside
// Meta's own ecosystem. It also books appointments, identifies and
// cancels subscriptions, and monitors home security cameras.
//
// ---------------------------------------------------------------------
// Why the money-moving half is a real, named gap and not a feature
// ---------------------------------------------------------------------
// Checked directly: this ecosystem has NO real external money
// movement anywhere. `v3/VASH_BAAS_VCOIN_ADVANCEMENT.md` says so in
// its own words -- VASH is 47 lines, a per-user balance and a single
// currency-conversion operation, "no account, no IBAN, no card, no
// payment rail, no external money movement of any kind." Paying a
// real electric bill needs a real banking-as-a-service partnership, a
// real card-issuing integration (what Link by Stripe actually is for
// Muse), real bank-account linking, and real KYC/AML compliance.
// None of that exists here, and NONE of it is faked by this module --
// a goal whose `kind` needs one of those real rails is marked
// `blocked-no-connector` with the real reason stated, never silently
// marked complete.
//
// **This is the single most safety-critical design decision in this
// file.** `personalAssistant.js`'s general-chat fallback is a real
// LLM completion, and an LLM asked "did you pay my electric bill?"
// will happily claim yes if nothing stops it first. So a payment-
// sounding request is intercepted by `PAYMENT_INTENT` in
// `personalAssistant.js`, the same way `BALANCE_INTENT` already
// intercepts a balance question, and answered with this module's own
// honest `connectorStatus` before the message ever reaches a
// completion that could hallucinate success.
//
// ---------------------------------------------------------------------
// What IS real and built here
// ---------------------------------------------------------------------
// A goal/task framework (open `kind`, the same "borrow the shape, not
// an exhaustive enum" treatment `combatSportType` gets in VDP), a
// connector registry that honestly reports every connector as
// unavailable (there are none), real user-maintained subscription
// tracking with real cancellation-request status (NOT auto-discovered
// -- there is no real bank-linking to discover a recurring charge
// from, unlike Muse's own real account access), real reminders, and
// a real proactive-suggestions pass over a user's own stored data --
// no generative model involved, consistent with this session's own
// "no AI-generated recommendations without a configured provider"
// rule (checked directly: no image/video/voice/text-generation API
// key beyond the existing, already-used v4-proxy/Anthropic path is
// configured anywhere in this environment).

const GOAL_STATUSES = ['requested', 'in-progress', 'blocked-no-connector', 'completed', 'cancelled'];

// Every one of Muse's real named task categories that needs a real
// external rail this ecosystem does not have. Open-ended on purpose
// (see the header) -- this is the list `connectorStatus` checks
// against to decide whether a goal can even start, not a closed
// enum `createGoal` restricts `kind` to.
const CONNECTOR_REQUIRED_KINDS = ['pay-bill', 'book-appointment', 'make-purchase', 'cancel-external-subscription'];

// **The connector registry, honestly empty.** A real Muse-style agent
// connects to external services one at a time; this ecosystem has
// connected to none. Every lookup below returns `available: false`
// with a real, specific reason -- never a silent success.
const CONNECTORS = {};

function connectorStatus(kind) {
  if (!CONNECTOR_REQUIRED_KINDS.includes(kind)) {
    return { available: true, reason: null };
  }
  const connector = CONNECTORS[kind];
  if (connector && connector.available) return connector;
  return {
    available: false,
    reason: `"${kind}" needs a real external connector (bank/card-issuing/booking integration) `
      + 'that is not configured in this environment. See this module\'s own header.',
  };
}

function requireString(value, field, action) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${action} requires a non-empty ${field}`);
  }
  return value.trim();
}

function requireCollections(store) {
  if (!store.assistantGoals) store.assistantGoals = [];
  if (!store.nextAssistantGoalId) store.nextAssistantGoalId = 1;
  if (!store.assistantSubscriptions) store.assistantSubscriptions = [];
  if (!store.nextAssistantSubscriptionId) store.nextAssistantSubscriptionId = 1;
  if (!store.assistantReminders) store.assistantReminders = [];
  if (!store.nextAssistantReminderId) store.nextAssistantReminderId = 1;
}

// ---------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------

// A goal that needs a connector this ecosystem doesn't have starts
// `blocked-no-connector` immediately, with the real reason attached --
// never `requested` followed by a silent stall, which would look
// identical to the agent quietly working on it.
function createGoal(store, options = {}) {
  requireCollections(store);
  const { userId, kind, description, now = Date.now() } = options;
  requireString(userId, 'userId', 'createGoal');
  requireString(kind, 'kind', 'createGoal');
  requireString(description, 'description', 'createGoal');

  const status = connectorStatus(kind);
  const goal = {
    id: store.nextAssistantGoalId++,
    userId,
    kind,
    description,
    status: status.available ? 'requested' : 'blocked-no-connector',
    blockedReason: status.available ? null : status.reason,
    createdAt: now,
    updatedAt: now,
  };
  store.assistantGoals.push(goal);
  return goal;
}

function getGoal(store, goalId) {
  requireCollections(store);
  return store.assistantGoals.find((g) => g.id === goalId) || null;
}

function listGoals(store, userId) {
  requireCollections(store);
  return store.assistantGoals.filter((g) => g.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
}

// A real person marking their own goal done -- this module has no way
// to verify a general-purpose real-world task actually happened (it
// has no browser, no connector), so completion for a non-blocked goal
// is always the user's own real report, never inferred.
function completeGoal(store, options = {}) {
  const { goalId, now = Date.now() } = options;
  const goal = getGoal(store, goalId);
  if (!goal) throw new Error(`completeGoal: no goal with id ${goalId}`);
  if (goal.status === 'blocked-no-connector') {
    throw new Error(`completeGoal: goal ${goalId} is blocked on a real connector that does not exist yet -- `
      + `${goal.blockedReason}`);
  }
  if (goal.status === 'completed' || goal.status === 'cancelled') {
    throw new Error(`completeGoal: goal ${goalId} is already "${goal.status}"`);
  }
  goal.status = 'completed';
  goal.updatedAt = now;
  return goal;
}

function cancelGoal(store, options = {}) {
  const { goalId, now = Date.now() } = options;
  const goal = getGoal(store, goalId);
  if (!goal) throw new Error(`cancelGoal: no goal with id ${goalId}`);
  if (goal.status === 'completed' || goal.status === 'cancelled') {
    throw new Error(`cancelGoal: goal ${goalId} is already "${goal.status}"`);
  }
  goal.status = 'cancelled';
  goal.updatedAt = now;
  return goal;
}

// ---------------------------------------------------------------------
// Subscriptions -- real, user-maintained, NOT auto-discovered
// ---------------------------------------------------------------------
// Muse can see a person's real bank/card activity and identify a
// recurring charge from it. This ecosystem has no such access, so a
// subscription here is entered by the person themselves -- a
// genuinely different, smaller real feature, named as such rather
// than presented as the same thing.

function addSubscription(store, options = {}) {
  requireCollections(store);
  const { userId, name, amount, cadence = 'monthly', now = Date.now() } = options;
  requireString(userId, 'userId', 'addSubscription');
  requireString(name, 'name', 'addSubscription');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('addSubscription requires a positive amount');

  const subscription = {
    id: store.nextAssistantSubscriptionId++,
    userId,
    name,
    amount,
    cadence,
    cancellationRequested: false,
    createdAt: now,
  };
  store.assistantSubscriptions.push(subscription);
  return subscription;
}

function listSubscriptions(store, userId) {
  requireCollections(store);
  return store.assistantSubscriptions.filter((s) => s.userId === userId);
}

// Marks that the person WANTS it cancelled -- does not cancel it. A
// real cancellation needs the same external connector a bill payment
// does (logging into the actual service), which this module does not
// have. Also opens a real, honestly-blocked goal, so the person's one
// real task list shows this request alongside everything else they
// asked for, instead of it only living on the subscription record.
function requestCancellation(store, options = {}) {
  requireCollections(store);
  const { subscriptionId, now = Date.now() } = options;
  const subscription = store.assistantSubscriptions.find((s) => s.id === subscriptionId);
  if (!subscription) throw new Error(`requestCancellation: no subscription with id ${subscriptionId}`);
  if (subscription.cancellationRequested) {
    throw new Error(`requestCancellation: cancellation for subscription ${subscriptionId} was already requested`);
  }
  subscription.cancellationRequested = true;
  const goal = createGoal(store, {
    userId: subscription.userId,
    kind: 'cancel-external-subscription',
    description: `Cancel ${subscription.name} (${subscription.amount}/${subscription.cadence})`,
    now,
  });
  return { subscription, goal };
}

// ---------------------------------------------------------------------
// Reminders -- real, simple, deterministic
// ---------------------------------------------------------------------

function createReminder(store, options = {}) {
  requireCollections(store);
  const { userId, text, dueAt, now = Date.now() } = options;
  requireString(userId, 'userId', 'createReminder');
  requireString(text, 'text', 'createReminder');
  if (!Number.isFinite(dueAt)) throw new Error('createReminder requires a numeric dueAt timestamp');

  const reminder = {
    id: store.nextAssistantReminderId++, userId, text, dueAt, acknowledged: false, createdAt: now,
  };
  store.assistantReminders.push(reminder);
  return reminder;
}

function acknowledgeReminder(store, reminderId) {
  requireCollections(store);
  const reminder = store.assistantReminders.find((r) => r.id === reminderId);
  if (!reminder) throw new Error(`acknowledgeReminder: no reminder with id ${reminderId}`);
  reminder.acknowledged = true;
  return reminder;
}

// Due, unacknowledged reminders as of `now` -- the real, simple half
// of "memory and unprompted suggestions" Muse's own feature list
// names. The other half (surfacing a suggestion no one asked for,
// generated rather than threshold-triggered) needs a real model call
// on a schedule nothing in this ecosystem runs yet; not built here.
function dueReminders(store, userId, now = Date.now()) {
  requireCollections(store);
  return store.assistantReminders
    .filter((r) => r.userId === userId && !r.acknowledged && r.dueAt <= now)
    .sort((a, b) => a.dueAt - b.dueAt);
}

// ---------------------------------------------------------------------
// Proactive suggestions -- real data, no model call
// ---------------------------------------------------------------------
// Every item here is read directly off this person's own stored
// goals/subscriptions/reminders. Nothing is generated, ranked by a
// model, or personalized beyond what the data itself already is --
// the same "real aggregation, not an invented number" discipline
// `chopz-shop/lib/dashboards.js` already holds.
function proactiveSuggestions(store, userId, now = Date.now()) {
  requireCollections(store);
  const suggestions = [];

  for (const reminder of dueReminders(store, userId, now)) {
    suggestions.push({ kind: 'reminder-due', text: reminder.text, refId: reminder.id });
  }

  const blockedGoals = listGoals(store, userId).filter((g) => g.status === 'blocked-no-connector');
  for (const goal of blockedGoals) {
    suggestions.push({
      kind: 'goal-blocked', text: `"${goal.description}" is still waiting on a real connector that doesn't exist yet.`, refId: goal.id,
    });
  }

  const pendingCancellations = listSubscriptions(store, userId).filter((s) => s.cancellationRequested);
  for (const sub of pendingCancellations) {
    suggestions.push({
      kind: 'subscription-cancellation-pending', text: `You asked to cancel ${sub.name} -- that still needs to be done manually.`, refId: sub.id,
    });
  }

  return suggestions;
}

module.exports = {
  GOAL_STATUSES, CONNECTOR_REQUIRED_KINDS, CONNECTORS, connectorStatus,
  createGoal, getGoal, listGoals, completeGoal, cancelGoal,
  addSubscription, listSubscriptions, requestCancellation,
  createReminder, acknowledgeReminder, dueReminders,
  proactiveSuggestions,
};
