# Scoring rubric

Scores are produced only by the session summary. Each criterion is scored 0 to 4 using the scale below. A score reflects evidence in this session, not the candidate's overall ability.

| Score | Meaning                                                                       |
| ----- | ----------------------------------------------------------------------------- |
| 0     | No evidence in the session.                                                   |
| 1     | Mentioned but shallow, incorrect, or unsupported.                             |
| 2     | Adequate: covers the basics with limited reasoning.                           |
| 3     | Strong: well reasoned, tied to requirements, covers main failure cases.       |
| 4     | Excellent: thorough, quantified where useful, explicit trade-offs and limits. |

## Criteria

- **requirements-clarification**: Asked about scope, scale, and constraints; recorded measurable targets; noted assumptions; revisited them when they changed.
- **architecture-completeness**: Components and data flows cover the stated functional requirements; responsibilities are clear; no major gaps on the main paths.
- **scalability**: Capacity estimated; bottlenecks identified; scaling approach fits the workload; hot spots considered.
- **reliability**: Failure modes, redundancy, degradation, retries, and idempotency considered relative to the availability and durability targets.
- **data-modeling**: Appropriate storage choices, keys and access patterns, consistency model, and retention.
- **trade-offs**: Alternatives named and compared; costs and downsides of choices acknowledged; defends decisions with reasons.
- **communication**: Clear, structured, and concise explanations; responds to challenge constructively.

Scores are a practice aid. Different valid designs can score equally well.
