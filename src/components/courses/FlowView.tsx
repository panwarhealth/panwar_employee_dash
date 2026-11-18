import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type SetStateAction,
} from 'react';
import {
  Controls,
  Handle,
  MiniMap,
  Panel,
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
import { hubsOf, newPage, uid, type CourseDoc, type Page, type Trigger } from '@/course/doc';
import * as ops from '@/course/edit';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { cn } from '@/lib/utils';
import { objectOptions } from './blockMeta';
import {
  CARD,
  WIRE_LOOK,
  curve,
  flowExits,
  flowWires,
  positions,
  sameStart,
  wireAt,
  type Curve,
  type FlowExit,
  type WireKind,
} from './flowGraph';
import { FlowWires } from './FlowWires';
import { Select } from './fields';
import { TriggerWizard } from './TriggerWizard';

interface PageData extends Record<string, unknown> {
  n: number;
  title: string;
  exits: FlowExit[];
  kinds: Record<string, WireKind>;
  names: Record<string, string>;
  kind: 'start' | 'main' | 'side';
  quiz: boolean;
  current: boolean;
}

type PageNode = Node<PageData, 'page'>;

const Picked = createContext<{ picked: string | null; onPick: (exitId: string) => void }>({
  picked: null,
  onPick: () => {},
});

const NO_EDGES: Edge[] = [];
const HEADS = {
  start: 'bg-green-600 text-white',
  main: 'bg-ph-charcoal text-white',
  side: 'bg-[#e6dcec] text-ph-charcoal',
};
const LEGEND: WireKind[] = ['next', 'jump', 'if', 'side'];

function exitTarget(e: FlowExit, names: Record<string, string>): string {
  if (e.to) return names[e.to];
  if (e.step === 'page') return 'Missing page';
  return e.step === 'prev' ? 'Nowhere' : 'End of course';
}

const PageCard = memo(function PageCard({ data, selected }: NodeProps<PageNode>) {
  const { picked, onPick } = useContext(Picked);
  const more = data.exits.length - CARD.shown;
  return (
    <div
      className={cn(
        'relative w-64 rounded-xl border-2 bg-white text-left shadow-sm',
        selected
          ? 'border-ph-purple ring-4 ring-ph-purple/25'
          : data.current
            ? 'border-ph-pink'
            : 'border-ph-charcoal/25',
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        isConnectableStart={false}
        style={{ top: CARD.head - 2, left: -2 }}
        className="!h-3 !w-3 !border-2 !border-white !bg-ph-charcoal/60"
      />
      <div className={cn('flex h-9 items-center gap-1.5 rounded-t-[10px] px-3', HEADS[data.kind])}>
        <span className="text-xs font-semibold opacity-60">{data.n}.</span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
          {data.title || 'Untitled'}
        </span>
        {data.kind === 'start' && (
          <span className="rounded-full bg-white/25 px-1.5 text-[10px] font-bold">START</span>
        )}
        {data.quiz && (
          <span className="rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-ph-charcoal">
            QUIZ
          </span>
        )}
      </div>
      <ul className="flex flex-col px-1.5 py-1.5 text-[11px] text-ph-charcoal/80">
        {data.exits.length === 0 && (
          <li className="flex h-[22px] items-center px-1.5 font-semibold text-red-600">
            No way out yet
          </li>
        )}
        {data.exits.slice(0, CARD.shown).map((e) => {
          const kind = data.kinds[e.id];
          return (
            <li key={e.id} className="relative h-[22px]">
              <button
                type="button"
                title="Select this branch"
                onClick={() => onPick(e.id)}
                className={cn(
                  'nodrag flex h-full w-full items-center gap-1 rounded px-1.5 text-left hover:bg-ph-purple/10',
                  picked === e.id && 'bg-ph-pink/15',
                )}
              >
                <span className="min-w-0 flex-1 truncate">
                  {e.rank && <span className="text-ph-charcoal/40">{e.rank}. </span>}
                  <span className="font-semibold">{e.start}</span>
                  {e.condition && <span className="text-amber-700"> {e.condition}</span>}
                </span>
                <span
                  className={cn(
                    'max-w-[45%] shrink-0 truncate',
                    e.to || e.step !== 'page' ? 'text-ph-charcoal/50' : 'font-semibold text-red-600',
                  )}
                >
                  {exitTarget(e, data.names)}
                </span>
              </button>
              <span
                className="pointer-events-none absolute -right-[13px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 border-white"
                style={{ background: picked === e.id ? PINK : kind ? WIRE_LOOK[kind].colour : '#d4d4d8' }}
              />
            </li>
          );
        })}
        {more > 0 && (
          <li className="flex h-[22px] items-center px-1.5 text-ph-charcoal/40">+ {more} more</li>
        )}
      </ul>
      <Handle
        type="source"
        position={Position.Right}
        title="Drag onto another page to add a branch"
        style={{ top: CARD.head - 2, right: -2 }}
        className="!h-3.5 !w-3.5 !border-2 !border-white !bg-ph-purple"
      />
    </div>
  );
});

const NODE_TYPES = { page: PageCard };

type Menu = { x: number; y: number; pageId: string | null };

const PINK = '#e6007e';
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
  const wires = useMemo(() => flowWires(doc, exits), [doc, exits]);
  const built = useMemo<PageNode[]>(() => {
    const at = positions(doc, exits);
    const hubOf = hubsOf(doc);
    const kinds = Object.fromEntries(wires.map((w) => [w.id, w.kind]));
    return doc.pages.map((p, i) => ({
      id: p.id,
      type: 'page',
      position: at.get(p.id)!,
      data: {
        n: i + 1,
        title: p.title,
        exits: exits.filter((e) => e.from === p.id),
        kinds,
        names,
        kind: i === 0 ? 'start' : hubOf.has(p.id) ? 'side' : 'main',
        quiz: p.blocks.some((b) => b.type === 'check'),
        current: p.id === currentId,
      },
    }));
  }, [doc, exits, wires, names, currentId]);
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

  const lit = useMemo(() => new Set(nodes.filter((n) => n.selected).map((n) => n.id)), [nodes]);
  const shown = useMemo(
    () =>
      wires.filter(
        (w) =>
          backs ||
          w.id === picked ||
          lit.has(w.from) ||
          lit.has(w.to) ||
          (w.kind !== 'back' && w.kind !== 'again'),
      ),
    [wires, backs, picked, lit],
  );
  const curves = useMemo(() => {
    const at = new Map(nodes.map((n) => [n.id, n.position]));
    const out = new Map<string, Curve>();
    for (const w of shown) {
      const from = at.get(w.from);
      const to = at.get(w.to);
      if (from && to) out.set(w.id, curve(from, w.row, to));
    }
    return out;
  }, [shown, nodes]);
  const wireUnder = (e: { clientX: number; clientY: number }) => {
    const p = flow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    return wireAt(curves, p.x, p.y, 8 / flow.getZoom());
  };
  const pick = useMemo(() => ({ picked, onPick: setPicked }), [picked]);
  const [home] = useState(() => {
    const p = built[0]?.position ?? { x: 0, y: 0 };
    return { x: 60 - p.x, y: 80 - p.y, zoom: 1 };
  });

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
          on a page, to edit it. Click a page to light up its lines. Right-click for a new page.
          Double-click a page to open it.
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-ph-charcoal/70">
            <input type="checkbox" checked={backs} onChange={(e) => setBacks(e.target.checked)} />
            Show every line
          </label>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (!window.confirm('Lay out every page again automatically?')) return;
              setDoc((d) => ops.updateCourse(d, (c) => c.pages.forEach((p) => delete p.flow)));
              setTimeout(() => flow.setViewport({ x: 60, y: 80, zoom: 1 }), 50);
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
        <Picked.Provider value={pick}>
          <ReactFlow<PageNode>
            nodes={nodes}
            edges={NO_EDGES}
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
            onMoveStart={() => setMenu(null)}
            onPaneClick={(e) => {
              setPicked(wireUnder(e));
              setMenu(null);
            }}
            onPaneMouseMove={(e) => {
              (e.currentTarget as HTMLElement).style.cursor = wireUnder(e) ? 'pointer' : '';
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
            defaultViewport={home}
            onlyRenderVisibleElements
            minZoom={0.1}
            proOptions={{ hideAttribution: true }}
          >
            <FlowWires
              wires={shown}
              curves={curves}
              picked={picked}
              label={exit ? `${exit.rank ? `${exit.rank}. ` : ''}${exit.start}` : ''}
              lit={lit}
            />
            <Panel position="bottom-center">
              <ul className="flex items-center gap-4 rounded-full border border-ph-charcoal/10 bg-white/90 px-4 py-1.5 text-[11px] text-ph-charcoal/70">
                {LEGEND.map((k) => (
                  <li key={k} className="flex items-center gap-1.5">
                    <span
                      className="h-0 w-6 border-t-2"
                      style={{
                        borderColor: WIRE_LOOK[k].colour,
                        borderStyle: WIRE_LOOK[k].dash.length ? 'dashed' : 'solid',
                      }}
                    />
                    {WIRE_LOOK[k].name}
                  </li>
                ))}
                <li className="flex items-center gap-1.5">
                  <span className="h-2.5 w-4 rounded-sm bg-ph-charcoal" />
                  Main page
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="h-2.5 w-4 rounded-sm bg-[#e6dcec]" />
                  Side page
                </li>
              </ul>
            </Panel>
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable nodeColor="#b9b4bf" />
          </ReactFlow>
        </Picked.Provider>

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
