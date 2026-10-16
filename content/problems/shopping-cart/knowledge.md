# Shopping cart: interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements.

## What the problem is really testing

- Defining a clear service boundary between cart, catalog, pricing, inventory, and checkout.
- Reasoning about consistency for a small, frequently edited, user-owned document.
- Handling identity transitions (anonymous to signed in) and multiple devices.
- Graceful degradation when dependencies fail.

## Core design tensions

**Boundary.** The cart should mostly store identifiers and quantities, not authoritative product data. Names, prices, and availability are resolved from other services and cached with bounded staleness. Prices become binding only at checkout.

**Concurrency.** Edits from several devices can conflict. Options: last-write-wins on the whole cart, optimistic concurrency with a version, or operation-based updates (increment, remove) that merge more naturally. Retrying clients require idempotent operations.

**Identity.** Anonymous carts are keyed by a token. On sign-in, a merge policy is needed. Candidates should consider token expiry, privacy, and abuse.

**Inventory.** Reserving stock at add time avoids failed checkouts but locks inventory for abandoned carts, which requires expiry. Many designs only check availability at checkout and show soft hints in the cart.

**Caching.** Reading carts is more frequent than writing them. A cache needs an invalidation story, particularly with multiple devices and regions. Checkout should validate against the source of truth.

**Checkout handoff.** Freezing a snapshot clarifies what is being purchased. Idempotency keys prevent duplicate orders. The failure policy (restore editable cart, keep reservation briefly, release) should be explicit.

## Reasonable alternatives

See `reference-architectures.json`. Document stores, relational schemas, and event-sourced designs can all be justified depending on requirements.

## Signs of strong answers

- Separates stored cart data from live product data.
- Explains conflict handling concretely.
- Keeps the cart usable when pricing or catalog is degraded.
- Defines a precise handoff and failure behaviour for checkout.

## Signs of weak answers

- Cart state held in server memory or sticky sessions.
- Prices copied into the cart with no refresh or verification.
- No answer for concurrent edits or for sign-in merging.
- Treating checkout as an atomic step that cannot fail.
