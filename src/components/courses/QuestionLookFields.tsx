import { useContext, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { isQuestion, type LookedBlock, type QuestionLook, type TextStyle } from '@/course/doc';
import { Field, inputClass, NumberBox, PaddingField, Select, Toggle } from './fields';
import { BUTTON_MARGIN } from '@/course/typography';
import { ColourField, TextStyleFields } from './TextStyleFields';
import { FontOptions } from './fontContext';
import { readFlag, saveFlag } from './flags';

type Kind = LookedBlock['type'];

const ITEMS: Partial<Record<Kind, string>> = {
  check: 'answers',
  pathway: 'choices',
  drag: 'tiles',
  match: 'rows',
  blank: 'blanks',
  written: 'answer box',
  likert: 'options',
  accordion: 'headings',
  tabs: 'tabs',
  flip: 'cards',
  hotspots: 'pins',
};

const GAP: Partial<Record<Kind, number>> = {
  check: 8,
  pathway: 8,
  drag: 8,
  match: 8,
  likert: 6,
  accordion: 0,
  tabs: 4,
  flip: 12,
};

const PADDING: Partial<Record<Kind, [number, number, number, number]>> = {
  check: [10, 14, 10, 14],
  pathway: [10, 14, 10, 14],
  drag: [5, 13, 5, 13],
  match: [6, 10, 6, 10],
  blank: [0, 6, 0, 6],
  written: [10, 13, 10, 13],
  likert: [8, 5, 8, 5],
  accordion: [10, 3, 10, 3],
  tabs: [0, 16, 0, 16],
  flip: [13, 13, 13, 13],
};

const CENTRED = new Set<Kind>(['blank', 'likert', 'flip']);
const BOXED = new Set<Kind>(['check', 'drag', 'match', 'blank', 'slider', 'written', 'likert', 'pathway']);
const CORNERS: Partial<Record<Kind, number>> = { tabs: 0, flip: 6 };

const SIDES = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Centre' },
  { value: 'right', label: 'Right' },
] as const;

export function Section({ title, children }: { title: string; children: ReactNode }) {
  const key = `course-look-closed:${title}`;
  const [open, setOpen] = useState(() => !readFlag(key));
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => {
          saveFlag(key, open);
          setOpen(!open);
        }}
        className="mt-2 flex items-center gap-1 text-left text-[11px] font-semibold uppercase tracking-wider text-ph-charcoal/50 hover:text-ph-purple"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {title}
      </button>
      {open && children}
    </div>
  );
}

export function PartText({
  label,
  value,
  size,
  colour,
  bold = false,
  onChange,
}: {
  label: string;
  value: TextStyle | undefined;
  size: number;
  colour?: string;
  bold?: boolean;
  onChange: (style: TextStyle) => void;
}) {
  const [open, setOpen] = useState(false);
  const fonts = useContext(FontOptions);
  const font = fonts.find((f) => f.id === (value?.font ?? 'course'))?.label;
  const ink = value?.color ?? colour;
  const heavy = value?.weight ? value.weight === 700 : bold;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-ph-charcoal/10 bg-white p-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-left text-xs text-ph-charcoal"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="font-bold">{label}</span>
        {!open && (
          <span className="ml-auto flex min-w-0 items-center gap-1.5 text-ph-charcoal/60">
            <span className="truncate">
              {[font, `${value?.size ?? size}px`, heavy && 'bold'].filter(Boolean).join(', ')}
            </span>
            {ink && (
              <span
                className="h-3 w-3 shrink-0 rounded-full border border-ph-charcoal/20"
                style={{ background: ink }}
              />
            )}
          </span>
        )}
      </button>
      {open && (
        <TextStyleFields
          title={null}
          freeSize
          value={{ ...value, size: value?.size ?? size, color: value?.color ?? colour }}
          boldByDefault={bold}
          onChange={onChange}
        />
      )}
    </div>
  );
}

export function QuestionTextFields<
  B extends { type: string; look?: QuestionLook; multiple?: boolean; mode?: string },
