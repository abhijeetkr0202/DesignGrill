# Payment System: interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about idempotency.
- Reasoning about ledger.
- Reasoning about reconciliation.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Idempotency.** How are duplicates prevented? Client-supplied idempotency keys stored with results. Provider idempotency where supported. Handling a timeout whose outcome is unknown.

**Payment state machine.** How is progress tracked? Explicit states persisted before and after each provider call. Asynchronous webhooks update state. Recovery jobs resolve stuck payments.

**Ledger.** How are money movements recorded? Double-entry bookkeeping in an append-only ledger. Balances derived from entries. Strong consistency within an account.

**Provider integration.** How are external providers used? Adapters per provider with circuit breakers. Failover routing and cost-based selection. Timeouts and uncertain outcomes.

**Reconciliation.** How is correctness verified? Compare internal records with provider reports daily. Investigate mismatches. Automated corrections with audit trail.

## Trade-offs to probe

- Synchronous vs asynchronous confirmation: Simple UX versus resilience to slow providers.
- Strong consistency vs availability: Money requires correctness; some operations may be delayed.
- Failover between providers: Availability versus duplicate-charge risk.

## Reasonable alternatives

- Orchestrated payment service with ledger: A payment orchestrator persists state, calls provider adapters, and writes ledger entries transactionally.
- Event-sourced payments: Every payment change is an event; state and ledger are projections.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Retrying a provider call without idempotency.
- Storing only balances and no ledger.
- Assuming a timeout means failure.
- No reconciliation process.
