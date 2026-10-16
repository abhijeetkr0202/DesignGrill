# Video Streaming (Netflix / YouTube): interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about transcoding.
- Reasoning about cdn.
- Reasoning about adaptive-bitrate.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Upload and ingest.** How do videos enter the system? Chunked resumable uploads to object storage. Validate and queue for processing. Large files need parallel chunks.

**Transcoding pipeline.** How are renditions produced? Split the video into segments and transcode in parallel (DAG of tasks). Idempotent tasks with retries. Prioritise popular or new content.

**Adaptive streaming.** How is playback adapted to networks? Segment-based protocols (HLS, DASH) with multiple bitrates. Client chooses the rendition from a manifest. Short segments reduce latency but increase requests.

**Delivery.** How is content delivered globally? CDN with edge caches; popular titles pushed to edges. ISP-embedded caches reduce transit cost. Cache hierarchy and tail content on origin.

**Metadata and search.** Where do catalogue and playback state live? Metadata database and search index. Watch-progress writes are frequent; use a scalable store. Recommendations as a separate service.

## Trade-offs to probe

- More renditions vs storage cost: Better quality coverage versus storage and compute.
- Pre-positioning vs on-demand caching: Hit rate versus bandwidth spent on unwatched content.
- Segment length: Startup latency versus request overhead.

## Reasonable alternatives

- Parallel transcoding DAG with multi-CDN delivery: Uploads are segmented, transcoded in a task graph, stored, and served via CDNs.
- Pre-encoded catalogue with edge appliances: A fixed catalogue is encoded ahead and pushed to caches inside ISP networks.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Serving video from application servers.
- Transcoding a whole file on one machine.
- A single resolution with no adaptive bitrate.
- Ignoring that popular content dominates and the long tail does not cache.
