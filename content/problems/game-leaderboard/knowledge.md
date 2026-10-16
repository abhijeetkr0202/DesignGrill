# Real-Time Game Leaderboard: interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about sorted-sets.
- Reasoning about ranking.
- Reasoning about real-time.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Ranking structure.** How is rank computed fast? In-memory sorted set (skip list) gives logarithmic updates and rank queries. A relational database ORDER BY does not scale. Memory footprint at 50 million players.

**Sharding.** How is a huge board partitioned? Shard by score range to get global rank by summing shard sizes. Or approximate rank beyond the top thousand. Hot top shard.

**Durability.** How are scores persisted? Write to a durable store and update the in-memory board. Rebuild the board from the store after failure. Snapshots plus log.

**Friends and regional boards.** How are sub-boards served? Small per-user friend sets can be computed at read time. Regional boards are separate sorted sets. Cache results briefly.

**Season reset.** How are seasons handled? Key boards by season. Archive old boards to cold storage. Avoid a mass delete at reset time.

## Trade-offs to probe

- Exact vs approximate rank: Cost of exactness for the long tail versus player expectations.
- Sync vs async score updates: Freshness versus write amplification.
- One big board vs sharded boards: Simplicity versus capacity.

## Reasonable alternatives

- In-memory sorted set with durable store: A sorted-set service holds scores, backed by a database for durability and rebuild.
- Score-range sharded boards: Players are partitioned by score band; global rank is derived from band counts.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Sorting the whole table on every read.
- Updating ranks for all players when one score changes.
- Only an in-memory board with no persistence.
- No plan for the season rollover.