>({ block, set }: { block: B; set: (fn: (b: B) => void) => void }) {
  const hint =
    (block.type === 'check' && block.multiple) ||
    block.type === 'drag' ||
    (block.type === 'match' && block.mode === 'drag');
  const put = (patch: Partial<QuestionLook>) => set((b) => (b.look = { ...b.look, ...patch }));
  const base = block.look?.size ?? 16;
  const ink = block.look?.textColour;
  return (
    <Section title="Question text">
      <PartText
        label="Question text"
        bold
        size={Math.round((base * 17) / 16)}
        colour={ink}
        value={block.look?.questionStyle}
        onChange={(questionStyle) => put({ questionStyle })}
      />
      {hint && (
        <PartText
          label="Hint text"
          size={Math.round(base * 0.875)}
          colour={ink}
          value={block.look?.hintStyle}
          onChange={(hintStyle) => put({ hintStyle })}
        />
      )}
      <Field label="Space under the question (px)">
        <NumberBox
          min={0}
          value={block.look?.questionGap ?? 10}
          onChange={(n) => put({ questionGap: Math.max(0, n) })}
          className={inputClass}
        />
      </Field>
    </Section>
  );
}

const LABELS: Partial<Record<Kind, string>> = {
  drag: 'Group and slot labels',
  match: 'Left side text',
  likert: 'Statements text',
};

const BODY: Partial<Record<Kind, string>> = {
  blank: 'Sentence text',
  accordion: 'Panel text',
  tabs: 'Panel text',
  flip: 'Back of card text',
};

const BOLD_ITEMS = new Set<Kind>(['drag', 'accordion', 'tabs', 'flip', 'hotspots']);
const QUESTIONED = new Set<Kind>([
  'check',
  'drag',
  'match',
  'blank',
  'slider',
  'written',
  'likert',
  'pathway',
]);

