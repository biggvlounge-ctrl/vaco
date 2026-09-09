// V4 -- AI Human Twin: profiles and the animation state machine.
//
// **Task #72 was "clarify AI Human Twin scope before building," and
// the clarification is this**: three genuinely different things in
// this project share the name "twin," and conflating them is what
// made the scope unanswerable.
//
//   1. **VENVM's AI Human Twin ad generation** -- a synthetic
//      presenter inside a *generated video ad*. Pre-rendered content,
//      produced by a video pipeline. Not real-time, not interactive.
//   2. **The agent presenter twin** -- a real-time visible embodiment
//      of a VACON agent on a live surface. This is what this file is.
//   3. **HVNTZ's "Digital Twin Level"** -- a business completeness
//      tier (Level 3 unlocks "AI Business Intelligence"). Nothing to
//      do with a human or an avatar at all. Pure name collision, and
//      worth knowing about because HVNTZ's own docs gate agent
//      features on it, which reads like a twin dependency and is not.
//
// Only #2 is in scope here. #1 belongs to VENVM's pipeline; #3 is an
// unrelated tiering concept in HVNTZ.
//
// **Division of labor, taken directly from
// `CHARACTER_MODEL_ANIMATION_PIPELINE.md`**, which states it exactly:
// "Claude Code writes the trait/Key resolver engine, the animation
// state-machine code, and the logic connecting a character model to
// that behavior. Claude Code does NOT produce the actual 3D character
// model or animation data."
//
// So: the state machine below is real and complete. The clip names it
// emits (`idle_breathing`, `talking_gesture_medium`) are contract
// names a rigged model must satisfy -- sourced from a marketplace
// model, auto-rigged through AccuRIG or Mixamo, and retargeted in the
// engine. No model, mesh, or motion data is produced here, and none is
// pretended.
//
// **A twin is not a likeness of any real person.** Every profile below
// belongs to a fictional agent persona in this ecosystem. Nothing here
// generates, stores, or reproduces a real individual's face or voice.

export const ANIMATION_STATES = ['absent', 'idle', 'listening', 'thinking', 'speaking', 'gesturing'];

//: A real state machine, not a list of names: illegal transitions are
//: rejected. The reason this matters in practice is that an avatar
//: driven by streamed conversation events receives them out of order
//: fairly often -- a "speech ended" arriving after the next "speech
//: started" is routine. Rejecting the impossible transition keeps the
//: figure from snapping into a pose the conversation is not in.
const TRANSITIONS = {
  absent: ['idle'],
  idle: ['listening', 'speaking', 'thinking', 'absent'],
  listening: ['thinking', 'speaking', 'idle', 'absent'],
  thinking: ['speaking', 'listening', 'idle', 'absent'],
  speaking: ['gesturing', 'listening', 'idle', 'thinking', 'absent'],
  gesturing: ['speaking', 'listening', 'idle', 'absent'],
};

//: Conversation events, mapped to the state each produces. Named as
//: what actually happens in a call rather than as state names, so a
//: caller streams real events and never has to know the machine.
const EVENT_TO_STATE = {
  'call-connected': 'idle',
  'user-started-speaking': 'listening',
  'user-stopped-speaking': 'thinking',
  'agent-response-pending': 'thinking',
  'agent-started-speaking': 'speaking',
  'agent-emphasis': 'gesturing',
  'agent-stopped-speaking': 'idle',
  'call-ended': 'absent',
};

export const ANIMATION_EVENTS = Object.keys(EVENT_TO_STATE);

//: Contract clip names a rigged model must provide. Deliberately
//: generic and small -- this is the minimum vocabulary a presenter
//: needs, chosen so a stock Mixamo/AccuRIG library can satisfy it
//: without commissioning custom motion capture.
const STATE_CLIPS = {
  absent: null,
  idle: 'idle_breathing',
  listening: 'idle_attentive',
  thinking: 'idle_thoughtful',
  speaking: 'talking_neutral',
  gesturing: 'talking_gesture_medium',
};

export class IllegalTransitionError extends Error {}

