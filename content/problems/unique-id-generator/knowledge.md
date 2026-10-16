# Unique ID Generator: interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about distributed-systems.
- Reasoning about ordering.
- Reasoning about time.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Scheme.** How is an ID composed? Timestamp plus machine ID plus sequence (snowflake style). Database auto-increment is simple but is a bottleneck. UUIDs are unique but large and not ordered.

**Node identity.** How do nodes get unique machine IDs? Coordinated assignment through a registry. Reuse after failure must not create duplicates. Bit budget limits the node count.

**Clock handling.** How are clock problems handled? Clock moving backwards can duplicate IDs. Wait, refuse, or use a logical component. Time synchronisation and monitoring.

**Sequence overflow.** What if a node exceeds its per-millisecond sequence? Block until the next tick. Borrow bits from other fields. Backpressure to callers.

**Deployment shape.** Is generation embedded or a service? Library embedded in each service avoids a network hop. A central service simplifies coordination. Failure isolation.

## Trade-offs to probe

- Ordering vs coordination: Strict ordering needs a central sequencer; rough ordering needs none.
- Embedded vs service: Latency and availability versus central control.
- Time-based vs random: Sortability and compactness versus unpredictability.

## Reasonable alternatives

- Snowflake-style embedded generator: Each node composes timestamp, node ID, and a local sequence.
- Range allocation service: A service hands out blocks of sequential IDs that nodes consume locally.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Assuming clocks never go backwards.
- Using a single database sequence as the global generator.
- Ignoring reuse of machine IDs after restarts.
- Not accounting for the bit budget.
