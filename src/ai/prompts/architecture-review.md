# Task: architecture review

Evaluate the architecture against the candidate's requirements and constraints.

Consider, where relevant: correctness problems, bottlenecks, single points of failure, hot-key or hot-partition risks, cache stampede and thundering-herd risks, queue backlog and back-pressure, database scaling, consistency and idempotency, security, operational complexity, cost and over-engineering, and missing or unresolved requirements and assumptions.

Rules:

- Evaluate against the stated requirements, not against a reference design. If requirements are missing for a concern, list that in `missingInformation` instead of asserting a problem.
- Classify each finding with `kind`:
  - `structural`: follows from the design itself regardless of load (for example a single instance with no failover for a stated availability target).
  - `conditional`: depends on traffic, configuration, or assumptions. State the condition.
  - `question`: you lack information; ask what would settle it.
  - `strength`: something the candidate did well relative to the requirements. Include at least one if deserved.
  - `assumption`: an unstated assumption the design depends on.
- Use `severity` of `critical`, `high`, `medium`, `low`, or `info`. Reserve `critical` for problems that break a stated requirement outright.
- Never state that a conditional problem is certain. Use `confidence` of `high`, `medium`, or `low` honestly.
- Reference only ids from the snapshot in `affectedNodeIds`, `affectedEdgeIds`, and `relatedRequirementIds`.
- Give mitigations as options with their trade-offs, not as a single mandated fix. Do not describe a complete replacement architecture.
- Prefer a small number of well-reasoned findings (typically 3 to 8) over an exhaustive list. Do not repeat findings already listed as unresolved unless the design change affects them.
- If the design has fewer than two components, return few or no findings and use `missingInformation` and `followUpQuestion` to guide the candidate.

Return JSON with exactly these fields:

```
{
  "overview": "two to four sentences summarising the state of the design against the requirements",
  "findings": [
    {
      "kind": "structural | conditional | question | strength | assumption",
      "severity": "critical | high | medium | low | info",
      "title": "short title",
      "affectedNodeIds": ["node ids"],
      "affectedEdgeIds": ["edge ids"],
      "relatedRequirementIds": ["requirement ids"],
      "reasoning": "why this matters, grounded in the design and requirements",
      "conditions": "when the problem occurs (omit for strengths)",
      "impact": "likely effect if it occurs",
      "mitigations": [ { "description": "one option", "tradeoffs": "what it costs" } ],
      "confidence": "high | medium | low"
    }
  ],
  "missingInformation": ["facts you need before judging more strongly"],
  "followUpQuestion": { "text": "one primary question to ask next", "reason": "why" }
}
```
