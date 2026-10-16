# Flash Sale System: interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about inventory.
- Reasoning about contention.
- Reasoning about load-shedding.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Traffic shaping.** How is the initial surge absorbed? Static pages and the countdown served from CDN. Virtual waiting room or queue admits users at a controlled rate. Reject excess requests early and cheaply.

**Inventory control.** How is stock decremented safely? A single-writer counter in memory (for example Redis) with atomic decrement. Database row locks do not scale for one hot key. Split stock into buckets to spread contention.

**Reservation and order.** How are reservations created and confirmed? Reserve stock, then create an order asynchronously through a queue. Expire unpaid reservations. Idempotent order creation.

**Consistency with the source of truth.** How does the fast path stay correct? Reconcile in-memory counts with the database. Recover counters after failure. Audit sold quantity against stock.

**Bot defence.** How is fairness enforced? Per-user limits and CAPTCHA or proof of work. Account and payment verification. Randomised admission from the waiting room.

## Trade-offs to probe

- Fairness vs simplicity: Queues and lotteries are fairer but add machinery.
- Speed vs strict consistency: In-memory counters are fast but need reconciliation.
- Rejecting early vs serving all: Protecting the system versus user frustration.

## Reasonable alternatives

- Waiting room plus in-memory inventory: A queue admits users; an atomic in-memory counter reserves stock; orders are created asynchronously.
- Pre-allocated stock tokens: Stock is turned into tokens in a queue; buyers claim tokens.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Row-level locking on a single hot inventory row.
- No waiting room so the database falls over at T+0.
- Letting reservations hold stock forever.
- Ignoring bots.
