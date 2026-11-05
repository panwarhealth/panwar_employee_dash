import {
  groupsOf,
  hasPicks,
  isQuestion,
  newPickRule,
  NO_INTERACTION,
  pickIds,
  type Block,
  type Group,
  type Interaction,
  type CourseDoc,
  type Frame,
  type Layout,
  type Page,
} from '@/course/doc';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { layoutsFor, lookFor, pagePaint } from '@/course/canvasLayout';
import { changeLook, changePagePaint } from '@/course/edit';
import { BlockForm } from './BlockForm';
import { QuestionLookFields } from './QuestionLookFields';
import { blockLabel, blockName } from './blockMeta';
import { AnimFields } from './AnimFields';
import { FrameFields } from './FrameFields';
import { InteractionFields, PickRuleFields } from './InteractionFields';
import { HOVER_LOOKS, VISITED_LOOKS } from './interactionLooks';
import { TriggersPanel } from './TriggersPanel';
import { Select, TextInput, Toggle } from './fields';
import { SortableList } from './SortableList';
import { PaintField } from './TextStyleFields';
import { ReviewNotes } from './ReviewNotes';

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
  canvas: CanvasControls;
}) {
  const block = page.blocks.find((b) => b.id === selectedId) ?? null;
  const shown = block && lookFor(block, canvas.layout);
  const styled = (fn: (b: Block) => void) =>
    block &&
    onChangeBlock(block.id, (b) =>
      changeLook(b, canvas.layout, layoutsFor(doc.screens)[0], fn),
    );
  const group = groupsOf(page).find((g) => g.id === selectedId) ?? null;
  const changeGroup = (fn: (g: Group) => void) =>
    onPage((p) => {
      const g = p.groups?.find((x) => x.id === group?.id);
      if (g) fn(g);
    });
  const look = (patch: Partial<Interaction>) =>
    changeGroup((g) => (g.interact = { ...NO_INTERACTION, ...g.interact, ...patch }));
  const last = page.blocks.length - 1;
  const items = [...page.blocks].reverse();
  const move = (from: number, to: number) => onMoveBlock(last - from, last - to);
  const index = block ? page.blocks.indexOf(block) : -1;

  return (
    <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-ph-charcoal/10 bg-[#faf9fb] px-4 py-4 text-sm">
      <ReviewNotes
        page={page}
        selectedId={selectedId}
        onSelect={onSelect}
        onResolve={(id) =>
          onPage((p) => {
            p.notes = p.notes?.filter((n) => n.id !== id);
            if (!p.notes?.length) delete p.notes;
          })
        }
      />
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
          <PaintField
            label="Page background"
            fill={pagePaint(page, canvas.layout)[0]}
            gradient={pagePaint(page, canvas.layout)[1]}
            onChange={(fill, gradient) =>
              onPage((p) =>
                changePagePaint(p, canvas.layout, layoutsFor(doc.screens)[0], fill, gradient),
              )
            }
          />
          {page.looks?.[canvas.layout] && (
            <p className="mt-1 text-xs text-ph-charcoal/60">
              Different on {canvas.layout}.{' '}
              <button
                type="button"
                onClick={() =>
                  onPage((p) => {
                    const looks = { ...p.looks };
                    delete looks[canvas.layout];
                    if (Object.keys(looks).length) p.looks = looks;
                    else delete p.looks;
                  })
                }
                className="text-ph-purple underline underline-offset-2"
              >
                Match desktop
              </button>
            </p>
          )}
        </div>
      </div>

      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ph-charcoal/50">
        Objects on this page
      </h4>
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
      <SortableList items={items} onMove={move}>
        {(b) => (
          <div
            className={cn(
              'group flex w-full items-center rounded-md border-[1.5px] bg-white',
              b.id === selectedId
                ? 'border-ph-purple font-semibold text-ph-purple'
                : 'border-transparent text-ph-charcoal hover:border-ph-charcoal/15',
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(b.id)}
              className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-1.5 text-left"
            >
              <span className="cursor-grab font-mono text-xs text-ph-charcoal/40">::</span>
              <span className="min-w-0 flex-1 truncate">{blockLabel(b)}</span>
              <span className="text-[10px] font-normal uppercase tracking-wide text-ph-charcoal/40">
                {blockName(b.type)}
              </span>
            </button>
            <button
              type="button"
              title="Delete"
              onClick={() => onRemoveBlock(b.id)}
              className={cn(
                'mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded text-ph-charcoal/40 hover:bg-red-50 hover:text-red-700',
                b.id === selectedId ? 'visible' : 'invisible group-hover:visible',
              )}
            >
              <Trash2 size={15} />
            </button>
          </div>
        )}
      </SortableList>
      <button
        type="button"
        onClick={onAddBlock}
        className="mt-2 w-full rounded-md border-[1.5px] border-ph-charcoal/15 bg-white py-2 font-medium text-ph-charcoal hover:border-ph-purple hover:text-ph-purple"
      >
        + Add object
      </button>
      {hasPicks(page) && (
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

      {group && (
        <div className="mt-4 flex flex-col gap-3 border-t border-ph-charcoal/10 pt-4">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-ph-charcoal/50">
            Group
          </h4>
          <TextInput
            label="Name"
            value={group.name}
            onChange={(name) => changeGroup((g) => (g.name = name))}
          />
          <Select
            label="On hover"
            value={group.interact?.hover ?? 'none'}
            options={HOVER_LOOKS}
            onChange={(hover) => look({ hover })}
          />
          <Select
            label="When visited"
            value={group.interact?.visited ?? 'none'}
            options={VISITED_LOOKS}
            onChange={(visited) => look({ visited })}
          />
          <p className="text-xs text-ph-charcoal/60">
            {group.members.length} objects move, hover and click as one. Give the group a trigger
            above to make a click anywhere on it do something.
          </p>
          <button
            type="button"
            onClick={() =>
              onPage((p) => {
                p.groups = p.groups?.filter((g) => g.id !== group.id);
                if (!p.groups?.length) delete p.groups;
              })
            }
            className="self-start text-sm text-ph-charcoal/60 underline underline-offset-4 hover:text-ph-purple"
          >
            Ungroup
          </button>
        </div>
      )}

      {block && shown && (
        <div className="mt-4 flex flex-col gap-3 border-t border-ph-charcoal/10 pt-4">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-ph-charcoal/50">
            {blockName(block.type)}
          </h4>
          {block.looks?.[canvas.layout] && (
            <p className="-mt-2 text-xs text-ph-charcoal/60">
              Styled differently on {canvas.layout}.{' '}
              <button
                type="button"
                onClick={() =>
                  onChangeBlock(block.id, (b) => {
                    const looks = { ...b.looks };
                    delete looks[canvas.layout];
                    if (Object.keys(looks).length) b.looks = looks;
                    else delete b.looks;
                  })
                }
                className="text-ph-purple underline underline-offset-2"
              >
                Match {canvas.layout === 'phone' ? 'desktop' : 'phone'}
              </button>
            </p>
          )}
          <BlockForm
            key={`${block.id}-${canvas.layout}`}
            block={shown}
            page={page}
            doc={doc}
            courseId={courseId}
            onChange={styled}
          />
          {isQuestion(shown) && (
            <QuestionLookFields
              block={shown}
              onChange={(look) =>
                styled((b) => {
                  if (isQuestion(b)) b.look = look;
                })
              }
            />
          )}
          {canvas.frame && (
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
