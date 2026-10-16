# Multiplayer Matchmaking: interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about queues.
- Reasoning about skill-rating.
- Reasoning about latency.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Pool partitioning.** How are players grouped for matching? Partition by mode and region to bound the search space. Skill buckets with widening tolerance over time. Party handling.

**Matching algorithm.** How are matches formed? Tickets in a pool, matched periodically in batches. Greedy versus optimisation; fairness versus speed. Relax constraints as wait grows.

**Server allocation.** How is a game server chosen and started? Fleet manager with warm pools. Select region by latency to all players. Autoscale on queue forecasts.

**Rating system.** How are skill ratings maintained? Elo, Glicko, or TrueSkill style updates after matches. Uncertainty for new players. Idempotent rating updates.

**State and reliability.** How is matchmaking state kept consistent? Tickets stored in a fast store with expiry. Avoid double-assigning a player to two matches. Handle player disconnects during assignment.

## Trade-offs to probe

- Match quality vs wait time: Tighter skill ranges mean longer queues.
- Warm servers vs cost: Instant starts versus idle capacity.
- Batch vs continuous matching: Better optimisation versus responsiveness.

## Reasonable alternatives

- Pool-based matcher with fleet manager: Tickets enter regional pools; a matcher forms matches in cycles and requests servers.
- Lobby-based matching: Players join open lobbies that fill by criteria.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- One global queue for all regions and modes.
- No time-based relaxation of constraints.
- Allowing a player into two matches at once.
- Ignoring latency when choosing the server region.