//: The twin profile is *presentation* config and nothing else. It
//: deliberately does not restate an agent's name, role, or system
//: prompt -- those live in `vacon/lib/agents.js` and duplicating them
//: here would create a second roster to drift out of sync, which is
//: the exact failure `VLAY_INTER_AGENT_COORDINATION.md`'s own status
//: note called out (its `RelayMessage` union hardcoded six agents and
//: was already missing seven).
const DEFAULT_PROFILE = {
  preferredFraming: 'head-and-shoulders',
  voiceProfile: 'neutral-professional',
  //: Real: not every agent should be embodied. A twin is a presenter,
  //: and some agents are background services whose work nobody watches.
  embodied: true,
};

export const TWIN_PROFILES = {
  qvan: { preferredFraming: 'head-and-shoulders', voiceProfile: 'terse-authoritative' },
  leslie: { preferredFraming: 'head-and-shoulders', voiceProfile: 'measured-analytical' },
  deskins: { preferredFraming: 'head-and-shoulders', voiceProfile: 'precise-formal' },
  mia: { preferredFraming: 'full-body', voiceProfile: 'warm-executive' },
  kevin: { preferredFraming: 'full-body', voiceProfile: 'warm-conversational' },
  kay: { preferredFraming: 'full-body', voiceProfile: 'warm-conversational' },
  anderson: { preferredFraming: 'full-body', voiceProfile: 'energetic-host' },
  //: Background agents, honestly marked. DREA scores ad inventory and
  //: Gibson computes routes -- neither is a presenter, and giving them
  //: avatars would be decoration rather than function.
  drea: { embodied: false, voiceProfile: 'neutral-professional' },
  gibson: { embodied: false, voiceProfile: 'neutral-professional' },
  //: Jake writes scripts. Same call, and worth stating because the
  //: temptation runs the other way: VENVM is the *production* app, so
  //: an avatar feels apt. It isn't -- Jake produces the script that a
  //: presenter performs, and he is never the one on screen.
  jake: { embodied: false, voiceProfile: 'neutral-professional' },
};

// Resolving a twin never invents an agent. Callers pass an agent id
// they already got from VACON's roster; this only answers "how is that
// agent presented." An id with no explicit profile gets the default,
// which is correct behavior -- a new agent added to VACON is
// immediately presentable without touching this file.
export function getTwinProfile(agentId) {
  if (!agentId) throw new Error('getTwinProfile requires an agentId');
  return { agentId, ...DEFAULT_PROFILE, ...(TWIN_PROFILES[agentId] || {}) };
}

export function listTwinProfiles() {
  return Object.keys(TWIN_PROFILES).map(getTwinProfile);
}

export function clipForState(state) {
  if (!ANIMATION_STATES.includes(state)) {
    throw new Error(`unknown animation state "${state}" (known: ${ANIMATION_STATES.join(', ')})`);
  }
  return STATE_CLIPS[state];
}

// Advance the machine. Returns the new state plus the clip a renderer
// should play. Throws on an illegal transition rather than silently
// clamping, because a caller streaming events in a nonsensical order
// has a real bug worth surfacing -- unlike the surface clamps in
// `surfaces.js`, where degrading is the correct product behavior.
export function advanceAnimation(options = {}) {
  const { currentState = 'absent', event } = options;
  if (!ANIMATION_STATES.includes(currentState)) {
    throw new Error(`unknown current state "${currentState}"`);
  }
  const nextState = EVENT_TO_STATE[event];
  if (!nextState) {
    throw new Error(`unknown animation event "${event}" (known: ${ANIMATION_EVENTS.join(', ')})`);
  }
  if (nextState === currentState) {
    return { previousState: currentState, state: currentState, clip: STATE_CLIPS[currentState], changed: false };
  }
  if (!TRANSITIONS[currentState].includes(nextState)) {
    throw new IllegalTransitionError(
      `cannot go from "${currentState}" to "${nextState}" (event "${event}"); legal from "${currentState}": ${TRANSITIONS[currentState].join(', ')}`
    );
  }
  return { previousState: currentState, state: nextState, clip: STATE_CLIPS[nextState], changed: true };
}

export function legalTransitionsFrom(state) {
  if (!ANIMATION_STATES.includes(state)) throw new Error(`unknown animation state "${state}"`);
  return TRANSITIONS[state];
}
