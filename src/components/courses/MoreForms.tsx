import type { ReactNode } from 'react';
import {
  uid,
  type AccordionBlock,
  type AnimationBlock,
  type AudioBlock,
  type BlankBlock,
  type CourseDoc,
  type DragBlock,
  type FlipBlock,
  type HotspotBlock,
  type LikertBlock,
  type MatchBlock,
  type Page,
  type Panel,
  type PathwayBlock,
  type PopupBlock,
  type QuestionBase,
  type ResultsBlock,
  type ScrollBlock,
  type SliderBlock,
  type TabsBlock,
  type WrittenBlock,
} from '@/course/doc';
import { blockLabel } from './blockMeta';
import { Field, MediaInput, NumberBox, Select, TextArea, TextInput, Toggle } from './fields';
import { RichText } from './RichText';
import { TextStyleFields } from './TextStyleFields';

type Edit<B> = (fn: (b: B) => void) => void;

const linkClass = 'text-sm text-ph-charcoal/60 underline underline-offset-4 hover:text-ph-purple';
const numClass =
  'w-full rounded-md border-[1.5px] border-ph-charcoal/15 bg-white px-2.5 py-1.5 text-sm focus:border-ph-purple focus:outline-none';

function ListEditor<T extends { id: string }>({
  label,
  items,
  min = 1,
  addLabel,
  onAdd,
  onRemove,
  children,
}: {
  label: string;
  items: T[];
  min?: number;
  addLabel: string;
  onAdd: () => void;
  onRemove: (index: number) => void;
  children: (item: T, index: number) => ReactNode;
}) {
  return (
    <div>
      <span className="mb-1 block text-xs font-semibold text-ph-charcoal/60">{label}</span>
      <div className="flex flex-col gap-2">
        {items.map((item, i) => (
          <div
            key={item.id}
            className="flex flex-col gap-2 rounded-md border border-ph-charcoal/10 bg-white p-2.5"
          >
            {children(item, i)}
            {items.length > min && (
              <button
                type="button"
                className={`${linkClass} self-start text-xs`}
                onClick={() => onRemove(i)}
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>
      <button type="button" className={`${linkClass} mt-1.5`} onClick={onAdd}>
        {addLabel}
      </button>
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
}) {
  return (
    <Field label={label}>
      <NumberBox className={numClass} step={step} value={value} onChange={onChange} />
    </Field>
  );
}

function QuestionCommon<B extends QuestionBase>({ block, set }: { block: B; set: Edit<B> }) {
  return (
    <>
      <TextInput
        label="Feedback when correct"
        value={block.feedbackCorrect}
        onChange={(v) => set((b) => (b.feedbackCorrect = v))}
      />
      <TextInput
        label="Feedback when wrong"
        value={block.feedbackWrong}
        onChange={(v) => set((b) => (b.feedbackWrong = v))}
      />
      <Toggle
        label="Must get it right before continuing"
        checked={block.required}
        onChange={(v) => set((b) => (b.required = v))}
      />
      <Toggle
        label="Counts toward the pass mark"
        checked={block.scored}
        onChange={(v) => set((b) => (b.scored = v))}
      />
    </>
  );
}

export function AudioForm({
  block,
  page,
  courseId,
  set,
}: {
  block: AudioBlock;
  page: Page;
  courseId: string;
  set: Edit<AudioBlock>;
}) {
  const others = page.blocks.filter((b) => b.id !== block.id);
  return (
    <>
      <MediaInput
        label="Audio (mp3)"
        courseId={courseId}
        value={block.src}
        fileName={block.fileName}
        accept=".mp3"
        onChange={(url, file) =>
          set((b) => {
            b.src = url;
            b.fileName = file.name;
          })
        }
      />
      <Select
        label="Plays as"
        value={block.mode}
        options={[
          { value: 'narration', label: 'Narration with a play button' },
          { value: 'background', label: 'Background audio, learner can mute' },
        ]}
        onChange={(v) => set((b) => (b.mode = v))}
      />
      {block.mode === 'narration' && (
        <ListEditor
          label="Reveal cue points (blocks stay hidden until the audio reaches them)"
          items={block.cues}
          min={0}
          addLabel="+ Add cue point"
          onAdd={() => set((b) => b.cues.push({ id: uid(), at: 0, blockId: others[0]?.id ?? '' }))}
          onRemove={(i) => set((b) => b.cues.splice(i, 1))}
        >
          {(c, i) => (
            <div className="grid grid-cols-[80px_1fr] gap-2">
              <NumberInput
                label="Seconds"
                step={0.5}
                value={c.at}
                onChange={(n) => set((b) => (b.cues[i].at = n))}
              />
              <Select
                label="Reveals"
                value={c.blockId}
                options={others.map((o) => ({ value: o.id, label: blockLabel(o).slice(0, 40) }))}
                onChange={(v) => set((b) => (b.cues[i].blockId = v))}
              />
            </div>
          )}
        </ListEditor>
      )}
    </>
  );
}

export function AnimationForm({
  block,
  courseId,
  set,
}: {
  block: AnimationBlock;
  courseId: string;
  set: Edit<AnimationBlock>;
}) {
  return (
    <>
      <MediaInput
        label="Lottie (.json) or GIF"
        courseId={courseId}
        value={block.src}
        fileName={block.fileName}
        accept=".json,.gif"
        onChange={(url, file) =>
          set((b) => {
            b.src = url;
            b.fileName = file.name;
          })
        }
      />
      <Toggle label="Loop" checked={block.loop} onChange={(v) => set((b) => (b.loop = v))} />
    </>
  );
}

export function ScrollForm({ block, set }: { block: ScrollBlock; set: Edit<ScrollBlock> }) {
  return (
    <>
      <RichText
        key={block.id}
        label="Text"
        html={block.html}
        onChange={(v) => set((b) => (b.html = v))}
      />
      <NumberInput
        label="Box height on flow pages (px)"
        value={block.height}
        onChange={(n) => set((b) => (b.height = Math.max(80, n)))}
      />
      <TextStyleFields value={block.textStyle} onChange={(v) => set((b) => (b.textStyle = v))} />
    </>
  );
}

export function PopupForm({
  block,
  courseId,
  set,
}: {
  block: PopupBlock;
  courseId: string;
  set: Edit<PopupBlock>;
}) {
  return (
    <>
      <Toggle
        label="Show a button that opens it"
        checked={block.showButton}
        onChange={(v) => set((b) => (b.showButton = v))}
      />
      {block.showButton && (
        <TextInput
          label="Button label"
          value={block.label}
          onChange={(v) => set((b) => (b.label = v))}
        />
      )}
      <TextInput
        label="Pop-up title"
        value={block.title}
        onChange={(v) => set((b) => (b.title = v))}
      />
      <RichText
        key={block.id}
        label="Pop-up text"
        html={block.html}
        onChange={(v) => set((b) => (b.html = v))}
      />
      <MediaInput
        label="Pop-up image (optional)"
        courseId={courseId}
        value={block.src}
        fileName={block.fileName}
        accept=".jpg,.jpeg,.png,.svg,.gif"
        onChange={(url, file) =>
          set((b) => {
            b.src = url;
            b.fileName = file.name;
          })
        }
      />
      {!block.showButton && (
        <p className="text-xs text-ph-charcoal/60">
          Open it from an object on a canvas page: On click, Open a pop-up layer.
        </p>
      )}
    </>
  );
}

export function PanelsForm({
  block,
  set,
}: {
  block: AccordionBlock | TabsBlock;
  set: Edit<AccordionBlock | TabsBlock>;
}) {
  const newPanel = (): Panel => ({
    id: uid(),
    title: 'New section',
    html: '<p>Type the content here.</p>',
  });
  return (
    <ListEditor
      label={block.type === 'tabs' ? 'Tabs' : 'Sections'}
      items={block.items}
      addLabel={block.type === 'tabs' ? '+ Add tab' : '+ Add section'}
      onAdd={() => set((b) => b.items.push(newPanel()))}
      onRemove={(i) => set((b) => b.items.splice(i, 1))}
    >
      {(p, i) => (
        <>
          <TextInput
            label="Title"
            value={p.title}
            onChange={(v) => set((b) => (b.items[i].title = v))}
          />
          <RichText
            key={p.id}
            label="Content"
            html={p.html}
            onChange={(v) => set((b) => (b.items[i].html = v))}
          />
        </>
      )}
    </ListEditor>
  );
}

export function FlipForm({
  block,
  courseId,
  set,
}: {
  block: FlipBlock;
  courseId: string;
  set: Edit<FlipBlock>;
}) {
  return (
    <ListEditor
      label="Cards"
      items={block.cards}
      addLabel="+ Add card"
      onAdd={() =>
        set((b) => b.cards.push({ id: uid(), front: 'Front', frontSrc: '', back: 'Back' }))
      }
      onRemove={(i) => set((b) => b.cards.splice(i, 1))}
    >
      {(c, i) => (
        <>
          <TextInput
            label="Front"
            value={c.front}
            onChange={(v) => set((b) => (b.cards[i].front = v))}
          />
          <MediaInput
            label="Front image (optional)"
            courseId={courseId}
            value={c.frontSrc}
            fileName={c.frontSrc ? 'Image added' : ''}
            accept=".jpg,.jpeg,.png,.svg,.gif"
            onChange={(url) => set((b) => (b.cards[i].frontSrc = url))}
          />
          <TextArea
            label="Back"
            value={c.back}
            onChange={(v) => set((b) => (b.cards[i].back = v))}
          />
        </>
      )}
    </ListEditor>
  );
}

function ImagePlacer({
  src,
  marks,
  onPlace,
  hint,
}: {
  src: string;
  marks: { id: string; x: number; y: number; w?: number; h?: number; label: string }[];
  onPlace: (x: number, y: number) => void;
  hint: string;
}) {
  return (
    <div>
      <p className="mb-1 text-xs text-ph-charcoal/60">{hint}</p>
      <div
        className="relative cursor-crosshair overflow-hidden rounded-md border border-ph-charcoal/15"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          onPlace(
            Math.round(((e.clientX - r.left) / r.width) * 1000) / 10,
            Math.round(((e.clientY - r.top) / r.height) * 1000) / 10,
          );
        }}
      >
        <img src={src} alt="" className="block w-full" />
        {marks.map((m) =>
          m.w !== undefined ? (
            <span
              key={m.id}
              className="absolute border-2 border-dashed border-ph-purple bg-ph-purple/10 text-[10px] font-semibold text-ph-purple"
              style={{ left: `${m.x}%`, top: `${m.y}%`, width: `${m.w}%`, height: `${m.h}%` }}
            >
              {m.label}
            </span>
          ) : (
            <span
              key={m.id}
              className="absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-ph-purple text-[10px] font-bold text-white"
              style={{ left: `${m.x}%`, top: `${m.y}%` }}
            >
              {m.label}
            </span>
          ),
        )}
      </div>
    </div>
  );
}

export function HotspotForm({
  block,
  courseId,
  set,
}: {
  block: HotspotBlock;
  courseId: string;
  set: Edit<HotspotBlock>;
}) {
  return (
    <>
      <MediaInput
        label="Image"
        courseId={courseId}
        value={block.src}
        fileName={block.fileName}
        accept=".jpg,.jpeg,.png,.svg,.gif"
        onChange={(url, file) =>
          set((b) => {
            b.src = url;
            b.fileName = file.name;
          })
        }
      />
      <TextInput label="Alt text" value={block.alt} onChange={(v) => set((b) => (b.alt = v))} />
      {block.src && (
        <ImagePlacer
          src={block.src}
          hint="Click the picture to add a pin."
          marks={block.spots.map((s, i) => ({ id: s.id, x: s.x, y: s.y, label: String(i + 1) }))}
          onPlace={(x, y) =>
            set((b) =>
              b.spots.push({
                id: uid(),
                x,
                y,
                title: `Pin ${b.spots.length + 1}`,
                html: '<p>Type the pin text here.</p>',
              }),
            )
          }
        />
      )}
      {block.spots.length > 0 && (
        <ListEditor
          label="Pins"
          items={block.spots}
          min={0}
          addLabel=""
          onAdd={() => {}}
          onRemove={(i) => set((b) => b.spots.splice(i, 1))}
        >
          {(s, i) => (
            <>
              <TextInput
                label={`${i + 1}. Title`}
                value={s.title}
                onChange={(v) => set((b) => (b.spots[i].title = v))}
              />
              <RichText
                key={s.id}
                label="Text"
                html={s.html}
                onChange={(v) => set((b) => (b.spots[i].html = v))}
              />
            </>
          )}
        </ListEditor>
      )}
    </>
  );
}

const pageOptions = (pages: Page[]) => [
  { value: '', label: 'Choose a page…' },
  ...pages.map((p, i) => ({ value: p.id, label: `${i + 1}. ${p.title || 'Untitled'}` })),
];

export function PathwayForm({
  block,
  pages,
  set,
}: {
  block: PathwayBlock;
  pages: Page[];
  set: Edit<PathwayBlock>;
}) {
  return (
    <>
      <TextArea
        label="Question"
        value={block.prompt}
        onChange={(v) => set((b) => (b.prompt = v))}
      />
      <ListEditor
        label="Choices"
        items={block.choices}
        addLabel="+ Add choice"
        onAdd={() => set((b) => b.choices.push({ id: uid(), label: 'Another option', pageId: '' }))}
        onRemove={(i) => set((b) => b.choices.splice(i, 1))}
      >
        {(c, i) => (
          <>
            <TextInput
              label="Label"
              value={c.label}
              onChange={(v) => set((b) => (b.choices[i].label = v))}
            />
            <Select
              label="Goes to"
              value={c.pageId}
              options={pageOptions(pages)}
              onChange={(v) => set((b) => (b.choices[i].pageId = v))}
            />
          </>
        )}
      </ListEditor>
    </>
  );
}

export function DragForm({
  block,
  courseId,
  set,
}: {
  block: DragBlock;
  courseId: string;
  set: Edit<DragBlock>;
}) {
  const zones =
    block.style === 'targets'
      ? block.targets.map((t) => ({ value: t.id, label: t.label }))
      : block.groups.map((g) => ({ value: g.id, label: g.label }));
  return (
    <>
      <Select
        label="Type"
        value={block.style}
        options={[
          { value: 'order', label: 'Order the items into slots' },
          { value: 'targets', label: 'Drop items onto targets on an image' },
          { value: 'groups', label: 'Sort items into groups' },
        ]}
        onChange={(v) => set((b) => (b.style = v))}
      />
      <TextArea
        label="Question"
        value={block.prompt}
        onChange={(v) => set((b) => (b.prompt = v))}
      />
      {block.style === 'targets' && (
        <>
          <MediaInput
            label="Image"
            courseId={courseId}
            value={block.src}
            fileName={block.fileName}
            accept=".jpg,.jpeg,.png,.svg,.gif"
            onChange={(url, file) =>
              set((b) => {
                b.src = url;
                b.fileName = file.name;
              })
            }
          />
          {block.src && (
            <ImagePlacer
              src={block.src}
              hint="Click the picture to add a drop target."
              marks={block.targets.map((t) => ({ ...t, label: t.label }))}
              onPlace={(x, y) =>
                set((b) =>
                  b.targets.push({
                    id: uid(),
                    label: `Target ${b.targets.length + 1}`,
                    x: Math.max(0, x - 10),
                    y: Math.max(0, y - 6),
                    w: 20,
                    h: 12,
                  }),
                )
              }
            />
          )}
          {block.targets.length > 0 && (
            <ListEditor
              label="Drop targets"
              items={block.targets}
              min={0}
              addLabel=""
              onAdd={() => {}}
              onRemove={(i) => set((b) => b.targets.splice(i, 1))}
            >
              {(t, i) => (
                <>
                  <TextInput
                    label="Label"
                    value={t.label}
                    onChange={(v) => set((b) => (b.targets[i].label = v))}
                  />
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['x', 'y', 'w', 'h'] as const).map((k) => (
                      <NumberInput
                        key={k}
                        label={`${k.toUpperCase()} %`}
                        value={t[k]}
                        onChange={(n) => set((b) => (b.targets[i][k] = n))}
                      />
                    ))}
                  </div>
                </>
              )}
            </ListEditor>
          )}
        </>
      )}
      {block.style === 'groups' && (
        <ListEditor
          label="Groups"
          items={block.groups}
          addLabel="+ Add group"
          onAdd={() =>
            set((b) => b.groups.push({ id: uid(), label: `Group ${b.groups.length + 1}` }))
          }
          onRemove={(i) => set((b) => b.groups.splice(i, 1))}
        >
          {(g, i) => (
            <TextInput
              label="Label"
              value={g.label}
              onChange={(v) => set((b) => (b.groups[i].label = v))}
            />
          )}
        </ListEditor>
      )}
      <ListEditor
        label={
          block.style === 'order' ? 'Items, in the correct order' : 'Items and where each belongs'
        }
        items={block.items}
        addLabel="+ Add item"
        onAdd={() => set((b) => b.items.push({ id: uid(), text: 'New item', target: '' }))}
        onRemove={(i) => set((b) => b.items.splice(i, 1))}
      >
        {(it, i) => (
          <>
            <TextInput
              label={block.style === 'order' ? `${i + 1}.` : 'Item'}
              value={it.text}
              onChange={(v) => set((b) => (b.items[i].text = v))}
            />
            {block.style !== 'order' && (
              <Select
                label="Belongs in"
                value={it.target}
                options={[{ value: '', label: 'Nowhere (distractor)' }, ...zones]}
                onChange={(v) => set((b) => (b.items[i].target = v))}
              />
            )}
          </>
        )}
      </ListEditor>
      <QuestionCommon block={block} set={set} />
    </>
  );
}

export function MatchForm({ block, set }: { block: MatchBlock; set: Edit<MatchBlock> }) {
  return (
    <>
      <TextArea
        label="Question"
        value={block.prompt}
        onChange={(v) => set((b) => (b.prompt = v))}
      />
      <Select
        label="Learners match by"
        value={block.mode}
        options={[
          { value: 'drag', label: 'Dragging' },
          { value: 'dropdown', label: 'Dropdowns' },
        ]}
        onChange={(v) => set((b) => (b.mode = v))}
      />
      <ListEditor
        label="Pairs"
        items={block.pairs}
        min={2}
        addLabel="+ Add pair"
        onAdd={() => set((b) => b.pairs.push({ id: uid(), left: 'Item', right: 'Match' }))}
        onRemove={(i) => set((b) => b.pairs.splice(i, 1))}
      >
        {(p, i) => (
          <div className="grid grid-cols-2 gap-2">
            <TextInput
              label="Item"
              value={p.left}
              onChange={(v) => set((b) => (b.pairs[i].left = v))}
            />
            <TextInput
              label="Matches"
              value={p.right}
              onChange={(v) => set((b) => (b.pairs[i].right = v))}
            />
          </div>
        )}
      </ListEditor>
      <QuestionCommon block={block} set={set} />
    </>
  );
}

export function BlankForm({ block, set }: { block: BlankBlock; set: Edit<BlankBlock> }) {
  return (
    <>
      <TextArea
        label="Question"
        value={block.prompt}
        onChange={(v) => set((b) => (b.prompt = v))}
      />
      <TextArea
        label="Text with blanks"
        value={block.text}
        onChange={(v) => set((b) => (b.text = v))}
      />
      <p className="-mt-1 text-xs text-ph-charcoal/60">
        Put each answer in [square brackets]. Separate other accepted answers with |, like
        [colour|color].
      </p>
      <QuestionCommon block={block} set={set} />
    </>
  );
}

export function SliderForm({ block, set }: { block: SliderBlock; set: Edit<SliderBlock> }) {
  return (
    <>
      <TextArea
        label="Question"
        value={block.prompt}
        onChange={(v) => set((b) => (b.prompt = v))}
      />
      <div className="grid grid-cols-3 gap-2">
        <NumberInput label="From" value={block.min} onChange={(n) => set((b) => (b.min = n))} />
        <NumberInput label="To" value={block.max} onChange={(n) => set((b) => (b.max = n))} />
        <NumberInput
          label="Step"
          value={block.step}
          onChange={(n) => set((b) => (b.step = n > 0 ? n : 1))}
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <NumberInput
          label="Correct answer"
          value={block.answer}
          onChange={(n) => set((b) => (b.answer = n))}
        />
        <NumberInput
          label="Allow +/-"
          value={block.tolerance}
          onChange={(n) => set((b) => (b.tolerance = Math.max(0, n)))}
        />
        <TextInput label="Unit" value={block.unit} onChange={(v) => set((b) => (b.unit = v))} />
      </div>
      <QuestionCommon block={block} set={set} />
    </>
  );
}

export function WrittenForm({
  block,
  doc,
  set,
}: {
  block: WrittenBlock;
  doc: CourseDoc;
  set: Edit<WrittenBlock>;
}) {
  const textVars = doc.variables.filter((v) => v.type === 'text');
  return (
    <>
      <TextArea
        label="Question"
        value={block.prompt}
        onChange={(v) => set((b) => (b.prompt = v))}
      />
      <Select
        label="Answer box"
        value={block.length}
        options={[
          { value: 'short', label: 'Short answer' },
          { value: 'essay', label: 'Essay' },
        ]}
        onChange={(v) => set((b) => (b.length = v))}
      />
      <Select
        label="Save the answer into a variable"
        value={block.saveTo ?? ''}
        options={[
          { value: '', label: textVars.length ? "Don't save" : 'Add a text variable first' },
          ...textVars.map((v) => ({ value: v.id, label: v.name })),
        ]}
        onChange={(v) => set((b) => (b.saveTo = v || undefined))}
      />
      <Toggle
        label="Must answer before continuing"
        checked={block.required}
        onChange={(v) => set((b) => (b.required = v))}
      />
    </>
  );
}

export function LikertForm({ block, set }: { block: LikertBlock; set: Edit<LikertBlock> }) {
  return (
    <>
      <TextArea
        label="Question"
        value={block.prompt}
        onChange={(v) => set((b) => (b.prompt = v))}
      />
      <ListEditor
        label="Statements"
        items={block.rows}
        addLabel="+ Add statement"
        onAdd={() => set((b) => b.rows.push({ id: uid(), text: 'Another statement' }))}
        onRemove={(i) => set((b) => b.rows.splice(i, 1))}
      >
        {(r, i) => (
          <TextInput
            label="Statement"
            value={r.text}
            onChange={(v) => set((b) => (b.rows[i].text = v))}
          />
        )}
      </ListEditor>
      <TextInput
        label="Scale (comma separated)"
        value={block.scale.join(', ')}
        onChange={(v) =>
          set(
            (b) =>
              (b.scale = v
                .split(',')
                .map((x) => x.trim())
                .filter(Boolean)),
          )
        }
      />
      <Toggle
        label="Must answer before continuing"
        checked={block.required}
        onChange={(v) => set((b) => (b.required = v))}
      />
    </>
  );
}

export function ResultsForm({ block, set }: { block: ResultsBlock; set: Edit<ResultsBlock> }) {
  return (
    <>
      <TextInput
        label="Message when passed"
        value={block.passText}
        onChange={(v) => set((b) => (b.passText = v))}
      />
      <TextInput
        label="Message when not passed"
        value={block.failText}
        onChange={(v) => set((b) => (b.failText = v))}
      />
      <Toggle
        label="Let learners retry"
        checked={block.retry}
        onChange={(v) => set((b) => (b.retry = v))}
      />
      <Toggle
        label="Show answer review"
        checked={block.review}
        onChange={(v) => set((b) => (b.review = v))}
      />
      <Toggle
        label="Negative scoring (wrong answers take a point off)"
        checked={block.negative}
        onChange={(v) => set((b) => (b.negative = v))}
      />
      <TextInput
        label="Random question pool: pages to draw (blank = all)"
        value={block.pool === null ? '' : String(block.pool)}
        onChange={(v) => {
          const n = parseInt(v, 10);
          set((b) => (b.pool = Number.isFinite(n) && n > 0 ? n : null));
        }}
      />
      <p className="-mt-1 text-xs text-ph-charcoal/60">
        With a pool, each learner gets that many of the scored question pages, picked at random.
      </p>
    </>
  );
}
