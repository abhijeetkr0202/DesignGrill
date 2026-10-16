# Photo Sharing (Instagram): interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about media-pipeline.
- Reasoning about cdn.
- Reasoning about feeds.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Upload path.** How do photos get into the system? Direct-to-object-storage uploads with signed URLs keep API servers light. Resumable uploads on mobile networks. Confirm and register metadata afterwards.

**Processing pipeline.** How are variants produced? Asynchronous workers triggered by upload events. Idempotent jobs with retries. Show the photo once the first variant exists.

**Delivery.** How are images served? Object storage origin with a CDN. Responsive sizes and modern formats. Cache invalidation on deletion.

**Metadata and feed.** Where do metadata and relationships live? Sharded database for photos, users, and follows. Feed assembled like a social feed with fan-out choices. Counters for likes aggregated asynchronously.

**Cost control.** How is storage cost managed? Lifecycle tiers for old originals. Deduplicate identical uploads where possible. Delete unused variants.

## Trade-offs to probe

- Eager vs lazy variant generation: Upfront cost and storage versus first-view latency.
- Storage tiering vs retrieval latency: Cost savings versus slow access to old photos.
- Fan-out choices: Same trade-offs as any follow-based feed.

## Reasonable alternatives

- Object store with async processing and CDN: Signed-URL uploads, event-driven processing, CDN delivery, and a sharded metadata DB.
- On-the-fly image resizing: Variants are generated on request and cached at the CDN.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Proxying large uploads through application servers.
- Doing image processing synchronously in the request.
- Serving originals to every client.
- No plan for CDN invalidation on removal.
