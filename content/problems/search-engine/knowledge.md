# Web Search Engine: interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about inverted-index.
- Reasoning about ranking.
- Reasoning about sharding.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Index structure.** How is the index organised? Inverted index with compressed posting lists. Partition by document (each shard holds a subset) for parallel queries. Tiered indexes: fresh, high-quality, long tail.

**Query execution.** How are queries answered? Broadcast to shards, each returns top results, then merge. Early termination and caching of popular queries. Replicas for throughput and tail latency.

**Ranking.** How are results ranked? First-pass scoring (BM25) then machine-learned reranking of top candidates. Link analysis and quality signals. Personalisation and freshness boosts.

**Indexing pipeline.** How are documents processed? Parse, tokenise, dedupe, and score documents offline in batches. Incremental updates for fresh content. Merge segments in the background.

**Resilience.** How does it handle failures? Replicas and tolerant merging with partial results. Graceful degradation by skipping slow shards. Canary rollouts of new index versions.

## Trade-offs to probe

- Document vs term partitioning: Parallelism and simplicity versus per-term locality.
- Freshness vs index stability: Frequent updates cost more merges.
- Ranking depth vs latency: More reranking improves quality but adds time.

## Reasonable alternatives

- Document-sharded tiered index: Shards hold subsets of documents with replicas; aggregators merge results; rerankers refine.
- Term-partitioned index: Posting lists are partitioned by term; a query contacts only shards for its terms.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Using a general-purpose database for text search.
- Querying every shard with no caching or early termination.
- No tiering, so the long tail dominates cost.
- Ignoring tail latency from slow shards.
