# VAGO GROUP WAGERS / GROUP BETS

NEW MASTER-FREEZE REQUIREMENT — **parked 17 Sep 2026, on deck.**
Owner's instruction: finish VACON-C first.

Verbatim as frozen by the owner.

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

VAGO must support Group Wagers / Group Bets as a native wagering
structure. A Group Wager allows multiple users to participate in the
same wager, prediction, contest, pool or event rather than limiting a
wager to two people.

Group wagering must integrate with the existing VAGO Wager Contract
Engine, Wager Graph, Wager Threads, Odds Layer, Escrow Adapter,
Resolution Engine, VASH, VCoin, VAKA, social systems, security and
compliance systems. Do not create duplicate versions of those systems.

## 1. GROUP WAGER TYPES

OPEN GROUP WAGER — a creator establishes a wager and allows eligible
users to join. PRIVATE GROUP WAGER — only invited users participate.
FRIEND GROUP — a wager between a defined group of friends. COMMUNITY
GROUP — open to an eligible VAGO community. CREATOR GROUP WAGER — a
creator establishes a wager for their audience. EVENT GROUP WAGER —
associated with a specific event, game, match, tournament, concert,
show or other eligible event. TEAM GROUP WAGER — users participate as
members of a team. POOL WAGER — participants contribute to a defined
pool, settlement follows predetermined rules. TOURNAMENT WAGER —
multiple participants compete through a structured
wagering/prediction tournament. LEAGUE WAGER — recurring group
competition across multiple events. SOCIAL CHALLENGE — a group competes
on a defined proposition or series of propositions.

## 2. GROUP SIZE

**The architecture must not assume that every wager has only two
participants.** A group wager may contain 3, 5, 10, 50, 100 or larger
groups where legally and technically permitted.

Limits configurable by market type, jurisdiction, provider, risk,
compliance, account type, event and product configuration.

## 3. GROUP WAGER STRUCTURE

Group Wager ID, creator, group name, description, participants,
invitations, join rules, entry requirements, proposition, outcomes,
stake, odds, pool structure, payout structure, entry deadline, lock
time, event, resolution method, evidence, group thread, participant
status, funding status, settlement status, disputes, audit history.

## 4. PARTICIPANT ROLES

CREATOR, PARTICIPANT, INVITED USER, OBSERVER (can watch/follow without
participating), ADMIN/MODERATOR. Roles must use the existing VACO
identity and permissions infrastructure.

## 5. GROUP JOIN FLOW

A user creates "$20 Group Bet — Who wins tonight?" and selects event,
proposition, entry amount, maximum participants, join deadline,
resolution and payout rules. Users receive invitations or discover the
group, then JOIN → FUND → CONFIRM → LOCK. Once locked, the group
follows the predetermined rules.

## 6. GROUP ODDS / POOLS

Fixed odds, negotiated odds, pari-mutuel/pool-style structures where
legally permitted, fixed-entry contests, winner-take-all, multiple
winners, ranked payouts, percentage-based pool distribution,
point-based competition, tournament scoring.

**The payout structure must be defined before the wager locks.**

## 7. GROUP PREDICTION

Group wagers do not require every participant to choose the same side.
A group can contain Team A supporters, Team B supporters, multiple
outcome selections, over/under selections, player props and multiple
predictions. The system tracks each participant's prediction, stake,
odds, position, entry, potential payout and result.

## 8. GROUP SIDE WAGERS

Group wagers must work with the existing Side Wager architecture.
Parent: "20 people bet on tonight's game." Side wagers: "Which player
scores first?", "Will the game go over the specified total?", "Who will
lead the team in scoring?" Each remains connected to the parent through
the Wager Graph.

## 9. GROUP WAGER THREAD

Every group wager has a shared discussion thread: comment, reply,
react, mention users, post photos, post videos, submit evidence, share
updates, view system events, track participants, discuss predictions.
Reuse the existing VACO social/thread infrastructure.

## 10. GROUP LEADERBOARD

Current standings, correct predictions, incorrect predictions, points,
wins, losses, streaks, accuracy, earnings, tournament position.
Leaderboards must follow the rules of the particular wager.

## 11. GROUP WAGER TOURNAMENTS

64 participants enter a prediction tournament and accumulate points
across multiple events. The system tracks rounds, matchups, points,
predictions, advancement, elimination, finals, winner and settlement.
Supports sports, esports, culture, entertainment, prediction markets,
VACO events, VACANCY events, VENUS events.

## 12. GROUP WAGER LEAGUES

Recurring prediction/wagering leagues — weekly sports, esports
prediction, friends, creator, seasonal, VACO community. Maintains
standings, weekly results, points, accuracy, streaks and rankings
within the specific league.

**Any ranking must remain descriptive of the league's recorded results
and must not be represented as a universal measure of user worth or
ability.**

## 13. GROUP INVITATIONS

Invite friends, followers, communities, teams, creator audiences, event
participants. States: Invited → Viewed → Joined → Funded → Locked →
Settled. Notifications use the existing VACO notification system.

## 14. GROUP ESCROW / FUNDING

