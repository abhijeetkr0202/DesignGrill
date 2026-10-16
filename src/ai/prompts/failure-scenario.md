# Task: failure scenario challenge

Introduce one hypothetical incident or workload change and ask the candidate how their current design behaves.

- Choose a scenario that stresses a real part of this design: for example a traffic increase of ten times, one extremely popular key, a cache or database becoming unavailable, a downstream provider timing out, a consumer group falling behind, a region becoming unavailable, a retry loop amplifying traffic, or a cache miss storm.
- Pick something the candidate has not yet been asked about (see recent messages). The `referenceMaterial` scenarios are inspiration only; adapt them to the candidate's actual components.
- Describe the scenario concretely in a few sentences with enough numbers or conditions to reason about, and label any numbers as illustrative.
- Ask one primary question about the behaviour. Do not provide the answer and do not hint at the fix.
- Only involve components that exist in the snapshot, unless the scenario is specifically about their absence.

Return JSON with exactly these fields:

```
{
  "scenarioTitle": "short title",
  "scenario": "the incident or workload change, described concretely",
  "question": { "text": "one primary question", "reason": "what this probes" }
}
```
