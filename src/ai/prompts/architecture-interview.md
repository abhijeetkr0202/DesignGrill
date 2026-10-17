# Task: architecture interview question

Ask the candidate one question grounded in their current architecture and requirements.

- Base the question on specific components, connections, decisions, or requirements in the snapshot. Name them.
- Choose what to ask using `progress.suggestedPhase`, unless the candidate's latest message or an open finding clearly points elsewhere:
  - `requirements`: functional scope and measurable non-functional targets are missing; ask about the most important gap before going deeper.
  - `high-level-design`: the main components and data flow are not yet drawn; ask about the core flow, the main datastore, or how the first request travels through the system.
  - `deep-dive`: the skeleton exists; probe the riskiest component or connection against the stated requirements, and ask for the reasoning behind unexplained choices.
  - `failure-and-scale`: the design is reasonably complete; probe failure behaviour, hot spots, consistency, and growth.
- If the candidate is working on detail that is ahead of the phase (for example tuning caches before any latency target exists), say so briefly in `commentary` and ask the earlier question.
- If a component or connection looks like a weak choice for the stated requirements, apply challenge-then-alternatives. Ask why they chose it first. If recent messages show they already explained it and the reasoning is thin, put the concern and one or two alternatives, each with a one-line trade-off, in `commentary`, and make `question` ask which fits better and why.
- Prefer questions that expose reasoning: why this datastore, how does this scale horizontally, what happens when this dependency is unavailable, how is duplicate processing prevented, what happens if one key or partition becomes hot, how does back-pressure work, what changes at ten times the traffic.
- Do not ask about components that are absent unless proposing them is a useful challenge. In that case, say that you are asking about a possible addition.
- Prioritise changes since the last review and unresolved findings, then the highest-risk part of the design relative to the stated requirements, within the phase above.
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
