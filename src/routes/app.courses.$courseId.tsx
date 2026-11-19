import { useCallback, useState, type ReactNode, type SetStateAction } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  History,
  Monitor,
  Redo2,
  Settings,
  Smartphone,
  Sparkles,
  Undo2,
  Workflow,
} from 'lucide-react';
import { CanvasEditor } from '@/components/courses/CanvasEditor';
import { relayout } from '@/components/courses/deckToPages';
import { getCourse, type Course } from '@/api/courses';
import { Button } from '@/components/ui/button';
import { AddBlockMenu } from '@/components/courses/AddBlockMenu';
import { AssistantPanel } from '@/components/courses/AssistantPanel';
import { ExportModal } from '@/components/courses/ExportModal';
import { PublishModal } from '@/components/courses/PublishModal';
import { FlowView } from '@/components/courses/FlowView';
import { HistoryModal } from '@/components/courses/HistoryModal';
import { Inspector } from '@/components/courses/Inspector';
import { PageList } from '@/components/courses/PageList';
import { PdfModal } from '@/components/courses/PdfModal';
import { PresenceAvatar } from '@/components/courses/PresenceAvatar';
import { PreviewModal } from '@/components/courses/PreviewModal';
import { SettingsModal } from '@/components/courses/SettingsModal';
import { VariablesModal } from '@/components/courses/VariablesModal';
import { frameFor, newFrame } from '@/course/canvasLayout';
import {
  fixNbsp,
  layerOf,
  newBlock,
  newPage,
  normalizeDoc,
  uid,
  type Block,
  type CourseDoc,
  type Layout,
} from '@/course/doc';
import * as ops from '@/course/edit';
import { fontFaces, fontOptions } from '@/course/typography';
import { CourseColours, courseColours } from '@/components/courses/colourContext';
import { FontOptions } from '@/components/courses/fontContext';
import { useCourseAssistant } from '@/hooks/useCourseAssistant';
import { useCourseAutosave } from '@/hooks/useCourseAutosave';
import { useCoursePresence } from '@/hooks/useCoursePresence';
import { useUndoable } from '@/hooks/useUndoable';
import { useNonBreakingSpace } from '@/components/courses/nbsp';
import { cn } from '@/lib/utils';
import '@/course/player.css';

export const Route = createFileRoute('/app/courses/$courseId')({
  component: EditorPage,
});

function EditorPage() {
  const { courseId } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => getCourse(courseId),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  if (isLoading) return <p className="p-6 text-sm text-ph-charcoal/60">Loading…</p>;
  if (error || !data)
    return <p className="p-6 text-sm text-red-700">{error?.message ?? 'Course not found'}</p>;
  return (
    <Editor
      key={data.updatedAt}
      courseId={courseId}
      initial={normalizeDoc(data.content)}
      publishTo={data.clinicalStudioCourseId}
      published={
        data.publishedBuild === null
          ? null
          : { build: data.publishedBuild, version: data.publishedVersion }
      }
    />
  );
}

