import type { Frame } from '@/course/doc';
import { NumberBox } from './fields';

const FIELDS: { key: keyof Frame; label: string }[] = [
  { key: 'x', label: 'X %' },
  { key: 'y', label: 'Y %' },
  { key: 'w', label: 'Width %' },
  { key: 'h', label: 'Height %' },
  { key: 'r', label: 'Rotation' },
];

export function FrameFields({ frame, onChange }: { frame: Frame; onChange: (f: Frame) => void }) {
  return (
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
  );
}
