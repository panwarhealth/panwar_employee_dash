import type { Block, ButtonAction, CheckBlock, Page } from '@/course/doc';
import { uid } from '@/course/doc';
import { MediaInput, RichText, Select, TextArea, TextInput, Toggle } from './fields';

const ALIGN = [
  { value: 'left' as const, label: 'Left' },
  { value: 'center' as const, label: 'Centre' },
];

export function BlockForm({
  block,
  pages,
  courseId,
  onChange,
}: {
  block: Block;
  pages: Page[];
  courseId: string;
  onChange: (update: (b: Block) => void) => void;
}) {
  const set = <B extends Block>(fn: (b: B) => void) => onChange((b) => fn(b as B));

  switch (block.type) {
    case 'heading':
      return (
        <>
          <TextInput
            label="Text"
            value={block.text}
            onChange={(v) => set<typeof block>((b) => (b.text = v))}
          />
          <Select
            label="Size"
            value={String(block.level) as '1' | '2'}
            options={[
              { value: '1', label: 'Large' },
              { value: '2', label: 'Small' },
            ]}
            onChange={(v) => set<typeof block>((b) => (b.level = v === '1' ? 1 : 2))}
          />
          <Select
            label="Align"
            value={block.align}
            options={ALIGN}
            onChange={(v) => set<typeof block>((b) => (b.align = v))}
          />
        </>
      );
    case 'text':
      return (
        <>
          <RichText
            key={block.id}
            label="Text"
            html={block.html}
            onChange={(v) => set<typeof block>((b) => (b.html = v))}
          />
          <Select
            label="Align"
            value={block.align}
            options={ALIGN}
            onChange={(v) => set<typeof block>((b) => (b.align = v))}
          />
        </>
      );
    case 'image':
      return (
        <>
          <MediaInput
            label="File"
            courseId={courseId}
            value={block.src}
            fileName={block.fileName}
            accept=".jpg,.jpeg,.png,.svg,.gif"
            onChange={(url, file) =>
              set<typeof block>((b) => {
                b.src = url;
                b.fileName = file.name;
              })
            }
          />
          <Select
            label="Size"
            value={block.size}
            options={[
              { value: 'full', label: 'Full width' },
              { value: 'medium', label: 'Medium' },
              { value: 'small', label: 'Small' },
            ]}
            onChange={(v) => set<typeof block>((b) => (b.size = v))}
          />
          <TextInput
            label="Alt text"
            value={block.alt}
            onChange={(v) => set<typeof block>((b) => (b.alt = v))}
          />
        </>
      );
    case 'video':
      return (
        <>
          <MediaInput
            label="Video (mp4)"
            courseId={courseId}
            value={block.src}
            fileName={block.fileName}
            accept=".mp4"
            onChange={(url, file) =>
              set<typeof block>((b) => {
                b.src = url;
                b.fileName = file.name;
              })
            }
          />
          <MediaInput
            label="Captions (vtt)"
            courseId={courseId}
            value={block.captions}
            fileName={block.captions ? 'Captions added' : ''}
            accept=".vtt"
            onChange={(url) => set<typeof block>((b) => (b.captions = url))}
          />
        </>
      );
    case 'embed':
      return (
        <TextInput
          label="Address"
          placeholder="https://www.youtube.com/watch?v=..."
          value={block.url}
          onChange={(v) => set<typeof block>((b) => (b.url = v))}
        />
      );
    case 'divider':
      return <p className="text-sm text-ph-charcoal/60">A thin line between blocks.</p>;
    case 'button':
      return (
        <>
          <TextInput
            label="Label"
            value={block.label}
            onChange={(v) => set<typeof block>((b) => (b.label = v))}
          />
          <ActionFields
            action={block.action}
            pages={pages}
            onChange={(a) => set<typeof block>((b) => (b.action = a))}
          />
          <Select
            label="Style"
            value={block.style}
            options={[
              { value: 'solid', label: 'Solid' },
              { value: 'outline', label: 'Outline' },
            ]}
            onChange={(v) => set<typeof block>((b) => (b.style = v))}
          />
        </>
      );
    case 'check':
      return <CheckForm block={block} onChange={(fn) => set<CheckBlock>(fn)} />;
  }
}

