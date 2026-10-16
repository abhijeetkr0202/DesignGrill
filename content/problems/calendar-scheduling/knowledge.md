# Calendar and Meeting Scheduling: interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about recurrence.
- Reasoning about time-zones.
- Reasoning about availability.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Event model.** How are recurring events stored? Store a rule (RRULE) plus exceptions rather than every instance. Expand on read for the requested window. Edits to one instance versus the series.

**Time zones.** How are times represented? Store local time with zone ID for events and UTC for instants. Daylight saving changes shift UTC instants. Update zone database over time.

**Sharing and invitations.** How are invitations delivered and tracked? Each attendee has their own copy linked to the organiser event. Updates propagate asynchronously. Conflicting edits and responses.

**Free/busy.** How is availability computed? Aggregate busy intervals per user, cached and indexed. Privacy: expose only busy blocks. Cross-user queries fan out.

**Reminders.** How are reminders scheduled? Time-bucketed scheduler producing notification jobs. Jitter at round times. Idempotent delivery.

## Trade-offs to probe

- Expanding on read vs materialising: Storage savings versus read cost.
- Per-attendee copies vs shared event: Autonomy versus update fan-out.
- Precise free/busy vs privacy: Usefulness versus data exposure.

## Reasonable alternatives

- Rule-based events with per-user calendars: Events keep recurrence rules; each user calendar references events; a scheduler issues reminders.
- Materialised instances window: Instances for the next N months are materialised and extended by a background job.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Storing every instance of an infinite recurrence.
- Storing only UTC and breaking recurring events across DST.
- Scanning all events to find reminders.
- Exposing private event details through free/busy.
