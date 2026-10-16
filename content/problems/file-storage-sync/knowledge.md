# File Storage and Sync (Dropbox): interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about chunking.
- Reasoning about deduplication.
- Reasoning about sync.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Chunking.** How are files split? Split into fixed or content-defined blocks and hash each. Upload only blocks that changed or are missing. Content-defined chunking handles inserts well.

**Metadata service.** How is the file tree tracked? Metadata database with file to block-list mappings, sharded by user. Block storage separate from metadata. Strong consistency for metadata per user.

**Sync protocol.** How do devices learn about changes? Long polling or push notifications of change events. Client keeps a cursor into the change log. Delta sync downloads only new blocks.

**Conflict handling.** What if two devices edit the same file? Version vectors or revision IDs detect conflicts. Create conflicted copies instead of overwriting. Last-writer rules for simple cases.

**Storage and durability.** How are blocks stored? Content-addressed blocks in replicated object storage. Deduplicate by hash across users carefully. Cold tiering of old versions.

## Trade-offs to probe

- Dedup across users vs privacy: Storage savings versus side-channel risks and encryption.
- Block size: Small blocks save transfer but increase metadata.
- Immediate sync vs batching: Freshness versus load.

## Reasonable alternatives

- Block-based sync with metadata service: Clients chunk and hash files; a metadata service tracks block lists; blocks live in object storage.
- Whole-file versions: Each save uploads a complete file version.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Re-uploading whole files for small edits.
- Mixing metadata and bulk data in one store.
- Overwriting on conflict.
- Polling the server constantly from every client.
