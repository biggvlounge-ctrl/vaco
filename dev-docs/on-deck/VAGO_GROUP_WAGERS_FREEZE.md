# VAGO GROUP WAGERS / GROUP BETS

NEW MASTER-FREEZE REQUIREMENT — **parked 17 Sep 2026, on deck.**
Owner's instruction: finish VACON-C first.

Verbatim as frozen by the owner. Do not edit the text below; it is the
specification, and an edited copy is a different specification.

> **Text restored 23 Sep 2026.** The copy filed on 17 Sep was condensed
> and reflowed — §17's format list had been folded into a running
> sentence and its "BLIND GROUP — 10 PLAYERS" example dropped, among
> others. It claimed to be verbatim and was not. The owner re-supplied
> the full text and it replaces the condensed copy here. See the
> folder README for why this matters more than tidiness.

> **Audit note, recorded 17 Sep 2026 and not part of the freeze.** This
> document opens by requiring integration with "the existing VAGO Wager
> Contract Engine, Wager Graph, Wager Threads, Odds Layer, Escrow
> Adapter, Resolution Engine" and instructs that those not be
> duplicated. Measured across every non-`node_modules` JS file in the
> repo, each of those names returns **zero files**. VAGO today is
> casino (mines, plinko, hilo), fantasy props, prediction markets, a
> sportsbook, esports staking and AMOE. **The wagering engine this
> document layers group play onto has not been built**, so it is the
> real first task whenever this resumes — not the group layer.

---

VAGO must support Group Wagers / Group Bets as a native wagering structure.

A Group Wager allows multiple user to participate in the same wager, prediction, contest, pool, or event rather than limiting a wager to two people.

Group wagering must integrate with the existing VAGO Wager Contract Engine, Wager Graph, Wager Threads, Odds Layer, Escrow Adapter, Resolution Engine, VASH, VCoin, VAKA, social systems, security, and compliance systems.

Do not create duplicate versions of those systems.

---

## 1. GROUP WAGER TYPES

Support multiple group structures.

OPEN GROUP WAGER

A creator establishes a wager and allows eligible users to join.

PRIVATE GROUP WAGER

Only invited users can participate.

FRIEND GROUP

A wager between a defined group of friends.

COMMUNITY GROUP

A wager open to an eligible VAGO community.

CREATOR GROUP WAGER

A creator establishes a wager for their audience/community.

EVENT GROUP WAGER

A wager associated with a specific event, game, match, tournament, concert, show, or other eligible event.

TEAM GROUP WAGER

Users participate as members of a team.

POOL WAGER

Participants contribute to a defined pool and settlement follows predetermined rules.

TOURNAMENT WAGER

Multiple participants compete through a structured wagering/prediction tournament.

LEAGUE WAGER

Recurring group competition across multiple events.

SOCIAL CHALLENGE

A group of users compete against one another based on a defined proposition or series of propositions.

---

## 2. GROUP SIZE

The architecture must not assume that every wager has only two participants.

A group wager may contain:

* 3 participants
* 5 participants
* 10 participants
* 50 participants
* 100 participants
* Larger groups where legally and technically permitted

Limits should be configurable based on:

* Market type
* Jurisdiction
* Provider
* Risk
* Compliance
* Account type
* Event
* Product configuration

---

## 3. GROUP WAGER STRUCTURE

A Group Wager should contain:

* Group Wager ID
* Creator
* Group name
* Description
* Participants
* Invitations
* Join rules
* Entry requirements
* Proposition
* Outcomes
* Stake
* Odds
* Pool structure
* Payout structure
* Entry deadline
* Lock time
* Event
* Resolution method
* Evidence
* Group thread
* Participant status
* Funding status
* Settlement status
* Disputes
* Audit history

---

## 4. PARTICIPANT ROLES

Group wagers can support different roles.

CREATOR

Creates the group wager.

PARTICIPANT

Joins and funds/predicts according to the rules.

INVITED USER

Has received an invitation but has not yet joined.

OBSERVER

Can watch/follow the wager without participating.

ADMIN/MODERATOR

Authorized to manage the group where applicable.

Roles must use the existing VACO identity and permissions infrastructure.

---

## 5. GROUP JOIN FLOW

Example:

A user creates:

"$20 Group Bet — Who wins tonight?"

The creator selects:

* Event
* Proposition
* Entry amount
* Maximum participants
* Join deadline
* Resolution
* Payout rules

Users receive invitations or discover the group.

They can:

JOIN → FUND → CONFIRM → LOCK

Once the wager locks, the group follows the predetermined rules.

---

## 6. GROUP ODDS / POOLS

