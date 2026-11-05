import {
  hasPicks,
  linkedPages,
  NO_INTERACTION,
  pickIds,
  type Block,
  type ButtonBlock,
  type Condition,
  type CourseDoc,
  type Interaction,
  type Page,
  type PickRule,
} from '@/course/doc';
import { ConditionsEditor } from './ConditionsEditor';
import { sectionClass, Select, TextInput, Toggle } from './fields';
import { HOVER_LOOKS, VISITED_LOOKS } from './interactionLooks';


export type EnabledWhen = NonNullable<ButtonBlock['enabledWhen']>;

export function InteractionFields({
  doc,
  block,
  page,
  onChange,
  onEnabledWhen,
}: {
  doc: CourseDoc;
  block: Block;
  page: Page;
  onChange: (i: Interaction) => void;
  onEnabledWhen: (when: EnabledWhen, conditions: Condition[]) => void;
}) {
  const i = block.interact ?? NO_INTERACTION;
  const set = (patch: Partial<Interaction>) => onChange({ ...i, ...patch });
  const pickable = pickIds(page).includes(block.id);

  return (
    <>
      <h4 className={sectionClass}>States</h4>
      <Select label="On hover" value={i.hover} options={HOVER_LOOKS} onChange={(hover) => set({ hover })} />
      {pickable && (
        <>
          <Select
            label="When picked"
            value={i.picked}
            options={[
              { value: 'tick', label: 'Green border and tick' },
              { value: 'glow', label: 'Glow' },
              { value: 'dim', label: 'Dim the others' },
              { value: 'none', label: 'None' },
            ]}
            onChange={(picked) => set({ picked })}
          />
          <Toggle
            label="This is a correct pick"
            checked={i.correct}
            onChange={(correct) => set({ correct })}
          />
        </>
      )}
      <Select
        label="When visited"
        value={i.visited}
        options={VISITED_LOOKS}
        onChange={(visited) => set({ visited })}
      />
      {block.type === 'button' && (
        <>
          <Select
            label="Enabled when"
            value={block.enabledWhen ?? 'always'}
            options={[
              { value: 'always', label: 'Always' },
              ...(hasPicks(page)
                ? [{ value: 'picks' as const, label: 'All correct picks are made' }]
                : []),
              ...(linkedPages(page).length
                ? [{ value: 'visited' as const, label: 'All linked pages are visited' }]
                : []),
              { value: 'condition', label: 'A condition is true' },
            ]}
            onChange={(v) => onEnabledWhen(v, block.enabledIf ?? [])}
          />
          {block.enabledWhen === 'condition' && (
            <ConditionsEditor
              doc={doc}
              conditions={block.enabledIf ?? []}
              onChange={(c) => onEnabledWhen('condition', c)}
            />
          )}
        </>
      )}
    </>
  );
}

export function PickRuleFields({
  rule,
  correctCount,
  onChange,
}: {
  rule: PickRule;
  correctCount: number;
  onChange: (r: PickRule) => void;
}) {
  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-ph-charcoal/10 pt-4">
      <h4 className={sectionClass}>Pick rule for this page</h4>
      <TextInput
        label={`Correct picks needed (blank = all ${correctCount} correct ones)`}
        value={rule.needed === null ? '' : String(rule.needed)}
        onChange={(v) => {
          const n = parseInt(v, 10);
          onChange({ ...rule, needed: Number.isFinite(n) && n > 0 ? n : null });
        }}
      />
      <TextInput
        label="Feedback when correct"
        value={rule.feedbackCorrect}
        onChange={(feedbackCorrect) => onChange({ ...rule, feedbackCorrect })}
      />
      <TextInput
        label="Feedback when wrong"
        value={rule.feedbackWrong}
        onChange={(feedbackWrong) => onChange({ ...rule, feedbackWrong })}
      />
      <Select
        label="Show feedback as"
        value={rule.showAs}
        options={[
          { value: 'popup', label: 'Pop-up over the canvas' },
          { value: 'text', label: 'Text under the canvas' },
        ]}
        onChange={(showAs) => onChange({ ...rule, showAs })}
      />
      <Toggle
        label="Must get it right before continuing"
        checked={rule.required}
        onChange={(required) => onChange({ ...rule, required })}
      />
    </div>
  );
}