function ActionFields({
  action,
  pages,
  onChange,
}: {
  action: ButtonAction;
  pages: Page[];
  onChange: (a: ButtonAction) => void;
}) {
  return (
    <>
      <Select
        label="When clicked"
        value={action.kind}
        options={[
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
                : { kind: 'next' },
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

function CheckForm({
  block,
  onChange,
}: {
  block: CheckBlock;
  onChange: (fn: (b: CheckBlock) => void) => void;
}) {
  const kind = block.multiple ? 'multiple' : 'single';
  return (
    <>
      <TextArea
        label="Question"
        value={block.question}
        onChange={(v) => onChange((b) => (b.question = v))}
      />
      <Select
        label="Type"
        value={kind}
        options={[
          { value: 'single', label: 'One correct answer' },
          { value: 'multiple', label: 'Select all that apply' },
        ]}
        onChange={(v) =>
          onChange((b) => {
            b.multiple = v === 'multiple';
            if (!b.multiple) {
              const first = b.options.findIndex((o) => o.correct);
              b.options.forEach((o, i) => (o.correct = i === Math.max(0, first)));
            }
          })
        }
      />
      <div>
        <span className="mb-1 block text-xs font-semibold text-ph-charcoal/60">
          Answers (tick the correct {block.multiple ? 'ones' : 'one'})
        </span>
        <div className="flex flex-col gap-1.5">
          {block.options.map((o, i) => (
            <div key={o.id} className="flex items-center gap-2">
              <input
                type={block.multiple ? 'checkbox' : 'radio'}
                className="h-4 w-4 shrink-0 accent-green-700"
                checked={o.correct}
                onChange={(e) =>
                  onChange((b) => {
                    if (b.multiple) b.options[i].correct = e.target.checked;
                    else b.options.forEach((x, j) => (x.correct = j === i));
                  })
                }
              />
              <input
                className="min-w-0 flex-1 rounded-md border-[1.5px] border-ph-charcoal/15 bg-white px-2.5 py-1.5 text-sm focus:border-ph-purple focus:outline-none"
                value={o.text}
                onChange={(e) => onChange((b) => (b.options[i].text = e.target.value))}
              />
              {block.options.length > 2 && (
                <button
                  type="button"
                  title="Remove answer"
                  className="text-ph-charcoal/40 hover:text-red-600"
                  onClick={() => onChange((b) => b.options.splice(i, 1))}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-4">
          <button
            type="button"
            className="text-sm text-ph-charcoal/60 underline underline-offset-4 hover:text-ph-purple"
            onClick={() =>
              onChange((b) =>
                b.options.push({
                  id: uid(),
                  text: 'Another answer',
                  correct: false,
                }),
              )
            }
          >
            + Add answer
          </button>
          <button
            type="button"
            className="text-sm text-ph-charcoal/60 underline underline-offset-4 hover:text-ph-purple"
            onClick={() =>
              onChange((b) => {
                b.multiple = false;
                b.options = [
                  { id: uid(), text: 'True', correct: true },
                  { id: uid(), text: 'False', correct: false },
                ];
                b.shuffle = false;
              })
            }
          >
            Make true or false
          </button>
        </div>
      </div>
      <Toggle
        label="Shuffle answers"
        checked={block.shuffle}
        onChange={(v) => onChange((b) => (b.shuffle = v))}
      />
      <TextInput
        label="Feedback when correct"
        value={block.feedbackCorrect}
        onChange={(v) => onChange((b) => (b.feedbackCorrect = v))}
      />
      <TextInput
        label="Feedback when wrong"
        value={block.feedbackWrong}
        onChange={(v) => onChange((b) => (b.feedbackWrong = v))}
      />
      <Toggle
        label="Must get it right before continuing"
        checked={block.required}
        onChange={(v) => onChange((b) => (b.required = v))}
      />
      <Toggle
        label="Counts toward the pass mark"
        checked={block.scored}
        onChange={(v) => onChange((b) => (b.scored = v))}
      />
    </>
  );
}
