# Content Delivery Network: interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about edge-caching.
- Reasoning about routing.
- Reasoning about invalidation.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Request routing.** How are users sent to an edge? DNS-based routing using geography and latency measurements. Anycast routes by network proximity. Health checks and load awareness.

**Cache hierarchy.** How are misses handled? Edge, regional, and origin shield tiers collapse misses. Request coalescing for the same object. Reduce origin load.

**Cache policy.** What is cached and for how long? Honour cache-control headers with overrides. Eviction by LRU variants with size awareness. Negative caching of errors.

**Invalidation.** How are updates propagated? Purge by URL, tag, or prefix through a control plane message bus. Versioned URLs avoid purges. Soft purge and stale-while-revalidate.

**Protection.** How is the network protected? Absorb volumetric attacks across many locations. Rate limits and web application firewall rules. Automated certificate provisioning.

## Trade-offs to probe

- More cache tiers vs latency: Origin offload versus extra hops.
- Long TTL vs freshness: Hit ratio versus staleness.
- Anycast vs DNS routing: Simplicity and failover versus finer control.

## Reasonable alternatives

- Tiered edge with origin shield: Edges forward misses to regional caches and a shield before the origin; a control plane distributes config and purges.
- Peering-based deployment inside ISPs: Cache appliances sit inside ISP networks for popular content.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Every edge fetching from origin independently on a miss.
- Relying only on purges instead of versioned URLs.
- Ignoring cache key design (query strings, headers).
- No plan for origin failure.
