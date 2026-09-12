# VACANCY — Consolidated Master Build Specification

## Intake record — read before treating anything below as present

**Received 12 Sep 2026 as a single consolidated handoff.** It is
reproduced below as sent, unedited, and it is the design authority for
VACANCY. Where this document and any other VACANCY document in this
repository disagree, this one wins.

**This supersedes the seven documents recorded as missing.**
`VACANCY_DOCUMENT_MANIFEST.md` listed 68 named documents that exist
nowhere in the repository, and seven of them were being waited on:
`VACANCY_WORLD_BIBLE_COMPLETION_MAP.md`,
`VACANCY_CITY_DNA_MASTER_FRAMEWORK.md`,
`VACANCY_CIVILIZATION_DNA_DATABASE.md`,
`VACANCY_GAME_DNA_MASTER_FRAMEWORK.md`, and world-bible parts
`_31_35`, `_36_45`, `_46_50_FINAL`. **They are confirmed gone and are
not coming.** This consolidation covers the same ground, so the gap is
closed by replacement rather than by recovery — which is a better
outcome than the manifest's "cannot be closed from inside the
repository" and a worse one than having the originals, because the
detail those documents held is genuinely lost.

**Two things this document describes but does not contain, stated by
the sender and repeated here so nothing downstream reads it
otherwise:**

| Named in the spec | What is actually present |
|---|---|
| A 2,100-characteristic trait matrix (§19) | The **architecture** for one, and ten named trait families. The literal 2,100-entry catalogue does not exist in this material and must be generated in the build/spec phase. |
| A separate World Bible, parts 1–50 | The **systems** those parts describe, consolidated. The per-part world-bible entries do not exist in this material. |

The same caveat applies in a smaller way to the barter key (§27): 17
example item values are given against an intended catalogue of roughly
3,750 items. The 17 are real; the 3,750 are a target.

**Anyone implementing from this must not generate those enumerations
and then cite them as recovered source.** They are new work, and the
repository's standing rule applies: a generated trait list is a
generated trait list, labelled as such, not a document that was found.

**What to do with it**, in the sender's own framing: treat it as the
design specification, then inspect the existing VACANCY codebase and
map each requirement to what is already implemented **before rewriting
anything**. That map is
`dev-docs/VACANCY_SPEC_IMPLEMENTATION_MAP.md`, and it is the document
to read before starting work, because a good deal of §§6–12, 17–23 and
36–45 is already built in `vacon-c/server/`.

---

# VACANCY
# THE WORLD STARTS OVER

COMPLETE WORLD BIBLE + GAME DESIGN + SIMULATION ARCHITECTURE + CLAUDE CODE BUILD HANDOFF

VERSION: CONSOLIDATED MASTER BUILD SPECIFICATION

---

## 1. WHAT VACANCY IS

VACANCY is a persistent, real-world civilization-reset simulation.

The game begins after a civilization-collapse event.

The player does not enter a normal modern-world game.

The player enters a world where civilization has largely stopped functioning.

Governments may be gone or powerless.

Modern financial systems are unavailable.

Internet infrastructure is unavailable.

Global supply chains have collapsed.

Modern transportation is severely degraded.

Industrial production is severely degraded.

Modern institutions are fractured.

The world must rebuild itself.

VACANCY is therefore a living civilization experiment.

The world is not primarily driven by scripted missions.

The world is driven by:

people, relationships, knowledge, resources, geography, organizations,
property, economics, environment, events, decisions, conflict,
cooperation, technology recovery, civilization rebuilding

The player's actions become part of the world's history.

## 2. CORE DESIGN PRINCIPLE

THE WORLD CONTINUES WITHOUT THE PLAYER.

NPCs do not wait for the player.

NPCs: work, eat, sleep, travel, form families, learn, teach, trade,
fight, negotiate, form organizations, create businesses, build
settlements, move, die, have children, remember events, change beliefs,
change relationships, discover resources, discover knowledge, discover
artifacts, create technology, establish governments, start conflicts,
end conflicts, build civilizations

The simulation must continue when the player is absent.

## 3. WORLD HIERARCHY

WORLD → COUNTRIES → REGIONS → CITIES → DISTRICTS → NEIGHBORHOODS →
BLOCKS → PROPERTIES → BUILDINGS / LOCATIONS → ORGANIZATIONS → NPCs /
RESIDENTS → RELATIONSHIPS / RESOURCES / KNOWLEDGE / EVENTS

Every layer affects the layers above and below it.

## 4. INITIAL WORLD STATE

VACANCY begins in the ZERO CIVILIZATION PERIOD.

Modern civilization has collapsed.

Initial conditions include: limited functioning government, limited
transportation, limited communication, limited industrial production,
limited financial systems, limited supply chains, scarce resources,
isolated communities, damaged infrastructure, abandoned properties,
fragmented populations

The initial economy is primarily barter.

The world subsequently develops through reemergence.

## 5. REAL-WORLD GEOGRAPHY

VACANCY uses real-world-inspired geography.

The world can contain real countries, regions, cities, districts,
neighborhoods, roads, rivers, lakes, terrain, landmarks,
infrastructure, and building types.

The initial prototype is centered around St. Louis and an
approximately three-hour / 180–200-mile surrounding region, including
Missouri, Illinois, and the Ozarks.

The architecture must remain scalable to the entire world.

## 6. THE 12 CORE SIMULATION ENGINES

**1. POPULATION ENGINE** — births, deaths, aging, migration,
households, homelessness, population growth, age distribution,
household formation, movement patterns.