The architecture must support multiple group pricing structures.

Examples:

* Fixed odds
* Negotiated odds
* Pari-mutuel/pool-style structures where legally permitted
* Fixed-entry contests
* Winner-take-all
* Multiple winners
* Ranked payouts
* Percentage-based pool distribution
* Point-based competition
* Tournament scoring

The payout structure must be defined before the wager locks.

---

## 7. GROUP PREDICTION

Group wagers do not have to require every participant to choose the same side.

A group can contain:

* Team A supporters
* Team B supporters
* Multiple outcome selections
* Over/under selections
* Player props
* Multiple predictions

The system tracks each participant's:

* Prediction
* Stake
* Odds
* Position
* Entry
* Potential payout
* Result

---

## 8. GROUP SIDE WAGERS

Group wagers must work with the existing Side Wager architecture.

Example:

Parent Group Wager:

"20 people bet on tonight's game."

Side Wager:

"Which player scores first?"

Another side wager:

"Will the game go over the specified total?"

Another:

"Who will lead the team in scoring?"

Each side wager remains connected to the parent group wager through the Wager Graph.

---

## 9. GROUP WAGER THREAD

Every group wager should have a shared discussion thread.

Participants can:

* Comment
* Reply
* React
* Mention users
* Post photos
* Post videos
* Submit evidence
* Share updates
* View system events
* Track participants
* Discuss predictions

The existing VACO social/thread infrastructure should be reused.

---

## 10. GROUP LEADERBOARD

Where appropriate, group wagers can display:

* Current standings
* Correct predictions
* Incorrect predictions
* Points
* Wins
* Losses
* Streaks
* Accuracy
* Earnings
* Tournament position

Leaderboards must follow the rules of the particular wager.

---

## 11. GROUP WAGER TOURNAMENTS

VAGO should support structured group tournaments.

Example:

64 participants enter a prediction tournament.

Participants accumulate points across multiple events.

The system tracks:

* Rounds
* Matchups
* Points
* Predictions
* Advancement
* Elimination
* Finals
* Winner
* Settlement

This can support:

* Sports
* Esports
* Culture
* Entertainment
* Prediction markets
* VACO events
* VACANCY events
* VENUS events

---

## 12. GROUP WAGER LEAGUES

Users can create recurring prediction/wagering leagues.

Examples:

* Weekly sports league
* Esports prediction league
* Friends prediction league
* Creator prediction league
* Seasonal league
* VACO community league

The league can maintain:

* Standings
* Weekly results
* Points
* Accuracy
* Streaks
* Rankings within the specific league

Any ranking must remain descriptive of the league's recorded results and must not be represented as a universal measure of user worth or ability.

---

## 13. GROUP INVITATIONS

Users can invite:

* Friends
* Followers
* Communities
* Teams
* Creator audiences
* Event participants

Invitation states:

Invited → Viewed → Joined → Funded → Locked → Settled

Notifications should use the existing VACO notification system.

---

## 14. GROUP ESCROW / FUNDING

Each participant's financial commitment must be tracked individually.

Example:

20 users × $25 entry = $500 total pool.

The system must know:

* Who funded
* How much
* When they funded
* Whether funds are locked
* Whether funding succeeded
* Whether funding was refunded
* Final settlement

Use the existing VASH/payment infrastructure and VAGO Escrow Adapter.

Do not create a second wallet.

---

## 15. GROUP SETTLEMENT

At resolution:

1. Determine official outcome.
2. Determine winning participants.
3. Calculate payout according to locked rules.
4. Release/settle funds through the authorized financial provider.
5. Record each participant's settlement.
6. Update wager history.
7. Update appropriate reputation/statistics.
8. Preserve the complete audit trail.

Settlement must be idempotent and protected against duplicate payout.

---

## 16. GROUP DISPUTES

Participants should be able to report a dispute according to the wager rules.

The system preserves:

* Original terms
* Participant predictions
* Funding
* Evidence
* Resolution sources
* Amendments
* Dispute submissions
* Administrative decisions
* Final resolution

No individual participant should be able to unilaterally rewrite the group's wager after lock.

---

## 17. GROUP BLIND

BLIND can operate as a group experience.

Example:

BLIND GROUP — 10 PLAYERS

VAGO/ARIES selects a random eligible proposition.

All participating users receive the same proposition.

Each user submits a prediction.

Predictions lock.

The result is resolved.

Participants receive outcomes based on the predefined rules.

Possible formats:

* Highest accuracy
* Fixed payout
* Points
* Tournament
* Pool
* Winner-take-all
* Multiple winners

---

## 18. GROUP BEFORE-THE-ANSWER

