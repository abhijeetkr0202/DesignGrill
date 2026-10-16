import { isLineKind, lineEndpoints } from '@/features/architecture/drawing-geometry';
import { nodeSize } from '@/features/architecture/node-size';
import type { Architecture, Drawing, DrawingKind } from '@/types/session';

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DrawingDescription {
  id: string;
  kind: DrawingKind;
  text?: string;
  bounds: Box;
  // Components whose centre lies inside a shape drawn as a container.
  contains?: string[];
  // Components an arrow or line starts and ends at.
  from?: string;
  to?: string;
  // Components a label or pen stroke sits on or beside.
  near?: string[];
  // Only non-default styling, because colour and dashing may carry meaning for the candidate.
  stroke?: string;
  fill?: string;
  dashed?: boolean;
}

const ENDPOINT_REACH = 24;
const NEAR_REACH = 24;
const MAX_DESCRIBED = 100;

const round = (v: number) => Math.round(v);

function nodeBox(n: Architecture['nodes'][number]): Box {
  return { ...n.position, ...nodeSize(n.type) };
}

function gap(p: { x: number; y: number }, b: Box): number {
  const dx = Math.max(b.x - p.x, 0, p.x - (b.x + b.width));
  const dy = Math.max(b.y - p.y, 0, p.y - (b.y + b.height));
  return Math.hypot(dx, dy);
}

function nearestNode(p: { x: number; y: number }, boxes: Map<string, Box>): string | undefined {
  let best: { id: string; d: number } | undefined;
  for (const [id, b] of boxes) {
    const d = gap(p, b);
    if (d <= ENDPOINT_REACH && (!best || d < best.d)) best = { id, d };
  }
  return best?.id;
}

function insideShape(d: Drawing, p: { x: number; y: number }): boolean {
  const rx = d.width / 2;
  const ry = d.height / 2;
  const dx = p.x - (d.x + rx);
  const dy = p.y - (d.y + ry);
  switch (d.kind) {
    case 'ellipse':
    case 'circle':
      return (dx / rx) ** 2 + (dy / ry) ** 2 <= 1;
    case 'diamond':
      return Math.abs(dx) / rx + Math.abs(dy) / ry <= 1;
    default:
      return Math.abs(dx) <= rx && Math.abs(dy) <= ry;
  }
}

const overlaps = (a: Box, b: Box, reach: number) =>
  a.x - reach < b.x + b.width &&
  a.x + a.width + reach > b.x &&
  a.y - reach < b.y + b.height &&
  a.y + a.height + reach > b.y;

// Translates free-form drawings into facts a reviewer can use: what they say and what they touch.
export function describeDrawings(arch: Architecture): DrawingDescription[] {
  const boxes = new Map(arch.nodes.map((n) => [n.id, nodeBox(n)] as const));
  const out: DrawingDescription[] = arch.drawings.map((d) => {
    const base: DrawingDescription = {
      id: d.id,
      kind: d.kind,
      bounds: { x: round(d.x), y: round(d.y), width: round(d.width), height: round(d.height) },
    };
    if (d.text?.trim()) base.text = d.text.trim();
    if (d.stroke !== 'auto') base.stroke = d.stroke;
    if (d.fill !== 'none') base.fill = d.fill;
    if (d.dashed) base.dashed = true;

    if (isLineKind(d.kind)) {
      const e = lineEndpoints(d, d.width, d.height);
      const from = nearestNode({ x: d.x + e.x1, y: d.y + e.y1 }, boxes);
      const to = nearestNode({ x: d.x + e.x2, y: d.y + e.y2 }, boxes);
      if (from) base.from = from;
      if (to) base.to = to;
    } else if (d.kind === 'text' || d.kind === 'freehand') {
      const own: Box = { x: d.x, y: d.y, width: d.width, height: d.height };
      const near = [...boxes].filter(([, b]) => overlaps(own, b, NEAR_REACH)).map(([id]) => id);
      if (near.length) base.near = near;
    } else {
      const contains = [...boxes]
        .filter(([, b]) => insideShape(d, { x: b.x + b.width / 2, y: b.y + b.height / 2 }))
        .map(([id]) => id);
      if (contains.length) base.contains = contains;
    }
    return base;
  });

  const informative = (d: DrawingDescription) =>
    Boolean(d.text || d.contains || d.from || d.to || d.near);
  return [...out.filter(informative), ...out.filter((d) => !informative(d))].slice(
    0,
    MAX_DESCRIBED,
  );
}

// What identifies a drawing for change tracking: its meaning, not where exactly it sits.
export function drawingFingerprint(d: DrawingDescription): string {
  return JSON.stringify([d.kind, d.text, d.contains, d.from, d.to, d.near]);
}
