# Search Autocomplete (Typeahead): interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about trie.
- Reasoning about low-latency.
- Reasoning about ranking.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Data structure.** How are prefixes mapped to suggestions? A trie with top-k stored at each node makes lookup constant per prefix. Or precompute prefix to top-k in a key-value store. Memory pruning of rare queries.

**Offline build.** How is the index built? Aggregate query logs into frequencies on a schedule. Build and swap new index versions atomically. Decay old popularity.

**Freshness.** How are trending queries reflected? Stream processing adds a small real-time layer. Merge with the offline index at serve time. Guard against manipulation.

**Serving.** How is latency kept low? Cache popular prefixes at the edge and in memory. Clients debounce and cache locally. Shard the index by prefix range.

**Quality and safety.** How are bad suggestions removed? Blocklists and classifiers in the build pipeline. Manual overrides and takedowns. Handling of rare but sensitive queries.

## Trade-offs to probe

- Freshness vs complexity: Real-time trends need a second pipeline.
- Memory vs coverage: More queries indexed versus cost.
- Personalisation vs cacheability: Relevance versus shared caches.

## Reasonable alternatives

- Precomputed prefix store with edge cache: Offline jobs write prefix to top-k mappings to a key-value store; CDN and memory caches serve them.
- In-memory trie service: Each server holds a trie with top-k per node, rebuilt periodically.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Querying a database with LIKE on every keystroke.
- Storing full query lists at every trie node.
- No client-side debouncing or caching.
- Ignoring offensive suggestions.
