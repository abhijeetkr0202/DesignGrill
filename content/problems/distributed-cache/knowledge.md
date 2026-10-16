# Distributed Cache: interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about caching.
- Reasoning about eviction.
- Reasoning about consistency.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Sharding.** How are keys distributed? Consistent hashing limits remapping when nodes change. Client-side versus proxy routing. Hot key mitigation by replication or local caching.

**Eviction.** Which entries are removed first? LRU, LFU, or TTL-based policies fit different workloads. Memory accounting and fragmentation. Admission control for one-hit wonders.

**Cache pattern.** How do applications populate and update the cache? Cache-aside is common and simple. Write-through and write-behind trade consistency and latency. Request coalescing prevents stampedes.

**Replication and failure.** What happens when a node fails? Replicas allow failover but cost memory. Without replicas, misses spike on the database. Gradual warm-up and rate limiting.

**Invalidation.** How is stale data removed? TTLs bound staleness. Explicit invalidation on writes can race with reads. Versioned keys avoid some races.

## Trade-offs to probe

- Replication vs memory cost: Resilience of the hot set versus the capacity it consumes.
- Short vs long TTL: Freshness versus hit rate.
- Client-side vs proxy routing: Latency versus operational control.

## Reasonable alternatives

- Sharded cluster with client-side routing: Clients use consistent hashing to route to cache nodes directly.
- Proxy tier in front of the cache: A proxy layer routes requests, pools connections, and handles failover.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Treating the cache as the source of truth.
- Ignoring cache stampedes on popular key expiry.
- Modulo hashing that remaps most keys on resize.
- No plan for a node loss spiking database load.
