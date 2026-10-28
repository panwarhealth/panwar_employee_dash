import type { Screens } from '@/course/doc';
import { labelClass, selectClass } from '@/lib/edm';
import { cn } from '@/lib/utils';
import { NumberBox } from './fields';

const SCREENS: {
  value: Screens;
  name: string;
  detail: string;
  ratio: string;
}[] = [
  {
    value: 'both',
    name: 'Desktop and phone',
    detail: 'Two layouts per page: 16:9 for desktop and tablet, 9:16 for phones.',
    ratio: '16:9 + 9:16',
  },
  {
    value: 'desktop',
    name: 'Desktop only',
    detail: 'One 16:9 layout. On a phone the stage scales down to fit.',
    ratio: '16:9',
  },
  {
    value: 'phone',
    name: 'Phone only',
    detail: 'One 9:16 layout. On a desktop it sits centred, phone width.',
    ratio: '9:16',
  },
];

export function ScreensPicker({
  value,
  onChange,
}: {
  value: Screens;
  onChange: (v: Screens) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {SCREENS.map((s) => (
        <button
          key={s.value}
          type="button"
          onClick={() => onChange(s.value)}
          className={cn(
            'flex w-full items-center justify-between gap-4 rounded-md border-[1.5px] bg-white px-5 py-3.5 text-left transition-colors',
            value === s.value
              ? 'border-ph-purple bg-ph-purple/5'
              : 'border-ph-charcoal/15 hover:border-ph-charcoal/30',
          )}
        >
          <span>
            <span className="block font-semibold text-ph-charcoal">{s.name}</span>
            <span className="block text-sm leading-snug text-ph-charcoal/60">{s.detail}</span>
          </span>
          <span className="whitespace-nowrap font-mono text-xs text-ph-charcoal/60">{s.ratio}</span>
        </button>
      ))}
    </div>
  );
}

export function PassMarkField({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div>
      <span className={labelClass}>Pass mark</span>
      <div className="flex items-center gap-3">
        <select
          className={cn(selectClass, 'w-auto')}
          value={value === null ? 'none' : 'mark'}
          onChange={(e) => onChange(e.target.value === 'none' ? null : 80)}
        >
          <option value="none">No pass mark, complete when finished</option>
          <option value="mark">Pass mark</option>
        </select>
        {value !== null && (
          <label className="flex items-center gap-2 text-sm text-ph-charcoal/70">
            <NumberBox
              min={1}
              max={100}
              value={value}
              onChange={(n) => onChange(Math.min(100, Math.max(1, n)))}
              className="h-10 w-20 rounded-md border border-ph-charcoal/20 px-3 text-base"
            />
            %
          </label>
        )}
      </div>
    </div>
  );
}
