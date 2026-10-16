# Maps and Navigation (Google Maps): interviewer knowledge notes

Original summaries for interviewers. They are not a single mandatory solution; evaluate designs against the candidate's own requirements and constraints.

## What the problem is really testing

- Reasoning about tiles.
- Reasoning about routing.
- Reasoning about traffic.
- Whether the candidate clarifies scope and estimates scale before designing.

## Core design tensions

**Tile serving.** How are tiles delivered? Pre-rendered raster or vector tiles served from object storage via CDN. Zoom levels multiply tile counts. Cache and long TTLs; regenerate on data change.

**Routing graph.** How are routes computed fast? Contraction hierarchies or similar preprocessing on the road graph. Partition the graph by region. Long routes cross partitions.

**Live traffic.** How is traffic incorporated? Aggregate anonymised location probes into edge speeds. Stream processing with short windows. Blend historical and live speeds.

**Geocoding and search.** How are addresses resolved? Index of addresses and places with fuzzy matching. Reverse geocoding using spatial lookup. Local relevance ranking.

**Navigation session.** How is re-routing handled? Client sends position updates; server checks deviation. Recompute when traffic changes materially. Offline fallback with downloaded regions.

## Trade-offs to probe

- Preprocessing vs live traffic: Fast static queries versus dynamic edge weights.
- Raster vs vector tiles: Simplicity versus flexibility and size.
- Re-route sensitivity: Better routes versus distraction and load.

## Reasonable alternatives

- Tile CDN plus partitioned routing service: Tiles are pre-built and cached; regional routing servers hold preprocessed graphs with a traffic overlay.
- On-demand vector tiles: Vector tiles are generated from a spatial database and cached.

A candidate who chooses a different structure is not wrong if it satisfies the requirements they established and they can explain the trade-offs.

## Signs of strong answers

- States assumptions and revisits them when requirements change.
- Quantifies load and storage before choosing components.
- Identifies the hardest failure modes unprompted and explains degradation behaviour.
- Explains why each component exists, and what happens when it is unavailable.

## Signs of weak answers

- Running Dijkstra on the whole planet graph per request.
- Rendering tiles on demand without caching.
- Ignoring regional partitioning of routing.
- Treating traffic data as exact and fresh.
