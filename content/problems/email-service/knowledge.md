# Email Service (Gmail): interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about storage.
- Reasoning about search.
- Reasoning about protocols.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Inbound pipeline.** How is incoming mail processed? SMTP front ends accept and queue mail. Authentication checks (SPF, DKIM, DMARC) and spam filtering before delivery. Retries for temporary failures.

**Mailbox storage.** How are mailboxes stored? Partition by user so a mailbox lives on one shard with replicas. Large attachments in object storage. Metadata store separate from bodies.

**Search.** How is search provided? Per-user inverted index updated on delivery. Index size versus coverage. Freshness lag of indexing.

**Spam and abuse.** How is spam controlled? Reputation, content models, and user feedback loops. Quarantine versus reject decisions. False positives are costly.

**Outbound sending.** How is deliverability managed? Queues with retry and backoff. IP reputation and rate limits. Bounce handling.

## Trade-offs to probe

- Aggressive filtering vs false positives: Blocking spam versus losing legitimate mail.
- Index everything vs cost: Search coverage versus storage and compute.
- Replication vs cost: Durability versus storage expense.

## Reasonable alternatives

- Sharded mailbox service with async pipeline: SMTP edge, filter pipeline, and user-sharded mailbox storage with per-user search indexes.
- Cloud-native object-based store: Messages as objects in blob storage with a metadata database and search service.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Treating mail delivery as a single synchronous request.
- Ignoring sender authentication.
- One global index across all users.
- No retry and queue strategy for temporary remote failures.
