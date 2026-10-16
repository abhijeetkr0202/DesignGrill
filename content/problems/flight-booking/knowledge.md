# Flight Search and Booking: interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about aggregation.
- Reasoning about caching.
- Reasoning about external-apis.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Search fan-out.** How are suppliers queried? Parallel calls with timeouts and partial results. Stream results as suppliers respond. Circuit breakers for slow suppliers.

**Fare caching.** How is cost reduced? Cache recent search results with short TTL by route and date. Precompute popular routes. Revalidate price before booking.

**Itinerary construction.** How are options combined? Combine outbound and return legs and connections. Rules for minimum connection times. Rank by price and convenience.

**Booking flow.** How is booking made reliable? Revalidate price, hold, payment, then ticket issuing. Saga with compensation for partial failure. Idempotency on supplier calls.

**Price changes.** How are changes handled? Inform the user of fare changes at booking. Price lock for a short window if supported. Avoid stale-price complaints.

## Trade-offs to probe

- Cache freshness vs supplier cost: Accuracy versus API fees.
- Waiting for all suppliers vs speed: Completeness versus latency.
- Hold and pay order: Risk of charging without a ticket versus ticketing without payment.

## Reasonable alternatives

- Aggregator with streaming results and fare cache: A search service fans out to suppliers, caches results, and streams ranked options.
- Precomputed fare index: Fares are ingested in bulk and searched locally.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Synchronously calling every supplier and waiting for all.
- Treating cached fares as bookable truth.
- No compensation if ticketing fails after payment.
- Ignoring supplier rate limits.