function Editor({
  courseId,
  initial,
  publishTo,
  published,
}: {
  courseId: string;
  initial: CourseDoc;
  publishTo: string | null;
  published: { build: number; version: number | null } | null;
}) {
  const queryClient = useQueryClient();
  const history = useUndoable(initial);
  useNonBreakingSpace();
  const doc = history.value;
  const setHistory = history.set;
  const setDoc = useCallback(
    (next: SetStateAction<CourseDoc>) =>
      setHistory((d) => fixNbsp(typeof next === 'function' ? next(d) : next)),
    [setHistory],
  );
  const [pageId, setPageId] = useState(initial.pages[0].id);
  const [blockId, setBlockId] = useState<string | null>(null);
  const [phone, setPhone] = useState(initial.screens === 'phone');
  const [modal, setModal] = useState<
    | 'add'
    | 'export'
    | 'publish'
    | 'pdf'
    | 'settings'
    | 'preview'
    | 'variables'
    | 'history'
    | 'flow'
    | null
  >(null);
  const save = useCourseAutosave(courseId, doc);
  const assistant = useCourseAssistant(courseId, doc, setDoc);
  const [assistantOpen, setAssistantOpen] = useState(false);

  const page = doc.pages.find((p) => p.id === pageId) ?? doc.pages[0];
  const people = useCoursePresence(courseId, page.id);
  const pageTitle = (id: string | null) => {
    const i = doc.pages.findIndex((p) => p.id === id);
    return i < 0 ? 'no page' : `page ${i + 1}, ${doc.pages[i].title || 'Untitled'}`;
  };
  const layout: Layout = doc.screens === 'both' ? (phone ? 'phone' : 'desktop') : doc.screens;
  const otherLayout: Layout | null =
    doc.screens === 'both' ? (layout === 'phone' ? 'desktop' : 'phone') : null;
  const selectedBlock = page.blocks.find((b) => b.id === blockId) ?? null;
  const setFrame = (id: string, frame: Parameters<typeof ops.setFrame>[4]) =>
    setDoc((d) => ops.setFrame(d, page.id, id, layout, frame));
  const removeBlocks = (ids: string[]) => {
    setDoc((d) => ops.removeBlocks(d, page.id, ids));
    setBlockId(null);
  };
  const [clipboard, setClipboard] = useState<Block[]>([]);
  const layer = layerOf(page, blockId);
  const addCopies = (copies: Block[], after: (i: number) => string | null) => {
    setDoc((d) => copies.reduce((acc, c, i) => ops.insertBlock(acc, page.id, after(i), c), d));
    const top = copies.filter((c) => !c.parent || c.parent === layer);
    setBlockId(top.length === 1 ? top[0].id : null);
  };
  const duplicateBlocks = (ids: string[]) => {
    const sources = ops.withChildren(page, ids);
    const copies = ops.cloneAll(sources, layer);
    addCopies(copies, (i) => (ids.includes(sources[i].id) ? sources[i].id : copies[i - 1].id));
  };
  const copyBlocks = (ids: string[]) =>
    setClipboard(ops.withChildren(page, ids).map((b) => structuredClone(b)));
  const pasteBlocks = () =>
    addCopies(ops.cloneAll(clipboard, layer), () => null);
  const selectPage = (id: string) => {
    setPageId(id);
    setBlockId(null);
  };
  const goTo = (id: string, to: Layout | null, block: string | null) => {
    const target = doc.pages.find((p) => p.id === id);
    if (!target) return;
    setPageId(id);
    if (to && doc.screens === 'both') setPhone(to === 'phone');
    setBlockId(block && target.blocks.some((b) => b.id === block) ? block : null);
  };

  return (
    <FontOptions.Provider value={fontOptions(doc)}>
      <CourseColours.Provider value={courseColours(doc)}>
      <div className="-m-4 flex h-[calc(100vh-3.5rem)] md:-m-6">
        {doc.fonts.length > 0 && <style>{fontFaces(doc)}</style>}
        <PageList
          pages={doc.pages}
          currentId={page.id}
          people={people}
          onSelect={selectPage}
          onAdd={() => {
            const p = newPage(`Page ${doc.pages.length + 1}`);
            setDoc((d) => ops.insertPage(d, page.id, p));
            selectPage(p.id);
          }}
          onDuplicate={(id) => {
            const copy = ops.copyPage(doc.pages.find((p) => p.id === id)!);
            setDoc((d) => ops.insertPage(d, id, copy));
            selectPage(copy.id);
          }}
          onDelete={(id) => {
            const target = doc.pages.find((p) => p.id === id);
            if (!target || !window.confirm(`Delete the page "${target.title}"?`)) return;
            setDoc((d) => ops.removePage(d, id));
            if (id === page.id) selectPage(doc.pages.find((p) => p.id !== id)!.id);
          }}
          onMove={(from, to) => setDoc((d) => ops.movePage(d, from, to))}
        />

        <div className="flex min-w-0 flex-1 flex-col bg-[#eceaef]">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-ph-charcoal/10 bg-white px-4 py-2 text-sm">
            <Link
              to="/app/courses"
              className="flex items-center gap-1 text-ph-charcoal/60 hover:text-ph-purple"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Courses
            </Link>
            <strong className="min-w-0 truncate font-semibold text-ph-charcoal">{doc.title}</strong>
            <span
              className={cn(
                'whitespace-nowrap text-xs',
                save === 'error'
                  ? 'text-red-700'
                  : save === 'saved'
                    ? 'text-green-700'
                    : 'text-ph-charcoal/50',
              )}
            >
              {save === 'saved'
                ? 'Saved'
                : save === 'saving'
                  ? 'Saving…'
                  : save === 'error'
                    ? 'Not saved, retrying on next change'
                    : 'Unsaved'}
            </span>
            <div className="flex gap-0.5">
              <button
                type="button"
                title="Undo (Ctrl+Z)"
                disabled={!history.canUndo}
                onClick={history.undo}
                className="rounded-md p-1.5 text-ph-charcoal/70 hover:bg-ph-charcoal/5 hover:text-ph-purple disabled:pointer-events-none disabled:opacity-30"
              >
                <Undo2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                title="Redo (Ctrl+Y)"
                disabled={!history.canRedo}
                onClick={history.redo}
                className="rounded-md p-1.5 text-ph-charcoal/70 hover:bg-ph-charcoal/5 hover:text-ph-purple disabled:pointer-events-none disabled:opacity-30"
              >
                <Redo2 className="h-4 w-4" />
              </button>
            </div>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              {people.length > 0 && (
                <div className="flex -space-x-1.5">
                  {people.map((p) => (
                    <PresenceAvatar
                      key={p.userId}
                      person={p}
                      title={`${p.name} is on ${pageTitle(p.pageId)}`}
                      onClick={() => p.pageId && selectPage(p.pageId)}
                    />
                  ))}
                </div>
              )}
              {doc.screens === 'both' && (
                <div className="flex gap-1">
                  <SegButton
                    on={!phone}
                    onClick={() => setPhone(false)}
                    icon={<Monitor className="h-3.5 w-3.5" />}
                    label="Desktop"
                  />
                  <SegButton
                    on={phone}
                    onClick={() => setPhone(true)}
                    icon={<Smartphone className="h-3.5 w-3.5" />}
                    label="Phone"
                  />
                </div>
              )}
              <button
                type="button"
                onClick={() => setAssistantOpen((o) => !o)}
                className={cn(
                  'flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium hover:bg-ph-charcoal/5 hover:text-ph-purple',
                  assistantOpen || assistant.busy ? 'text-ph-purple' : 'text-ph-charcoal/70',
                )}
              >
                <Sparkles className="h-3.5 w-3.5" />
                AI assistant
              </button>
              <button
                type="button"
                onClick={() => setModal('flow')}
                className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-ph-charcoal/70 hover:bg-ph-charcoal/5 hover:text-ph-purple"
              >
                <Workflow className="h-3.5 w-3.5" />
                Flow
              </button>
              <button
                type="button"
                onClick={() => setModal('variables')}
                className="rounded-md px-2 py-1.5 text-xs font-medium text-ph-charcoal/70 hover:bg-ph-charcoal/5 hover:text-ph-purple"
              >
                Variables
              </button>
              <button
                type="button"
                title="Version history"
                onClick={() => setModal('history')}
                className="rounded-md p-1.5 text-ph-charcoal/60 hover:bg-ph-charcoal/5 hover:text-ph-purple"
              >
                <History className="h-4 w-4" />
              </button>
              <button
                type="button"
                title="Course settings"
                onClick={() => setModal('settings')}
                className="rounded-md p-1.5 text-ph-charcoal/60 hover:bg-ph-charcoal/5 hover:text-ph-purple"
              >
                <Settings className="h-4 w-4" />
              </button>
              <Button size="sm" variant="outline" onClick={() => setModal('preview')}>
                Preview
              </Button>
              <Button size="sm" variant="outline" onClick={() => setModal('pdf')}>
                Export PDF
              </Button>
              <Button size="sm" onClick={() => setModal('publish')}>
                Publish
              </Button>
            </div>
          </div>
          <div className="flex flex-1 justify-center overflow-auto">
            {modal !== 'flow' && (
              <CanvasEditor
                doc={doc}
                page={page}
                layout={layout}
                selectedId={blockId}
                onSelect={setBlockId}
                onFrame={setFrame}
                onFrames={(frames) => setDoc((d) => ops.setFrames(d, page.id, layout, frames))}
                onRemove={removeBlocks}
                onGroup={(ids) => {
                  const id = uid();
                  setDoc((d) => ops.groupBlocks(d, page.id, ids, id));
                  setBlockId(id);
                }}
                onUngroup={(id) => {
                  setDoc((d) => ops.ungroup(d, page.id, id));
                  setBlockId(null);
                }}
                onCopy={copyBlocks}
                onDuplicate={duplicateBlocks}
                onPaste={pasteBlocks}
                canPaste={clipboard.length > 0}
                onText={(id, value) =>
                  setDoc((d) =>
                    ops.updateBlock(d, page.id, id, (b) => {
                      if (b.type === 'text') b.html = value;
                      if (b.type === 'heading') b.text = value;
                    }),
                  )
                }
              />
            )}
          </div>
        </div>

        <Inspector
          doc={doc}
          page={page}
          courseId={courseId}
          selectedId={blockId}
          onSelect={setBlockId}
          onPage={(fn) => setDoc((d) => ops.updatePage(d, page.id, fn))}
          onAddBlock={() => setModal('add')}
          onMoveBlock={(from, to) => setDoc((d) => ops.moveBlock(d, page.id, from, to))}
          onChangeBlock={(id, update) => setDoc((d) => ops.updateBlock(d, page.id, id, update))}
          onDuplicateBlock={(id) => duplicateBlocks([id])}
          onCopyBlocks={copyBlocks}
          onPasteBlocks={pasteBlocks}
          canPaste={clipboard.length > 0}
          onRemoveBlock={(id) => removeBlocks([id])}
          polishing={assistant.busy}
          onPolish={() => {
            setAssistantOpen(true);
            void assistant.polishPage(page.id, layout);
          }}
          canvas={{
            layout,
            otherLayout,
            frame: selectedBlock ? frameFor(page, selectedBlock, layout) : null,
            onFrame: (f) => selectedBlock && setFrame(selectedBlock.id, f),
            onCopyLayout: () =>
              otherLayout && setDoc((d) => ops.copyLayout(d, page.id, otherLayout, layout)),
          }}
        />

        <AddBlockMenu
          open={modal === 'add'}
          onClose={() => setModal(null)}
          onPick={(type) => {
            const b = newBlock(type);
            if (type === 'popup') {
              const names = new Set(page.blocks.map((x) => x.name));
              let n = 1;
              while (names.has(`Pop-up ${n}`)) n++;
              b.name = `Pop-up ${n}`;
            }
            let frame = newFrame(type, layout);
            const card = page.blocks.find((x) => x.id === layer);
            if (card && type !== 'popup') {
              b.parent = card.id;
              const c = frameFor(page, card, layout);
              const w = Math.min(frame.w, c.w * 0.88);
              const h = Math.min(frame.h, c.h * 0.88);
              frame = { ...frame, w, h, x: c.x + (c.w - w) / 2, y: c.y + (c.h - h) / 2 };
            }
            setDoc((d) => {
              const next = ops.insertBlock(d, page.id, blockId, b);
              return ops.setFrame(next, page.id, b.id, layout, frame);
            });
            setBlockId(b.id);
            setModal(null);
          }}
        />
        {modal === 'flow' && (
          <FlowView
            doc={doc}
            setDoc={setDoc}
            currentId={page.id}
            onOpen={(id) => {
              selectPage(id);
              setModal(null);
            }}
            onClose={() => setModal(null)}
          />
        )}
        {modal === 'history' && (
          <HistoryModal
            courseId={courseId}
            canRestore={save === 'saved'}
            onClose={() => setModal(null)}
          />
        )}
        <SettingsModal
          open={modal === 'settings'}
          onClose={() => setModal(null)}
          doc={doc}
          courseId={courseId}
          onChange={(fn) => setDoc((d) => ops.updateCourse(d, fn))}
          onRefit={async () => setDoc((await relayout(doc)).doc)}
        />
        <VariablesModal
          open={modal === 'variables'}
          onClose={() => setModal(null)}
          doc={doc}
          onChange={(fn) => setDoc((d) => ops.updateCourse(d, fn))}
        />
        <PdfModal
          open={modal === 'pdf'}
          onClose={() => setModal(null)}
          courseId={courseId}
          doc={doc}
        />
        {modal === 'publish' && (
          <PublishModal
            onClose={() => setModal(null)}
            onExport={() => setModal('export')}
            onGoTo={(spot) => goTo(spot.id, spot.layout ?? null, spot.blockId ?? null)}
            courseId={courseId}
            doc={doc}
            target={publishTo}
            last={published}
            onPublished={(build, version) =>
              queryClient.setQueryData<Course>(['course', courseId], (old) =>
                old ? { ...old, publishedBuild: build, publishedVersion: version } : old,
              )
            }
            onTarget={(course) =>
              queryClient.setQueryData<Course>(['course', courseId], (old) =>
                old ? { ...old, clinicalStudioCourseId: course.clinicalStudioCourseId } : old,
              )
            }
            onCreated={(clinicalStudioCourseId) =>
              queryClient.setQueryData<Course>(['course', courseId], (old) =>
                old ? { ...old, clinicalStudioCourseId } : old,
              )
            }
          />
        )}
        <ExportModal
          open={modal === 'export'}
          onClose={() => setModal(null)}
          courseId={courseId}
          doc={doc}
          onExported={() => void queryClient.invalidateQueries({ queryKey: ['courses'] })}
          onGoTo={(spot) => goTo(spot.id, spot.layout ?? null, spot.blockId ?? null)}
          fixing={assistant.busy}
          onFix={(request) => {
            setAssistantOpen(true);
            void assistant.send({ pageId: page.id, layout, selectedId: blockId }, request);
          }}
        />
        {assistantOpen && (
          <AssistantPanel
            entries={assistant.entries}
            busy={assistant.busy}
            status={assistant.status}
            cost={assistant.cost}
            canUndo={assistant.canUndo}
            onSend={(text, images, decks) =>
              void assistant.send(
                { pageId: page.id, layout, selectedId: blockId },
                text,
                images,
                decks,
              )
            }
            onDeck={assistant.importDeck}
            onGoTo={goTo}
            pendingDeck={assistant.pendingDeck}
            onDeckChoice={assistant.resolveDeck}
            canFinishDeck={assistant.canFinishDeck}
            onFinishDeck={() => void assistant.finishDeck()}
            onStop={assistant.stop}
            onUndo={assistant.undo}
            canClear={assistant.canClear}
            onClear={assistant.clear}
            onMinimise={() => setAssistantOpen(false)}
            onClose={() => {
              assistant.clear();
              setAssistantOpen(false);
            }}
          />
        )}
        {modal === 'preview' && (
          <PreviewModal
            doc={doc}
            startPageId={page.id}
            layout={layout}
            onClose={() => setModal(null)}
          />
        )}
      </div>
      </CourseColours.Provider>
    </FontOptions.Provider>
  );
}

function SegButton({
  on,
  onClick,
  icon,
  label,
}: {
  on: boolean;
  onClick: () => void;
  icon?: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-md border-[1.5px] px-2.5 py-1 text-xs font-medium',
        on
          ? 'border-ph-purple bg-ph-purple/5 text-ph-purple'
          : 'border-ph-charcoal/15 bg-white text-ph-charcoal/70',
      )}
    >
      {icon}
      {label}
    </button>
  );
}
