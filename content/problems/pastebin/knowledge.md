# Pastebin: interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about object-storage.
- Reasoning about expiration.
- Reasoning about read-heavy.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Content storage.** Where does paste text live? Object storage is cheap and scales; a database row is simpler for small text. Metadata (owner, expiry, visibility) belongs in a database. Large pastes may need streaming reads.

**Link generation.** How are unique, unguessable links produced? Random codes with a uniqueness check versus a pre-allocated key pool. Private pastes need higher entropy. Collision handling under concurrency.

**Expiration.** How are expired pastes removed? Check expiry on read so correctness never depends on cleanup. Background sweeps reclaim storage. Time-bucketed storage makes bulk deletion cheap.

**Caching and CDN.** How are popular pastes served cheaply? Pastes are immutable, so they cache well. Invalidation on deletion or moderation takedowns. Edge caching versus control of private content.

**Abuse prevention.** How is misuse limited? Per-IP and per-account rate limits. Content scanning and reporting workflow. Size limits and quotas.

## Trade-offs to probe

- Database vs object storage for content: Simplicity versus cost and scalability at larger sizes.
- Long cache TTL vs fast takedown: Hit rate versus how quickly removed content disappears.
- Sequential vs random IDs: Compact and easy versus guessable.

## Reasonable alternatives

- Metadata database plus object store: API servers write metadata to a database and content to object storage; reads go through a CDN.
- Single key-value store: Small pastes live directly in a key-value store keyed by paste code with a TTL.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Storing large text in a hot relational table without considering size.
- Relying on a cleanup job for correctness of expiry.
- Ignoring unguessable links for private pastes.
- No abuse or size controls.
