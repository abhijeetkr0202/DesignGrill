# Collaborative Document Editor (Google Docs): interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about ot-crdt.
- Reasoning about real-time.
- Reasoning about conflict-resolution.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Concurrency control.** How are concurrent edits merged? Operational Transformation with a central server ordering operations. CRDTs allow merging without central ordering at metadata cost. Both converge but differ in complexity and overhead.

**Session routing.** How are collaborators connected? All editors of a document connect to the same server instance or shard. Route by document ID with consistent hashing. Failover and reconnection with state catch-up.

**Persistence.** How is the document stored? Append operation log and periodic snapshots. Rebuild state from the latest snapshot plus recent operations. Version history from the log.

**Presence and cursors.** How are cursors shared? Lightweight ephemeral messages not stored durably. Throttle updates. Scoped to the document session.

**Offline and reconnect.** How is offline editing merged? Queue local operations and rebase on reconnect. CRDTs make offline merges natural. Conflict-friendly UX.

## Trade-offs to probe

- OT vs CRDT: Central server simplicity versus decentralised flexibility and memory overhead.
- Snapshot frequency: Faster loads versus storage and compute.
- Co-locating editors on one server: Simple ordering versus hot document limits.

## Reasonable alternatives

- OT with per-document server: A server instance per active document orders and transforms operations and fans out updates.
- CRDT-based sync: Clients exchange CRDT updates through a relay that stores and forwards them.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Last-write-wins for the whole document.
- Locking the document or paragraphs for one editor.
- Persisting every keystroke as a separate database write.
- No plan for server failure mid-session.
