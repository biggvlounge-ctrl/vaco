// server/gossip.js
//
// By direct instruction: "gossip/word-of-mouth player-facing 'ask
// around' verb" — task #50 of "the next 5 tasks."
//
// ---------------------------------------------------------------------
// Word-of-mouth is already real; asking around it is not
// ---------------------------------------------------------------------
// `media.js`'s own `word_of_mouth` channel already spreads real facts
// peer to peer within a community — `espionage.js`'s own header
// already names it directly: "word-of-mouth is already real... that
// channel is how ordinary facts already spread to everybody." A real
// resident can already end up holding a real `entity_knowledge` row
// about a real subject, with a real `confidence_level` and a real
// `distortion_level` (hearsay, never ground truth — `fact_type:
// 'rumor'`). What was missing is a way for a PLAYER to actually ask —
// `worldStore.getKnowledge` already answers "what does entity X know
// about subject Y," one entity at a time, and nothing in this engine
// had ever asked it on a player's behalf, let alone asked it of more
// than one person at once.
//
// ---------------------------------------------------------------------
// The real aggregation this file adds, and the one thing it refuses
// to invent
// ---------------------------------------------------------------------
// `askAround` queries every real OTHER resident of the asker's own
// community (`npc.communityId`, the identical real field every other
// per-community reader in this engine already filters on — `crime
// .dangerByCommunity`, `migration.workByCommunity`) for real knowledge
// about a named subject, and returns the single most-confident real
// row among them — never a blend, never a fabricated "nobody knows
// anything specific, but..." placeholder. Nobody real knowing
// anything real is a real `null`, the honest answer, not a zero.
//
// **No invented "willingness to gossip" draw.** The obvious build
// gates this on a social trait (Charisma, Network Reach) the way
// `espionage.js`'s own composite listening score does for a sponsored
// spy — and that is the wrong precedent to copy here on purpose.
// `meetings.js`'s own header already argues against inventing a
// persuasion modifier for an ordinary conversation ("it invents no
// modifier, and that is the whole design"); asking a neighbour
// something they already know is the same ordinary kind of
// interaction, not a contested, risk-bearing act the way sending a
// spy is. The honest fact already does or does not exist in the
// world — surfacing it deterministically is not a fabrication either
// way, and a probability nobody measured would be.
//
// A resident's knowledge ABOUT THEMSELVES is excluded: asking around
// means asking OTHERS, not asking the subject to inform on
// themselves — a different real action this engine already has
// elsewhere (a direct conversation), not this one.

'use strict';

const worldStore = require('./worldStore.js');

// Every real OTHER resident of this community -- the asker and the
// subject (if either happens to live here) are both excluded, for
// the two different real reasons this file's own header states.
function residentsToAsk(worldState, communityId, askerId, subjectEntityId) {
  return (worldState.npcs || []).filter((n) => n.communityId === communityId
    && n.id !== askerId && n.id !== subjectEntityId);
}

// The single most-confident real thing anybody nearby actually knows
// about a real subject -- or null, honestly, when nobody does.
function askAround(worldState, askerId, subjectEntityId) {
  const asker = (worldState.npcs || []).find((n) => n.id === askerId);
  if (!asker) throw new Error(`askAround: no entity ${askerId}.`);
  if (subjectEntityId == null) throw new Error('askAround requires a subjectEntityId.');
  if (asker.communityId == null) return null;

  let best = null;
  for (const resident of residentsToAsk(worldState, asker.communityId, askerId, subjectEntityId)) {
    for (const row of worldStore.getKnowledge(worldState, resident.id, subjectEntityId)) {
      const confidence = Number(row.confidence_level) || 0;
      if (!best || confidence > (Number(best.confidence_level) || 0)) best = row;
    }
  }
  return best;
}

module.exports = {
  residentsToAsk,
  askAround,
};