**2. ECONOMY ENGINE** — employment, wages, business activity, illegal
economy, rent, spending, poverty, economic growth, underground economy,
neighborhood wealth. The economy begins as barter and develops over
time.

**3. PROPERTY ENGINE** — ownership, occupancy, maintenance,
construction, abandonment, upgrades. Tracks houses, apartments,
warehouses, businesses, land parcels.

**4. ORGANIZATION ENGINE** — tribes, gangs, companies, clubs, churches,
nonprofits, merchant groups, rebuilding organizations, community
organizations. Tracks members, alliances, conflicts, assets, influence,
territory.

**5. TERRITORY ENGINE** — block control, district influence, contested
zones, expansion, defense. Tracks territory percentage, defensive
strength, loyalty zones, control stability.

**6. CRIME ENGINE** — violent crime, theft, drugs, organized crime,
fraud, robbery. Tracks crime density, retaliation, escalation, crime
hotspots.

**7. LAW ENFORCEMENT ENGINE** — patrols, investigations, raids,
arrests, response time. Tracks police density, law pressure, clearance
rates. This system must adapt to civilization recovery.

**8. SOCIAL INFLUENCE ENGINE** — reputation, public trust, leadership,
influencers, social cohesion. Tracks morale, loyalty, influence spread,
community trust.

**9. RESOURCE ENGINE** — food, water, medicine, fuel, materials, tools,
supplies, energy. Tracks shortages, distribution, stockpiles, scarcity,
resource control.

**10. INFRASTRUCTURE ENGINE** — roads, electricity, water,
internet/communication, bridges, transit, utilities. Tracks system
failures, infrastructure quality, outages, recovery.

**11. EVENT ENGINE** — conflicts, fires, floods, protests, festivals,
disasters, economic events, migration events. Tracks probability,
severity, duration, affected zones, escalation chains.

**12. AI DECISION ENGINE** — NPC decisions, organization decisions,
adaptive behavior, scenario outcomes. Decision methods include multiple
choice, probability, true/false logic, conditional logic, risk
analysis, priority weighting, memory, emotion, personality, resources,
environment.

## 7. THE 40 URBAN SYSTEMS

1. Population · 2. Housing · 3. Economy · 4. Employment · 5. Education ·
6. Health · 7. Transportation · 8. Infrastructure · 9. Energy ·
10. Food Supply · 11. Water · 12. Waste · 13. Law Enforcement ·
14. Crime · 15. Gang · 16. Organized Crime · 17. Court · 18. Prison ·
19. Political · 20. Government Services · 21. Fire & Emergency ·
22. Communication · 23. Media · 24. Social Media · 25. Cultural ·
26. Religion · 27. Community Organizations · 28. Business ·
29. Real Estate · 30. Construction · 31. Environmental · 32. Weather ·
33. Disaster · 34. Supply Chain · 35. Military / National Guard ·
36. Tourism · 37. Technology · 38. Migration · 39. Reputation ·
40. AI Decision

## 8. CITY SIMULATION

Each city is a living simulation.

Cities contain districts, neighborhoods, blocks, properties, buildings,
NPC populations, organizations, resources, transportation, economic
activity, culture, history, infrastructure, crime, politics, education,
healthcare.

Cities evolve independently.

## 9. MASTER BLOCK KEY

Every block contains:

**GEOGRAPHIC DATA** — block size, alley access, highway distance, rail
access, river/lake proximity, industrial access, police station
distance, hospital distance.

**POPULATION** — total population, age ranges, gender distribution,
household count, migration rates.

**DEMOGRAPHIC MODEL** — the system supports demographic modeling
without making demographics determine an NPC's morality, criminality,
intelligence, or worth.

**ECONOMICS** — median income, rent average, home ownership,
unemployment, business density, informal economy, illegal economy.

**HOUSING** — single-family homes, duplexes, apartments, high-rises,
vacant homes, abandoned structures.

**CRIME** — violent crime, property crime, drug crime, theft, gun
crime, fraud, domestic incidents.

**ORGANIZATION** — organization presence, leadership, members,
influence, territory.

**TERRITORY** — territory strength, loyalty, conflict pressure, police
pressure, takeover risk.

**SURVEILLANCE** — cameras, patrol frequency, lighting, private
security, neighborhood watch.

**COMMUNITY** — schools, churches, clinics, parks, community centers,
libraries.

**ENVIRONMENT** — woods, rivers, lakes, flood zones, pollution, heat
zones.

**PSYCHOLOGICAL** — fear, morale, organization influence, police trust,
economic stress, community trust.

**REPUTATION** — safe, dangerous, tourist, industrial, luxury,
organization-controlled.

**MOBILITY** — foot traffic, commuter routes, transit, nightlife,
delivery routes.

**TIME** — day, night, weekday, weekend, season.

**AI INTERACTION** — NPCs and organizations can receive decisions such
as Expand, Recruit, Defend, Invest, Retreat. The system may also
evaluate statements such as "Police pressure is increasing." and
questions such as "Most influential organization: ______"

## 10. PROPERTY CONTROL & STEWARDSHIP

**PROPERTY TYPES** — private ownership, organization controlled, shared
control, government controlled, abandoned.

**STEWARDSHIP ROLES** — property steward, resident families, security
personnel, operational staff.

**ASSET CONTRIBUTION** — members can contribute houses, apartments,
warehouses, land, businesses, vehicles, equipment. Example: 2 houses,
1 business, 4 vehicles. The system tracks contributed assets and their
economic/resource value.

