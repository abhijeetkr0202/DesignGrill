# Proximity Service (Yelp / Nearby Places): interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about geohash.
- Reasoning about quadtree.
- Reasoning about read-heavy.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Spatial index.** How are nearby businesses found? Geohash prefixes, quadtrees, S2, or H3 cells. Query the target cell and its neighbours. Adaptive cell sizes for dense areas.

**Storage and sharding.** How is the index partitioned? Shard by geographic region or cell prefix. Dense areas need further splits. Replicate for read throughput.

**Query pipeline.** How are results filtered and ranked? Retrieve candidates from cells, then filter by category and rating. Rank by distance and quality. Cache popular area queries.

**Updates.** How do changes reach the index? Source of truth in a database; index rebuilt incrementally. Rare writes allow simple propagation. Eventual consistency is fine.

**Caching.** How is repeated demand handled? Cache by cell and filter combination. CDN for business detail pages. Short TTLs for popular areas.

## Trade-offs to probe

- Geohash vs quadtree: Simplicity and range queries versus adaptive density.
- Cell size: More precision versus more cells to read.
- Index freshness vs cost: Real-time updates unnecessary for slow-changing data.

## Reasonable alternatives

- Geo-cell index service: A read-optimised index keyed by cell serves candidate lookups, fed by the business database.
- Database with spatial extension: A relational database with a spatial index answers queries directly.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Computing distance to every business.
- Using only latitude and longitude B-tree indexes.
- Ignoring the edge of a cell where neighbours matter.
- Treating dense and sparse regions the same.
