# E-commerce Product Search: interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about inverted-index.
- Reasoning about ranking.
- Reasoning about facets.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Index design.** How is the index built and sharded? Inverted index sharded by product with replicas for throughput. Scatter-gather query to all shards. Facet counts add cost.

**Ingestion.** How do catalogue changes reach the index? Change events from the catalogue database stream to indexers. Partial updates for price and stock. Backfill and reindex strategy.

**Ranking.** How are results ordered? Text relevance combined with popularity, conversion, and availability. Learning-to-rank in a second stage. Boost in-stock items.

**Freshness of volatile data.** How are price and stock kept current? Store volatile fields outside the main index and join at query time. Frequent partial updates. Verify at checkout regardless.

**Query understanding.** How are queries interpreted? Tokenisation, spelling correction, synonyms, and category prediction. Typeahead suggestions. Handling zero-result queries.

## Trade-offs to probe

- Index freshness vs indexing load: Real-time updates cost more.
- Scatter-gather latency vs shard count: More shards parallelise but add tail latency.
- Rich ranking vs latency: Better relevance needs more computation.

## Reasonable alternatives

- Search cluster fed by a change stream: Catalogue changes flow via a log into a sharded search cluster; a ranking service reorders results.
- Managed search with batch indexing: A hosted search product receives periodic bulk updates.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Using database LIKE queries.
- Rebuilding the whole index for small changes.
- Trusting search results for price at checkout.
- No plan for zero-result queries.
