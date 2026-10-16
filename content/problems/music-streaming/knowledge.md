# Music Streaming (Spotify): interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about catalogue.
- Reasoning about offline-sync.
- Reasoning about recommendations.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Audio delivery.** How is audio served? Chunked streaming from object storage via CDN with prefetch of the next track. Multiple bitrates for network conditions. Popular tracks cache well; the tail goes to origin.

**Catalogue and search.** How are metadata and search stored? Metadata database plus a search index with typo tolerance. Rights metadata by region. Index update flow from content ingestion.

**Playlists and sync.** How are playlists stored and synced? Per-user data with versioning for conflict handling. Collaborative playlists need merge semantics. Cache on devices with sync deltas.

**Play accounting.** How are plays counted? Client events into a durable log, then aggregated. Deduplicate and validate for royalties. Near-real-time for display; exact batch for payouts.

**Recommendations.** How are suggestions produced? Offline batch models plus real-time signals. Precompute daily lists per user. Cold start for new users and tracks.

## Trade-offs to probe

- Prefetching vs bandwidth waste: Seamless playback versus unplayed downloads.
- Exact vs approximate play counts: Royalty accuracy versus real-time cost.
- Offline downloads vs rights control: User experience versus license enforcement.

## Reasonable alternatives

- CDN streaming with event-log analytics: Chunked audio from CDN; play events stream into a log for aggregation and royalties.
- Peer-assisted delivery: Clients share cached chunks with nearby peers to reduce server load.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Streaming the whole file before playing.
- Counting plays synchronously in the playback path.
- One global playlist table without sharding.
- Ignoring regional licensing restrictions.
