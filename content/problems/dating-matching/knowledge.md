# Dating App Matching (Tinder): interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about geo-search.
- Reasoning about recommendations.
- Reasoning about consistency.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Candidate generation.** How are nearby profiles found? Geospatial indexes (geohash, quadtrees, or cells) by location. Filter by preferences and exclude seen profiles. Precompute candidate queues per user.

**Swipe storage.** How are swipes recorded? Write-heavy store keyed by swiper and target. Check the reverse swipe to detect a match. Atomicity to avoid missing simultaneous swipes.

**Match detection.** How is a mutual match found reliably? On each right swipe, look up the other direction. Handle the race of both swiping simultaneously. Idempotent match creation.

**Seen-set tracking.** How are repeats avoided? Per-user seen sets can be large; use Bloom filters or time-bounded sets. Approximate filters tolerate rare repeats. Reset policies.

**Ranking and fairness.** How are candidates ordered? Activity, preferences, and mutual interest signals. Avoid concentrating attention on a few profiles. Cold-start for new users.

## Trade-offs to probe

- Precomputed vs on-demand candidates: Fast cards versus staleness of location and preferences.
- Bloom filter vs exact set: Memory savings versus occasional false positives.
- Strict match consistency vs speed: Handling races correctly adds coordination.

## Reasonable alternatives

- Geo-sharded candidate service: Users are indexed by location cells; candidate queues are precomputed and swipes stored in a key-value store.
- On-demand query with caching: Query a geospatial database per request and cache recent results.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Querying all users and filtering by distance in the database.
- Missing matches when two swipes race.
- Unbounded seen lists per user.
- Ignoring privacy of precise location.
