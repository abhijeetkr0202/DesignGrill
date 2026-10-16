# Distributed Key-Value Store: interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about partitioning.
- Reasoning about replication.
- Reasoning about consistency.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Partitioning.** How are keys spread across nodes? Consistent hashing with virtual nodes balances load and limits data movement. Range partitioning supports scans but risks hot ranges. Rebalancing cost.

**Replication.** How are copies placed and kept in sync? Replicate to N nodes clockwise on the ring or across racks. Quorum reads and writes (W + R > N) tune consistency. Cross-datacenter placement.

**Conflict handling.** How are concurrent writes reconciled? Last-write-wins is simple but loses data. Vector clocks detect conflicts for the application to resolve. Read repair and anti-entropy.

**Failure handling.** How are temporary and permanent failures handled? Hinted handoff keeps writes during brief outages. Gossip-based failure detection. Merkle trees repair divergence.

**Storage engine.** How is data stored on a node? LSM trees favour writes with compaction cost. B-trees favour reads and in-place updates. Commit log, memtable, and SSTables.

## Trade-offs to probe

- Consistency vs availability: Quorum settings trade freshness against tolerance of failures.
- LWW vs vector clocks: Simplicity versus not silently losing updates.
- Virtual node count: Balance and recovery speed versus metadata overhead.

## Reasonable alternatives

- Leaderless ring with quorums: Nodes on a consistent-hash ring replicate keys; clients or coordinators use quorums.
- Leader-based partitions with consensus: Each partition has a leader replicated by a consensus protocol.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Hashing with modulo so adding a node reshuffles everything.
- Claiming strong consistency without a quorum or consensus mechanism.
- Ignoring repair for replicas that missed writes.
- No plan for hot keys.