Each participant's financial commitment tracked individually. 20 users
× $25 entry = $500 total pool. The system must know who funded, how
much, when, whether funds are locked, whether funding succeeded,
whether funding was refunded, and final settlement.

Use the existing VASH/payment infrastructure and VAGO Escrow Adapter.
**Do not create a second wallet.**

## 15. GROUP SETTLEMENT

1. Determine official outcome. 2. Determine winning participants.
3. Calculate payout according to locked rules. 4. Release/settle funds
through the authorized financial provider. 5. Record each participant's
settlement. 6. Update wager history. 7. Update appropriate
reputation/statistics. 8. Preserve the complete audit trail.

**Settlement must be idempotent and protected against duplicate
payout.**

## 16. GROUP DISPUTES

Participants may report a dispute according to the wager rules. The
system preserves original terms, participant predictions, funding,
evidence, resolution sources, amendments, dispute submissions,
administrative decisions and final resolution.

**No individual participant may unilaterally rewrite the group's wager
after lock.**

## 17. GROUP BLIND

BLIND can operate as a group experience. VAGO/ARIES selects a random
eligible proposition; all participants receive the same proposition;
each submits a prediction; predictions lock; the result is resolved.
Formats: highest accuracy, fixed payout, points, tournament, pool,
winner-take-all, multiple winners.

## 18. GROUP BEFORE-THE-ANSWER

VAGO KNOW / Before-the-Answer can operate as a group wager. Each
participant submits an answer; answers lock; VAGO performs the
predefined research; the answer is resolved. The group sees each
participant's answer, the correct answer, the source, resolution,
settlement and standings.

**The AI must not alter the answer based on the participants' bets.**

## 19. GROUP GOAL WAGERS

VAGO GOAL supports groups. Each participant has an individual goal,
target, deadline, verification rules, progress and outcome. The group
tracks collective progress while each participant's individual wager
remains separately recorded.

## 20. GROUP WAGER SOCIAL EXPERIENCE

Group avatar presence, live participant list, event countdown, live
updates, chat, reactions, evidence, leaderboards, predictions, side
wagers, achievements, group history. Use the universal VACO avatar.

## 21. VAGO + VILLAGE

Group wagering surfaces through VILLAGE communities — sports groups,
esports groups, prediction clubs, creator communities, event groups,
private groups. VAGO remains the wagering engine; VILLAGE remains the
social/community environment.

## 22. VAGO + VENUS

VENUS provides physical/digital group wagering environments —
sportsbook groups, casino groups, sports lounges, esports lounges,
tournament rooms, VIP groups. Multiple avatars occupy the same digital
environment while VAGO manages the underlying wager.

## 23. VAGO + VACANCY

VACANCY supports group wagers around esports, team competitions,
tournaments, in-world events, sports and casino events. VAGO handles
wagering; VACANCY handles the game/world experience.

## 24. GROUP WAGER SECURITY

QVAN monitors collusion, coordinated manipulation, multi-accounting,
fraudulent invitations, account takeover, suspicious participant
networks, artificial participation, payment abuse, manipulation of
group outcomes and bonus abuse. Use the existing QVAN/VACO security
infrastructure.

## 25. GROUP WAGER COMPLIANCE

Group wagers obey the same applicable age, geography, KYC, AML, market,
stake, responsible-wagering, self-exclusion, provider and licensing
requirements as other regulated VAGO wagering.

**A group structure must never be used to bypass individual
restrictions.**

## 26. GROUP WAGER GRAPH

Group → Event → Parent Wager → Participants → Individual Positions →
Side Wagers → Threads → Evidence → Resolution → Settlement. This
structure must preserve the relationship between the group and every
individual participant.

## 27. GROUP WAGER ANALYTICS

Group size, entry volume, participation, pool size, average entry,
completion, settlement, disputes, retention, repeat groups, tournament
participation, creator groups, community groups, risk patterns. Use
existing VACO analytics infrastructure.

## 28. GROUP WAGER MASTER RULE

**GROUP WAGERS ARE A CORE VAGO FEATURE. They are not an afterthought.**

They must work across sports, esports, prediction markets, BLIND,
BEFORE-THE-ANSWER, goals, live events, casino, VENUS, VACANCY, creator
markets, community markets and other eligible VAGO markets.

The underlying architecture must remain reusable so a new group format
does not require rebuilding the wagering engine.

## 29. IMPLEMENTATION REQUIREMENT

Integrate Group Wagers into the existing VAGO architecture. Do not
create separate group wallet, group identity, group notification
system, group search, group security, group AI, group audit platform or
group payment platform. Reuse existing VACO/VAGO systems. Build only
the missing group-specific functionality.

### FINAL RULE

ONE VAGO WAGERING ENGINE. INDIVIDUAL WAGERS, TWO-PARTY WAGERS, SIDE
WAGERS, GROUP WAGERS, POOLS, TOURNAMENTS AND LEAGUES ALL USE THE SAME
UNDERLYING WAGER CONTRACT, WAGER GRAPH, ODDS, FUNDING, RESOLUTION AND
SETTLEMENT ARCHITECTURE.
