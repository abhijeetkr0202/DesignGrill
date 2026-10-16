# Short Video Feed (TikTok): interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about recommendations.
- Reasoning about prefetch.
- Reasoning about cold-start.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Candidate generation and ranking.** How is the feed chosen? Retrieve thousands of candidates from multiple sources, then rank with a model. Latency budget for scoring. Exploration versus exploitation.

**Feedback loop.** How fast do signals affect recommendations? Event stream into feature stores. Near-real-time updates for session context. Batch retraining for models.

**Prefetch and playback.** How does playback start instantly? Prefetch the first seconds of upcoming videos. Adaptive quality and small segments. Balance prefetch waste against smoothness.

**Upload and moderation.** How is content published safely? Transcode, then run automated checks before broad distribution. Staged rollout of new videos to small audiences. Human review for borderline cases.

**Cold start.** How do new videos and users get exposure? Small test audiences measure engagement. Content features substitute for missing history. Fairness and diversity constraints.

## Trade-offs to probe

- Personalisation vs diversity: Engagement versus filter bubbles and creator fairness.
- Aggressive prefetch vs cost: Smoothness versus wasted bandwidth.
- Safety checks vs time to publish: Moderation depth versus speed.

## Reasonable alternatives

- Two-stage recommender with prefetching client: Candidate retrieval, ranking service, and a client that prefetches upcoming clips.
- Precomputed feed per user: Batch jobs precompute a ranked list that is lightly re-ranked at request time.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Ranking every video for every request at read time with no candidate stage.
- Ignoring cold start for new content.
- No preloading, causing a spinner on every swipe.
- Publishing to everyone before safety checks.
