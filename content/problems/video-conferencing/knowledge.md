# Video Conferencing (Zoom): interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about webrtc.
- Reasoning about media-routing.
- Reasoning about real-time.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Topology.** How is media routed? Peer-to-peer mesh works only for very small calls. An SFU forwards streams without mixing and scales well. An MCU mixes streams, saving client bandwidth at server cost.

**Signalling and joining.** How do participants connect? Signalling service negotiates sessions (ICE, SDP). TURN relays for restrictive networks. Select a nearby media server.

**Quality adaptation.** How is quality adapted? Simulcast or layered coding lets the SFU pick a layer per receiver. Congestion control and bitrate adaptation. Prefer audio over video under stress.

**Large events.** How are very large audiences served? Cascade media servers. Viewers receive via CDN-style streaming with higher latency. Only a few active speakers publish.

**Recording.** How are meetings recorded? A server-side recorder joins as a participant. Post-processing and storage. Consent and compliance.

## Trade-offs to probe

- SFU vs MCU: Server compute and flexibility versus client load.
- Latency vs scale for webinars: Interactive latency versus CDN-scale delivery.
- Quality vs bandwidth: Higher bitrates cost network and server capacity.

## Reasonable alternatives

- Regional SFU clusters: Participants connect to nearby SFUs; SFUs cascade for cross-region meetings.
- Hybrid with streaming for large events: Interactive speakers use SFU; the audience watches a streamed output.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Using a full mesh for large meetings.
- Routing all media through a single region.
- No fallback relay for restrictive networks.
- Ignoring adaptation to changing bandwidth.
