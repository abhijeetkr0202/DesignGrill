# Distributed Message Queue: interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about logs.
- Reasoning about ordering.
- Reasoning about delivery-guarantees.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Storage model.** How are messages stored? Append-only partitioned log with sequential disk writes. Segment files and index for offset lookups. Retention by time or size.

**Partitioning.** How are messages assigned to partitions? Key hashing preserves per-key order. Partition count limits consumer parallelism. Repartitioning is disruptive.

**Replication.** How is durability achieved? Leader and follower replicas with in-sync set. Acknowledgement levels trade latency for safety. Leader election after failure.

**Consumption.** How do consumers track progress? Offsets committed by consumer groups. Rebalancing when consumers join or leave. Commit timing determines duplicates versus loss.

**Delivery semantics.** What guarantees are offered? At-least-once with idempotent consumers is common. Idempotent producers and transactions enable stronger guarantees. Exactly-once has scope limits.

## Trade-offs to probe

- Acks all vs acks leader: Durability versus write latency.
- More partitions vs overhead: Parallelism versus metadata and recovery cost.
- Batching vs latency: Throughput versus delivery delay.

## Reasonable alternatives

- Partitioned replicated log: Brokers store partition logs replicated to followers; consumers pull by offset.
- Per-message broker with acknowledgements: A broker holds queues and removes messages after acknowledgement.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Claiming exactly-once across arbitrary systems without limits.
- Ignoring consumer rebalancing and duplicate handling.
- Treating the queue like a database for random access.
- Choosing too few partitions to scale later.
