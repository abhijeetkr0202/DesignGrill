import type { DrawStyle } from '@/features/architecture/drawing-geometry';

const SWATCHES: { name: string; value: string }[] = [
  { name: 'Default', value: 'auto' },
  { name: 'Red', value: '#e03131' },
  { name: 'Orange', value: '#f08c00' },
  { name: 'Yellow', value: '#e8b900' },
  { name: 'Green', value: '#2f9e44' },
  { name: 'Teal', value: '#0c8599' },
  { name: 'Blue', value: '#1971c2' },
  { name: 'Purple', value: '#7048e8' },
  { name: 'Pink', value: '#c2255c' },
  { name: 'Gray', value: '#868e96' },
];

function Swatches({
  label,
  value,
  withNone,
  onChange,
}: {
  label: string;
  value: string;
  withNone?: boolean;
  onChange: (v: string) => void;
}) {
  const custom = /^#[0-9a-f]{6}$/i.test(value) && !SWATCHES.some((s) => s.value === value);
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1">
      <span className="mr-0.5 text-[11px] text-muted">{label}</span>
      {withNone && (
        <button
          type="button"
          aria-label={`${label} none`}
          aria-pressed={value === 'none'}
          title="None"
          onClick={() => onChange('none')}
          className={`relative h-4 w-4 rounded-sm border ${value === 'none' ? 'border-accent ring-1 ring-accent' : 'border-line'}`}
        >
          <span aria-hidden className="absolute inset-0 m-auto h-px w-3 rotate-45 bg-danger" />
        </button>
      )}
      {SWATCHES.map((s) => (
        <button
          key={s.value}
          type="button"
          aria-label={`${label} ${s.name}`}
          aria-pressed={value === s.value}
          title={s.name}
          onClick={() => onChange(s.value)}
          className={`h-4 w-4 rounded-sm border ${value === s.value ? 'border-accent ring-1 ring-accent' : 'border-line'}`}
          style={{ background: s.value === 'auto' ? 'var(--fg)' : s.value }}
        />
      ))}
      <input
        type="color"
        aria-label={`${label} custom colour`}
        title="Custom colour"
        value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'}
        onChange={(e) => onChange(e.target.value)}
        className={`h-4 w-5 cursor-pointer rounded-sm border bg-transparent p-0 ${custom ? 'border-accent' : 'border-line'}`}
      />
    </div>
  );
}

export function StylePicker({
  value,
  onChange,
}: {
  value: DrawStyle;
  onChange: (patch: Partial<DrawStyle>) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      <Swatches label="Stroke" value={value.stroke} onChange={(stroke) => onChange({ stroke })} />
      <Swatches label="Fill" value={value.fill} withNone onChange={(fill) => onChange({ fill })} />
      <div role="group" aria-label="Stroke width" className="flex items-center gap-1">
        <span className="mr-0.5 text-[11px] text-muted">Width</span>
        {[1, 2, 4].map((w) => (
          <button
            key={w}
            type="button"
            aria-label={`Stroke width ${w}`}
            aria-pressed={value.strokeWidth === w}
            onClick={() => onChange({ strokeWidth: w })}
            className={`flex h-5 w-6 items-center justify-center rounded border ${value.strokeWidth === w ? 'border-accent' : 'border-line'}`}
          >
            <span aria-hidden className="w-4 bg-fg" style={{ height: w }} />
          </button>
        ))}
      </div>
      <label className="flex items-center gap-1 text-[11px] text-muted">
        <input
          type="checkbox"
          checked={value.dashed}
          onChange={(e) => onChange({ dashed: e.target.checked })}
        />
        Dashed
      </label>
    </div>
  );
}
