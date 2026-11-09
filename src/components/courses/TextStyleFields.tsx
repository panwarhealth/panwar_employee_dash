import { useContext, useState, type ReactNode } from 'react';
import { Pipette, X } from 'lucide-react';
import type { Border, Gradient, Shadow, TextStyle } from '@/course/doc';
import { gradientCss, SIZES } from '@/course/typography';
import { CourseColours } from './colourContext';
import { pickColour } from './eyedropper';
import { FontOptions } from './fontContext';
import { Field, inputClass, NumberBox, sectionClass, Select, Toggle } from './fields';

const RGBA = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i;

function colourParts(value: string | undefined): { hex: string | undefined; alpha: number } {
  const m = value?.match(RGBA);
  if (!m) return { hex: value, alpha: 1 };
  const hex = `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
  return { hex: hex.toUpperCase(), alpha: m[4] === undefined ? 1 : Number(m[4]) };
}

function withAlpha(hex: string, alpha: number): string {
  if (alpha >= 1) return hex;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${Math.round(alpha * 100) / 100})`;
}

export function ColourField({
  label,
  value,
  onChange,
  alpha,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  alpha?: boolean;
}) {
  const parts = colourParts(value);
  const pick = (hex: string) => onChange(alpha ? withAlpha(hex, parts.alpha) : hex);
  return (
    <Field label={label}>
      <span className="flex items-center gap-1">
        <ColourPicker value={parts.hex} onChange={pick} />
        {alpha && (
          <span className="flex shrink-0 items-center gap-0.5 text-xs text-ph-charcoal/60">
            <NumberBox
              aria-label="Opacity"
              title="Opacity"
              min={0}
              max={100}
              disabled={!parts.hex || !HEX.test(parts.hex)}
              value={Math.round(parts.alpha * 100)}
              onChange={(n) =>
                parts.hex &&
                HEX.test(parts.hex) &&
                onChange(withAlpha(parts.hex, Math.min(100, Math.max(0, n)) / 100))
              }
              className="h-9 w-12 rounded-md border-[1.5px] border-ph-charcoal/15 bg-white px-1 text-right text-xs text-ph-charcoal focus:border-ph-purple focus:outline-none disabled:opacity-50"
            />
            %
          </span>
        )}
        {value && (
          <button
            type="button"
            title="Reset to default"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-ph-charcoal/50 hover:bg-ph-charcoal/5 hover:text-ph-purple"
            onClick={() => onChange(undefined)}
          >
            <X size={14} />
          </button>
        )}
      </span>
      <Swatches value={parts.hex} onPick={pick} />
    </Field>
  );
}

const HEX = /^#[0-9a-f]{6}$/i;

function ColourPicker({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (v: string) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const shown = value && HEX.test(value) ? value.toUpperCase() : '';
  return (
    <span className="flex shrink-0 items-center gap-1">
      <input
        type="color"
        value={shown || '#2f3030'}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="h-9 w-10 cursor-pointer rounded border border-ph-charcoal/20"
      />
      <button
        type="button"
        title="Pick a colour from anything on screen"
        disabled={picking}
        onClick={async () => {
          setPicking(true);
          try {
            const colour = await pickColour();
            if (colour) onChange(colour);
          } finally {
            setPicking(false);
          }
        }}
        className="flex h-9 w-9 items-center justify-center rounded border border-ph-charcoal/20 text-ph-charcoal/70 hover:border-ph-purple hover:text-ph-purple disabled:cursor-wait disabled:opacity-50"
      >
        <Pipette size={15} />
      </button>
      <input
        type="text"
        aria-label="Hex colour"
        placeholder="#000000"
        value={draft ?? shown}
        onChange={(e) => {
          const typed = e.target.value.trim();
          setDraft(typed);
          const full = typed.startsWith('#') ? typed : `#${typed}`;
          if (HEX.test(full)) onChange(full.toUpperCase());
        }}
        onBlur={() => setDraft(null)}
        className="h-9 w-20 rounded-md border-[1.5px] border-ph-charcoal/15 bg-white px-1.5 font-mono text-xs uppercase focus:border-ph-purple focus:outline-none"
      />
    </span>
  );
}

function Swatches({ value, onPick }: { value: string | undefined; onPick: (v: string) => void }) {
  const colours = useContext(CourseColours);
  if (!colours.length) return null;
  return (
    <span className="mt-1.5 flex flex-wrap gap-1">
      {colours.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          onClick={() => onPick(c)}
          className={`h-5 w-5 rounded border ${
            value?.toUpperCase() === c
              ? 'border-ph-purple ring-2 ring-ph-purple/30'
              : 'border-ph-charcoal/20'
          }`}
          style={{ background: c }}
        />
      ))}
    </span>
  );
}

