import { useState, type ReactNode } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Monitor, Settings, Smartphone, Sparkles } from 'lucide-react';
import { CanvasEditor } from '@/components/courses/CanvasEditor';
import { getCourse } from '@/api/courses';
import { Button } from '@/components/ui/button';
import { AddBlockMenu } from '@/components/courses/AddBlockMenu';
import { AssistantPanel } from '@/components/courses/AssistantPanel';
import { ExportModal } from '@/components/courses/ExportModal';
import { Inspector } from '@/components/courses/Inspector';
import { PageList } from '@/components/courses/PageList';
import { PreviewModal } from '@/components/courses/PreviewModal';
import { SettingsModal } from '@/components/courses/SettingsModal';
import { Stage } from '@/components/courses/Stage';
import { VariablesModal } from '@/components/courses/VariablesModal';
import { frameFor, newFrame } from '@/course/canvasLayout';
import { newBlock, newPage, normalizeDoc, type CourseDoc, type Layout } from '@/course/doc';
import * as ops from '@/course/edit';
import { fontFaces, fontOptions } from '@/course/typography';
import { FontOptions } from '@/components/courses/fontContext';
import { useCourseAssistant } from '@/hooks/useCourseAssistant';
import { useCourseAutosave } from '@/hooks/useCourseAutosave';
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
  return <Editor courseId={courseId} initial={normalizeDoc(data.content)} />;
}

function Editor({ courseId, initial }: { courseId: string; initial: CourseDoc }) {
  const queryClient = useQueryClient();
  const [doc, setDoc] = useState(initial);
  const [pageId, setPageId] = useState(initial.pages[0].id);
  const [blockId, setBlockId] = useState<string | null>(null);
  const [phone, setPhone] = useState(initial.screens === 'phone');
  const [modal, setModal] = useState<
    'add' | 'export' | 'settings' | 'preview' | 'variables' | null
  >(null);
  const save = useCourseAutosave(courseId, doc);
  const assistant = useCourseAssistant(courseId, doc, setDoc);
  const [assistantOpen, setAssistantOpen] = useState(false);

  const page = doc.pages.find((p) => p.id === pageId) ?? doc.pages[0];
  const layout: Layout = doc.screens === 'both' ? (phone ? 'phone' : 'desktop') : doc.screens;
  const otherLayout: Layout | null =
    doc.screens === 'both' ? (layout === 'phone' ? 'desktop' : 'phone') : null;
  const isCanvas = page.kind === 'canvas';
  const selectedBlock = page.blocks.find((b) => b.id === blockId) ?? null;
  const setFrame = (id: string, frame: Parameters<typeof ops.setFrame>[4]) =>
    setDoc((d) => ops.setFrame(d, page.id, id, layout, frame));
  const removeBlock = (id: string) => {
    setDoc((d) => ops.removeBlock(d, page.id, id));
    setBlockId(null);
  };
  const selectPage = (id: string) => {
    setPageId(id);
    setBlockId(null);
  };

  return (
    <FontOptions.Provider value={fontOptions(doc)}>
      <div className="-m-4 flex h-[calc(100vh-3.5rem)] md:-m-6">
        {doc.fonts.length > 0 && <style>{fontFaces(doc)}</style>}
        <PageList
          pages={doc.pages}
          currentId={page.id}
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
          <div className="flex items-center gap-3 border-b border-ph-charcoal/10 bg-white px-4 py-2 text-sm">
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
            <div className="ml-auto flex items-center gap-2">
              <div className="flex gap-1">
                <SegButton
                  on={!isCanvas}
                  onClick={() => setDoc((d) => ops.setPageKind(d, page.id, 'flow'))}
                  label="Flow"
                />
                <SegButton
                  on={isCanvas}
                  onClick={() => setDoc((d) => ops.setPageKind(d, page.id, 'canvas'))}
                  label="Canvas"
                />
              </div>
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
                onClick={() => setModal('variables')}
                className="rounded-md px-2 py-1.5 text-xs font-medium text-ph-charcoal/70 hover:bg-ph-charcoal/5 hover:text-ph-purple"
              >
                Variables
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
              <Button size="sm" onClick={() => setModal('export')}>
                Export zip
              </Button>
            </div>
          </div>
          {isCanvas ? (
            <div className="flex flex-1 justify-center overflow-auto p-6">
              <CanvasEditor
                doc={doc}
                page={page}
                layout={layout}
                selectedId={blockId}
                onSelect={setBlockId}
                onFrame={setFrame}
                onRemove={removeBlock}
                onText={(id, value) =>
                  setDoc((d) =>
                    ops.updateBlock(d, page.id, id, (b) => {
                      if (b.type === 'text') b.html = value;
                      if (b.type === 'heading') b.text = value;
                    }),
                  )
                }
              />
            </div>
          ) : (
            <Stage
              doc={doc}
              page={page}
              phone={layout === 'phone'}
              selectedId={blockId}
              onSelect={setBlockId}
            />
          )}
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
          onDuplicateBlock={(id) => {
            const copy = ops.copyBlock(page.blocks.find((b) => b.id === id)!);
            setDoc((d) => ops.insertBlock(d, page.id, id, copy));
            setBlockId(copy.id);
          }}
          onRemoveBlock={removeBlock}
          canvas={
            isCanvas
              ? {
                  layout,
                  otherLayout,
                  frame: selectedBlock ? frameFor(page, selectedBlock, layout) : null,
                  onFrame: (f) => selectedBlock && setFrame(selectedBlock.id, f),
                  onCopyLayout: () =>
                    otherLayout && setDoc((d) => ops.copyLayout(d, page.id, otherLayout, layout)),
                }
              : null
          }
        />

        <AddBlockMenu
          open={modal === 'add'}
          onClose={() => setModal(null)}
          onPick={(type) => {
            const b = newBlock(type);
            setDoc((d) => {
              const next = ops.insertBlock(d, page.id, blockId, b);
              return isCanvas
                ? ops.setFrame(next, page.id, b.id, layout, newFrame(type, layout))
                : next;
            });
            setBlockId(b.id);
            setModal(null);
          }}
        />
        <SettingsModal
          open={modal === 'settings'}
          onClose={() => setModal(null)}
          doc={doc}
          courseId={courseId}
          onChange={(fn) => setDoc((d) => ops.updateCourse(d, fn))}
        />
        <VariablesModal
          open={modal === 'variables'}
          onClose={() => setModal(null)}
          doc={doc}
          onChange={(fn) => setDoc((d) => ops.updateCourse(d, fn))}
        />
        <ExportModal
          open={modal === 'export'}
          onClose={() => setModal(null)}
          courseId={courseId}
          doc={doc}
          onExported={() => void queryClient.invalidateQueries({ queryKey: ['courses'] })}
        />
        {assistantOpen && (
          <AssistantPanel
            entries={assistant.entries}
            busy={assistant.busy}
            status={assistant.status}
            cost={assistant.cost}
            canUndo={assistant.canUndo}
            onSend={(text) => void assistant.send(text)}
            onDeck={(file) => void assistant.buildFromDeck(file)}
            onStop={assistant.stop}
            onUndo={assistant.undo}
            onClose={() => setAssistantOpen(false)}
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
