# Ad Click Aggregation: interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about stream-processing.
- Reasoning about exactly-once.
- Reasoning about late-data.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Ingestion.** How are events collected? Stateless collectors write to a durable partitioned log. Partition by ad ID. Backpressure and buffering.

**Stream aggregation.** How are counts computed? Windowed aggregation in a stream processor. Handle hot ads by splitting keys and merging. State checkpointing for recovery.

**Late and duplicate events.** How is correctness ensured? Event-time windows with watermarks and allowed lateness. Deduplicate by event ID. Correct late data through reprocessing.

**Batch reconciliation.** How is billing accuracy guaranteed? Raw events retained so a batch job recomputes exact totals. Compare streaming and batch results. Lambda or Kappa style architecture.

**Serving.** How are aggregates queried? Pre-aggregated store optimised for time-range queries. Rollups for larger windows. Cache dashboard queries.

## Trade-offs to probe

- Streaming speed vs batch exactness: Near-real-time estimates versus authoritative billing.
- Allowed lateness vs result stability: More late data accepted means results change longer.
- Hot-key splitting vs complexity: Throughput for popular ads versus merge logic.

## Reasonable alternatives

- Log plus stream processor with batch backfill: Events go to a log; a stream job aggregates windows; a batch job recomputes exact totals from raw storage.
- Stream-only with replay: One streaming pipeline is the source of truth and can replay from the log.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Counting directly in a relational database row per ad.
- Ignoring duplicates and retries.
- Using processing time for windows.
- No way to recompute from raw data.
