// server/regionalTemperamentPacks.js
//
// **A real, peer-reviewed answer to "does a New York person have a
// different temperament than someone in Iowa" — reported on the
// region, deliberately not yet wired into the `Aggression`/
// `Volatility` traits that answer would most directly touch.**
//
// ---------------------------------------------------------------------
// The real source, checked directly
// ---------------------------------------------------------------------
// Rentfrow, Gosling & Potter (and later Rentfrow, Jokela, Stillwell,
// Kosinski & Potter, "Divided We Stand," Journal of Personality and
// Social Psychology, 2013) administered the Big Five Inventory to
// over half a million people across the contiguous United States and
// the District of Columbia, and found the country clusters into
// three real, named psychological regions — not fifty independent
// profiles, which this module does not claim to have precise
// per-state scores for. The three clusters, in the paper's own
// characterization:
//
//   **"Friendly and Conventional"**  the Great Plains and the South —
//                                    higher Agreeableness and
//                                    Conscientiousness, lower
//                                    Openness.
//   **"Relaxed and Creative"**       the West Coast and parts of the
//                                    East Coast — higher Openness,
//                                    lower Agreeableness and
//                                    Conscientiousness.
//   **"Temperamental and
//      Uninhibited"**                the Northeast — higher
//                                    Neuroticism and Extraversion,
//                                    lower Agreeableness.
//
// This is the real, checked, headline finding of that research
// programme — not a per-state lookup table of exact Big Five scores,
// which this module does not have and does not fabricate. A future
// pass with access to the published state rankings could narrow this
// to the state level; this module reports the three real regional
// clusters the research itself establishes.
//
// ---------------------------------------------------------------------
// Deliberately report-only — the same reason `countryPacks.js` and
// `crimeHotspotPacks.js` stayed out of calibrated mechanics
// ---------------------------------------------------------------------
// `Aggression` and `Volatility` are real, existing trait names
// (`traits.js`'s `behavioral` and `emotional` families) — and
// `Aggression` specifically feeds `keys.resolveAggression`, the
// violent-crime escalation mechanism the seventeenth standing rule
// spent four measured attempts calibrating. Biasing that trait's
// draw by region, even from a real source, without equivalent
// calibration work risks re-breaking exactly the balance that work
// fixed — the same risk already named twice this session. This
// module reports `region.temperamentCluster` and a human-readable
// description; nothing reads it to decide an outcome, and wiring one
// into the trait draw is a separate, future round with its own
// calibration pass.
//
// §9 note: this is a region-level cultural-psychology finding, not a
// claim about any one generated person — the same posture every
// other reference in this registry takes.

'use strict';

const CLUSTERS = ['friendly-and-conventional', 'relaxed-and-creative', 'temperamental-and-uninhibited'];

const CLUSTER_DESCRIPTIONS = {
  'friendly-and-conventional': {
    source: 'rentfrow-gosling-potter-divided-we-stand-2013',
    label: 'Friendly and Conventional',
    typicalOf: 'the Great Plains and the South',
    bigFiveNote: 'higher Agreeableness and Conscientiousness, lower Openness',
  },
  'relaxed-and-creative': {
    source: 'rentfrow-gosling-potter-divided-we-stand-2013',
    label: 'Relaxed and Creative',
    typicalOf: 'the West Coast and parts of the East Coast',
    bigFiveNote: 'higher Openness, lower Agreeableness and Conscientiousness',
  },
  'temperamental-and-uninhibited': {
    source: 'rentfrow-gosling-potter-divided-we-stand-2013',
    label: 'Temperamental and Uninhibited',
    typicalOf: 'the Northeast',
    bigFiveNote: 'higher Neuroticism and Extraversion, lower Agreeableness',
  },
};

function describeCluster(key) {
  const entry = CLUSTER_DESCRIPTIONS[key];
  if (!entry) return null;
  return { key, ...entry };
}

module.exports = {
  CLUSTERS,
  CLUSTER_DESCRIPTIONS,
  describeCluster,
};