## 11. PROPERTY CONTROL SCALE

CONTROL SCALE: 1 = weak control, 10 = total control.

Control is determined by occupancy, loyalty, security, resources,
infrastructure, reputation, organization presence.

PROPERTY STATUS: active, contested, vacant, abandoned, under
construction, defended, under organization control.

## 12. TERRITORY EXPANSION

Organizations can absorb neighboring blocks, form alliances, recruit
locals, secure infrastructure, establish safe houses, create supply
routes, establish businesses, build settlements, develop defensive
positions.

Expansion is affected by loyalty, policing, resources, conflict,
economic stability, population, leadership, infrastructure.

## 13. ORGANIZATION / FACTION SYSTEM

Organizations form naturally: survivor groups, tribes, families,
merchant groups, businesses, churches, charities, community groups,
protection groups, criminal organizations, scientific organizations,
rebuilding organizations, governments, military organizations.

Every organization has identity, leadership, membership, values,
resources, assets, territory, reputation, alliances, rivals, goals,
strategies.

Organization roles can include founder, leader, council member,
specialist, commander, worker, recruiter, security, citizen, associate.

## 14. GANG / ORGANIZATION STRUCTURE

For organizations that use hierarchical structures, roles can include
shot callers, leaders, lieutenants, enforcers, recruiters, soldiers,
associates, juveniles.

Variables: recruitment rate, loyalty, retaliation probability,
leadership stability, territorial aggression, alliance strength.

This is a simulation system.

The game should not automatically equate criminal affiliation with a
fixed personality.

NPC behavior remains individualized.

## 15. REPUTATION & INFLUENCE ECONOMY

Influence sources: money, businesses, churches, charities, media,
social media, fear, loyalty, leadership, knowledge, service,
achievements.

Influence spreads through schools, businesses, families, organizations,
online platforms, trade networks, community events.

Influence should have measurable radius and decay.

## 16. SOCIAL GRAPH

Relationships contain weighted values.

Core relationship variables: crew loyalty, rivalry, family, civilian
influence, elder guidance, trust, respect, fear, reputation.

Default values from the existing framework include:

crew loyalty = 0.85 · rivalry = 0.50 · family = 0.20 ·
civilian influence = 0.30 · elder guidance = 0.25

These are defaults, not universal immutable values.

## 17. NPC HUMAN SIMULATION

Every NPC is a unique simulated human.

NPC data includes name, age, gender, birthplace, culture, language,
family, education, occupation, income, health, skills, knowledge,
personality, emotions, memories, relationships, inventory, location,
organization, reputation, goals, fears, ambitions, status.

NPC status: active, imprisoned, deceased.

NPCs can independently work, learn, teach, trade, travel, marry, have
children, fight, negotiate, form organizations, leave organizations,
change careers, move locations, discover resources, discover artifacts,
change beliefs, develop skills, die.

## 18. NPC LIFE HISTORY

Each NPC receives a generated life history: childhood, family
conditions, education, friendships, relationships, successes, failures,
trauma, achievements, employment, skills, memories.

Life history affects future decisions.

## 19. 2,100 TRAIT MATRIX

VACANCY requires a 2,100-characteristic trait matrix.

The architecture must support thousands of individual characteristics
while maintaining computational efficiency.

Major trait families include:

**PHYSICAL** — strength, endurance, speed, agility, coordination,
health, recovery, pain tolerance, stamina.

**MENTAL** — intelligence, memory, logic, creativity, curiosity,
learning speed, problem solving, mathematical ability, strategic
thinking, language ability.

**EMOTIONAL** — fear, courage, anger, patience, empathy, confidence,
stress tolerance, emotional control, jealousy, happiness, sadness,
hope.

**PERSONALITY** — introversion, extroversion, ambition, discipline,
honesty, loyalty, generosity, self-interest, aggression, humor,
seriousness.

**SOCIAL** — charisma, persuasion, leadership, trust building,
negotiation, diplomacy, intimidation, cooperation, teaching.

**SURVIVAL** — resourcefulness, adaptability, navigation, wilderness
skill, crafting, awareness, risk assessment, improvisation.

**PROFESSIONAL** — farming, hunting, fishing, construction, carpentry,
masonry, engineering, mechanics, medicine, business, trade, teaching,
science, technology, art, leadership.

**MORAL** — compassion, justice, honor, sacrifice, revenge,
forgiveness, greed, corruption, loyalty.

**CULTURAL** — language, tradition, belief, custom, identity, community
attachment, historical knowledge.

**RARE** — genius inventor, master builder, legendary leader, master
strategist, exceptional teacher, visionary, rare technical ability.

The exact 2,100-entry catalog should be implemented as structured data
rather than hard-coded into individual NPC logic.

Each trait should support base value, age modifier, experience
modifier, education modifier, environment modifier, relationship
modifier, temporary state modifier.

## 20. NPC GENERATION ENGINE

NPC generation pipeline:

1. Generate identity. 2. Generate birthplace. 3. Generate family.
4. Generate cultural/language context. 5. Generate physical
characteristics. 6. Generate personality. 7. Generate psychological
baseline. 8. Generate education. 9. Generate childhood. 10. Generate
career. 11. Generate life experiences. 12. Generate skills.
13. Generate memories. 14. Generate relationships. 15. Generate
organization affiliation. 16. Generate inventory. 17. Generate current
goals. 18. Generate current needs. 19. Generate current location.
20. Begin autonomous simulation.

