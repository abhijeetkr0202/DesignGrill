# Distributed Job Scheduler: interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about scheduling.
- Reasoning about idempotency.
- Reasoning about leader-election.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Job storage.** How are jobs stored and found when due? Index by next run time in a partitioned store. Scan windows of upcoming jobs rather than everything. Delay queues versus polling.

**Triggering.** Who fires jobs? Scheduler nodes own partitions of the job space. Leader election or lease-based ownership avoids duplicates. Failover must pick up missed triggers.

**Execution.** How do workers run jobs? Hand off through a queue to a worker pool. Visibility timeouts and heartbeats detect dead workers. Resource isolation per tenant.

**Exactly-once illusion.** How are duplicates handled? At-least-once execution with idempotency keys. Fencing tokens prevent stale workers. Overlap policy for recurring jobs.

**Spikes.** How are top-of-hour spikes handled? Jitter spreads load. Priority queues and backpressure. Autoscaling workers.

## Trade-offs to probe

- Precision vs cost: Fine-grained polling raises load for tighter timing.
- At-least-once vs at-most-once: Risk of duplicates versus risk of missed runs.
- Central vs partitioned scheduler: Simplicity versus scalability.

## Reasonable alternatives

- Partitioned scheduler with queue: Scheduler shards own job partitions and enqueue due jobs for a worker pool.
- Workflow engine: A durable workflow engine runs timers and activities with persisted state.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Scanning the whole job table every second.
- Assuming a job runs exactly once.
- A single scheduler instance with no failover.
- Ignoring spikes at round times.