export function QuestionLookFields({
  block,
  onChange,
}: {
  block: LookedBlock;
  onChange: (look: QuestionLook) => void;
}) {
  const look = block.look ?? {};
  const set = (patch: Partial<QuestionLook>) => onChange({ ...look, ...patch });
  const kind = block.type;
  const graded = isQuestion(block);
  const items = block.type === 'match' && block.mode === 'drag' ? 'tiles' : ITEMS[kind];
  const pills = kind === 'check' || kind === 'pathway';
  const cols = block.type === 'check' ? look.answerColumns : undefined;
  const grid = block.type === 'match' && block.mode === 'grid';
  const tray =
    (block.type === 'drag' && block.style !== 'order') ||
    (block.type === 'match' && block.mode === 'drag');
  const row =
    grid ||
    tray ||
    (block.type === 'check' && (!!cols || block.options.every((o) => o.text.length <= 20)));
  const written = block.type === 'written' && block.submit !== false;
  const button = graded
    ? block.submitLabel || 'Submit'
    : written
      ? block.submitLabel || 'Submit'
      : kind === 'results'
      ? 'Try again'
      : null;
  const align =
    look.answerAlign ??
    (CENTRED.has(kind) || (pills && look.answers === 'buttons' && !row) ? 'center' : 'left');
  const boxed = BOXED.has(kind);
  const base = look.size ?? 16;
  const ink = look.textColour;
  const labels = grid
    ? 'Row labels'
    : block.type === 'drag' && block.style === 'order'
      ? 'Numbers'
    : block.type !== 'match' || block.mode === 'drag'
      ? LABELS[kind]
      : undefined;
  const box = kind === 'hotspots' ? null : 'Border';
  return (
    <>
      <Section title="Colour and corners">
        <ColourField
          label={kind === 'hotspots' ? 'Pin colour' : 'Main colour'}
          value={look.colour}
          onChange={(colour) => set({ colour })}
        />
        <Field label="Answer and button corners (px)">
          <NumberBox
            min={0}
            value={look.radius ?? CORNERS[kind] ?? 4}
            onChange={(radius) => set({ radius: Math.max(0, radius) })}
            className={inputClass}
          />
        </Field>
      </Section>

      {QUESTIONED.has(kind) && (
        <QuestionTextFields
          block={block}
          set={(fn) => {
            const copy = { ...block, look: { ...look } };
            fn(copy);
            onChange(copy.look);
          }}
        />
      )}

      {items && (
        <Section title={items[0].toUpperCase() + items.slice(1)}>
          {pills && (
            <Select
              label="Style"
              value={look.answers ?? 'list'}
              options={[
                { value: 'list', label: kind === 'check' ? 'List with tick boxes' : 'List' },
                { value: 'buttons', label: 'Buttons' },
              ]}
              onChange={(answers) => set({ answers })}
            />
          )}
          {block.type === 'drag' && block.style === 'targets' && (
            <Toggle
              label="Tiles and button beside the image"
              checked={!!look.beside}
              onChange={(beside) => set({ beside: beside || undefined })}
            />
          )}
          {block.type === 'drag' && block.style === 'targets' && look.beside && (
            <Field label="Image width (%)">
              <NumberBox
                min={30}
                max={85}
                value={look.besideImage ?? 60}
                onChange={(n) => set({ besideImage: Math.min(85, Math.max(30, n)) })}
                className={inputClass}
              />
            </Field>
          )}
          {kind === 'check' && (
            <Select
              label="Columns"
              value={cols ? String(cols) : 'auto'}
              options={[
                { value: 'auto', label: 'Automatic (wrap to fit)' },
                ...[1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: String(n) })),
              ]}
              onChange={(v) => set({ answerColumns: v === 'auto' ? undefined : Number(v) })}
            />
          )}
          <PartText
            label={grid ? 'Column headings' : `${items[0].toUpperCase()}${items.slice(1)} text`}
            bold={BOLD_ITEMS.has(kind) || (pills && look.answers === 'buttons')}
            size={Math.round(base * (kind === 'likert' ? 0.85 : kind === 'hotspots' ? 0.9 : 1))}
            colour={look.answerText}
            value={look.answerStyle}
            onChange={(answerStyle) => set({ answerStyle, answerText: undefined })}
          />
          {labels && (
            <PartText
              label={labels}
              bold={kind === 'likert'}
              size={Math.round(base * (kind === 'likert' ? 1 : 0.85))}
              colour={ink}
              value={look.labelStyle}
              onChange={(labelStyle) => set({ labelStyle })}
            />
          )}
          {(BODY[kind] || (block.type === 'match' && block.table)) && (
            <PartText
              label={BODY[kind] ?? 'Heading row text'}
              size={base}
              colour={ink}
              value={look.bodyStyle}
              onChange={(bodyStyle) => set({ bodyStyle })}
            />
          )}
          <ColourField
            label={`${items[0].toUpperCase()}${items.slice(1)} background`}
            value={look.answerFill}
            onChange={(answerFill) => set({ answerFill })}
          />
          <ColourField
            label={`${items[0].toUpperCase()}${items.slice(1)} border colour`}
            value={look.answerBorder}
            onChange={(answerBorder) => set({ answerBorder })}
          />
          {tray && (
            <ColourField
              label="Background behind the tiles"
              value={look.bankFill}
              onChange={(bankFill) => set({ bankFill })}
            />
          )}
          {kind !== 'hotspots' && (
            <div className="grid grid-cols-2 gap-2">
              <Select
                label="Text align"
                value={align}
                options={[...SIDES]}
                onChange={(answerAlign) => set({ answerAlign })}
              />
              {pills && (
                <Select
                  label="Inside each"
                  value={look.answerInside ?? align}
                  options={[...SIDES]}
                  onChange={(answerInside) => set({ answerInside })}
                />
              )}
              {GAP[kind] !== undefined && cols !== 1 && (
                <Field label={row ? 'Gap across (px)' : 'Gap between (px)'}>
                  <NumberBox
                    min={0}
                    value={look.answerGap ?? GAP[kind]!}
                    onChange={(answerGap) => set({ answerGap: Math.max(0, answerGap) })}
                    className={inputClass}
                  />
                </Field>
              )}
            </div>
          )}
          {row && (
            <Field label="Gap between rows (px)">
              <NumberBox
                min={0}
                value={look.answerRowGap ?? look.answerGap ?? GAP[kind]!}
                onChange={(answerRowGap) => set({ answerRowGap: Math.max(0, answerRowGap) })}
                className={inputClass}
              />
            </Field>
          )}
          {PADDING[kind] && !grid && (
            <PaddingField
              label={`Padding inside the ${items} (px)`}
              value={look.answerPadding ?? PADDING[kind]!}
              onChange={(answerPadding) => set({ answerPadding })}
            />
          )}
        </Section>
      )}

      {kind === 'slider' && (
        <Section title="Number">
          <PartText
            label="Number text"
            bold
            size={base * 2}
            value={look.answerStyle}
            onChange={(answerStyle) => set({ answerStyle })}
          />
          <PartText
            label="End labels text"
            size={Math.round(base * 0.85)}
            colour={ink}
            value={look.labelStyle}
            onChange={(labelStyle) => set({ labelStyle })}
          />
        </Section>
      )}

      {kind === 'results' && (
        <Section title="Text">
          <PartText
            label="Score text"
            bold
            size={base * 3}
            value={look.questionStyle}
            onChange={(questionStyle) => set({ questionStyle })}
          />
          <PartText
            label="Pass mark text"
            size={Math.round(base * 0.875)}
            colour={ink}
            value={look.hintStyle}
            onChange={(hintStyle) => set({ hintStyle })}
          />
          <PartText
            label="Message text"
            size={base}
            colour={ink}
            value={look.bodyStyle}
            onChange={(bodyStyle) => set({ bodyStyle })}
          />
          <PartText
            label="Review list text"
            size={base}
            colour={ink}
            value={look.labelStyle}
            onChange={(labelStyle) => set({ labelStyle })}
          />
        </Section>
      )}

      {kind === 'hotspots' && (
        <Section title="Pop-up text">
          <PartText
            label="Title text"
            bold
            size={Math.round((base * 17) / 16)}
            colour={ink}
            value={look.questionStyle}
            onChange={(questionStyle) => set({ questionStyle })}
          />
          <PartText
            label="Body text"
            size={base}
            colour={ink}
            value={look.bodyStyle}
            onChange={(bodyStyle) => set({ bodyStyle })}
          />
        </Section>
      )}

      {button && (
        <Section title={`${button[0].toUpperCase()}${button.slice(1)} button`}>
          <PartText
            label="Button text"
            bold
            size={base}
            value={look.buttonStyle}
            onChange={(buttonStyle) => set({ buttonStyle })}
          />
          <Select
            label="Position"
            value={look.submitAlign ?? (kind === 'results' ? 'center' : 'left')}
            options={[...SIDES]}
            onChange={(submitAlign) => set({ submitAlign })}
          />
          {graded && (
            <Select
              label="Feedback"
              value={look.feedback ?? 'under'}
              options={[
                { value: 'under', label: 'Under the question' },
                { value: 'popup', label: 'In a pop-up over the page' },
              ]}
              onChange={(feedback) => set({ feedback })}
            />
          )}
          {(graded || (written && block.modelAnswer)) && (
            <PartText
              label={graded ? 'Feedback text' : 'Model answer text'}
              size={base}
              value={look.feedbackStyle}
              onChange={(feedbackStyle) => set({ feedbackStyle })}
            />
          )}
          <PaddingField
            label="Space around the button (px)"
            value={look.buttonMargin ?? (graded || written ? BUTTON_MARGIN : [0, 0, 0, 0])}
            onChange={(buttonMargin) => set({ buttonMargin })}
          />
        </Section>
      )}

      {box && (
        <Section title={box}>
          <Toggle
            label="Outline"
            checked={boxed ? look.card !== false : !!look.card}
            onChange={(card) => set({ card })}
          />
          <ColourField
            label="Border colour"
            value={look.boxBorder}
            onChange={(boxBorder) => set({ boxBorder })}
          />
          <Field label="Thickness (px)">
            <NumberBox
              min={0}
              value={look.boxBorderWidth ?? 1}
              onChange={(n) => set({ boxBorderWidth: Math.max(0, n) })}
              className={inputClass}
            />
          </Field>
          <Field label="Corners (px)">
            <NumberBox
              min={0}
              value={look.boxRadius ?? 6}
              onChange={(boxRadius) => set({ boxRadius: Math.max(0, boxRadius) })}
              className={inputClass}
            />
          </Field>
          <ColourField
            label="Background"
            value={look.fill}
            onChange={(fill) => set({ fill })}
          />
          <PaddingField
            label="Space inside the border (px)"
            value={
              look.boxPadding ??
              ((boxed ? look.card !== false : look.card) ? [16, 16, 16, 16] : [0, 0, 0, 0])
            }
            onChange={(boxPadding) => set({ boxPadding })}
          />
        </Section>
      )}
    </>
  );
}
