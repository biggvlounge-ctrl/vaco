# VACANCY — Trait Database Attachment
### Document 7 of 7 — Final Handoff Package

**Important, real distinction**: this is not a narrative World Bible
chapter — it's a real, concrete technical specification, referencing
an actual codebase (`engine.js`) and a real "Document 2" database
schema, part of a separate seven-document handoff package. This is
the actual, verified implementation of the Trait DNA concept referenced
throughout every part of the World Bible.

**Full spec target**: 2,100+ traits. This document is the actual
generator-ready state — what's built and verified (18 families, 92
traits, live in `engine.js`), what the architecture process added on
top (1 new individual family + 4 tier-level trait families), and the
exact scaling mechanism to reach 2,100 — requiring zero schema
changes, only data entry into `trait_definitions`.

## Individual tier — 19 families, 98 traits

The 18 families below are live in `engine.js`'s `TRAIT_FAMILIES` and
verified via `generateNPC()`. Family #19 (Skills) was specified by
the architecture process and needs to be added to the code —
everything else already runs.

```js
TRAIT_FAMILIES = {
  physical: ["Strength", "Endurance", "Agility", "Reflexes", "Pain Tolerance",
             "Recovery Rate", "Vision Acuity", "Stamina"],
  mental: ["Intelligence", "Memory", "Focus", "Problem Solving", "Creativity",
           "Adaptability", "Risk Assessment", "Learning Speed", "Curiosity"],
  emotional: ["Empathy", "Volatility", "Resilience", "Optimism",
              "Attachment Style", "Grief Processing"],
  psychological: ["Paranoia", "Impulsivity", "Narcissism", "Trust Threshold",
                  "Delusion Susceptibility", "Compulsiveness"],
  behavioral: ["Aggression", "Patience", "Honesty", "Discipline",
               "Recklessness", "Conformity"],
  social: ["Charisma", "Persuasion", "Network Reach", "Reputation",
           "Group Loyalty", "Social Mobility"],
  economic: ["Greed", "Frugality", "Risk Appetite", "Barter Skill",
             "Resource Hoarding", "Debt Tolerance"],
  educational: ["Literacy", "Technical Knowledge", "Historical Knowledge",
                "Self-Taught Aptitude"],
  criminal: ["Stealth", "Deception", "Black Market Ties", "Heat Tolerance",
             "Crew Loyalty"],
  combat: ["Melee Skill", "Ranged Skill", "Tactical Awareness", "Bloodlust",
           "Composure Under Fire", "Weapon Mastery"],
  sports: ["Speed", "Coordination", "Competitive Drive", "Team Chemistry",
           "Injury Resistance"],
  health: ["Immune Response", "Nutrition Status", "Chronic Conditions",
           "Sleep Quality"],
  technology: ["Machinery Aptitude", "Electronics Repair",
               "Signal/Comms Literacy", "Salvage Engineering"],
  environmental: ["Weather Tolerance", "Wilderness Survival",
                  "Urban Navigation", "Contamination Resistance"],
  leadership: ["Command Presence", "Strategic Vision", "Delegation",
               "Crisis Composure", "Vision", "Corruption Risk"],
  reputation: ["Fear Factor", "Trustworthiness", "Notoriety",
               "Faction Standing"],
  faction: ["Ideological Alignment", "Defection Risk", "Recruitment Draw",
            "Territorial Instinct"],
  special: ["Artifact Sensitivity", "Signal Perception", "Anomaly Resistance"],
  personality: ["Confidence", "Teaching Ability"],
  skills: ["Communication", "Leadership", "Engineering", "Medicine", "Science",
           "Technology", "Art", "Music", "Business", "Agriculture",
           "Construction", "Combat", "Athletics", "Crafting", "Research",
           "Management"]
}
```

## Tier-level trait sheets

```js
FAMILY_TRAIT_FAMILIES = { unity, loyalty, reputation, wealth, resources,
  traditions, leadership, generationalKnowledge, cooperation, conflictLevel }

ORGANIZATION_TRAIT_FAMILIES = { power, influence, membership, production,
  innovation, security, territory, resources, leadershipQuality,
  internalLoyalty, diplomacy, reputation, growthPotential }

CITY_TRAIT_FAMILIES = { population, economy, safety, culture, infrastructure,
  education, technology, resources, transportation, tourism, growth, stability }

CIVILIZATION_TRAIT_FAMILIES = { population, leadership, economy, technology,
  military, education, healthcare, infrastructure, transportation, resources,
  culture, religion, innovation, security, justice, trade, diplomacy,
  environment, historicalReputation, citizenHappiness, identity }
```

