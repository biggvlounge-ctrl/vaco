// VDP — player-run organizations: family, tribe, cult.
//
// A named, joinable social group a player founds -- distinct from
// `households.js`, which is about who shares a home. An organization
// is about who someone identifies with, not where they live, and
// membership mixes real players and NPCs freely: a member id is
// either a real userId or the same `npc-<id>` convention
// `server.cjs`'s own `/api/players/:id/talk` route already uses for
// NPC-relationship rows.
//
// Scoped like every other VACON-C-derived module this session
// (`npcs.js`, `skills.js`, `households.js`): VACON-C's own
// `organizationTraits.js` scores a civilization-scale faction on nine
// dimensions (power, territory, diplomacy, ...). VDP needs one:
// `cohesion`, moved by real member activity (talking to a fellow
// member, player or NPC) and faded on the same reinforce-and-fade
// shape `skills.js`/`npcs.js`'s habits already use, not a scoreboard
// an inactive group can win by sitting still.

// `religious-institution` joined 9 Oct 2026, per direct instruction:
// "the government will not set up religious institutions. This is
// something that will be set up as more NPCs come over as well." The
// existing gate already fits exactly -- `foundOrganization` takes any
// real `founderId`, NPC included, and nothing in this module lets the
// government (`jobs.js`'s `PLANETARY_GOVERNORS_PAYROLL`, a payroll
// account, not an actor with a userId) call it at all. No new code
// enforces "the government will not" as a rule; it is simply already
// true that nothing here can act as the government.
// `gang` joined 9 Oct 2026, per direct instruction: "different groups
// of people religions gangs organizations cultures will start to
// import things and smuggle things across the border and then
// certain groups families organizations tribes gangs will start to
// make deals and negotiate with each other for smuggling routes."
// The word is named twice, explicitly, alongside the types already
// here -- the real smuggling-route control this instruction asks for
// (`immigration.js`'s own `claimSmugglingRoute`/`negotiateRouteTransfer`)
// takes any real `organizationId`, gang included, with no separate
// gate -- the same "the existing gate already fits" treatment
// `religious-institution` got above.
export const ORG_TYPES = ['family', 'tribe', 'cult', 'religious-institution', 'gang'];

export const STARTING_COHESION = 50;
export const COHESION_GAIN = 3;
export const COHESION_FADE_PER_TICK = 0.05;
const MIN_COHESION = 0;
const MAX_COHESION = 100;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function createOrganizationsStore() {
  return { organizations: [], nextOrganizationId: 1 };
}

export function listOrganizations(store) {
  return store.organizations;
}

export function getOrganization(store, id) {
  return store.organizations.find((o) => o.id === id) || null;
}

export function organizationOf(store, memberId) {
  return store.organizations.find((o) => o.memberIds.includes(memberId)) || null;
}

export function foundOrganization(store, { name, type, founderId, now = Date.now() } = {}) {
  if (!name || !name.trim()) throw new Error('foundOrganization requires a name');
  if (!ORG_TYPES.includes(type)) {
    throw new Error(`foundOrganization: "${type}" is not a known type (expected one of ${ORG_TYPES.join(', ')})`);
  }
  if (!founderId) throw new Error('foundOrganization requires a founderId');
  if (organizationOf(store, founderId)) {
    throw new Error(`foundOrganization: "${founderId}" already belongs to an organization`);
  }

  const org = {
    id: store.nextOrganizationId++,
    name: name.trim(),
    type,
    founderId,
    memberIds: [founderId],
    cohesion: STARTING_COHESION,
    foundedAt: now,
  };
  store.organizations.push(org);
  return org;
}

// Invites another member (player or `npc-<id>`) onto an organization
// the inviter already belongs to. A member belongs to exactly one
// organization at a time, the same single-membership rule
// `households.js`'s `addMember` applies to a household.
export function addMember(store, { organizationId, memberId }) {
  if (!memberId) throw new Error('addMember requires a memberId');
  const org = getOrganization(store, organizationId);
  if (!org) throw new Error(`addMember: no organization ${organizationId}`);
  if (organizationOf(store, memberId)) {
    throw new Error(`addMember: "${memberId}" already belongs to an organization`);
  }
  org.memberIds.push(memberId);
  return org;
}

// Refuses to empty an organization to zero members -- the same
// "never emptied to zero" guard `households.js`'s own `removeMember`
// enforces. Unlike a household, losing the founder does not dissolve
// the group; the organization is the members, not any one of them.
export function removeMember(store, { organizationId, memberId }) {
  const org = getOrganization(store, organizationId);
  if (!org) throw new Error(`removeMember: no organization ${organizationId}`);
  const idx = org.memberIds.indexOf(memberId);
  if (idx === -1) throw new Error(`removeMember: "${memberId}" does not belong to this organization`);
  if (org.memberIds.length === 1) {
    throw new Error(`removeMember: "${memberId}" is the only member -- an organization is never emptied to zero`);
  }
  org.memberIds.splice(idx, 1);
  return org;
}

// Called when two real members (player-player or player-NPC) actually
// interact -- a chat message, a conversation -- so cohesion reflects
// real activity between people who belong together, never a number a
// silent group can accumulate on its own.
export function recordActivity(store, organizationId) {
  const org = getOrganization(store, organizationId);
  if (!org) throw new Error(`recordActivity: no organization ${organizationId}`);
  org.cohesion = clamp(org.cohesion + COHESION_GAIN, MIN_COHESION, MAX_COHESION);
  return org.cohesion;
}

// Same per-tick shape as `skills.js`'s `fadeSkills` -- called on the
// server's own tick, so an organization nobody is active in slowly
// drifts back toward a neutral cohesion rather than holding whatever
// peak it last reached forever.
export function fadeCohesion(store) {
  for (const org of store.organizations) {
    org.cohesion = clamp(org.cohesion - COHESION_FADE_PER_TICK, MIN_COHESION, MAX_COHESION);
  }
}