NPCs must not all have identical distributions.

Population generation must create realistic variation.

## 21. AI PSYCHOLOGY ENGINE

Every NPC makes decisions using personality, needs, emotions, memory,
relationships, resources, environment, knowledge, risk, morality,
goals, current physical state.

Needs include food, water, shelter, safety, health, family, belonging,
respect, resources, purpose, achievement, legacy.

## 22. EMOTION SYSTEM

NPC emotional states include fear, anger, happiness, sadness, hope,
desperation, confidence, jealousy, loyalty, stress, grief, excitement.

Emotions modify decisions.

Example: a normally cooperative NPC experiencing severe hunger and fear
may make a different decision from the same NPC under safe conditions.

## 23. AI DECISION MODEL

Decision architecture:

CURRENT STATE · PERSONALITY · NEEDS · EMOTION · MEMORY ·
RELATIONSHIPS · KNOWLEDGE · RESOURCES · RISK · ENVIRONMENT
= DECISION

Possible decisions: trade, farm, travel, recruit, defend, retreat,
negotiate, research, build, teach, explore, join organization, leave
organization, form alliance, compete, fight.

The system must permit nonviolent solutions.

## 24. KNOWLEDGE RECOVERY

Knowledge is a civilization resource.

Sources: books, manuals, documents, libraries, universities,
experienced NPCs, artifacts, preserved records, blueprints, archives.

Knowledge can unlock agriculture, medicine, engineering, construction,
manufacturing, government, science, education, technology.

## 25. EDUCATION & KNOWLEDGE TIERS

**TIER 1** Basic literacy and everyday skills — reading, writing, basic
math, cooking, gardening, first aid, basic barter.

**TIER 2** Basic trades — carpentry, sewing, fishing, hunting, farming,
tool usage.

**TIER 3** Intermediate professions — mechanics, plumbing, electrical,
advanced fishing/hunting, food preservation.

**TIER 4** Professional knowledge — medicine, engineering, finance,
business, navigation, agriculture science.

**TIER 5** Advanced technical/strategic knowledge — architecture,
logistics, military tactics, advanced science, diplomacy.

**TIER 6** Rare/esoteric knowledge — ancient languages, specialized
research, artifact manuals, rare scientific information.

**TIER 7** Expert knowledge — multidisciplinary mastery, advanced
medicine, rare trade secrets, advanced finance.

**TIER 8** Legendary knowledge — ancient archives, rare artifact
knowledge, advanced historical systems.

**TIER 9** World-class knowledge — complete mastery, multilingual
ability, advanced recovered AI/technology knowledge.

**TIER 10** Ultimate/lost knowledge — lost civilizations,
forbidden/hidden technical knowledge, civilization-changing
discoveries.

Higher tiers require prerequisites.

Books may exist in multiple languages.

NPCs may need translation.

## 26. BARTER ECONOMY

VACANCY begins without conventional money.

The initial economy is SURVIVAL BARTER.

Trade categories: food, water, medicine, clothing, tools, materials,
livestock, fish, crops, metals, gems, spices, textiles, luxury goods,
knowledge, services, labor, transport, repair, protection.

## 27. MASTER BARTER KEY

Every barter item contains: Item_Name, Section_Category, Base_Value,
Rarity, Environment_Modifier, Population_Modifier,
Final_Barter_Score.

Example values already established include:

| Item | Value |
|---|---:|
| Gold Ingot | 100 |
| Silver Ingot | 50 |
| Platinum Ingot | 120 |
| Copper Ingot | 20 |
| Palladium | 110 |
| Diamond | 200 |
| Sapphire | 150 |
| Ruby | 150 |
| Emerald | 150 |
| Amethyst | 60 |
| Sand | 5 |
| Gravel | 7 |
| Hammer | 8 |
| Saw | 10 |
| Gold Bar | 1800 |
| Silver Coin | 25 |
| Rare Musical Instrument | 2000 |

The full barter framework is intended to scale to approximately 3,750
globally modeled items.

Modifiers respond to local scarcity, population, environment, climate,
regional demand, production, transport difficulty.

## 28. RESOURCE ENGINE

Resources include food, water, medicine, fuel, wood, stone, metals,
minerals, energy, tools, clothing, knowledge, technology.

Resources are produced, consumed, stored, transported, traded, lost,
stolen, controlled.

Scarcity changes value.

## 29. SUPPLY CHAIN

Tracks food routes, fuel routes, medicine routes, material routes,
trade routes, shipping hubs, trucking lanes, rail hubs, warehouses,
ports.

Early civilization: human labor, animal transport, local trade.

Later civilization: vehicles, trucking, rail, shipping, aviation,
industrial logistics.

## 30. BUILDING & LOCATION KEY

Every important location has name, type, coordinates, condition, owner,
control status, security, resources, population, economic value,
knowledge value, artifact pool, access conditions, active missions.

**BUILDING TYPES**

*Residential:* houses, apartments, shelters, compounds.

*Education:* schools, libraries, universities, research centers.

*Medical:* hospitals, clinics, pharmacies.

*Government:* city halls, courthouses, administrative centers.

*Religious:* churches, temples, mosques, synagogues, monasteries, other
religious sites.

*Cultural:* museums, theaters, monuments, historic sites.

*Industrial:* factories, warehouses, workshops, mines, processing
facilities.

*Agriculture:* farms, ranches, fisheries, greenhouses.

*Strategic:* airports, ports, military sites, power plants,
communication centers.

