import {
  hasPicks,
  newPickRule,
  pickIds,
  type Block,
  type CourseDoc,
  type Frame,
  type Layout,
  type Page,
} from '@/course/doc';
import { cn } from '@/lib/utils';
import { BlockForm } from './BlockForm';
import { blockLabel, blockName } from './blockMeta';
import { AnimFields } from './AnimFields';
import { FrameFields } from './FrameFields';
import { InteractionFields, PickRuleFields } from './InteractionFields';
import { TriggersPanel } from './TriggersPanel';
import { Select, TextInput, Toggle } from './fields';
import { SortableList } from './SortableList';

export function Inspector({
  doc,
  page,
  courseId,
  selectedId,
  onSelect,
  onPage,
  onAddBlock,
  onMoveBlock,
  onChangeBlock,
  onDuplicateBlock,
  onRemoveBlock,
  canvas,
}: {
  doc: CourseDoc;
  page: Page;
  courseId: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPage: (fn: (p: Page) => void) => void;
  onAddBlock: () => void;
  onMoveBlock: (from: number, to: number) => void;
  onChangeBlock: (id: string, update: (b: Block) => void) => void;
  onDuplicateBlock: (id: string) => void;
  onRemoveBlock: (id: string) => void;
  canvas: CanvasControls | null;
}) {
  const block = page.blocks.find((b) => b.id === selectedId) ?? null;
  const last = page.blocks.length - 1;
  const items = canvas ? [...page.blocks].reverse() : page.blocks;
  const move = (from: number, to: number) =>
    canvas ? onMoveBlock(last - from, last - to) : onMoveBlock(from, to);
  const index = block ? page.blocks.indexOf(block) : -1;

  return (
    <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-ph-charcoal/10 bg-[#faf9fb] px-4 py-4 text-sm">
      <div className="mb-4">
        <TextInput
          label="Page title"
          value={page.title}
          onChange={(title) => onPage((p) => (p.title = title))}
        />
        <div className="mt-2">
          <Select
            label="Page transition"
            value={page.transition ?? 'none'}
            options={[
              { value: 'none', label: 'None' },
              { value: 'fade', label: 'Fade' },
              { value: 'slide', label: 'Slide in' },
            ]}
            onChange={(t) => onPage((p) => (p.transition = t))}
          />
        </div>
        <div className="mt-2">
          <Select
            label="Page navigation"
            value={page.ownNav ? 'own' : 'bar'}
            options={[
              { value: 'bar', label: 'Back and Continue in the bottom bar' },
              { value: 'own', label: "Only this page's own buttons" },
            ]}
            onChange={(v) => onPage((p) => (p.ownNav = v === 'own'))}
          />
        </div>
      </div>

      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ph-charcoal/50">
        {canvas ? 'Objects on this canvas' : 'Blocks on this page'}
      </h4>
      {canvas && (
        <p className="-mt-1 mb-2 text-xs font-semibold text-ph-purple">
          Editing the {canvas.layout === 'phone' ? 'phone 9:16' : 'desktop 16:9'} layout
          {canvas.otherLayout && (
            <>
              {' · '}
              <button
                type="button"
                onClick={canvas.onCopyLayout}
                className="underline underline-offset-2"
              >
                copy positions from {canvas.otherLayout}
              </button>
            </>
          )}
        </p>
      )}
      <SortableList items={items} onMove={move}>
        {(b) => (
          <button
            type="button"
            onClick={() => onSelect(b.id)}
            className={cn(
              'flex w-full items-center gap-2 rounded-md border-[1.5px] bg-white px-2.5 py-1.5 text-left',
              b.id === selectedId
                ? 'border-ph-purple font-semibold text-ph-purple'
                : 'border-transparent text-ph-charcoal hover:border-ph-charcoal/15',
            )}
          >
            <span className="cursor-grab font-mono text-xs text-ph-charcoal/40">::</span>
            <span className="min-w-0 flex-1 truncate">{blockLabel(b)}</span>
            <span className="text-[10px] font-normal uppercase tracking-wide text-ph-charcoal/40">
              {blockName(b.type)}
            </span>
          </button>
        )}
      </SortableList>
      <button
        type="button"
        onClick={onAddBlock}
        className="mt-2 w-full rounded-md border-[1.5px] border-ph-charcoal/15 bg-white py-2 font-medium text-ph-charcoal hover:border-ph-purple hover:text-ph-purple"
      >
        {canvas ? '+ Add object' : '+ Add block'}
      </button>
      {canvas && hasPicks(page) && (
        <PickRuleFields
          rule={page.pick ?? newPickRule()}
          correctCount={
            pickIds(page).filter((id) => page.blocks.find((b) => b.id === id)?.interact?.correct)
              .length
          }
          onChange={(r) => onPage((p) => (p.pick = r))}
        />
      )}
      <TriggersPanel
        doc={doc}
        page={page}
        selectedId={selectedId}
        onChange={(triggers) => onPage((p) => (p.triggers = triggers))}
      />

      {block && (
        <div className="mt-4 flex flex-col gap-3 border-t border-ph-charcoal/10 pt-4">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-ph-charcoal/50">
            {blockName(block.type)}
          </h4>
          <BlockForm
            key={block.id}
            block={block}
            page={page}
            doc={doc}
            courseId={courseId}
            onChange={(update) => onChangeBlock(block.id, update)}
          />
          {canvas?.frame && (
            <>
              <FrameFields frame={canvas.frame} onChange={canvas.onFrame} />
              <InteractionFields
                doc={doc}
                block={block}
                page={page}
                onChange={(i) => onChangeBlock(block.id, (b) => (b.interact = i))}
                onEnabledWhen={(when, conditions) =>
                  onChangeBlock(block.id, (b) => {
                    if (b.type !== 'button') return;
                    b.enabledWhen = when;
                    b.enabledIf = conditions;
                  })
                }
              />
              <div className="flex gap-4">
                <button
                  type="button"
                  disabled={index === last}
                  onClick={() => onMoveBlock(index, index + 1)}
                  className="text-sm text-ph-charcoal/60 underline underline-offset-4 hover:text-ph-purple disabled:opacity-40"
                >
                  Bring forward
                </button>
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => onMoveBlock(index, index - 1)}
                  className="text-sm text-ph-charcoal/60 underline underline-offset-4 hover:text-ph-purple disabled:opacity-40"
                >
                  Send backward
                </button>
              </div>
            </>
          )}
          <Toggle
            label="Hidden when the page starts (show it with a trigger)"
            checked={!!block.startHidden}
            onChange={(v) => onChangeBlock(block.id, (b) => (b.startHidden = v))}
          />
          <AnimFields
            anim={block.anim}
            onChange={(a) => onChangeBlock(block.id, (b) => (b.anim = a))}
          />
          <div className="mt-1 flex gap-4">
            <button
              type="button"
              onClick={() => onDuplicateBlock(block.id)}
              className="text-sm text-ph-charcoal/60 underline underline-offset-4 hover:text-ph-purple"
            >
              Duplicate block
            </button>
            <button
              type="button"
              onClick={() => onRemoveBlock(block.id)}
              className="text-sm text-red-700 underline underline-offset-4 hover:text-red-800"
            >
              Remove block
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

export interface CanvasControls {
  layout: Layout;
  otherLayout: Layout | null;
  frame: Frame | null;
  onFrame: (frame: Frame) => void;
  onCopyLayout: () => void;
}
