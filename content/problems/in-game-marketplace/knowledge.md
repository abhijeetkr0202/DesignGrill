# In-Game Item Marketplace: interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about transactions.
- Reasoning about inventory.
- Reasoning about fraud.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Atomic purchase.** How is a sale made safe? A single transaction moves item and currency, or a saga with compensation across services. Idempotency keys for retries. Prevent double-spend with conditional updates.

**Listing storage and search.** How are listings found? Search index for filters (type, rarity, price). Database as the source of truth. Index lag versus accuracy of availability.

**Inventory ownership.** How is item ownership tracked? Items are unique records with an owner; transfers are logged. Locking an item while listed. Audit trail of every change.

**Pricing and fees.** How are prices and fees handled? Fees and taxes as a sink in the economy. Price history for guidance. Limits to deter manipulation.

**Fraud controls.** How is abuse limited? Rate limits and anomaly detection. Holds on suspicious trades. Account trust levels.

## Trade-offs to probe

- Single transaction vs saga: Simplicity versus independent services.
- Search freshness vs cost: Accurate availability versus indexing load.
- Fraud holds vs friction: Protection versus player experience.

## Reasonable alternatives

- Transactional marketplace service: A service with its own database performs atomic purchases and publishes events to the search index.
- Saga across wallet and inventory services: Purchase coordinates separate services with compensating actions.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Check-then-update purchases that allow double sale.
- Trusting the search index as the source of truth.
- No audit log of item movement.
- Allowing item duplication through retries.
