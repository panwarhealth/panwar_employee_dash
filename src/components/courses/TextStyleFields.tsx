import { useContext } from 'react';
import type { TextStyle } from '@/course/doc';
import { SIZES } from '@/course/typography';
import { FontOptions } from './fontContext';
import { Field, Toggle } from './fields';

const inputClass =
  'w-full rounded-md border-[1.5px] border-ph-charcoal/15 bg-white px-2 py-1.5 text-sm focus:border-ph-purple focus:outline-none';

function ColourField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <Field label={label}>
      <span className="flex items-center gap-2">
        <input
          type="color"
          value={value ?? '#2f3030'}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 cursor-pointer rounded border border-ph-charcoal/20"
        />
        {value ? (
          <button
            type="button"
            className="text-xs text-ph-charcoal/60 underline underline-offset-2"
            onClick={() => onChange(undefined)}
          >
            Reset
          </button>
        ) : (
          <span className="text-xs text-ph-charcoal/50">Default</span>
        )}
      </span>
    </Field>
  );
}

export function TextStyleFields({
  value,
  onChange,
  fill,
  onFill,
  boldByDefault = false,
}: {
  value: TextStyle | undefined;
  boldByDefault?: boolean;
  onChange: (s: TextStyle) => void;
  fill?: string;
  onFill?: (v: string | undefined) => void;
}) {
  const fonts = useContext(FontOptions);
  const s = value ?? {};
  const set = (patch: Partial<TextStyle>) => onChange({ ...s, ...patch });
  const num = (v: string) => (v === '' ? undefined : Number(v));

  return (
    <>
      <h4 className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-ph-charcoal/50">
        Text style
      </h4>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Font">
          <select
            className={inputClass}
            value={s.font ?? 'course'}
            onChange={(e) =>
              set({ font: e.target.value === 'course' ? undefined : e.target.value })
            }
          >
            {fonts.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Size (px)">
          <select
            className={inputClass}
            value={s.size ?? ''}
            onChange={(e) => set({ size: num(e.target.value) })}
          >
            <option value="">Default</option>
            {SIZES.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </Field>
        <ColourField label="Colour" value={s.color} onChange={(color) => set({ color })} />
        {onFill && <ColourField label="Button colour" value={fill} onChange={onFill} />}
        <Field label="Line height">
          <input
            type="number"
            step={0.1}
            min={0.8}
            className={inputClass}
            placeholder="Default"
            value={s.lineHeight ?? ''}
            onChange={(e) => set({ lineHeight: num(e.target.value) })}
          />
        </Field>
        <Field label="Letter spacing (em)">
          <input
            type="number"
            step={0.01}
            className={inputClass}
            placeholder="Default"
            value={s.letterSpacing ?? ''}
            onChange={(e) => set({ letterSpacing: num(e.target.value) })}
          />
        </Field>
      </div>
      <div className="flex flex-wrap gap-4">
        <Toggle
          label="Bold"
          checked={s.weight ? s.weight === 700 : boldByDefault}
          onChange={(v) => set({ weight: v ? 700 : 400 })}
        />
        <Toggle label="Italic" checked={!!s.italic} onChange={(italic) => set({ italic })} />
        <Toggle
          label="Underline"
          checked={!!s.underline}
          onChange={(underline) => set({ underline })}
        />
      </div>
    </>
  );
}
