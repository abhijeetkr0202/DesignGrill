import type { ReactNode } from 'react';
import {
  arrowHead,
  isLineKind,
  lineEndpoints,
  resolveColor,
} from '@/features/architecture/drawing-geometry';
import type { Drawing } from '@/types/session';

type Visual = Pick<
  Drawing,
  'kind' | 'stroke' | 'fill' | 'strokeWidth' | 'dashed' | 'flipX' | 'flipY' | 'points' | 'text'
>;

// Renders in pixel space so outlines and arrowheads keep their proportions at any size.
export function DrawingShape({
  drawing: d,
  width,
  height,
}: {
  drawing: Visual;
  width: number;
  height: number;
}) {
  const stroke = resolveColor(d.stroke, 'var(--fg)');
  const fill = resolveColor(d.fill, 'none');
  const sw = d.strokeWidth;
  const inset = sw / 2;
  const w = Math.max(width - sw, 1);
  const h = Math.max(height - sw, 1);
  const common = {
    stroke,
    fill,
    fillOpacity: fill === 'none' ? undefined : 0.22,
    strokeWidth: sw,
    strokeDasharray: d.dashed ? `${sw * 3} ${sw * 2}` : undefined,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  let body: ReactNode = null;
  switch (d.kind) {
    case 'rectangle':
      body = <rect x={inset} y={inset} width={w} height={h} {...common} />;
      break;
    case 'rounded-rectangle':
      body = (
        <rect
          x={inset}
          y={inset}
          width={w}
          height={h}
          rx={Math.min(16, w / 2, h / 2)}
          {...common}
        />
      );
      break;
    case 'ellipse':
    case 'circle':
      body = <ellipse cx={width / 2} cy={height / 2} rx={w / 2} ry={h / 2} {...common} />;
      break;
    case 'diamond':
      body = (
        <polygon
          points={`${width / 2},${inset} ${width - inset},${height / 2} ${width / 2},${height - inset} ${inset},${height / 2}`}
          {...common}
        />
      );
      break;
    case 'triangle':
      body = (
        <polygon
          points={`${width / 2},${inset} ${width - inset},${height - inset} ${inset},${height - inset}`}
          {...common}
        />
      );
      break;
    case 'line':
    case 'arrow': {
      const { x1, y1, x2, y2 } = lineEndpoints(d, width, height);
      const head = d.kind === 'arrow' ? arrowHead(x1, y1, x2, y2, Math.max(10, sw * 4)) : null;
      body = (
        <>
          <line x1={x1} y1={y1} x2={x2} y2={y2} {...common} fill="none" />
          {head && (
            <polyline
              points={head.map((p) => `${p.x},${p.y}`).join(' ')}
              {...common}
              fill="none"
              strokeDasharray={undefined}
            />
          )}
        </>
      );
      break;
    }
    case 'freehand':
      body = (
        <polyline
          points={(d.points ?? []).map(([px, py]) => `${px * width},${py * height}`).join(' ')}
          {...common}
          fill="none"
        />
      );
      break;
    case 'text':
      break;
  }

  const showText = d.text && !isLineKind(d.kind) && d.kind !== 'freehand';
  return (
    <>
      <svg
        aria-hidden
        width={width}
        height={height}
        className="absolute inset-0 overflow-visible"
        style={{ pointerEvents: 'none' }}
      >
        {body}
      </svg>
      {showText && (
        <div
          className={`absolute inset-0 flex ${textLayout(d.kind)} px-1 text-[16px] leading-tight whitespace-pre-wrap`}
          style={{ color: stroke === 'none' ? 'var(--fg)' : stroke }}
        >
          {d.text}
        </div>
      )}
    </>
  );
}

// Notes read like writing (top-left, never clipped); text inside a shape stays centred.
export function textLayout(kind: Visual['kind']): string {
  return kind === 'text'
    ? 'items-start justify-start overflow-visible text-left'
    : 'items-center justify-center overflow-hidden text-center';
}
