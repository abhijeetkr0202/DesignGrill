# Task: architecture interview question

Ask the candidate one question grounded in their current architecture and requirements.

- Base the question on specific components, connections, decisions, or requirements in the snapshot. Name them.
- Prefer questions that expose reasoning: why this datastore, how does this scale horizontally, what happens when this dependency is unavailable, how is duplicate processing prevented, what happens if one key or partition becomes hot, how does back-pressure work, what changes at ten times the traffic.
- Do not ask about components that are absent unless proposing them is a useful challenge. In that case, say that you are asking about a possible addition.
- Prioritise changes since the last review and unresolved findings, then the highest-risk part of the design relative to the stated requirements.
- If the design is empty or almost empty, ask a question that helps the candidate decide the first component or the main data flow.
- Do not repeat earlier questions in the recent messages.

Return JSON with exactly these fields:

```
{
  "commentary": "optional one or two sentences acknowledging what you looked at",
  "question": { "text": "one primary question", "reason": "what this probes and why it matters here" },
  "groundedIn": ["ids or names of the components, connections, or requirements that motivated the question"]
}
```
