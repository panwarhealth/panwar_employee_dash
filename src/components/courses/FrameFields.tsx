import { anchorOf } from '@/course/canvasLayout';
import type { Anchor, Frame } from '@/course/doc';
import { cn } from '@/lib/utils';
import { NumberBox } from './fields';

const FIELDS: { key: 'x' | 'y' | 'w' | 'h' | 'r'; label: string }[] = [
  { key: 'x', label: 'X %' },
  { key: 'y', label: 'Y %' },
  { key: 'w', label: 'Width %' },
  { key: 'h', label: 'Height %' },
  { key: 'r', label: 'Rotation' },
];

const PINS: { a: Anchor; label: string }[] = [
  { a: 'tl', label: 'Top left' },
  { a: 't', label: 'Top' },
  { a: 'tr', label: 'Top right' },
  { a: 'l', label: 'Left' },
  { a: 'c', label: 'Centre' },
  { a: 'r', label: 'Right' },
  { a: 'bl', label: 'Bottom left' },
  { a: 'b', label: 'Bottom' },
  { a: 'br', label: 'Bottom right' },
];

const pinAt = (h: number, v: number) => PINS[v * 2 * 3 + h * 2];

export function FrameFields({ frame, onChange }: { frame: Frame; onChange: (f: Frame) => void }) {
  const auto = (frame.a ?? 'auto') === 'auto';
  const { h, v } = anchorOf(frame);
  const current = pinAt(h, v);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="mb-1 block text-xs font-semibold text-ph-charcoal/60">{f.label}</span>
            <NumberBox
              step={f.key === 'r' ? 1 : 0.5}
              value={frame[f.key]}
              onChange={(n) => onChange({ ...frame, [f.key]: n })}
              className="w-full rounded-md border-[1.5px] border-ph-charcoal/15 bg-white px-2.5 py-1.5 text-sm focus:border-ph-purple focus:outline-none"
            />
          </label>
        ))}
      </div>
      <div>
        <span className="mb-1 block text-xs font-semibold text-ph-charcoal/60">Pin to screen</span>
        <div className="flex items-center gap-3">
          <div className="grid grid-cols-3 gap-1 rounded-md border-[1.5px] border-ph-charcoal/15 p-1.5">
            {PINS.map((p) => (
              <button
                key={p.a}
                type="button"
                title={p.label}
                onClick={() => onChange({ ...frame, a: p.a })}
                className="flex h-5 w-5 items-center justify-center rounded hover:bg-ph-purple/10"
              >
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    p.a === current.a
                      ? auto
                        ? 'bg-ph-purple/40'
                        : 'bg-ph-purple'
                      : 'bg-ph-charcoal/20',
                  )}
                />
              </button>
            ))}
          </div>
          <div className="text-xs text-ph-charcoal/60">
            <button
              type="button"
              onClick={() => onChange({ ...frame, a: 'auto' })}
              className={cn(
                'mb-1 rounded-full border px-2.5 py-0.5',
                auto
                  ? 'border-ph-purple bg-ph-purple text-white'
                  : 'border-ph-charcoal/20 hover:border-ph-purple',
              )}
            >
              Where it sits
            </button>
            <p>
              {auto ? 'Auto: ' : ''}
              {current.label}.{' '}
              {current.a === 'c'
                ? 'Stays in the middle on taller or wider screens.'
                : 'Stays this close to that edge on taller or wider screens.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
