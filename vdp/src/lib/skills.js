// VDP — player/NPC skills.
//
// Scoped to the subjects VACON-C's own `server/occupations.js` already
// names for the districts VDP actually has — not its full 16-skill
// sheet, the same "borrow the shape, not the scale" discipline
// `npcs.js` already applies to VACON-C's needs/goals/habits. Each
// subject below is the real §25 skill that occupation practises:
// `Business` (trader), `Crafting` (cook), `Construction` (labourer/
// carpenter), `Communication` (teacher/implied), `Management`,
// `Athletics` (occupations.js tier 2: "organizations.type sports"),
// `Art` (occupations.js tier 4, implied) -- the last two added
// alongside the Combat Sports District and Fashion District jobs in
// `jobs.js`, VDP-native districts that had no matching skill before.
// `Agriculture` and `Combat` joined 8 Oct 2026 the same way, for the
// frontier jobs occupations.js already names exactly: `farmer` is
// `skill: 'Agriculture', source: 'farming'`, `hunter` is
// `skill: 'Combat', source: 'hunting'`, verbatim. `Engineering` joined
// the same day for the water treatment job -- occupations.js's own
// `INFRASTRUCTURE_POST` names the real link: `water_systems:
// 'plumber'`, and `plumber` is `skill: 'Engineering', source:
// 'plumbing'`. The schema has no operator column for infrastructure at
// all, which is this project's own comment for exactly why that link
// has to be stated somewhere rather than assumed.
//
// A skill rises from three places, each bounded so none of them can
// alone max it out: working a matching job (small, passive, per
// shift — see `jobs.js`), reading a matching real textbook (one real
// jump — see `library.js`), or a relevant conversation (a tiny nudge —
// see `v4AgentClient.js`'s `talkToNpc`). Decay is the same
// reinforce-and-fade shape `npcs.js`'s habits already use, so a skill
// bump from one conversation doesn't read as permanent next to one
// built from steady practice.

export const SKILL_NAMES = [
  'Business', 'Crafting', 'Construction', 'Communication', 'Management', 'Athletics', 'Art',
  'Agriculture', 'Combat', 'Engineering',
];

export const JOB_SHIFT_GAIN = 1.5;
export const TEXTBOOK_GAIN = 12;
export const CONVERSATION_GAIN = 0.8;
export const SKILL_FADE_PER_TICK = 0.05;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// `seed` is optional -- "people are bringing the chaos from the old
// world to the new world. You have all your different characteristics,
// statistics, and things like that" (8 Oct 2026, direct instruction):
// a migrant's `immigration.js` arrival record can carry real
// `oldWorldSkills`, and whoever seeds a player (`server.cjs`'s
// `ensurePlayer`) passes them through here rather than starting every
// arrival at zero. Omitting `seed` is exactly what every existing
// caller and test already does, unchanged.
export function createSkills(seed = {}) {
  const skills = {};
  for (const s of SKILL_NAMES) skills[s] = clamp(seed[s] || 0, 0, 100);
  return skills;
}

function requireSkillName(name) {
  if (!SKILL_NAMES.includes(name)) {
    throw new Error(`skills: "${name}" is not a known skill (expected one of ${SKILL_NAMES.join(', ')})`);
  }
}

// Shared by all three real sources — only the gain amount and the
// reason differ, so the clamp/no-op-on-unknown-skill behavior can't
// drift between them.
function bump(skills, name, amount) {
  requireSkillName(name);
  skills[name] = clamp(skills[name] + amount, 0, 100);
  return skills[name];
}

export function gainFromShift(skills, name) {
  return bump(skills, name, JOB_SHIFT_GAIN);
}

// Idempotency is the caller's job (see `library.js`'s per-order
// dedup) — this always applies the gain it's given.
export function gainFromTextbook(skills, name) {
  return bump(skills, name, TEXTBOOK_GAIN);
}

export function gainFromConversation(skills, name) {
  return bump(skills, name, CONVERSATION_GAIN);
}

// Slow fade toward 0, same per-tick shape as `npcs.js`'s `fadeHabits`
// — called on the same server tick as the player's needs/goals step,
// so an unused skill very slowly recedes rather than being a one-way
// ratchet (the exact ratchet VACON-C's own CLAUDE.md names as a
// recurring mistake: a mechanism with no inverse has no equilibrium).
export function fadeSkills(skills) {
  for (const name of SKILL_NAMES) {
    skills[name] = clamp(skills[name] - SKILL_FADE_PER_TICK, 0, 100);
  }
}
