# Centralised Logging System: interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about ingestion.
- Reasoning about search.
- Reasoning about retention.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Shipping.** How do logs leave the hosts? Local agents buffer and ship with backpressure. Durable queue between agents and indexers. Drop policy under overload.

**Indexing and storage.** How are logs made searchable? Time-partitioned indices with inverted indexes on selected fields. Index only what is needed to save cost. Hot, warm, and cold tiers.

**Search and tail.** How are queries served? Time-bounded queries prune partitions. Live tail through a stream rather than search. Query limits and timeouts.

**Retention and cost.** How is cost controlled? TTL per index or tenant. Sampling for noisy logs. Cold storage in object stores with on-demand search.

**Security.** How is access protected? Per-tenant or per-team permissions. Redact secrets and PII at source or ingestion. Audit access.

## Trade-offs to probe

- Full-text indexing vs cost: Fast search versus storage and CPU.
- Loss tolerance vs queue size: Durability of logs under bursts.
- Sampling vs fidelity: Cost savings versus missing events.

## Reasonable alternatives

- Agent, queue, indexer, tiered storage: Agents ship to a durable queue; indexers write to time-partitioned search storage with tiering.
- Object-store-first logging: Logs are written to object storage in columnar chunks with a small index and searched on demand.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Writing logs directly to the search cluster from services.
- Indexing every field of every line.
- No retention policy.
- Logging secrets and personal data.
