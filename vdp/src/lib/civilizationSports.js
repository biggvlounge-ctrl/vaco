// VDP — Civilization Sports Culture: this session's own third
// gameplay suggestion from "what could make the gameplay or lore
// better" -- sports culture as a per-civilization fact, not a
// global, placeless list of matches and games.
//
// `combatSports.js`/`teamSports.js` are deliberately storage-agnostic
// and own only the card itself (who's fighting, in what format, at
// what tier) -- this module is a real, separate overlay that answers
// "who actually cares about this sport" and "whose home crowd is this
// match being played in," without touching either of those already-
// complete, tested, pure modules. Same split this app already uses
// for Combat Sports/Vavlt Stvdios/VAGO: this owns the culture fact,
// not the card and not the broadcast.
//
// No source document names which real-world civilization favors which
// real sport -- this is entirely a flagged interpretive choice, the
// same footing every other undecided fact in this project stands on.
// `combatSportType`/`teamSportType` stay open strings here too, for
// the identical reason `combatSports.js`/`teamSports.js` already keep
// them open: the next real discipline should not need a code change
// to be favored by a civilization.

import { getCivilization, listCivilizations } from './civilizations.js';

export function createCivilizationSportsStore() {
  return { cultures: {}, hostedMatches: {} };
}

function ensureCulture(store, civilizationId) {
  if (!store.cultures[civilizationId]) {
    store.cultures[civilizationId] = { favoredCombatSports: [], favoredTeamSports: [], homeVenue: null };
  }
  return store.cultures[civilizationId];
}

export function getSportsCulture(store, civilizationId) {
  const culture = store.cultures[civilizationId];
  return {
    civilizationId,
    favoredCombatSports: culture ? [...culture.favoredCombatSports] : [],
    favoredTeamSports: culture ? [...culture.favoredTeamSports] : [],
    homeVenue: culture ? culture.homeVenue : null,
  };
}

// A real, declared fact about a civilization's own sports culture --
// additive, not a single overwritten record, so declaring a second
// favored sport never erases the first. Lower-cased the same way
// `combatSports.js`'s own `createMatch` normalizes `combatSportType`,
// so "Boxing" and "boxing" are the same real favored sport.
export function declareSportsCulture(civStore, store, civilizationId, { combatSportType, teamSportType, homeVenue } = {}) {
  const civ = getCivilization(civStore, civilizationId);
  if (!civ) throw new Error(`declareSportsCulture: no civilization ${civilizationId}`);
  if (!combatSportType && !teamSportType && !homeVenue) {
    throw new Error('declareSportsCulture requires a combatSportType, teamSportType, or homeVenue');
  }
  const culture = ensureCulture(store, civilizationId);
  if (combatSportType) {
    const sport = combatSportType.trim().toLowerCase();
    if (sport && !culture.favoredCombatSports.includes(sport)) culture.favoredCombatSports.push(sport);
  }
  if (teamSportType) {
    const sport = teamSportType.trim().toLowerCase();
    if (sport && !culture.favoredTeamSports.includes(sport)) culture.favoredTeamSports.push(sport);
  }
  if (homeVenue) culture.homeVenue = homeVenue.trim();
  return getSportsCulture(store, civilizationId);
}

// The reverse lookup -- given a real sport, which civilizations
// actually favor it. The real "who's the home crowd for this" query,
// built on the same disciplines combatSports.js/teamSports.js already
// carry rather than a second, invented list of "real" sports.
export function civilizationsFavoring(civStore, store, { combatSportType, teamSportType } = {}) {
  if (!combatSportType && !teamSportType) {
    throw new Error('civilizationsFavoring requires a combatSportType or teamSportType');
  }
  const sport = (combatSportType || teamSportType).trim().toLowerCase();
  const field = combatSportType ? 'favoredCombatSports' : 'favoredTeamSports';
  return listCivilizations(civStore)
    .filter((civ) => store.cultures[civ.id] && store.cultures[civ.id][field].includes(sport))
    .map((civ) => ({ id: civ.id, name: civ.name }));
}

// Associates an already-real match/game -- `combatSports.js`'s own
// `matchId`, or `teamSports.js`'s own `gameId`, both caller-assigned,
// real, and already unique -- with a real host civilization. A thin
// overlay recorded here, never written onto the match/game record
// itself, which stays exactly the shape those two modules already
// define. `favored` is a real, checkable signal (does this host
// civilization's own declared culture actually favor this sport),
// not an invented bonus or multiplier -- what a caller does with that
// fact is their own business.
export function hostMatch(civStore, store, matchId, { civilizationId, combatSportType, teamSportType, now = Date.now() } = {}) {
  if (!matchId) throw new Error('hostMatch requires a matchId');
  if (!combatSportType && !teamSportType) {
    throw new Error('hostMatch requires a combatSportType or teamSportType');
  }
  const civ = getCivilization(civStore, civilizationId);
  if (!civ) throw new Error(`hostMatch: no civilization ${civilizationId}`);

  const culture = getSportsCulture(store, civilizationId);
  const sport = (combatSportType || teamSportType).trim().toLowerCase();
  const favored = combatSportType
    ? culture.favoredCombatSports.includes(sport)
    : culture.favoredTeamSports.includes(sport);

  store.hostedMatches[matchId] = { matchId, civilizationId, sport, favored, at: now };
  return { ...store.hostedMatches[matchId] };
}

export function getMatchHost(store, matchId) {
  return store.hostedMatches[matchId] ? { ...store.hostedMatches[matchId] } : null;
}