*Natural:* caves, forests, mountains, rivers, lakes, underground areas.

*Hidden/special:* secret facilities, buried locations, hidden archives,
artifact locations.

## 31. ARTIFACT SYSTEM

Artifacts are special objects that can unlock missions and civilization
progression.

Artifact Key: Origin, Type, Era, Rarity, Energy/Class, Condition.

Artifacts can represent historical objects, technology, knowledge,
blueprints, cultural objects, scientific discoveries, civilization
records.

## 32. CONTROL NODE SYSTEM

Locations may have:

**LOCKED** — no meaningful access.

**CONTESTED** — limited access.

**CONTROLLED** — full artifact and mission access.

**FORTIFIED** — high-tier missions and defense systems.

## 33. ARTIFACT MISSION ENGINE

VACANCY missions should emerge from the world.

Mission formula: ARTIFACT + LOCATION + NPC + WORLD STATE = MISSION

Artifact properties determine mission characteristics:

Origin = environment/context · Type = objective · Era = rules/context ·
Rarity = scale · Energy/Class = mechanics · Condition =
complication/twist

## 34. NATURAL WORLD + ARTIFACT LAYERS

VACANCY has two simultaneous layers.

**BASE WORLD:** NPC life, economy, relationships, resources,
organizations, geography, events.

**ARTIFACT CONTROL:** special locations, artifacts, knowledge,
technology, mission generation.

The artifact layer does not replace the natural simulation.

## 35. MISSION RULE

The world should not depend on arbitrary quest markers.

Missions can originate from NPC needs, artifacts, resource shortages,
conflicts, discoveries, events, relationships, territorial changes,
civilization recovery.

The player can encounter missions naturally.

## 36. COMMUNITY DEVELOPMENT

Civilization progression:

SURVIVOR CAMP → SETTLEMENT → VILLAGE → TOWN → CITY → CIVILIZATION

Development requires population, food, water, housing, security,
knowledge, leadership, infrastructure, trade, production.

## 37. CIVILIZATION REEMERGENCE ENGINE

CRE = Civilization Reactivation / Reemergence Engine.

Civilization systems begin offline.

Recovery occurs through NPC discovery, faction control, resource
access, knowledge recovery, infrastructure rebuilding.

Global recovery: 0% = lost · 25% = rediscovered · 50% = limited use ·
75% = regional spread · 100% = fully restored/new civilization

## 38. REGIONAL STATES

0–20% DEAD ZONE · 20–50% AWAKENING ZONE · 50–80% ACTIVE ZONE ·
80–100% DOMINANT ZONE

## 39. REEMERGENCE SYSTEMS

**ENERGY:** electric grids, solar, wind, hydroelectric, nuclear, oil
refining, natural gas, battery storage.

**TRANSPORT:** civilian vehicles, freight, rail, subways, aviation,
military transport, maritime, drones.

**COMMUNICATION:** radio, cell networks, internet, satellites, data
centers, AI systems, surveillance, cybersecurity.

**CIVILIZATION:** hospitals, pharmaceuticals, water, waste, food
supply, agriculture, education, banking.

**INDUSTRY:** manufacturing, construction, mining, textiles,
electronics, automotive, logistics, retail, luxury production.

Weapons-related infrastructure is modeled as a world-state category,
but implementation should focus on simulation, resource availability,
security, and consequences rather than providing real-world
construction instructions.

## 40. BOTTLENECK LOGIC

Civilization systems depend upon one another.

Example dependency chain: electricity → communication / industry →
transportation → trade → economic growth → advanced technology

Fuel affects transport, industry, logistics.

Knowledge affects medicine, engineering, agriculture, technology,
government.

## 41. HISTORICAL MEMORY

The world remembers riots, wars, economic crashes, disasters, famous
crimes, political changes, major discoveries, major leaders, major
settlements.

History affects reputation, policing, migration, fear, loyalty,
culture, future decisions.

## 42. PROBABILITY SYSTEM

Every major world action can have probability: raid probability,
conflict probability, migration probability, economic collapse
probability, recruitment probability, disaster probability, trade
success, diplomatic success, construction success.

Probability is modified by world state.

## 43. EVENT ENGINE

Events can include raids, shootings, protests, fires, floods,
blackouts, festivals, economic crashes, conflicts, migration spikes,
disasters, political changes, discoveries.

Every event has probability, severity, duration, affected zones,
participants, consequences.

Events can create cascading events.

## 44. MOVEMENT SYSTEM

Tracks work routes, school routes, shopping, nightlife, social
activity, deliveries, organization movement, police patrols, resource
transportation.

Movement depends on roads, transit, security, weather, resources, time,
territory.

## 45. TIME SYSTEM

Supports day/night, hour, weekday/weekend, season, long-term evolution,
NPC aging, historical progression.

Different activities occur at different times: nightlife increases at
night, schools operate during school hours, commuting peaks at specific
times, seasonal weather changes movement, agriculture follows seasonal
cycles.

## 46. WEATHER & ENVIRONMENT

Tracks temperature, rain, snow, storms, flooding, heat, drought,
wildlife, terrain, pollution.

Weather modifies movement, food production, construction, health,
resources, events.

## 47. NEIGHBORHOOD OUTCOME VARIABLES

1. Median income · 2. Employment · 3. Education · 4. Property
ownership · 5. Housing condition · 6. Crime · 7. Police presence ·
8. Organization influence · 9. Business density · 10. Infrastructure ·
11. School quality · 12. Transportation · 13. Population density ·
14. Community engagement · 15. Public space quality · 16. Health
access · 17. Food access · 18. Cultural identity · 19. Development
pressure · 20. Migration pressure

