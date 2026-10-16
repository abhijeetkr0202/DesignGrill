# Online Auction System: interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about concurrency.
- Reasoning about real-time.
- Reasoning about timers.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Bid ordering.** How are concurrent bids ordered? Serialise bids per auction through a single partition owner. Conditional update on current price. Sequence numbers decide ties.

**Deadline handling.** How are auctions closed reliably? Timers or scheduled jobs trigger closing. A bid arriving at the boundary uses server time. Anti-sniping extensions add complexity.

**Real-time updates.** How do watchers see changes? Pub/sub with push over WebSockets or server-sent events. Fan-out per auction channel. Coalesce updates under load.

**Proxy bidding.** How are automatic bids handled? Store maximum bids server-side and increment minimally. Re-evaluate on every incoming bid. Privacy of maximums.

**Integrity.** How is fairness proven? Immutable bid log with timestamps. Detect collusion patterns. Audit trail for disputes.

## Trade-offs to probe

- Strict serialisation vs throughput: Per-auction ordering limits parallelism for hot items.
- Anti-sniping vs predictability: Fairness versus fixed end times.
- Push every update vs coalescing: Freshness versus fan-out cost.

## Reasonable alternatives

- Per-auction owner with timer service: Each auction is owned by one partition that serialises bids and schedules its own closing.
- Database with optimistic concurrency: Bids are conditional updates on the auction row.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Read-then-write bid validation that races.
- Using client time for deadlines.
- Closing auctions with a once-per-minute scan.
- No durable record of every bid.
