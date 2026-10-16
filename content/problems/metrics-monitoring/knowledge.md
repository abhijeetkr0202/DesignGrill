# Metrics Monitoring and Alerting: interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about time-series.
- Reasoning about downsampling.
- Reasoning about alerting.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Collection.** How are metrics gathered? Pull scraping gives control and discovery; push suits short-lived jobs. Agents batch and buffer. Service discovery integration.

**Time-series storage.** How are points stored? Append-optimised store with delta compression and blocks by time. Series index maps labels to series IDs. Shard by series hash.

**Query engine.** How are queries executed? Fan out to shards and merge aggregates. Use rollups for long ranges. Limit expensive queries.

**Alerting.** How are alerts evaluated reliably? A dedicated evaluator reads recent data on a schedule. Deduplicate and group notifications. Alert on missing data and on the monitor itself.

**Cardinality and retention.** How is growth controlled? Limit label cardinality per metric. Downsample old data to coarser resolution. Tier cold data to cheaper storage.

## Trade-offs to probe

- Pull vs push: Control and simplicity versus handling ephemeral workloads.
- Resolution vs retention cost: Detail versus storage.
- Alert latency vs false positives: Fast detection versus noise.

## Reasonable alternatives

- Sharded TSDB with separate alert evaluators: Collectors write to sharded time-series storage; query and alerting services read from it.
- Managed SaaS ingestion: Agents ship data to a hosted backend.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Using a general relational database for time series.
- Unbounded label cardinality.
- Alerting that depends on the failing system alone.
- No downsampling for long retention.
