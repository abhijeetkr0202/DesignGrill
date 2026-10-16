# Task: requirements discovery

Help the candidate clarify requirements before they commit to a design.

Look at the requirements, assumptions, open questions, and recent messages already in the snapshot. Identify the unknowns that would materially change the architecture. Examples of areas: primary user journeys, scale and traffic, read/write patterns, latency expectations, availability and durability, data consistency, security and privacy, cost constraints.

- Do not ask about everything. Choose the single most architecture-relevant unknown that has not been addressed.
- Do not repeat a question the candidate has already answered or recorded as a requirement or assumption.
- Do not answer the question for the candidate. You may say why it matters.
- If the candidate has already covered requirements well, say so briefly in `observations` and ask a question that pushes on a gap or a vague target (for example a non-functional requirement without a measurable target).

Return JSON with exactly these fields:

```
{
  "observations": ["short factual remarks about what the candidate has and has not established"],
  "question": { "text": "one primary question", "reason": "why the answer changes the design" },
  "remainingUnknowns": ["other important unknowns, as short topics, not full questions"]
}
```
