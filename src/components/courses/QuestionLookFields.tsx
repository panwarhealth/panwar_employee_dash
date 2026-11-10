import { isQuestion, type LookedBlock, type QuestionLook } from '@/course/doc';
import { Field, inputClass, NumberBox, PaddingField, Select, Toggle } from './fields';
import { BUTTON_MARGIN } from '@/course/typography';
import { ColourField } from './TextStyleFields';

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

const heading = 'mt-2 text-[11px] font-semibold uppercase tracking-wider text-ph-charcoal/50';

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
  const items = ITEMS[kind];
  const pills = kind === 'check' || kind === 'pathway';
  const row = block.type === 'check' && block.options.every((o) => o.text.length <= 20);
  const button = graded
    ? block.submitLabel || 'Submit'
    : kind === 'results'
      ? 'Try again'
      : kind === 'popup'
        ? 'pop-up'
        : null;
  const boxed = BOXED.has(kind);
  const box = kind === 'popup' ? 'Pop-up window' : kind === 'hotspots' ? null : 'Box';
  return (
    <>
      <h4 className={heading}>Look</h4>
      <ColourField
        label={kind === 'hotspots' ? 'Pin colour' : 'Main colour'}
        value={look.colour}
        onChange={(colour) => set({ colour })}
      />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Text size (px)">
          <NumberBox
            min={10}
            value={look.size ?? 16}
            onChange={(size) => set({ size: Math.max(10, size) })}
            className={inputClass}
          />
        </Field>
        <Field label="Corners (px)">
          <NumberBox
            min={0}
            value={look.radius ?? CORNERS[kind] ?? 4}
            onChange={(radius) => set({ radius: Math.max(0, radius) })}
            className={inputClass}
          />
        </Field>
      </div>
      <ColourField
        label="Text colour"
        value={look.textColour}
        onChange={(textColour) => set({ textColour })}
      />

      {items && (
        <>
          <h4 className={heading}>{items[0].toUpperCase() + items.slice(1)}</h4>
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
          {kind !== 'hotspots' && (
            <div className="grid grid-cols-2 gap-2">
              <Select
                label="Text align"
                value={
                  look.answerAlign ??
                  (CENTRED.has(kind) || (pills && look.answers === 'buttons' && !row) ? 'center' : 'left')
                }
                options={[...SIDES]}
                onChange={(answerAlign) => set({ answerAlign })}
              />
              {GAP[kind] !== undefined && (
                <Field label="Gap between (px)">
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
          {PADDING[kind] && (
            <PaddingField
              label={`Padding inside the ${items} (px)`}
              value={look.answerPadding ?? PADDING[kind]!}
              onChange={(answerPadding) => set({ answerPadding })}
            />
          )}
          <ColourField
            label="Background"
            value={look.answerFill}
            onChange={(answerFill) => set({ answerFill })}
          />
          <ColourField
            label="Border colour"
            value={look.answerBorder}
            onChange={(answerBorder) => set({ answerBorder })}
          />
          <ColourField
            label="Text colour"
            value={look.answerText}
            onChange={(answerText) => set({ answerText })}
          />
        </>
      )}

      {button && (
        <>
          <h4 className={heading}>{`${button[0].toUpperCase()}${button.slice(1)} button`}</h4>
          {kind !== 'popup' && (
            <>
              <Select
                label="Position"
                value={look.submitAlign ?? (kind === 'results' ? 'center' : 'left')}
                options={[...SIDES]}
                onChange={(submitAlign) => set({ submitAlign })}
              />
              <PaddingField
                label="Space around the button (px)"
                value={look.buttonMargin ?? (graded ? BUTTON_MARGIN : [0, 0, 0, 0])}
                onChange={(buttonMargin) => set({ buttonMargin })}
              />
            </>
          )}
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
        </>
      )}

      {box && (
        <>
          <h4 className={heading}>{box}</h4>
          {kind !== 'popup' && (
            <Toggle
              label="Outline"
              checked={boxed ? look.card !== false : !!look.card}
              onChange={(card) => set({ card })}
            />
          )}
          <ColourField
            label="Background"
            value={look.fill}
            onChange={(fill) => set({ fill })}
          />
          <PaddingField
            label="Padding (px)"
            value={
              look.boxPadding ??
              (kind === 'popup'
                ? [26, 26, 26, 26]
                : (boxed ? look.card !== false : look.card)
                  ? [16, 16, 16, 16]
                  : [0, 0, 0, 0])
            }
            onChange={(boxPadding) => set({ boxPadding })}
          />
        </>
      )}
    </>
  );
}
