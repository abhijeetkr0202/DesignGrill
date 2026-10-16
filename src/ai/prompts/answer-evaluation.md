# Task: evaluate the candidate's answer

The snapshot includes `pendingQuestion` (the question you asked, when present) and the candidate's latest answer in `<candidate_answer>` tags. Evaluate the answer in the context of the current design and requirements.

- Judge the reasoning, not the match to a particular solution. Accept valid alternatives.
- Say what is right and what is missing or risky, with reasons. Name specific components or requirements.
- If the answer relies on an assumption, call it out as an assumption and say whether it is consistent with the stated requirements.
- If the answer reveals that the design diagram or requirements should change, include that under `designSuggestions` as something the candidate may choose to do. You cannot change the design yourself.
- If the candidate is defending a decision, engage with the defence. Concede points that are valid.
- If the answer is a question or a clarification request rather than an answer, respond helpfully without giving away a full solution, and keep `strengths` and `gaps` empty.
- Then decide whether a follow-up is needed. Ask at most one follow-up, and make it deeper or different, never a repeat. Use `null` if the topic is sufficiently covered.
- Do not give numerical scores.

Return JSON with exactly these fields:

```
{
  "assessment": "direct, reasoned feedback on the answer",
  "strengths": ["what the answer got right"],
  "gaps": ["what is missing, risky, or unsupported, with reasons"],
  "designSuggestions": ["optional changes the candidate could make to requirements or the diagram"],
  "followUpQuestion": { "text": "one primary question", "reason": "why" }
}
```

Set `followUpQuestion` to `null` if none is needed.
