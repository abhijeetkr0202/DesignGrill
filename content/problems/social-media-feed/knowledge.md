# Social Media News Feed: interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about fan-out.
- Reasoning about ranking.
- Reasoning about caching.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Fan-out strategy.** When is the feed assembled? Fan-out on write precomputes feeds and makes reads fast. Fan-out on read computes at request time and avoids write amplification. Hybrid handles celebrities on read.

**Feed storage.** Where are timelines stored? Per-user lists of post IDs in a cache or key-value store. Store IDs, hydrate content at read time. Bound the list length.

**Ranking.** How is relevance computed? Chronological is simple and predictable. Ranking uses features and a model, adding latency. Two-stage candidate generation then ranking.

**Graph storage.** How are follow relationships stored? Adjacency lists sharded by user. Both follower and followee lookups are needed. Counts may be approximate.

**Media and counts.** How are media and counters handled? Media in object storage behind a CDN. Like counters are write-hot; aggregate asynchronously. Eventual consistency for counts.

## Trade-offs to probe

- Write vs read amplification: Precomputing speeds reads but costs writes for popular authors.
- Freshness vs cost: Instant delivery versus batching.
- Ranking quality vs latency: Better relevance needs more computation.

## Reasonable alternatives

- Hybrid fan-out: Fan out to followers on write for normal accounts and merge celebrity posts at read time.
- Pull-based feed with caching: Fetch recent posts from followees at read time and cache the result.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Fan-out on write for celebrities with millions of followers.
- Computing every feed from scratch at read time with no caching.
- Storing full post bodies in every timeline.
- Ignoring deleted posts and blocked users in cached feeds.
