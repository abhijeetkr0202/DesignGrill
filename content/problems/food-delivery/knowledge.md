# Food Delivery (DoorDash): interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about three-sided-marketplace.
- Reasoning about dispatch.
- Reasoning about eta.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Discovery and menus.** How are restaurants found and menus served? Geospatial search plus ranking by distance, rating, and ETA. Menu cache with fast availability overlays. Read-heavy; cache aggressively.

**Order lifecycle.** How is an order tracked end to end? State machine across customer, restaurant, and courier. Idempotent transitions and timeouts. Handling a restaurant that never accepts.

**Courier dispatch.** How are couriers assigned? Match by proximity and food readiness time. Batch multiple orders along a route. Delay dispatch until food is nearly ready.

**ETA estimation.** How is delivery time predicted? Prep time plus travel time with models using history. Update as conditions change. Communicate uncertainty.

**Real-time tracking.** How does the customer see progress? Courier location streamed through pub/sub. Throttle updates to the app. Push notifications on state changes.

## Trade-offs to probe

- Early vs late dispatch: Courier idle time versus cold food.
- Batching orders vs speed: Efficiency versus delivery time per order.
- ETA padding: Under-promise safely versus lower conversion.

## Reasonable alternatives

- Order orchestrator with dispatch and ETA services: An order service drives a state machine; dispatch and ETA services consume order and location events.
- Restaurant-managed delivery: Restaurants employ couriers; the platform handles ordering only.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Dispatching couriers the moment an order is placed regardless of prep time.
- Single shared database for menus, orders, and location.
- No handling of restaurants that fail to respond.
- Ignoring meal-time spikes.
