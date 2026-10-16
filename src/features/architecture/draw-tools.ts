import type { DrawingKind } from '@/types/session';

export const DRAW_TOOLS: { kind: DrawingKind; label: string }[] = [
  { kind: 'line', label: 'Line' },
  { kind: 'arrow', label: 'Arrow' },
  { kind: 'rectangle', label: 'Rectangle' },
  { kind: 'rounded-rectangle', label: 'Rounded rectangle' },
  { kind: 'circle', label: 'Circle' },
  { kind: 'ellipse', label: 'Ellipse' },
  { kind: 'diamond', label: 'Diamond' },
  { kind: 'triangle', label: 'Triangle' },
  { kind: 'freehand', label: 'Pen' },
  { kind: 'text', label: 'Text' },
];
