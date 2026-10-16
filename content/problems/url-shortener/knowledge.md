# URL shortener: interviewer knowledge notes

These notes are original summaries for interviewers. They describe design considerations and are not a single mandatory solution. Judge a candidate's design against the requirements they established.

## What the problem is really testing

- Whether the candidate clarifies scope before designing.
- Whether they recognise a strongly read-heavy workload and shape the design around it.
- Whether they can reason about unique ID generation under concurrency.
- Whether they treat caching as a design problem (invalidation, hot keys, failure) rather than a checkbox.

## Core design tensions

**Code generation.** Options include hashing the URL and handling collisions, encoding a monotonically increasing counter, drawing random codes and checking uniqueness, or pre-generating a pool. Counters need coordination but never collide; hashes and random codes need collision handling and a uniqueness constraint in storage. Sequential codes are guessable; if links are private by obscurity that is a security concern, otherwise it may be acceptable.

**Storage.** Lookup is by key. A relational database is adequate at moderate scale with replicas and a cache. A partitioned key-value store removes the single-writer ceiling but complicates secondary queries. The right answer depends on the estimated scale and team constraints.

**Redirect path.** This is latency-sensitive and availability-sensitive. Keep it short: look up, redirect. Anything that can fail (analytics, abuse checks) should not block it, or should degrade gracefully.

**Caching.** Cache-aside is common. Discuss TTLs, eviction, negative caching, request coalescing for hot keys, and what happens when the cache is empty or unavailable. Deletion and expiry require an invalidation story, and any CDN or browser caching extends the time a deleted link may remain reachable.

**Redirect status.** Permanent redirects reduce load but clients may cache them indefinitely, which weakens analytics and deletion. Temporary redirects preserve control at the cost of more requests.

**Analytics.** Prefer asynchronous event capture. Discuss approximate versus exact counting, duplicates, and retention.

**Expiry and deletion.** Check expiry on read so correctness does not depend on cleanup jobs; use background cleanup for storage reclamation. Be careful about reusing freed codes.

## Reasonable alternatives

Several architectures are valid; see `reference-architectures.json`. A candidate who chooses a different structure is not wrong if the choice satisfies their stated requirements and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies read and write rates and storage growth.
- Identifies hot keys and cache failure as first-class risks.
- Separates the redirect path from creation and analytics.
- Explains how uniqueness is guaranteed, not just how codes look.

## Signs of weak answers

- Starts drawing before asking questions.
- Adds many components with no stated reason.
- Cannot say what happens when the cache or the ID generator fails.
- Treats every non-functional requirement as "high" without numbers or trade-offs.
