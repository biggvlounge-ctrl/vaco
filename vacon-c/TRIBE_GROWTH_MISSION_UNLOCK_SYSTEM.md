# VACANCY — Tribe Growth & Mission Unlock System

The real, core mechanic confirmed: recruiting the right person doesn't
just add a body to the Tribe — it directly unlocks and suggests the
specific mission their skill makes possible. This is the genuine
engine behind "the game opens up as the Tribe grows."

The real mechanic: ties together three systems already built into one
coherent unlock chain. A location's Control Key already specifies
real specialist requirements (a Hospital needs medical experts, per
the Control Key system). The Occupation Taxonomy already tracks
exactly what real skill each NPC brings. The moment a Tribe recruits
someone whose occupation matches a nearby location's specialist
requirement, that match itself becomes the trigger for a new, real,
suggested mission.

TribeSkillMissionUnlock {
  tribeId, newMemberNpcId, newMemberOccupation: string
  matchedLocationId: string
  unlockedMission: string
  suggestionSource: "the-new-member-themselves" | "elder" |
    "tribe-leader"
}

Confirmed examples: recruit someone with real water-treatment
experience, and the water plant takeover becomes a real, newly-viable
mission — because the Control Key's specialist requirement is now
actually met. Recruit a pastor, and a church becomes a real,
newly-viable target.

Why this is the right mechanic: gives Tribe growth real, mechanical
weight beyond just a bigger population number. A player doesn't just
want more people — they want the right people, because each new
specialist genuinely opens a real, specific door that was locked
before.

TribeGrowthOptionsExpansion {
  tribeId
  currentMemberOccupations: [string]
  availableMissionsUnlockedByCurrentRoster: [string]
}

Status: confirms and formalizes the real, core engine behind the whole
Tribe/recruitment/mission system — growing a Tribe unlocks specific,
real gameplay options based on exactly who joins.
