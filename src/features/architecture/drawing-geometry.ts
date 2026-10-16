import type { Drawing, DrawingKind } from '@/types/session';

export type DrawTool = 'select' | DrawingKind;
export type Point = { x: number; y: number };

export interface DrawStyle {
  stroke: string;
  fill: string;
  strokeWidth: number;
  dashed: boolean;
}

export const DEFAULT_DRAW_STYLE: DrawStyle = {
  stroke: 'auto',
  fill: 'none',
  strokeWidth: 2,
  dashed: false,
};

// Below this size a line is drawn straight through the middle of its box.
export const MIN_SIZE = 12;

const CLICK_THRESHOLD = 6;
const DEFAULT_SIZE: Partial<Record<DrawingKind, { width: number; height: number }>> = {
  rectangle: { width: 120, height: 80 },
  'rounded-rectangle': { width: 120, height: 80 },
  ellipse: { width: 120, height: 80 },
  circle: { width: 90, height: 90 },
  diamond: { width: 100, height: 100 },
  triangle: { width: 100, height: 90 },
  text: { width: 160, height: 36 },
};
const DEFAULT_LINE_LENGTH = 120;
const MAX_FREEHAND_POINTS = 500;

export const isLineKind = (k: DrawingKind) => k === 'line' || k === 'arrow';
// Boxes sit behind components so they can act as grouping areas.
export const isBackdropKind = (k: DrawingKind) =>
  k === 'rectangle' ||
  k === 'rounded-rectangle' ||
  k === 'ellipse' ||
  k === 'circle' ||
  k === 'diamond' ||
  k === 'triangle';

export function lineEndpoints(
  d: Pick<Drawing, 'flipX' | 'flipY'>,
  width: number,
  height: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const flat = height <= MIN_SIZE;
  const tall = width <= MIN_SIZE;
  const ax = tall ? width / 2 : d.flipX ? width : 0;
  const bx = tall ? width / 2 : d.flipX ? 0 : width;
  const ay = flat ? height / 2 : d.flipY ? height : 0;
  const by = flat ? height / 2 : d.flipY ? 0 : height;
  return { x1: ax, y1: ay, x2: bx, y2: by };
}

export function arrowHead(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  size: number,
): [Point, Point, Point] {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const spread = Math.PI / 7;
  const wing = (a: number): Point => ({ x: x2 - size * Math.cos(a), y: y2 - size * Math.sin(a) });
  return [wing(angle - spread), { x: x2, y: y2 }, wing(angle + spread)];
}

function simplify(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= 2) out.push(p);
  }
  const stride = Math.ceil(out.length / MAX_FREEHAND_POINTS);
  return stride > 1 ? out.filter((_, i) => i % stride === 0 || i === out.length - 1) : out;
}

// Turns a pointer gesture (in flow coordinates) into a drawing for the chosen tool.
export function buildDrawing(
  kind: DrawingKind,
  start: Point,
  end: Point,
  path: Point[],
  style: DrawStyle,
): Omit<Drawing, 'id'> {
  const base = { ...style, flipX: false, flipY: false };
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const clicked = Math.hypot(dx, dy) < CLICK_THRESHOLD;

  if (kind === 'freehand') {
    const pts = simplify(path.length > 1 ? path : [start, { x: start.x + 1, y: start.y + 1 }]);
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    const width = Math.max(MIN_SIZE, Math.max(...xs) - x);
    const height = Math.max(MIN_SIZE, Math.max(...ys) - y);
    const norm = (v: number, o: number, s: number) => Math.round(((v - o) / s) * 1000) / 1000;
    return {
      ...base,
      kind,
      x,
      y,
      width,
      height,
      points: pts.map((p) => [norm(p.x, x, width), norm(p.y, y, height)] as [number, number]),
    };
  }

  if (isLineKind(kind)) {
    const target = clicked ? { x: start.x + DEFAULT_LINE_LENGTH, y: start.y } : end;
    const w = Math.abs(target.x - start.x);
    const h = Math.abs(target.y - start.y);
    return {
      ...base,
      kind,
      x: Math.min(start.x, target.x) - (w <= MIN_SIZE ? (MIN_SIZE - w) / 2 : 0),
      y: Math.min(start.y, target.y) - (h <= MIN_SIZE ? (MIN_SIZE - h) / 2 : 0),
      width: Math.max(MIN_SIZE, w),
      height: Math.max(MIN_SIZE, h),
      flipX: target.x < start.x,
      flipY: target.y < start.y,
    };
  }

  const fallback = DEFAULT_SIZE[kind] ?? { width: 120, height: 80 };
  if (clicked) {
    return { ...base, kind, x: start.x, y: start.y, ...fallback };
  }
  if (kind === 'circle') {
    const size = Math.max(Math.abs(dx), Math.abs(dy));
    return {
      ...base,
      kind,
      x: dx < 0 ? start.x - size : start.x,
      y: dy < 0 ? start.y - size : start.y,
      width: size,
      height: size,
    };
  }
  return {
    ...base,
    kind,
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.max(MIN_SIZE, Math.abs(dx)),
    height: Math.max(MIN_SIZE, Math.abs(dy)),
  };
}

export function resolveColor(value: string, fallback: string): string {
  return value === 'auto' ? fallback : value === 'none' ? 'none' : value;
}
