# CI/CD and Code Deployment System: interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about pipelines.
- Reasoning about rollouts.
- Reasoning about artifacts.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Build execution.** How do builds run? Ephemeral workers pull jobs from queues. Remote caching of dependencies and build outputs. Hermetic builds for reproducibility.

**Pipeline orchestration.** How are stages sequenced? Pipeline definitions as code translated to a DAG. State machine persists progress. Retries and manual gates.

**Artifact management.** How are artifacts stored and promoted? Immutable versioned artifacts in a registry. Promote the same artifact across environments. Retention and garbage collection.

**Rollout strategy.** How are releases made safe? Canary and staged region rollouts with automated health analysis. Automatic rollback on error budget burn. Feature flags to decouple deploy from release.

**Security and compliance.** How is the supply chain protected? Signed artifacts and provenance. Short-lived credentials for deploy. Audit logs and approvals.

## Trade-offs to probe

- Speed vs safety of rollouts: Faster releases versus longer canary stages.
- Remote caching vs correctness: Faster builds versus risk of stale outputs.
- Central platform vs team autonomy: Consistency versus flexibility.

## Reasonable alternatives

- Queue-based build farm with progressive delivery: Workers run builds from queues; an orchestrator drives pipelines and staged rollouts with health gates.
- GitOps pull-based deploys: Clusters pull desired state from a repository and reconcile.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Rebuilding artifacts per environment.
- Deploying everywhere at once with no canary.
- No rollback automation.
- Long-lived credentials in the pipeline.
