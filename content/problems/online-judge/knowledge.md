# Online Judge (LeetCode): interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about sandboxing.
- Reasoning about queues.
- Reasoning about contests.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Submission pipeline.** How are submissions processed? Persist the submission, enqueue it, and let workers pull jobs. Priority queues for contests. Idempotent verdict updates.

**Sandboxing.** How is untrusted code isolated? Containers or microVMs with seccomp, cgroups, no network, and read-only filesystems. CPU time and memory limits. Clean environments per run.

**Fair measurement.** How are runtimes comparable? Dedicated pinned CPUs for timing. Repeat or calibrate borderline runs. Standardised judge machines.

**Test data distribution.** How is test data managed? Test cases in object storage cached on workers. Versioned problems and tests. Hidden data protected.

**Contest leaderboard.** How is live ranking served? Verdict events update a sorted structure. Cache and push updates. Freeze scoreboard near the end if needed.

## Trade-offs to probe

- Isolation strength vs startup cost: MicroVMs are safer but slower than containers.
- Timing accuracy vs utilisation: Dedicated cores waste capacity.
- Contest priority vs normal traffic: Fairness versus responsiveness for practice users.

## Reasonable alternatives

- Queue with sandbox worker fleet: Submissions go to priority queues; elastic workers run sandboxed executions and report verdicts.
- Serverless execution: Each run executes in an ephemeral function environment.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Running user code on application servers.
- Allowing network access from the sandbox.
- One shared queue so practice traffic starves contests.
- Ignoring fork bombs and resource exhaustion.
