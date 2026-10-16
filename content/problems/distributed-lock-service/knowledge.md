# Distributed Lock Service: interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about consensus.
- Reasoning about leases.
- Reasoning about fencing.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Consensus core.** How does the service stay consistent? A replicated state machine using Raft or Paxos. Quorum of nodes decides every lock grant. Leader handles writes.

**Leases.** How are crashed holders handled? Locks carry time-limited leases renewed by heartbeats. Clock drift assumptions. Session-based locks tied to client liveness.

**Fencing.** How is a paused client prevented from corrupting data? A monotonically increasing token accompanies each grant. Protected resources reject stale tokens. Leases alone are not sufficient.

**Client behaviour.** How do clients wait and retry? Watches avoid polling. Fair queueing versus random retry. Backoff to prevent herd effects.

**Scaling.** How does it scale beyond one consensus group? Shard locks across groups by name. Read scaling with followers for watches. Multi-region coordination cost.

## Trade-offs to probe

- Strong safety vs availability: During partitions the minority cannot grant locks.
- Short vs long leases: Fast failover versus renewal load and false expiry.
- Single group vs sharded: Simplicity versus capacity.

## Reasonable alternatives

- Consensus-backed lock service: A small replicated cluster stores lock state and grants leases with fencing tokens.
- Lock via database or cache: Locks implemented with conditional writes in an existing store.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Using a single-node store as the lock authority.
- Assuming lease expiry alone makes locks safe.
- Ignoring client pauses such as garbage collection.
- Using wall-clock time comparisons across machines.
