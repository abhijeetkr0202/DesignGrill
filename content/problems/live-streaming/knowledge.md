# Live Streaming (Twitch): interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about low-latency.
- Reasoning about ingest.
- Reasoning about chat.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Ingest.** How do streams enter the platform? RTMP or modern ingest protocols to nearby ingest points. Redundant ingest paths. Authentication with stream keys.

**Live transcoding.** How are renditions produced in real time? Transcode into several bitrates continuously. Compute cost scales with streams, not viewers. Transcode only popular streams at full ladder.

**Delivery protocol.** How is video sent to viewers? Segmented HLS/DASH with low-latency variants. WebRTC for ultra-low latency but more costly. CDN fan-out to a huge audience.

**Live chat.** How does chat scale? Pub/sub per channel with sharded connections. Rate limits and message sampling in big rooms. Moderation pipeline.

**Recording and discovery.** How are recordings and listings produced? Write segments to storage as the stream proceeds. Viewer counts are approximate and aggregated. Directory updates tolerate delay.

## Trade-offs to probe

- Latency vs scalability: Lower delay reduces CDN efficiency and increases cost.
- Full ladder for all streams vs popular ones: Quality coverage versus compute.
- Chat completeness vs sustainability: Show every message versus sampling in huge rooms.

## Reasonable alternatives

- Ingest, transcode, segment, CDN: Streams enter at ingest points, are transcoded and segmented, and pushed through a CDN.
- WebRTC-based low-latency distribution: Viewers receive media through a tree of media servers.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Pushing video through a single server per stream to all viewers.
- Treating live like VOD with long segments and high delay.
- One global chat server for all channels.
- No plan for broadcaster reconnects.
