# Stock Exchange Order Matching: interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about low-latency.
- Reasoning about determinism.
- Reasoning about event-sourcing.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Matching engine.** How is matching done? Single-threaded, in-memory order book per symbol for determinism. Price-time priority data structures. Avoid locks and garbage collection pauses.

**Sequencing and event log.** How is order maintained? A sequencer assigns a global order to inbound messages. Append-only event log enables replay. State is the result of replaying the log.

**Replication and recovery.** How does it survive failures? Hot standby consumes the same event stream. Fail over by promoting the replica. Snapshots speed recovery.

**Risk and gateways.** How are orders validated? Pre-trade risk checks at gateways. Authentication and rate limits. Fat-finger protections.

**Market data.** How are results published? Multicast or efficient fan-out of trades and book updates. Snapshots and incremental feeds. Fairness in delivery.

## Trade-offs to probe

- Single-threaded determinism vs parallelism: Correctness and speed per symbol versus total throughput.
- Synchronous replication vs latency: Zero data loss versus added delay.
- Rich risk checks vs speed: Safety versus latency.

## Reasonable alternatives

- Sequenced event-sourced engine with hot standby: Gateways feed a sequencer; engines consume the ordered log; a standby replays the same stream.
- Partitioned engines by symbol: Symbols are assigned to independent engine instances.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Using a general-purpose database in the matching path.
- Multi-threaded matching with locks causing non-determinism.
- No event log, making replay and audit impossible.
- Ignoring fairness of message ordering.