VAGO KNOW / Before-the-Answer can also operate as a group wager.

Example:

10 people join.

Question:

"BET BEFORE I ANSWER."

Each participant submits an answer.

The answers lock.

VAGO performs the predefined research.

The answer is resolved.

The group sees:

* Each participant's answer
* Correct answer
* Source
* Resolution
* Settlement
* Group standings where applicable

The AI must not alter the answer based on the participants' bets.

---

## 19. GROUP GOAL WAGERS

VAGO GOAL can support groups.

Example:

A group of friends establishes a shared challenge.

Each participant has:

* Individual goal
* Target
* Deadline
* Verification rules
* Progress
* Outcome

The group can track collective progress while each participant's individual wager remains separately recorded.

---

## 20. GROUP WAGER SOCIAL EXPERIENCE

Group wagers should feel like a social event rather than merely a financial transaction.

The experience can include:

* Group avatar presence
* Live participant list
* Event countdown
* Live updates
* Chat
* Reactions
* Evidence
* Leaderboards
* Predictions
* Side wagers
* Achievements
* Group history

Use the universal VACO avatar.

---

## 21. VAGO + VILLAGE

Group wagering can surface through VILLAGE communities.

A VILLAGE community can create or participate in eligible:

* Sports groups
* Esports groups
* Prediction clubs
* Creator communities
* Event groups
* Private groups

VAGO remains the wagering engine.

VILLAGE remains the social/community environment.

---

## 22. VAGO + VENUS

VENUS can provide physical/digital group wagering environments.

Examples:

* Sportsbook groups
* Casino groups
* Sports lounges
* Esports lounges
* Tournament rooms
* VIP groups

Multiple avatars can occupy the same digital wagering environment while VAGO manages the underlying wager.

---

## 23. VAGO + VACANCY

VACANCY can support group wagers around:

* Esports
* Team competitions
* Tournaments
* In-world events
* Sports
* Casino events

VAGO handles wagering.

VACANCY handles the game/world experience.

---

## 24. GROUP WAGER SECURITY

QVAN should monitor group-specific risks including:

* Collusion
* Coordinated manipulation
* Multi-accounting
* Fraudulent invitations
* Account takeover
* Suspicious participant networks
* Artificial participation
* Payment abuse
* Manipulation of group outcomes
* Bonus abuse

Use the existing QVAN/VACO security infrastructure.

---

## 25. GROUP WAGER COMPLIANCE

Group wagers must obey the same applicable:

* Age
* Geography
* KYC
* AML
* Market
* Stake
* Responsible-wagering
* Self-exclusion
* Provider
* Licensing

requirements as other regulated VAGO wagering.

A group structure must never be used to bypass individual restrictions.

---

## 26. GROUP WAGER GRAPH

The Wager Graph expands to:

Group → Event → Parent Wager → Participants → Individual Positions → Side Wagers → Threads → Evidence → Resolution → Settlement

This structure must preserve the relationship between the group and every individual participant.

---

## 27. GROUP WAGER ANALYTICS

VAGO analytics should track:

* Group size
* Entry volume
* Participation
* Pool size
* Average entry
* Completion
* Settlement
* Disputes
* Retention
* Repeat groups
* Tournament participation
* Creator groups
* Community groups
* Risk patterns

Use existing VACO analytics infrastructure.

---

## 28. GROUP WAGER MASTER RULE

GROUP WAGERS ARE A CORE VAGO FEATURE.

They are not an afterthought.

They must work across:

* Sports
* Esports
* Prediction markets
* BLIND
* BEFORE-THE-ANSWER
* Goals
* Live events
* Casino
* VENUS
* VACANCY
* Creator markets
* Community markets
* Other eligible VAGO markets

The underlying architecture must remain reusable so a new group format does not require rebuilding the wagering engine.

---

## 29. IMPLEMENTATION REQUIREMENT

Claude Code must integrate Group Wagers into the existing VAGO architecture.

Do not create separate:

* Group wallet
* Group identity
* Group notification system
* Group search
* Group security
* Group AI
* Group audit platform
* Group payment platform

Reuse existing VACO/VAGO systems.

Build only the missing group-specific functionality.

FINAL RULE:

ONE VAGO WAGERING ENGINE.

INDIVIDUAL WAGERS, TWO-PARTY WAGERS, SIDE WAGERS, GROUP WAGERS, POOLS, TOURNAMENTS AND LEAGUES ALL USE THE SAME UNDERLYING WAGER CONTRACT, WAGER GRAPH, ODDS, FUNDING, RESOLUTION AND SETTLEMENT ARCHITECTURE.
