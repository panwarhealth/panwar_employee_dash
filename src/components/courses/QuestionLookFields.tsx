import type { GradedBlock, Layout, QuestionLook } from '@/course/doc';
import { Field, inputClass, NumberBox, PaddingField, Select, Toggle } from './fields';
import { ColourField } from './TextStyleFields';


export function QuestionLookFields({
  block,
  layout,
  onChange,
}: {
  block: GradedBlock;
  layout: Layout;
  onChange: (look: QuestionLook) => void;
}) {
  const look = block.look ?? {};
  const set = (patch: Partial<QuestionLook>) => onChange({ ...look, ...patch });
  const button = block.submitLabel || 'Submit';
  return (
    <>
      <h4 className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-ph-charcoal/50">
        Look
      </h4>
      <ColourField
        label="Button colour"
        value={look.colour}
        onChange={(colour) => set({ colour })}
      />
      {block.type === 'check' && (
        <Select
          label="Answers"
          value={look.answers ?? 'list'}
          options={[
            { value: 'list', label: 'List with tick boxes' },
            { value: 'buttons', label: 'Buttons' },
          ]}
          onChange={(answers) => set({ answers })}
        />
      )}
      <Field label="Text size (px)">
        <NumberBox
          min={10}
          value={look.size ?? 16}
          onChange={(size) => set({ size: Math.max(10, size) })}
          className={inputClass}
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Button corners (px)">
          <NumberBox
            min={0}
            value={look.radius ?? 4}
            onChange={(radius) => set({ radius: Math.max(0, radius) })}
            className={inputClass}
          />
        </Field>
        <Select
          label={`${button} button`}
          value={look.submitAlign ?? 'left'}
          options={[
            { value: 'left', label: 'Left' },
            { value: 'center', label: 'Centre' },
            { value: 'right', label: 'Right' },
          ]}
          onChange={(submitAlign) => set({ submitAlign })}
        />
      </div>
      <PaddingField
        label={`${button} button padding (px)`}
        value={look.buttonPadding ?? (layout === 'phone' ? [8, 18, 8, 18] : [10, 24, 10, 24])}
        onChange={(buttonPadding) => set({ buttonPadding })}
      />
      <Select
        label="Feedback"
        value={look.feedback ?? 'under'}
        options={[
          { value: 'under', label: 'Under the question' },
          { value: 'popup', label: 'In a pop-up over the page' },
        ]}
        onChange={(feedback) => set({ feedback })}
      />
      <Toggle
        label="Box around the question"
        checked={look.card !== false}
        onChange={(card) => set({ card })}
      />
    </>
  );
}