export function PaintField({
  label,
  fill,
  gradient,
  onChange,
}: {
  label: string;
  fill: string | undefined;
  gradient: Gradient | undefined;
  onChange: (fill: string | undefined, gradient: Gradient | undefined) => void;
}) {
  const colours = useContext(CourseColours);
  const start = (): Gradient => {
    const first = fill ?? colours[0] ?? '#702F8F';
    return {
      kind: 'linear',
      angle: 90,
      stops: [
        { colour: first, at: 0 },
        { colour: colours.find((c) => c !== first) ?? '#FFFFFF', at: 100 },
      ],
    };
  };
  return (
    <div className="flex flex-col gap-3">
      {!gradient && (
        <ColourField
          label={label}
          alpha
          value={fill}
          onChange={(v) => onChange(v, undefined)}
        />
      )}
      <Toggle
        label={gradient ? `${label}: gradient` : 'Use a gradient'}
        checked={!!gradient}
        onChange={(on) => {
          if (!on) return onChange(gradient?.stops[0].colour, undefined);
          const g = start();
          onChange(g.stops[0].colour, g);
        }}
      />
      {gradient && (
        <GradientFields value={gradient} onChange={(g) => onChange(g.stops[0].colour, g)} />
      )}
    </div>
  );
}

function GradientFields({ value, onChange }: { value: Gradient; onChange: (g: Gradient) => void }) {
  const setStop = (i: number, patch: Partial<Gradient['stops'][number]>) =>
    onChange({
      ...value,
      stops: value.stops.map((s, j) => (j === i ? { ...s, ...patch } : s)),
    });
  const addStop = () => {
    const last = value.stops[value.stops.length - 1];
    const before = value.stops[value.stops.length - 2];
    const at = Math.round((last.at + before.at) / 2);
    onChange({
      ...value,
      stops: [...value.stops.slice(0, -1), { colour: last.colour, at }, last],
    });
  };
  return (
    <div className="flex flex-col gap-2 rounded-md border border-ph-charcoal/10 p-2">
      <div
        className="h-6 rounded border border-ph-charcoal/15"
        style={{ background: gradientCss(value) }}
      />
      <div className="grid grid-cols-2 gap-x-2 gap-y-3">
        <Select
          label="Type"
          value={value.kind}
          options={[
            { value: 'linear', label: 'Straight' },
            { value: 'radial', label: 'Round' },
          ]}
          onChange={(kind) => onChange({ ...value, kind })}
        />
        {value.kind === 'linear' && (
          <Field label="Angle">
            <NumberBox
              min={0}
              max={359}
              step={15}
              value={value.angle}
              onChange={(angle) => onChange({ ...value, angle: ((angle % 360) + 360) % 360 })}
              className={inputClass}
            />
          </Field>
        )}
      </div>
      {value.stops.map((stop, i) => (
        <div key={i} className="flex flex-col gap-1 border-t border-ph-charcoal/10 pt-2">
          <span className="flex items-center gap-2">
            <ColourPicker value={stop.colour} onChange={(colour) => setStop(i, { colour })} />
            {value.stops.length > 2 && (
              <button
                type="button"
                title="Remove this colour"
                className="ml-auto text-ph-charcoal/50 hover:text-ph-charcoal"
                onClick={() =>
                  onChange({
                    ...value,
                    stops: value.stops.filter((_, j) => j !== i),
                  })
                }
              >
                <X size={16} />
              </button>
            )}
          </span>
          <label className="flex items-center gap-2 text-xs text-ph-charcoal/60">
            Position
            <input
              type="range"
              min={0}
              max={100}
              value={stop.at}
              onChange={(e) => setStop(i, { at: e.target.valueAsNumber })}
              className="flex-1 accent-ph-purple"
            />
            <span className="w-9 text-right tabular-nums">{stop.at}%</span>
          </label>
          <Swatches value={stop.colour} onPick={(colour) => setStop(i, { colour })} />
        </div>
      ))}
      <button
        type="button"
        className="self-start text-xs text-ph-purple underline underline-offset-2"
        onClick={addStop}
      >
        Add a colour
      </button>
    </div>
  );
}