## 48. NEIGHBORHOOD STABILITY

0–30 = COLLAPSING · 30–50 = STRUGGLING · 50–70 = STABLE ·
70–85 = THRIVING · 85–100 = ELITE

Stability is dynamically calculated.

## 49. CITY DNA

Each city has a distinct identity: industrial city, tourism city, port
city, military city, technology city, university city, finance city,
agricultural city, culturally dominant city.

City DNA modifies economy, migration, crime, infrastructure, resources,
development, population, technology, culture.

## 50. PLAYER SYSTEM

The player begins as one human within the civilization.

The player can become survivor, farmer, builder, merchant, explorer,
scientist, teacher, leader, politician, inventor, historian, athlete,
fighter, organization founder, city founder, civilization founder.

Player progression is not restricted to traditional levels.

## 51. PLAYER LEGACY

Player actions permanently influence NPC relationships, organizations,
territory, settlements, knowledge, technology, economy, history,
culture, future generations.

The player can become part of recorded world history.

## 52. COMBAT SYSTEM

Combat is one component of the simulation.

Combat outcome depends on physical condition, skill, experience,
technique, environment, numbers, equipment, emotion, morale, strategy,
timing, positioning.

Combat must not be guaranteed.

A weaker character may succeed through strategy, teamwork,
environment, preparation, skill, luck.

## 53. FIGHTING STYLES

Supported training styles can include boxing, wrestling, karate, judo,
jiu-jitsu, taekwondo, other martial arts, military-style training,
improvised survival combat.

Fighting styles affect movement, technique, conditioning, defense,
grappling, striking, discipline, timing.

The game treats these as character-development systems rather than
instructional real-world combat manuals.

## 54. SPORTS SYSTEM

Sports exist as civilization rebuilding progresses.

Categories: combat sports, football, basketball, baseball, soccer,
racing, endurance, local games, traditional games.

Sports create culture, entertainment, reputation, community identity,
competition, economic activity.

Players/NPCs can become athletes, coaches, promoters, team owners,
league organizers.

## 55. TRAINING & CHARACTER PROGRESSION

Players and NPCs improve through practice, education, mentorship,
competition, work, experience, survival.

Progression categories: physical, mental, social, survival,
professional, knowledge, leadership, combat, sports.

## 56. FAMILY SYSTEM

NPC families include parents, children, siblings, partners, extended
relatives.

Family affects loyalty, migration, inheritance, protection,
decision-making, organization affiliation.

Families create persistent social networks.

## 57. NPC MEMORY

NPCs remember favors, betrayals, conversations, victories, losses,
trauma, deaths, discoveries, historical events, relationships.

Memory changes future behavior.

## 58. MENTOR SYSTEM

NPCs can become teachers, students, mentors, apprentices.

Knowledge transfer requires knowledge, ability, time, trust.

## 59. DEVELOPMENT SYSTEM

Tracks gentrification, redevelopment, abandonment, business growth,
housing growth, migration, infrastructure growth.

Development is emergent.

## 60. FIRST-WORLD CITY PLAYABILITY

The existing Chicago first-world framework establishes that a
modern-city simulation layer should support districts, neighborhoods,
NPCs, MPCs, factions, social graphs, economy, resources,
transportation, media, communication, seasonal cycles, missions,
reset/chaos dynamics.

The city framework must remain compatible with the civilization-reset
version of VACANCY.

## 61. MEDIA & COMMUNICATION

Media systems include local news, radio, social media, community
bulletins, word-of-mouth, community communication.

Media affects reputation, rumors, morale, social influence, faction
strategy, public awareness.

In the reset era, communication should begin locally and reemerge
technologically over time.

## 62. CULTURAL SYSTEM

Tracks traditions, festivals, religion, language, music, art, sports,
community identity, historical memory.

Culture evolves rather than remaining static.

## 63. POLITICAL / GOVERNMENT SYSTEM

Government develops over time.

Stages: informal rules → settlement leadership → council → local
government → regional government → larger political structures

Tracks laws, leadership, public approval, corruption, diplomacy,
services, taxation when applicable, conflict.

## 64. HEALTH SYSTEM

Tracks health, injury, disease, medicine, medical knowledge, healthcare
access, hospitals, clinics.

Medical knowledge can disappear and later be recovered.

## 65. EDUCATION SYSTEM

Tracks schools, teachers, students, libraries, books, knowledge,
literacy, specialized education.

Education expands civilization capacity.

## 66. TECHNOLOGY RECOVERY

Technology advances through discovery, knowledge, resources,
specialists, manufacturing, infrastructure.

Technology progression should be dependent on prerequisite systems.

## 67. NETWORK / GRAPH ENGINE

The simulation requires graph structures for NPC relationships, family,
organizations, territory, trade, knowledge, transport, communication,
influence.

Graph influence must be weighted and scalable.

## 68. ADVANCED PRECISION SYSTEMS

Implement weighted scoring, influence radius, recruitment models,
conflict escalation, economic ripple effects, territory stability,
resource consumption, historical memory, network graphs, multi-scale
simulation.

## 69. SIMULATION SCALABILITY

The world must support extremely large populations without simulating
every NPC at maximum detail every second.

Use simulation levels:

**HIGH DETAIL:** NPCs near players.

**MEDIUM DETAIL:** NPCs in relevant areas.

