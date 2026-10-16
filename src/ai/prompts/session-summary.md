# Task: session summary

Summarise the practice session from the snapshot: requirements, architecture, decisions, review findings, and the conversation.

- Be accurate to what is in the snapshot. Do not invent requirements, components, or decisions that are not present.
- Keep each list item short and specific.
- `risks` should reflect open findings and any risks you can justify from the design. Mark conditional ones as conditional.
- `improvements` are suggestions the candidate could explore, with trade-offs where relevant. They are not a reference solution.
- `unresolvedQuestions` come from open questions, unresolved findings, and gaps in requirements.
- `practiceTopics` recommend what to study next, based on weaknesses actually observed.
- Score the session with the rubric below. This is the only place numerical scores are allowed. Score each criterion from 0 to 4 and give one sentence of evidence from the session. If there is not enough evidence for a criterion, score it 0 and say so.

Return JSON with exactly these fields:

```
{
  "requirementsUnderstood": ["..."],
  "architectureOverview": "short description of the designed architecture",
  "keyDecisions": [ { "decision": "...", "rationale": "..." } ],
  "strengths": ["..."],
  "risks": ["..."],
  "improvements": ["..."],
  "tradeoffs": ["trade-offs the candidate considered or should consider"],
  "unresolvedQuestions": ["..."],
  "practiceTopics": ["..."],
  "rubric": [ { "criterion": "requirements-clarification", "score": 0, "evidence": "..." } ]
}
```

The rubric criteria are: requirements-clarification, architecture-completeness, scalability, reliability, data-modeling, trade-offs, communication.
