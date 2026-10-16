# Notification system: interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements.

## What the problem is really testing

- Asynchronous design: decoupling producers from delivery with durable queues.
- Honest treatment of delivery guarantees across external systems.
- Handling third-party failure and rate limits without cascading overload.
- Isolation of priorities and tenants.

## Core design tensions

**Acknowledgement semantics.** The ingestion API should acknowledge after the request is durably recorded, not after delivery. Producers need idempotency keys so retries do not create duplicates.

**Delivery guarantees.** Providers rarely offer true exactly-once semantics. A practical design is at-least-once with deduplication keyed by a notification ID, plus provider-side idempotency where available. Candidates should state the residual duplicate risk, for example when a request times out but the provider processed it.

**Queues and partitioning.** Separate by channel and priority. Partitioning by user keeps per-user order but risks hot partitions; random partitioning balances load but loses order. Ask whether order matters before choosing.

**Preferences.** Evaluate at send time. Cache with a bounded staleness and state it. Hard opt-outs should be authoritative.

**Backpressure.** Provider limits are the real throughput ceiling. The design should apply per-provider rate limiting and let queues absorb bursts, with visibility into lag and a policy for stale messages.

**Failure handling.** Backoff with jitter, bounded attempts, retryable versus permanent errors, circuit breakers, dead-letter storage with replay.

**Scheduling.** Delay queues or time-bucketed storage with a scheduler; account for time zones and quiet hours.

## Reasonable alternatives

See `reference-architectures.json`. Queue-centric, workflow-engine, and fan-out designs can all be valid depending on volume and complexity.

## Signs of strong answers

- Separates transactional and bulk paths.
- Explains where duplicates can still occur and how they are mitigated.
- Quantifies burst capacity against provider limits.
- Includes observability: lag, failure rate per provider, dead-letter volume.

## Signs of weak answers

- Synchronous provider calls inside the producer's request.
- One shared queue for everything.
- Claims of exactly-once without mechanism.
- No plan for provider outage or throttling.
