# Chat System (WhatsApp): interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about websockets.
- Reasoning about ordering.
- Reasoning about presence.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Connection layer.** How do clients stay connected? Persistent WebSocket or similar connections to gateway servers. Routing from a user to the gateway holding their connection. Reconnect storms after failure.

**Message flow and storage.** How are messages persisted and routed? Persist before acknowledging to the sender. Queue messages for offline recipients. Per-conversation sequence numbers give ordering.

**Group chat.** How are group messages delivered? Fan-out on the server to each member. Membership lookups on the hot path. Large groups need batching.

**Receipts and presence.** How are status and online state tracked? Receipts are small messages in the reverse direction. Presence via heartbeats is costly; subscribe only to visible contacts. Approximate presence is fine.

**Multi-device sync.** How do devices stay in sync? Each device has its own cursor into the message log. Messages are stored per conversation with sequence IDs. Idempotent delivery on retries.

## Trade-offs to probe

- Persist before ack vs latency: Safety versus a small delay.
- Presence accuracy vs load: Frequent heartbeats cost server and battery.
- Server fan-out vs client fan-out: Server work and visibility versus encryption model.

## Reasonable alternatives

- Gateway plus message store: Stateful gateways hold connections; a message service persists and routes via a session directory.
- Actor-per-conversation: Each conversation is an actor that serialises messages and fans out to members.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Using plain HTTP polling for real-time delivery.
- No way to route a message to the right gateway server.
- Ignoring ordering and duplicate delivery on retries.
- Broadcasting presence to everyone.
