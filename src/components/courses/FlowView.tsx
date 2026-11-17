import { useCallback, useEffect, useMemo, useState, type SetStateAction } from 'react';
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useReactFlow,
  type Edge,
  type Node,
  type NodeChange,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { newPage, uid, type CourseDoc, type Page, type Trigger } from '@/course/doc';
import * as ops from '@/course/edit';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { cn } from '@/lib/utils';
import { objectOptions } from './blockMeta';
import { flowExits, positions, sameStart, type FlowExit } from './flowGraph';
import { Select } from './fields';
import { TriggerWizard } from './TriggerWizard';

interface PageData extends Record<string, unknown> {
  n: number;
  title: string;
  exits: FlowExit[];
  names: Record<string, string>;
  start: boolean;
  current: boolean;
  picked: string | null;
  onPick: (exitId: string) => void;
}

type PageNode = Node<PageData, 'page'>;

const SHOWN = 8;

function exitTarget(e: FlowExit, names: Record<string, string>): string {
  if (e.to) return names[e.to];
  if (e.step === 'page') return 'Missing page';
  return e.step === 'prev' ? 'Nowhere' : 'End of course';
}

function PageCard({ data }: NodeProps<PageNode>) {
  return (
    <div
      className={cn(
        'w-64 rounded-xl border-2 bg-white text-left shadow-sm',
        data.current ? 'border-ph-purple' : 'border-ph-charcoal/15',
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        isConnectableStart={false}
        className="!h-3 !w-3 !bg-ph-charcoal/40"
      />
      <div className="flex items-center gap-1.5 border-b border-ph-charcoal/10 px-3 py-2">
        <span className="text-xs font-semibold text-ph-charcoal/40">{data.n}.</span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ph-charcoal">
          {data.title || 'Untitled'}
        </span>
        {data.start && (
          <span className="rounded-full bg-green-600 px-1.5 text-[10px] font-bold text-white">
            START
          </span>
        )}
      </div>
      <ul className="flex flex-col px-1.5 py-1.5 text-[11px] leading-snug text-ph-charcoal/80">
        {data.exits.length === 0 && (
          <li className="px-1.5 text-ph-charcoal/40">No way out yet</li>
        )}
        {data.exits.slice(0, SHOWN).map((e) => (
          <li key={e.id}>
            <button
              type="button"
              title="Select this branch"
              onClick={() => data.onPick(e.id)}
              className={cn(
                'nodrag block w-full truncate rounded px-1.5 py-0.5 text-left hover:bg-ph-purple/10',
                data.picked === e.id && 'bg-ph-pink/10',
              )}
            >
              {e.rank && <span className="text-ph-charcoal/40">{e.rank}. </span>}
              <span className="font-semibold">{e.start}</span>
              {e.condition && <span className="text-amber-700"> {e.condition}</span>}
              <span className="text-ph-charcoal/40"> → </span>
              <span className={e.to || e.step !== 'page' ? '' : 'font-semibold text-red-600'}>
                {exitTarget(e, data.names)}
              </span>
            </button>
          </li>
        ))}
        {data.exits.length > SHOWN && (
          <li className="px-1.5 text-ph-charcoal/40">+ {data.exits.length - SHOWN} more</li>
        )}
      </ul>
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !bg-ph-purple" />
    </div>
  );
}

const NODE_TYPES = { page: PageCard };

type Menu = { x: number; y: number; pageId: string | null };

const PINK = '#e6007e';
const FAINT = '#c4b5cf';
const smallButton =
  'rounded border border-ph-charcoal/20 px-2 py-0.5 hover:border-ph-purple hover:text-ph-purple disabled:opacity-30';
const choiceButton =
  'rounded-md border border-ph-charcoal/10 px-3 py-2 text-left hover:border-ph-purple hover:text-ph-purple';

function Flow({
  doc,
  setDoc,
  currentId,
  onOpen,
  onClose,
}: {
  doc: CourseDoc;
  setDoc: (next: SetStateAction<CourseDoc>) => void;
  currentId: string;
  onOpen: (pageId: string) => void;
  onClose: () => void;
}) {
  const flow = useReactFlow();
  const [picked, setPicked] = useState<string | null>(null);
  const [backs, setBacks] = useState(false);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [linking, setLinking] = useState<{ from: string; to: string } | null>(null);
  const [wizard, setWizard] = useState<{ page: Page; trigger: Trigger } | null>(null);
  const exits = useMemo(() => flowExits(doc), [doc]);
  const names = useMemo(
    () => Object.fromEntries(doc.pages.map((p, i) => [p.id, `${i + 1}. ${p.title || 'Untitled'}`])),
    [doc.pages],
  );
  const built = useMemo<PageNode[]>(() => {
    const at = positions(doc, exits);
    return doc.pages.map((p, i) => ({
      id: p.id,
      type: 'page',
      position: at.get(p.id)!,
      data: {
        n: i + 1,
        title: p.title,
        exits: exits.filter((e) => e.from === p.id),
        names,
        start: i === 0,
        current: p.id === currentId,
        picked,
        onPick: setPicked,
      },
    }));
  }, [doc, exits, names, currentId, picked]);
  const [nodes, setNodes] = useState<PageNode[]>(built);
  const [synced, setSynced] = useState(built);
  if (synced !== built) {
    setSynced(built);
    setNodes((now) =>
      built.map((n) => {
        const old = now.find((o) => o.id === n.id);
        return old ? { ...n, measured: old.measured, selected: old.selected } : n;
      }),
    );
  }

  const edges = useMemo<Edge[]>(
    () =>
      exits
        .filter((e) => e.to && e.to !== e.from)
        .filter((e) => backs || e.id === picked || e.step !== 'prev')
        .map((e) => {
          const on = e.id === picked;
          const faint = e.step === 'next' || e.step === 'prev' || e.detour;
          const colour = e.triggerId ? '#702f8f' : '#2f3030';
          const stroke = on ? PINK : faint ? FAINT : colour;
          const named = on || !!e.condition || !!e.rank;
          const rank = e.rank ? `${e.rank}. ` : '';
          return {
            id: e.id,
            source: e.from,
            target: e.to!,
            label: named ? `${rank}${e.start}${e.condition ? ` ${e.condition}` : ''}` : undefined,
            selected: on,
            zIndex: on ? 10 : 0,
            style: {
              stroke,
              strokeWidth: on ? 3 : faint ? 1 : 1.5,
              strokeDasharray: faint ? '6 4' : undefined,
            },
            labelStyle: { fontSize: 10, fill: '#2f3030' },
            labelBgStyle: { fill: '#ffffff' },
            markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
          };
        }),
    [exits, picked, backs],
  );

  const pageOf = (id: string) => doc.pages.find((p) => p.id === id)!;
  const exit = exits.find((e) => e.id === picked) ?? null;

  const change = (fn: (c: CourseDoc) => void) =>
    setDoc((d) =>
      ops.updateCourse(d, (c) => {
        for (const n of nodes) {
          const p = c.pages.find((x) => x.id === n.id);
          if (p && !p.flow) p.flow = { x: Math.round(n.position.x), y: Math.round(n.position.y) };
        }
        fn(c);
      }),
    );
  const changePage = (pageId: string, fn: (p: Page) => void) =>
    change((c) => {
      const p = c.pages.find((x) => x.id === pageId);
      if (p) fn(p);
    });

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || wizard || linking) return;
      if (menu) setMenu(null);
      else if (picked) setPicked(null);
      else onClose();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [wizard, linking, menu, picked, onClose]);

  const onNodesChange = useCallback(
    (changes: NodeChange<PageNode>[]) => setNodes((ns) => applyNodeChanges(changes, ns)),
    [],
  );

  const addPage = (at: { x: number; y: number }) => {
    const p = newPage(`Page ${doc.pages.length + 1}`);
    p.flow = { x: Math.round(at.x), y: Math.round(at.y) };
    change((c) => c.pages.push(p));
  };

  const link = (from: string, to: string, when: Trigger['when']) => {
    const t: Trigger = { id: uid(), when, action: { kind: 'page', pageId: to }, conditions: [] };
    changePage(from, (p) => p.triggers.push(t));
    setLinking(null);
    setPicked(`trigger:${t.id}`);
  };

  const move = (e: FlowExit, by: -1 | 1) => {
    const list = sameStart(pageOf(e.from), e.triggerId!);
    const other = list[list.findIndex((t) => t.id === e.triggerId) + by];
    if (!other) return;
    changePage(e.from, (p) => {
      const a = p.triggers.findIndex((t) => t.id === e.triggerId);
      const b = p.triggers.findIndex((t) => t.id === other.id);
      [p.triggers[a], p.triggers[b]] = [p.triggers[b], p.triggers[a]];
    });
  };

  const retarget = (e: FlowExit, to: string) => {
    if (to === 'missing') return;
    changePage(e.from, (p) => {
      if (e.choice) {
        const b = p.blocks.find((x) => x.id === e.choice!.blockId);
        const c = b?.type === 'pathway' && b.choices.find((x) => x.id === e.choice!.choiceId);
        if (c) c.pageId = to;
        return;
      }
      const b = p.blocks.find((x) => x.id === e.buttonId);
      const t = p.triggers.find((x) => x.id === e.triggerId);
      const old = b?.type === 'button' ? b.action : t?.action;
      const back = old?.kind === 'page' && old.back ? { back: true } : {};
      if (b?.type === 'button')
        b.action = to === 'next' ? { kind: 'next' } : { kind: 'page', pageId: to, ...back };
      else if (t)
        t.action =
          to === 'next' || to === 'prev' || to === 'finish'
            ? { kind: to }
            : { kind: 'page', pageId: to, ...back };
    });
  };

  const remove = (e: FlowExit) => {
    if (e.buttonId) retarget(e, 'next');
    else changePage(e.from, (p) => (p.triggers = p.triggers.filter((t) => t.id !== e.triggerId)));
    setPicked(null);
  };

  const siblings = exit?.triggerId ? sameStart(pageOf(exit.from), exit.triggerId) : [];
  const at = siblings.findIndex((t) => t.id === exit?.triggerId);
  const goes = exit ? (exit.step === 'page' ? (exit.to ?? 'missing') : exit.step) : '';
  const targets = exit
    ? [
        ...(exit.choice ? [] : [{ value: 'next', label: 'The next page in order' }]),
        ...(exit.triggerId
          ? [
              { value: 'prev', label: 'The previous page' },
              { value: 'finish', label: 'Finish the course' },
            ]
          : []),
        ...(goes === 'missing' ? [{ value: 'missing', label: 'Missing page' }] : []),
        ...doc.pages.map((p) => ({ value: p.id, label: names[p.id] })),
      ]
    : [];
  const why = !exit
    ? ''
    : exit.bar
      ? 'The Continue bar under every page. Turn it off in course settings.'
      : exit.choice
        ? 'A choice in a pathway question on this page.'
        : exit.buttonId
          ? "The button's own action. It runs only if none of the button's triggers went anywhere."
          : exit.condition
            ? `Only ${exit.condition}`
            : 'Always, no conditions';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#f4f2f6]">
      <div className="flex items-center gap-4 border-b border-ph-charcoal/10 bg-white px-4 py-2 text-sm">
        <strong className="shrink-0 font-semibold text-ph-charcoal">Course flow</strong>
        <span className="min-w-0 text-xs text-ph-charcoal/60">
          Drag from a page's purple dot onto another page to add a branch. Click a line, or a row
          on a page, to edit it. Right-click for a new page. Double-click a page to open it.
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-ph-charcoal/70">
            <input type="checkbox" checked={backs} onChange={(e) => setBacks(e.target.checked)} />
            Show back links
          </label>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (!window.confirm('Lay out every page again automatically?')) return;
              setDoc((d) => ops.updateCourse(d, (c) => c.pages.forEach((p) => delete p.flow)));
              setTimeout(() => flow.fitView(), 50);
            }}
          >
            Tidy up
          </Button>
          <Button size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        <ReactFlow<PageNode>
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodesChange={onNodesChange}
          onNodeDragStop={(_, __, moved) =>
            change((c) =>
              moved.forEach((n) => {
                const p = c.pages.find((x) => x.id === n.id);
                if (p) p.flow = { x: Math.round(n.position.x), y: Math.round(n.position.y) };
              }),
            )
          }
          onNodeClick={() => setMenu(null)}
          onNodeDoubleClick={(_, n) => onOpen(n.id)}
          onEdgeClick={(_, e) => setPicked(e.id)}
          onMoveStart={() => setMenu(null)}
          onPaneClick={() => {
            setPicked(null);
            setMenu(null);
          }}
          onConnectEnd={(ev, state) => {
            const from = state.fromNode?.id;
            const pt = 'changedTouches' in ev ? ev.changedTouches[0] : ev;
            const to =
              state.toNode?.id ??
              document
                .elementFromPoint(pt.clientX, pt.clientY)
                ?.closest('.react-flow__node')
                ?.getAttribute('data-id');
            if (from && to && from !== to) setLinking({ from, to });
          }}
          onPaneContextMenu={(e) => {
            e.preventDefault();
            setMenu({ x: e.clientX, y: e.clientY, pageId: null });
          }}
          onNodeContextMenu={(e, n) => {
            e.preventDefault();
            setMenu({ x: e.clientX, y: e.clientY, pageId: n.id });
          }}
          deleteKeyCode={null}
          fitView
          minZoom={0.1}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable />
        </ReactFlow>

        {menu && (
          <div
            className="fixed z-[60] min-w-[180px] rounded-lg border border-ph-charcoal/10 bg-white py-1 text-sm shadow-lg"
            style={{ left: menu.x, top: menu.y }}
          >
            {menu.pageId === null ? (
              <MenuItem
                onClick={() => {
                  addPage(flow.screenToFlowPosition({ x: menu.x, y: menu.y }));
                  setMenu(null);
                }}
              >
                New page here
              </MenuItem>
            ) : (
              <>
                <MenuItem onClick={() => onOpen(menu.pageId!)}>Open page</MenuItem>
                <MenuItem
                  onClick={() => {
                    const src = pageOf(menu.pageId!);
                    const copy = ops.copyPage(src);
                    const from = nodes.find((n) => n.id === src.id)?.position ?? { x: 0, y: 0 };
                    copy.flow = { x: Math.round(from.x + 40), y: Math.round(from.y + 40) };
                    change((c) => {
                      c.pages.splice(c.pages.findIndex((p) => p.id === src.id) + 1, 0, copy);
                    });
                    setMenu(null);
                  }}
                >
                  Duplicate page
                </MenuItem>
                {doc.pages.length > 1 && (
                  <MenuItem
                    danger
                    onClick={() => {
                      const p = pageOf(menu.pageId!);
                      setMenu(null);
                      if (!window.confirm(`Delete the page "${p.title}"?`)) return;
                      change((c) => (c.pages = c.pages.filter((x) => x.id !== p.id)));
                    }}
                  >
                    Delete page
                  </MenuItem>
                )}
              </>
            )}
          </div>
        )}

        {exit && (
          <aside className="absolute right-4 top-4 flex w-80 flex-col gap-3 rounded-xl border border-ph-charcoal/10 bg-white p-4 text-sm shadow-lg">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ph-charcoal/50">
                  Branch
                </p>
                <p className="font-semibold text-ph-charcoal">{names[exit.from]}</p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setPicked(null)}
                className="text-ph-charcoal/40 hover:text-ph-purple"
              >
                ×
              </button>
            </div>
            <p className="text-ph-charcoal/80">
              Starts when: <strong>{exit.start}</strong>
              <br />
              {why}
            </p>
            {exit.bar ? (
              <p className="text-ph-charcoal/80">Goes to: {exitTarget(exit, names)}</p>
            ) : (
              <Select
                label="Goes to"
                value={goes}
                options={targets}
                onChange={(v) => retarget(exit, v)}
              />
            )}
            {exit.step !== 'page' && exit.to && !exit.bar && (
              <p className="text-xs text-ph-charcoal/60">Right now that is {names[exit.to]}.</p>
            )}
            {siblings.length > 1 && (
              <div className="flex items-center gap-2 text-xs text-ph-charcoal/70">
                Order: {at + 1} of {siblings.length}
                <button
                  type="button"
                  disabled={at === 0}
                  onClick={() => move(exit, -1)}
                  className={smallButton}
                >
                  Run earlier
                </button>
                <button
                  type="button"
                  disabled={at === siblings.length - 1}
                  onClick={() => move(exit, 1)}
                  className={smallButton}
                >
                  Run later
                </button>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {exit.triggerId && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const page = pageOf(exit.from);
                    const t = page.triggers.find((x) => x.id === exit.triggerId);
                    if (t) setWizard({ page, trigger: t });
                  }}
                >
                  Edit conditions…
                </Button>
              )}
              {exit.triggerId && (
                <Button size="sm" variant="outline" onClick={() => remove(exit)}>
                  Delete branch
                </Button>
              )}
              {exit.buttonId && exit.step !== 'next' && (
                <Button size="sm" variant="outline" onClick={() => remove(exit)}>
                  Send to next page
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => onOpen(exit.from)}>
                Open page
              </Button>
            </div>
          </aside>
        )}
      </div>

      {linking && (
        <Modal
          open
          onClose={() => setLinking(null)}
          title="What starts this branch?"
          className="max-w-md"
        >
          <div className="flex flex-col gap-2 px-6 py-5 text-sm">
            <p className="text-ph-charcoal/70">
              From <strong>{names[linking.from]}</strong> to <strong>{names[linking.to]}</strong>.
              Pick what the learner does on {names[linking.from]}:
            </p>
            <div className="flex max-h-[50vh] flex-col gap-1 overflow-y-auto">
              {objectOptions(pageOf(linking.from)).map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() =>
                    link(linking.from, linking.to, { kind: 'click', blockId: o.value })
                  }
                  className={choiceButton}
                >
                  Clicks {o.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => link(linking.from, linking.to, { kind: 'pageStart' })}
                className={choiceButton}
              >
                Nothing, as soon as the page starts
              </button>
            </div>
          </div>
        </Modal>
      )}

      {wizard && (
        <TriggerWizard
          doc={doc}
          page={wizard.page}
          initial={wizard.trigger}
          onSave={(t) => {
            changePage(wizard.page.id, (p) => {
              p.triggers = p.triggers.map((x) => (x.id === t.id ? t : x));
            });
            setWizard(null);
          }}
          onClose={() => setWizard(null)}
        />
      )}
    </div>
  );
}

function MenuItem({
  onClick,
  danger = false,
  children,
}: {
  onClick: () => void;
  danger?: boolean;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'block w-full px-3 py-1.5 text-left hover:bg-ph-charcoal/5',
        danger ? 'text-red-600' : 'text-ph-charcoal',
      )}
    >
      {children}
    </button>
  );
}

export function FlowView(props: {
  doc: CourseDoc;
  setDoc: (next: SetStateAction<CourseDoc>) => void;
  currentId: string;
  onOpen: (pageId: string) => void;
  onClose: () => void;
}) {
  return (
    <ReactFlowProvider>
      <Flow {...props} />
    </ReactFlowProvider>
  );
}
