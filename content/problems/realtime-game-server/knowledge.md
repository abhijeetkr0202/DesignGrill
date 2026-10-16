# Real-Time Multiplayer Game Backend: interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about state-sync.
- Reasoning about udp.
- Reasoning about authoritative-server.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Authoritative simulation.** Who owns the game state? A dedicated game server runs the simulation and validates inputs. Clients predict locally and reconcile. Clients are never trusted for outcomes.

**Transport and sync.** How is state sent to clients? UDP-based protocols with custom reliability for latency. Delta compression and snapshots. Interest management sends only nearby entities.

**Server placement.** Where do matches run? Regional fleets chosen by player latency. Warm instances and autoscaling. One match per process or core for isolation.

**Failure and reconnect.** How are crashes and disconnects handled? Reconnect with state snapshot and input replay. Periodic checkpoints for recovery are rarely worth it for short matches. Graceful match abort and compensation.

**Persistence and anti-cheat.** How are results saved and cheating limited? Write final results asynchronously to a durable store. Server-side validation and anomaly detection. Telemetry replay for review.

## Trade-offs to probe

- Tick rate vs cost: Smoothness versus CPU and bandwidth.
- Client prediction vs correctness: Responsiveness versus rollbacks.
- Checkpointing vs simplicity: Resilience to crashes versus overhead.

## Reasonable alternatives

- Dedicated server fleet with orchestrator: An orchestrator allocates game server processes in regional fleets; clients connect over UDP.
- Peer-hosted with relay: A player hosts the match and a relay brokers connections.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Trusting client-reported positions or damage.
- Using TCP head-of-line blocking for fast state updates.
- Sending the full world state to every player.
- Persisting every tick to a database.
