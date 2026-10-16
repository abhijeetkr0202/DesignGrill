# Ride Sharing (Uber): interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about geo-index.
- Reasoning about dispatch.
- Reasoning about real-time-location.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Location ingestion.** How are driver positions handled? High-volume writes to an in-memory geospatial index. Only the latest position matters, so history goes to a stream. Shard by city or geographic cell.

**Geospatial indexing.** How are nearby drivers found? Geohash, S2 cells, or H3 hexagons as keys. Query neighbouring cells. Cell size versus density.

**Dispatch.** How is a driver chosen? Score candidates by ETA and fit. Offer to one driver with a timeout, then the next. Prevent double-offering with a state machine.

**Trip state.** How is a trip tracked? Durable state machine from requested to completed. Real-time updates over persistent connections. Recovery after service restart.

**Surge pricing.** How is dynamic pricing computed? Supply and demand per cell in near real time. Smooth changes to avoid oscillation. Price shown is locked for the rider.

## Trade-offs to probe

- Batch vs immediate matching: Global efficiency versus time to match.
- Location update frequency: Accuracy versus battery, network, and write load.
- Cell size: Query cost versus precision in dense areas.

## Reasonable alternatives

- City-sharded geo index with dispatch service: Location updates populate an in-memory cell index per region; a dispatch service matches requests and manages trip state.
- Batch matching windows: Requests and drivers are collected for a couple of seconds and matched globally.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Storing every location ping in a relational table for matching.
- Querying all drivers and computing distances.
- No guard against dispatching a driver twice.
- Ignoring dense-city hot spots.
