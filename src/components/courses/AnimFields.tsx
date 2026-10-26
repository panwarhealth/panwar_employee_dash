import type { Anim, AnimKind } from '@/course/doc';
import { Field, Select } from './fields';

const KINDS: { value: AnimKind; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'fade', label: 'Fade' },
  { value: 'fadeUp', label: 'Fade up' },
  { value: 'slideLeft', label: 'Slide in' },
  { value: 'zoom', label: 'Zoom' },
];

const NONE: Anim = { in: 'none', out: 'none', delay: 0 };

export function AnimFields({
  anim,
  onChange,
}: {
  anim: Anim | undefined;
  onChange: (a: Anim) => void;
}) {
  const a = anim ?? NONE;
  return (
    <>
      <h4 className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-ph-charcoal/50">
        Animation
      </h4>
      <div className="grid grid-cols-2 gap-2">
        <Select
          label="Animate in"
          value={a.in}
          options={KINDS}
          onChange={(v) => onChange({ ...a, in: v })}
        />
        <Select
          label="Animate out"
          value={a.out}
          options={KINDS}
          onChange={(v) => onChange({ ...a, out: v })}
        />
      </div>
      {a.in !== 'none' && (
        <Field label="Delay before it comes in (seconds)">
          <input
            type="number"
            min={0}
            step={0.25}
            value={a.delay}
            onChange={(e) => onChange({ ...a, delay: Math.max(0, Number(e.target.value) || 0) })}
            className="w-full rounded-md border-[1.5px] border-ph-charcoal/15 bg-white px-2.5 py-1.5 text-sm focus:border-ph-purple focus:outline-none"
          />
        </Field>
      )}
      {a.in !== 'none' && (
        <p className="-mt-1 text-xs text-ph-charcoal/60">
          Blocks come in one after another in order of their delay.
        </p>
      )}
    </>
  );
}
