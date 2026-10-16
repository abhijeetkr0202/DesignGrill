# Web Crawler: interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about politeness.
- Reasoning about deduplication.
- Reasoning about frontier.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**URL frontier.** How are URLs queued and prioritised? Priority queues by importance and freshness. Per-host queues enforce politeness delay. Partition the frontier by host hash.

**Fetching.** How are pages downloaded? Distributed fetchers with DNS caching. Timeouts, retries, and backoff. Handle redirects and content types.

**Deduplication.** How are duplicates avoided? URL normalisation and a seen-URL set (Bloom filter or sharded store). Content fingerprints (hashes, simhash) detect near-duplicates. Trap detection by depth and pattern limits.

**Politeness.** How is each site protected? Honour robots.txt and crawl-delay. One connection per host at a time. Adaptive rates based on response times.

**Storage and handoff.** Where does content go? Raw pages to distributed object storage. Queue to parsing and indexing. Metadata store for crawl history.

## Trade-offs to probe

- Freshness vs politeness and cost: More frequent recrawls use more bandwidth and annoy sites.
- Bloom filter vs exact set: Memory versus false positives that skip pages.
- Breadth vs depth: Coverage versus important-site freshness.

## Reasonable alternatives

- Host-partitioned distributed crawler: Frontier and fetchers are partitioned by host; seen-set and fingerprints live in sharded stores.
- Focused crawler: A classifier scores links so only relevant pages are queued.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Hammering a single host with parallel requests.
- No URL normalisation, so duplicates multiply.
- Falling into infinite calendar or session-ID traps.
- Ignoring robots.txt.