**LOW DETAIL:** distant populations.

**ABSTRACT:** far-away civilization systems.

Important events can increase simulation detail temporarily.

## 70. SIMULATION TICK

The backend needs a persistent simulation loop.

Each tick evaluates time, NPC needs, NPC actions, movement, resources,
economy, organizations, territory, events, weather, infrastructure,
knowledge, civilization recovery.

The tick rate should be configurable.

## 71. SAVE / WORLD PERSISTENCE

World state must persist.

Save player state, NPC state, relationships, locations, properties,
organizations, resources, artifacts, knowledge, events, history,
civilization progress.

## 72. FRONT END

The player-facing application requires WORLD MAP, CHARACTER PROFILE,
NPC INTERACTION, INVENTORY, RESOURCE MANAGEMENT, PROPERTY MANAGEMENT,
SETTLEMENT MANAGEMENT, ORGANIZATION MANAGEMENT, ECONOMY / TRADE,
KNOWLEDGE, MISSIONS, WORLD HISTORY, CIVILIZATION STATUS, REPUTATION,
RELATIONSHIPS, COMBAT / TRAINING, SPORTS, SETTINGS.

## 73. MAP INTERFACE

The map should allow world view, country view, regional view, city
view, district view, neighborhood view, block view, property view.

Map markers can represent NPCs, organizations, resources, buildings,
artifacts, missions, settlements, infrastructure, events.

## 74. BACKEND ARCHITECTURE

Backend services should be modular.

Core services: World Service, Population Service, NPC Service, Trait
Service, Psychology Service, Relationship Service, Organization
Service, Property Service, Territory Service, Economy Service, Resource
Service, Knowledge Service, Artifact Service, Mission Service, Event
Service, Weather Service, Transportation Service, Infrastructure
Service, Civilization Service, History Service, Player Service.

## 75. DATABASE MODEL

Required logical entities: Players, NPCs, Traits, NPC_Traits, Families,
Relationships, Locations, Countries, Regions, Cities, Districts,
Neighborhoods, Blocks, Properties, Buildings, Organizations,
Territories, Resources, Inventory, Knowledge, Books, Artifacts,
Missions, Events, Weather, Infrastructure, Transportation, Businesses,
Schools, Hospitals, HistoricalEvents, Reputation, Skills, Sports,
Teams, Leagues.

## 76. API REQUIREMENTS

Backend APIs should support world state, map queries, NPC queries, NPC
decisions, relationships, inventory, barter, resources, organizations,
territory, properties, knowledge, artifacts, missions, events, player
progression, combat state, sports, civilization progress.

Use authenticated endpoints for player actions.

## 77. SECURITY

Implement authentication, authorization, input validation, rate
limiting, server-side validation, database protection, audit logs,
secure secrets, session security, anti-cheat controls.

Never trust client-side game state.

## 78. FRONTEND / BACKEND SEPARATION

The game must be a real application.

**FRONT END:** presentation, input, map, UI, player interaction.

**BACK END:** simulation, NPC decisions, world state, database,
economy, resources, events, validation.

The client must not control authoritative world state.

## 79. AI AGENT ARCHITECTURE

NPC AI should be deterministic where appropriate and probabilistic
where appropriate.

Use utility scoring, weighted decisions, behavior states, memory,
needs, goals, personality, emotion, risk.

AI must be able to select among multiple valid actions.

## 80. EXAMPLE AI DECISION

Settlement food supply decreases.

NPC evaluates food requirement, population, weather, available land,
trade partners, personal morality, leadership, past experience, fear,
resources.

Possible actions: farm, trade, relocate, request aid, reduce
consumption, seek new resources, negotiate, compete.

The choice becomes part of the world's history.

## 81. REAL-TIME WORLD EFFECT

Player actions should propagate.

Example: player helps restore a school. Result: education increases,
NPC knowledge increases, employment changes, community trust changes,
migration may change, business development may change, future leaders
may emerge.

This creates economic and social ripple effects.

## 82. NO STATIC WORLD

Do not build VACANCY as a static collection of missions.

The world must generate outcomes from systems.

Avoid fixed NPC behavior, fixed economy, fixed faction power, fixed
territory, fixed relationships, fixed mission chains.

Use simulation, rules, probability, AI, memory, world state.

## 83. TESTING REQUIREMENTS

Test NPC generation, trait generation, AI decisions, relationships,
family creation, resource consumption, barter, property control,
territory, events, weather, movement, civilization progression,
knowledge transfer, artifact missions, player progression, save/load,
multiplayer synchronization when implemented.

Stress test large NPC populations, large maps, large relationship
graphs, many simultaneous events.

## 84. DEVELOPMENT ORDER

**PHASE 1 — Foundation:** project, database, authentication, world data
model, map, player.

**PHASE 2 — NPC ENGINE:** NPC generator, traits, skills, personality,
memory, family.

**PHASE 3 — AI:** needs, emotion, psychology, decision engine.

**PHASE 4 — WORLD:** cities, districts, neighborhoods, blocks,
properties, buildings.

**PHASE 5 — ECONOMY:** resources, inventory, barter, trade, business.

**PHASE 6 — ORGANIZATIONS:** groups, leadership, territory,
relationships, influence.

**PHASE 7 — CIVILIZATION:** settlements, education, infrastructure,
knowledge, technology recovery.

**PHASE 8 — ARTIFACTS / MISSIONS:** locations, artifacts, control,
emergent missions.

**PHASE 9 — COMBAT / SPORTS:** training, combat attributes, sports,
teams, competition.

