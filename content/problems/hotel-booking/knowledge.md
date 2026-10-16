# Hotel Booking (Airbnb / Booking.com): interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about availability-calendar.
- Reasoning about double-booking.
- Reasoning about search.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Search and availability.** How does search stay fast with date filters? Search index holds listings and approximate availability. Exact availability verified at booking. Geo plus date filtering.

**Availability storage.** How is the calendar stored? Per-listing per-night rows or ranges. Partition by listing. Block dates atomically.

**Booking transaction.** How is double booking prevented? Transactional check-and-reserve on the listing calendar. Hold, pay, then confirm. Idempotent booking requests.

**External inventory sync.** How is outside inventory kept current? Webhooks and polling from channel managers. Rate limits and eventual consistency. Conflict handling on overbooking.

**Pricing.** How are prices determined? Base price plus rules by date and demand. Cache prices with expiry. Quote guarantees for a short time.

## Trade-offs to probe

- Search freshness vs cost: Exact availability in search is expensive; approximate is cheap but may mislead.
- Instant booking vs host approval: Convenience versus host control.
- Overbooking policy: Occupancy versus guest trust.

## Reasonable alternatives

- Search index plus per-listing transactional calendar: Search serves candidates; booking verifies the authoritative calendar transactionally.
- Event-driven availability: Calendar changes publish events that update search and caches.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Searching by scanning the booking table.
- Check-then-insert booking race conditions.
- Treating search results as guaranteed availability.
- Ignoring time zones for check-in dates.
