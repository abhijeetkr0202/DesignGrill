import type { ComponentType } from '@/types/session';

// Footprint and text inset per shape at 100%, in px, so labels stay inside the outline.
export const SHAPE_BASE: Record<
  ComponentType,
  { w: number; h: number; l: number; r: number; t: number }
> = {
  client: { w: 160, h: 72, l: 12, r: 12, t: 16 },
  'load-balancer': { w: 176, h: 80, l: 32, r: 32, t: 0 },
  'api-gateway': { w: 176, h: 72, l: 32, r: 24, t: 0 },
  service: { w: 160, h: 72, l: 12, r: 12, t: 0 },
  database: { w: 144, h: 92, l: 12, r: 12, t: 20 },
  cache: { w: 176, h: 80, l: 28, r: 28, t: 0 },
  queue: { w: 176, h: 64, l: 12, r: 56, t: 0 },
  'object-storage': { w: 144, h: 92, l: 16, r: 16, t: 20 },
  'search-index': { w: 192, h: 100, l: 40, r: 40, t: 0 },
  'external-provider': { w: 192, h: 88, l: 36, r: 36, t: 12 },
  custom: { w: 160, h: 72, l: 12, r: 12, t: 0 },
};

// Components are added at 60% of their original size; zoom the canvas for detail.
export const NODE_SCALE = 0.6;

export function nodeSize(type: ComponentType): { width: number; height: number } {
  const b = SHAPE_BASE[type];
  return { width: Math.round(b.w * NODE_SCALE), height: Math.round(b.h * NODE_SCALE) };
}
