# Ticket Booking (Ticketmaster): interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about seat-reservation.
- Reasoning about contention.
- Reasoning about queues.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Waiting room.** How is the surge controlled? Virtual queue admits users in batches. Static assets from CDN. Per-user admission tokens.

**Seat holds.** How are seats locked during checkout? Atomic conditional update from available to held with an expiry. Row-level locking at the seat is fine because contention is per seat. Expire holds with timers or lazy expiry on read.

**Inventory model.** How is availability stored and read? Seat state in a transactional store, cached views for map display. Cached maps may be slightly stale; final check on hold. Partition by event.

**Checkout and payment.** How is the purchase completed? Payment with idempotency while the hold is valid. Extend hold during payment processing. Compensate on failure.

**Bot defence.** How are bots limited? Verified accounts and CAPTCHA. Per-account purchase limits. Anomaly detection on queue behaviour.

## Trade-offs to probe

- Fresh seat map vs load: Accurate availability versus cost of serving it.
- Hold time length: Fewer abandoned seats versus buyer stress.
- Strict fairness vs throughput: Queue order versus user experience.

## Reasonable alternatives

- Waiting room plus transactional seat inventory: A queue admits users; seat holds are conditional updates in a per-event database; payments follow.
- In-memory seat service per event: Each event has an in-memory owner that serialises seat operations and persists asynchronously.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- No queue, letting the database absorb all arrivals.
- Check-then-update seat selection that races.
- Showing seat availability from a stale cache as final truth.
- Holds that never expire.
