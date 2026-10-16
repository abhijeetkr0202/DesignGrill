# Digital Wallet: interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about ledger.
- Reasoning about transactions.
- Reasoning about sharding.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Data model.** How is money represented? Immutable ledger entries with derived balances. Integer minor units to avoid rounding. Per-wallet sequence numbers.

**Transfer atomicity.** How are cross-wallet transfers atomic? Same-shard transfers use a database transaction. Cross-shard transfers use two-phase commit or a saga with holds. Idempotency keys.

**Sharding.** How is data partitioned? Shard by wallet ID. Hot wallets such as merchants need special handling. Rebalancing.

**Fraud and limits.** How are risky transfers detected? Rule and model checks on the critical path with latency budget. Holds on suspicious transactions. Velocity limits.

**History and reporting.** How is history served? Read model derived from the ledger. Pagination by time. Statements and exports.

## Trade-offs to probe

- 2PC vs saga: Strictness versus availability and complexity.
- Synchronous fraud checks vs speed: Safety versus latency.
- Single shard simplicity vs scale: Capacity versus operational simplicity.

## Reasonable alternatives

- Sharded ledger with sagas: Wallets are sharded; same-shard transfers are transactions and cross-shard ones use a saga with holds.
- Single strongly consistent database: One distributed SQL database provides cross-row transactions.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Updating two balances in separate non-atomic calls.
- Floating-point money.
- Hot merchant wallets on one row.
- Computing balances by scanning all history on every read.
