import type { CSSProperties, ReactNode } from 'react';
import { NODE_SCALE, SHAPE_BASE } from '@/features/architecture/node-size';
import type { ComponentType } from '@/types/session';

// Conventional HLD shapes, drawn in a 100x60 box that stretches to the node size.
const SHAPES: Record<ComponentType, { color: string; body: ReactNode; dashed?: boolean }> = {
  client: {
    color: '#64748b',
    body: (
      <>
        <rect x="1" y="1" width="98" height="58" rx="4" />
        <line x1="1" y1="13" x2="99" y2="13" />
      </>
    ),
  },
  'load-balancer': {
    color: '#8b5cf6',
    body: <polygon points="20,1 80,1 99,30 80,59 20,59 1,30" />,
  },
  'api-gateway': {
    color: '#0ea5e9',
    body: <polygon points="14,1 99,1 86,59 1,59" />,
  },
  service: {
    color: '#3b82f6',
    body: <rect x="1" y="1" width="98" height="58" rx="10" />,
  },
  database: {
    color: '#f59e0b',
    body: (
      <>
        <path d="M1,10 a49,9 0 0 1 98,0 v40 a49,9 0 0 1 -98,0 z" />
        <path d="M1,10 a49,9 0 0 0 98,0" />
      </>
    ),
  },
  cache: {
    color: '#ef4444',
    body: <ellipse cx="50" cy="30" rx="49" ry="29" />,
  },
  queue: {
    color: '#14b8a6',
    body: (
      <>
        <rect x="1" y="1" width="98" height="58" rx="6" />
        <line x1="68" y1="1" x2="68" y2="59" />
        <line x1="78" y1="1" x2="78" y2="59" />
        <line x1="88" y1="1" x2="88" y2="59" />
      </>
    ),
  },
  'object-storage': {
    color: '#d97706',
    body: (
      <>
        <path d="M1,10 a49,8 0 0 1 98,0 l-10,40 a39,8 0 0 1 -78,0 z" />
        <path d="M1,10 a49,8 0 0 0 98,0" />
      </>
    ),
  },
  'search-index': {
    color: '#ec4899',
    body: <polygon points="50,1 99,30 50,59 1,30" />,
  },
  'external-provider': {
    color: '#6b7280',
    body: (
      <path d="M25,52 C10,52 3,40 12,32 C8,18 24,10 34,16 C40,2 66,2 70,16 C84,10 98,22 90,34 C100,44 92,52 78,52 Z" />
    ),
  },
  custom: {
    color: '#94a3b8',
    dashed: true,
    body: <rect x="1" y="1" width="98" height="58" rx="10" />,
  },
};

export function shapeBox(type: ComponentType): CSSProperties {
  const b = SHAPE_BASE[type];
  const s = (v: number) => Math.round(v * NODE_SCALE);
  return {
    width: s(b.w),
    height: s(b.h),
    paddingLeft: s(b.l),
    paddingRight: s(b.r),
    paddingTop: s(b.t),
  };
}

export function ComponentShape({
  type,
  selected = false,
  flagged = false,
  className = 'absolute inset-0 h-full w-full',
}: {
  type: ComponentType;
  selected?: boolean;
  flagged?: boolean;
  className?: string;
}) {
  const shape = SHAPES[type];
  const stroke = selected ? 'var(--accent)' : flagged ? 'var(--warn)' : shape.color;
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 60"
      preserveAspectRatio="none"
      className={`shape-svg ${className}`}
      fill="var(--surface)"
      stroke={stroke}
      strokeWidth={selected || flagged ? 2.5 : 1.75}
      strokeDasharray={shape.dashed || flagged ? '5 3' : undefined}
      strokeLinejoin="round"
      style={{ overflow: 'visible' }}
    >
      {shape.body}
    </svg>
  );
}
