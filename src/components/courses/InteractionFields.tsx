import {
  NO_INTERACTION,
  type Block,
  type ClickAction,
  type Interaction,
  type Page,
  type PickRule,
} from '@/course/doc';
import { Select, TextInput, Toggle } from './fields';

const sectionClass = 'mt-1 text-[11px] font-semibold uppercase tracking-wider text-ph-charcoal/50';

export function InteractionFields({
  block,
  pages,
  pagePicks,
  onChange,
  onEnabledWhen,
}: {
  block: Block;
  pages: Page[];
  pagePicks: boolean;
  onChange: (i: Interaction) => void;
  onEnabledWhen: (v: 'always' | 'picks') => void;
}) {
  const i = block.interact ?? NO_INTERACTION;
  const set = (patch: Partial<Interaction>) => onChange({ ...i, ...patch });
  const picks = i.onClick.kind === 'pick';

  return (
    <>
      <h4 className={sectionClass}>States</h4>
      <Select
        label="On hover"
        value={i.hover}
        options={[
          { value: 'none', label: 'None' },
          { value: 'scale', label: 'Scale up 105%' },
          { value: 'glow', label: 'Glow' },
          { value: 'lift', label: 'Lift with shadow' },
          { value: 'border', label: 'Border colour' },
        ]}
        onChange={(hover) => set({ hover })}
      />
      {picks && (
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
      )}
      {block.type !== 'button' && (
        <Select
          label="When visited"
          value={i.visited}
          options={[
            { value: 'none', label: 'No change' },
            { value: 'fade', label: 'Fade to 60%' },
          ]}
          onChange={(visited) => set({ visited })}
        />
      )}

      {block.type === 'button' ? (
        pagePicks && (
          <Select
            label="Enabled when"
            value={block.enabledWhen ?? 'always'}
            options={[
              { value: 'always', label: 'Always' },
              { value: 'picks', label: 'All correct picks are made' },
            ]}
            onChange={onEnabledWhen}
          />
        )
      ) : (
        <>
          <h4 className={sectionClass}>On click</h4>
          <ClickFields
            action={i.onClick}
            pages={pages}
            onChange={(onClick) =>
              set(
                onClick.kind === 'pick' && i.picked === 'none'
                  ? { onClick, picked: 'tick' }
                  : { onClick },
              )
            }
          />
          {picks && (
            <Toggle
              label="This is a correct pick"
              checked={i.correct}
              onChange={(correct) => set({ correct })}
            />
          )}
        </>
      )}
    </>
  );
}

function ClickFields({
  action,
  pages,
  onChange,
}: {
  action: ClickAction;
  pages: Page[];
  onChange: (a: ClickAction) => void;
}) {
  return (
    <>
      <Select
        label="Action"
        value={action.kind}
        options={[
          { value: 'none', label: 'Nothing' },
          { value: 'pick', label: 'Mark as a pick' },
          { value: 'next', label: 'Go to next page' },
          { value: 'page', label: 'Go to a page...' },
          { value: 'link', label: 'Open a link' },
        ]}
        onChange={(k) =>
          onChange(
            k === 'page'
              ? { kind: 'page', pageId: pages[0]?.id ?? '' }
              : k === 'link'
                ? { kind: 'link', url: '' }
                : { kind: k },
          )
        }
      />
      {action.kind === 'page' && (
        <Select
          label="Page"
          value={action.pageId}
          options={pages.map((p, i) => ({
            value: p.id,
            label: `${i + 1}. ${p.title || 'Untitled'}`,
          }))}
          onChange={(pageId) => onChange({ kind: 'page', pageId })}
        />
      )}
      {action.kind === 'link' && (
        <TextInput
          label="Link"
          placeholder="https://"
          value={action.url}
          onChange={(url) => onChange({ kind: 'link', url })}
        />
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