## Culture DNA — tier-level, not individual

Attached to Family/Community/Organization/City/Civilization entities —
individuals *belong to* a culture, they don't each carry their own.

```js
CULTURE_TRAIT_FAMILIES = { trustLevel, tradition, innovation, competition,
  cooperation, communicationStyle, leadershipStyle, conflictResolution,
  education, art, religion, values, customs, language, cuisine, fashion }
```

## Value System DNA — individual, weights decisions

Distinct from traits (capability) and Culture (tier-level) — Values
determine *which* decision an entity makes given equal capability.

```js
VALUES = ["Family First", "Freedom", "Power", "Wealth", "Knowledge",
  "Security", "Community", "Religion", "Adventure", "Fame", "Innovation",
  "Tradition", "Justice", "Competition", "Peace"]
```

## Personal Preferences — individual, taste not values

```js
PREFERENCE_CATEGORIES = ["music", "food", "fashion", "hobby",
  "entertainment", "learning_style"]
```

## Beliefs — individual, typed

```js
BELIEF_TYPES = ["religious", "philosophical", "political", "scientific",
  "cultural", "personal"]
```

## Trait Archetypes — derived, not source data

Discrete tags computed from trait threshold combinations, never
stored independently:

```
Individual: Natural Leader, Strategic Thinker, Charismatic, Independent,
  Disciplined, Creative, Risk Taker, Cautious, Trustworthy, Unreliable,
  Diplomatic, Aggressive, Generous, Selfish, Entrepreneur, Investor,
  Worker Mentality, Innovator, Prepared, Adaptive, Fearless, Paranoid,
  Community Focused
Family: Strong Family Bond, Family Conflict, Legacy Focused, Competitive
  Family, Private Family, Connected Family
Organization: Efficient, Innovative, Corrupt, Disciplined, Chaotic,
  Power Seeking
City: Growing, Declining, Safe, Dangerous, Innovative, Cultural,
  Resource Rich
Leadership styles: Collaborative, Authoritarian, Strategic, Charismatic,
  Traditional, Innovative, Reactive, Visionary, Corrupt
```

The `archetypes` table stores the *derived tag* plus which traits
produced it — never re-specify these as new scored trait families;
they are a read, not a write.

## Dynamic, non-trait per-entity state — do not confuse with traits

Tracked in separate tables because they're volatile/time-horizoned,
not stable capability scores:

- **Needs** (Maslow-style, dynamic): food, water, sleep, safety,
  income, housing, healthcare, education, love, friendship, respect,
  status, purpose, freedom, legacy
- **Goals** (time-horizoned): immediate, daily, weekly, monthly,
  lifetime, legacy, generational
- **Mood/Stress**: volatile per-tick, not a trait
- **Knowledge (`entity_knowledge`)**: subjective, can be wrong —
  known, unknown, rumor, false, assumption, prediction, verified.
  **Direct confirmation: this is the real, concrete implementation
  of the subjective-NPC-knowledge gap flagged in the earlier
  reconciliation report.**

## Scaling path: 92 → 2,100

Every trait lives as a row in `trait_definitions`, never a column —
scaling means adding rows to the JS arrays above, never a schema
migration.

| Tier | Current | Target (rough) |
|---|---|---|
| Individual (19 families) | 98 | ~1,400 |
| Family | 10 | ~150 |
| Organization | 13 | ~200 |
| City | 12 | ~150 |
| Civilization | 21 | ~150 |
| Culture (tier-level) | 16 | ~50 |
| **Total** | **170** | **~2,100** |

Starting allocation, not a locked requirement — expand whichever
family the actual gameplay needs most first.

## Status

**This is genuinely one of the most important documents in the whole
package — the real, verified, already-coded foundation underneath
every abstract "trait," "key," and "DNA" reference made across all 83+
parts of the World Bible.** It directly resolves the subjective-
knowledge gap flagged in the earlier reconciliation report, and
confirms this is part of a real, separate seven-document technical
handoff package — meaning genuine implementation work already exists
beyond the World Bible's design narrative. Worth confirming whether
the other six documents in this handoff package are available to
integrate as well.
