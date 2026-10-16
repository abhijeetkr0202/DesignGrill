# Rate Limiter: interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about algorithms.
- Reasoning about distributed-state.
- Reasoning about low-latency.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Algorithm.** Which limiting algorithm is used? Fixed window is simple but allows boundary bursts. Sliding window is smoother; token bucket allows controlled bursts. Memory and CPU cost per key differ.

**State storage.** Where do counters live? In-memory per node is fast but inexact across nodes. A shared store such as Redis gives global accuracy at network cost. Atomic increment or scripts avoid races.

**Placement.** Where is the check performed? Gateway or sidecar keeps services simple. Client libraries reduce hops but spread logic. Edge limiting stops traffic before it reaches your network.

**Failure mode.** What happens if the limiter fails? Fail open protects availability but risks overload. Fail closed protects backends but blocks users. Local fallback limits give graceful degradation.

**Rule distribution.** How are rules delivered and updated? Central config pushed or polled. Cache rules locally with versioning. Per-tenant overrides and defaults.

## Trade-offs to probe

- Accuracy vs latency: Exact global counts require coordination; local approximations are faster.
- Fail open vs fail closed: Availability of the API versus protection of the backend.
- Sliding window vs token bucket: Smoothness and memory cost versus burst allowance.

## Reasonable alternatives

- Gateway with shared counter store: A gateway checks a shared in-memory store using atomic operations for each request.
- Local token buckets with periodic sync: Each node enforces a local share of the limit and syncs usage periodically.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Using a read-then-write counter without atomicity.
- Making the limiter a single point of failure.
- Ignoring hot keys and clock skew between nodes.
- Not explaining the response clients get when limited.