**PHASE 10 — WORLD SCALE:** large-scale simulation, regional
abstraction, global reemergence.

**PHASE 11 — MULTIPLAYER:** persistent shared world, player
settlements, alliances, trade, competition.

**PHASE 12 — OPTIMIZATION / RELEASE:** stress testing, security,
performance, save/load, deployment, monitoring.

## 85. REPLIT / CLAUDE CODE REQUIREMENT

Claude Code must treat this document as the design authority for
VACANCY.

Do not reduce the game to a demo unless explicitly requested.

Build an actual runnable application.

The implementation must include front end, back end, database,
simulation engine, NPC engine, AI decision engine, world engine,
resource engine, economy, map, player system, persistent state,
testing, deployment configuration.

## 86. IMPORTANT IMPLEMENTATION RULE

Build the architecture so systems are modular.

Do not create one giant monolithic file.

Each major simulation system must have clear inputs, outputs, state,
dependencies, tests.

## 87. DEBUG / ADMIN SYSTEM

Developer tools should provide world state viewer, NPC inspector, trait
inspector, relationship graph, organization inspector, property
inspector, resource inspector, event inspector, civilization progress,
simulation controls, tick controls, save/load, seed control.

## 88. WORLD SEED

The simulation should support reproducible world seeds.

Same seed + same rules = reproducible initial world.

This allows debugging.

## 89. PLAYER-FACING WORLD INFORMATION

The player should not automatically know everything.

Information is discovered through exploration, NPC conversations,
books, maps, relationships, observation, organizations, missions,
knowledge.

Fog-of-knowledge is part of the experience.

## 90. FINAL GAME LOOP

SURVIVE → EXPLORE → MEET PEOPLE → LEARN → GATHER RESOURCES → TRADE →
BUILD → FORM RELATIONSHIPS → CREATE / JOIN ORGANIZATIONS → ESTABLISH
PROPERTY CONTROL → DEVELOP SETTLEMENTS → RECOVER KNOWLEDGE → RESTORE
INFRASTRUCTURE → REBUILD TECHNOLOGY → CREATE GOVERNMENT → DEVELOP
CIVILIZATION → LEAVE A LEGACY

## 91. FINAL WORLD LOOP

NPC LIFE → RESOURCE USE → ECONOMIC ACTIVITY → RELATIONSHIPS →
ORGANIZATIONS → TERRITORY → EVENTS → KNOWLEDGE → INFRASTRUCTURE →
CIVILIZATION RECOVERY → NEW CONDITIONS → NPC DECISIONS → REPEAT

## 92. FINAL POSITIONING

VACANCY is not simply an RPG, a survival game, a city builder, a
strategy game, a fighting game, a sports game, or a civilization game.

It combines those systems into one persistent simulation.

The central concept is: THE WORLD STARTS OVER.

Humanity rebuilds through people.

People rebuild through knowledge, relationships, resources,
cooperation, competition, culture, leadership, discovery, innovation.

The player becomes one participant in that process.

## 93. MVP DEFINITION

The first playable version should establish one geographic region, one
persistent world, a substantial simulated NPC population, NPC
generation, 2,100-trait architecture, psychology, emotion, memory,
family, relationships, basic organizations, properties, resources,
barter, knowledge, settlement development, events, player movement, NPC
interaction, basic combat, basic sports, save/load, world simulation.

The architecture must allow expansion to the global world.

## 94. DEFINITION OF "PLAYABLE"

A playable VACANCY build means:

The player can enter the world. The player can move. The player can
interact with NPCs. NPCs act independently. Resources change. The
economy operates. Relationships change. Organizations form and change.
Properties can be controlled. Settlements evolve. Knowledge can be
discovered and transferred. Events occur. The player can make
consequential choices. The world persists after the player leaves.

## 95. DEFINITION OF "COMPLETE"

A complete production VACANCY build requires functional frontend,
functional backend, persistent database, persistent simulation, NPC
generation, trait system, psychology, emotion, memory, relationships,
family, skills, professions, economy, barter, resources, properties,
buildings, organizations, territory, transport, infrastructure,
education, knowledge, artifacts, missions, events, weather, culture,
politics, civilization recovery, combat, sports, player progression,
history, save/load, security, testing, deployment.

## 96. FINAL DEVELOPMENT COMMAND

CLAUDE CODE:

Read this entire specification before implementation.

Treat VACANCY as a systems-driven persistent civilization simulator.

Do not build isolated features that cannot communicate with the
simulation.

Every major feature must connect to the world state.

NPCs must be autonomous.

The economy must respond to resources.

Resources must respond to production and consumption.

Organizations must respond to people and resources.

Territory must respond to organizations.

Civilization must respond to knowledge and infrastructure.

History must respond to events.

Player actions must alter the world.

The world must continue without the player.

Build the system incrementally.

After every major subsystem: implement, test, integrate, stress test,
document.

Do not declare the game complete merely because the UI exists.

The simulation must actually run.

## 97. END STATE

VACANCY ultimately becomes:

A persistent real-world civilization simulation in which humanity
begins again after collapse and millions of unique AI-driven people
create the future through survival, relationships, knowledge,
economics, organization, discovery, conflict, cooperation, technology
recovery, and civilization building.

THE WORLD STARTS OVER.

THE PEOPLE CREATE WHAT COMES NEXT.

*END OF CONSOLIDATED VACANCY WORLD BIBLE / CLAUDE CODE HANDOFF*