const SHADOW: Shadow = {
  colour: '#000000',
  opacity: 0.25,
  x: 0,
  y: 4,
  blur: 12,
};

export function ShadowField({
  value,
  onChange,
}: {
  value: Shadow | undefined;
  onChange: (v: Shadow | undefined) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Toggle
        label="Drop shadow"
        checked={!!value}
        onChange={(on) => onChange(on ? SHADOW : undefined)}
      />
      {value && <ShadowFields value={value} onChange={onChange} />}
    </div>
  );
}

function ShadowFields({ value, onChange }: { value: Shadow; onChange: (v: Shadow) => void }) {
  const set = (patch: Partial<Shadow>) => onChange({ ...value, ...patch });
  const offset = (label: string, key: 'x' | 'y' | 'blur', min: number) => (
    <Field label={label}>
      <NumberBox
        min={min}
        value={value[key]}
        onChange={(n) => set({ [key]: Math.max(min, n) })}
        className={inputClass}
      />
    </Field>
  );
  return (
    <div className="flex flex-col gap-2 rounded-md border border-ph-charcoal/10 p-2">
      <Field label="Colour">
        <ColourPicker value={value.colour} onChange={(colour) => set({ colour })} />
      </Field>
      <div className="grid grid-cols-2 gap-x-2 gap-y-3">
        <Field label="Strength (%)">
          <NumberBox
            min={0}
            max={100}
            step={5}
            value={Math.round(value.opacity * 100)}
            onChange={(n) => set({ opacity: Math.min(100, Math.max(0, n)) / 100 })}
            className={inputClass}
          />
        </Field>
        {offset('Blur (px)', 'blur', 0)}
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-3">
        {offset('Across (px)', 'x', -100)}
        {offset('Down (px)', 'y', -100)}
      </div>
    </div>
  );
}

export function BorderField({
  value,
  onChange,
}: {
  value: Border | undefined;
  onChange: (v: Border | undefined) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-2 gap-y-3">
      <ColourField
        label="Border colour"
        value={value?.colour}
        onChange={(colour) => onChange(colour ? { colour, width: value?.width ?? 1 } : undefined)}
      />
      <Field label="Border width (px)">
        <NumberBox
          min={0}
          step={0.5}
          value={value?.width ?? 0}
          onChange={(n) =>
            onChange(n > 0 ? { colour: value?.colour ?? '#2f3030', width: n } : undefined)
          }
          className={inputClass}
        />
      </Field>
    </div>
  );
}

export function TextStyleFields({
  value,
  onChange,
  boldByDefault = false,
  emphasis = true,
  colour = true,
  align,
}: {
  value: TextStyle | undefined;
  boldByDefault?: boolean;
  emphasis?: boolean;
  colour?: boolean;
  align?: ReactNode;
  onChange: (s: TextStyle) => void;
}) {
  const fonts = useContext(FontOptions);
  const s = value ?? {};
  const set = (patch: Partial<TextStyle>) => onChange({ ...s, ...patch });
  const num = (v: string) => (v === '' ? undefined : Number(v));

  return (
    <>
      <h4 className={sectionClass}>
        Text style
      </h4>
      <div className="grid grid-cols-2 gap-x-2 gap-y-3">
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
        {colour && (
          <div className="col-span-2">
            <ColourField label="Colour" value={s.color} onChange={(color) => set({ color })} />
          </div>
        )}
        {emphasis && (
          <div className="col-span-2 flex flex-wrap gap-4">
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
        )}
        {align}
      </div>
    </>
  );
}
