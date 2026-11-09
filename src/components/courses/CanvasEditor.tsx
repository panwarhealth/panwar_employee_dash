import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { editContext } from '@/course/editContext';
import { CanvasStage } from '@/course/canvas';
import { PopupLayer } from '@/course/interactive';
import {
  backdropClass,
  frameFor,
  frameStyle,
  groupFrame,
  growsToFit,
  MENU_CORNER,
  refit,
} from '@/course/canvasLayout';
import {
  groupsOf,
  isHiddenPopup,
  type CourseDoc,
  type Frame,
  type Layout,
  type Page,
} from '@/course/doc';
import { bounds } from '@/course/geometry';
import { cn } from '@/lib/utils';
import { isDecor } from './blockKinds';
import { InlineText } from './InlineText';
import { ObjectMenu } from './ObjectMenu';
import { objectMenuItems } from './objectMenuItems';

const SAFE_ZONE_KEY = 'course-editor.show-safe-zone';
const SNAP_KEY = 'course-editor.snap';
const ZOOMS = [1, 1.5, 2, 3, 4];
const STAGE_PX: Record<Layout, number> = { desktop: 960, phone: 360 };

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) !== '0';
  } catch {
    return true;
  }
}

function saveFlag(key: string, on: boolean) {
  try {
    localStorage.setItem(key, on ? '1' : '0');
  } catch {
    return;
  }
}

type Mode = 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'rotate';

interface Drag {
  id: string;
  mode: Mode;
  startX: number;
  startY: number;
  orig: Frame;
}

interface SelectionBox {
  left: number;
  top: number;
  width: number;
  height: number;
  transform: string;
}

interface Guides {
  x: number[];
  y: number[];
}

const SNAP = 1;
const PICKED = '__picked';
const MIN = 2;

function selectionOf(page: Page, selectedId: string | null): string[] {
  if (!selectedId) return [];
  const group = groupsOf(page).find((g) => g.id === selectedId);
  if (group) return group.members;
  return page.blocks.some((b) => b.id === selectedId) ? [selectedId] : [];
}

function snapAxis(
  pos: number,
  size: number,
  targets: number[],
): { delta: number; at: number | null } {
  let best: { delta: number; at: number | null } = { delta: 0, at: null };
  for (const edge of [pos, pos + size / 2, pos + size]) {
    for (const t of targets) {
      const d = t - edge;
      if (Math.abs(d) <= SNAP && (best.at === null || Math.abs(d) < Math.abs(best.delta)))
        best = { delta: d, at: t };
    }
  }
  return best;
}

export function CanvasEditor({
  doc,
  page,
  layout,
  selectedId,
  onSelect,
  onFrame,
  onFrames,
  onRemove,
  onText,
  onGroup,
  onUngroup,
  onCopy,
  onDuplicate,
  onPaste,
  canPaste,
}: {
  doc: CourseDoc;
  page: Page;
  layout: Layout;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onFrame: (blockId: string, frame: Frame) => void;
  onFrames: (frames: Record<string, Frame>) => void;
  onRemove: (ids: string[]) => void;
  onText: (blockId: string, value: string) => void;
  onGroup: (ids: string[]) => void;
  onUngroup: (groupId: string) => void;
  onCopy: (ids: string[]) => void;
  onDuplicate: (ids: string[]) => void;
  onPaste: () => void;
  canPaste: boolean;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [live, setLive] = useState<Frame | null>(null);
  const [guides, setGuides] = useState<Guides>({ x: [], y: [] });
  const [showSafeZone, setShowSafeZone] = useState(() => readFlag(SAFE_ZONE_KEY));
  const [snap, setSnap] = useState(() => readFlag(SNAP_KEY));
  const [zoom, setZoom] = useState(1);
  const [editing, setEditing] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const missing = page.blocks.filter((b) => !b.frames?.[layout]).length;

  const groups = groupsOf(page);
  const groupBy = new Map(groups.flatMap((g) => g.members.map((id) => [id, g] as const)));
  const selected = page.blocks.find((b) => b.id === selectedId) ?? null;
  const selectedGroup = groups.find((g) => g.id === selectedId) ?? null;
  const dragMembers =
    drag?.id === PICKED ? picked : drag ? groups.find((g) => g.id === drag.id)?.members : undefined;
  const selectedIds = selectionOf(page, selectedId);
  const [box, setBox] = useState<SelectionBox | null>(null);

  useEffect(() => setPicked([]), [page.id]);

  useLayoutEffect(() => {
    const els = selectionOf(page, selectedId)
      .map((id) => stage.current?.querySelector<HTMLElement>(`[data-obj="${CSS.escape(id)}"]`))
      .filter((el): el is HTMLElement => !!el);
    const measure = () => {
      if (!els.length) return setBox((prev) => (prev ? null : prev));
      const left = Math.min(...els.map((el) => el.offsetLeft));
      const top = Math.min(...els.map((el) => el.offsetTop));
      const next = {
        left,
        top,
        width: Math.max(...els.map((el) => el.offsetLeft + el.offsetWidth)) - left,
        height: Math.max(...els.map((el) => el.offsetTop + el.offsetHeight)) - top,
        transform: els.length === 1 ? els[0].style.transform : '',
      };
      setBox((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    measure();
    if (!els.length) return;
    const resize = new ResizeObserver(measure);
    els.forEach((el) => resize.observe(el));
    resize.observe(stage.current!);
    return () => resize.disconnect();
  }, [selectedId, live, page, layout, editing]);

  useEffect(() => {
    const ids = picked.length > 1 ? picked : selectionOf(page, selectedId);
    const group = groupsOf(page).find((g) => g.id === selectedId);
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable="true"]')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        if (e.shiftKey && group) onUngroup(group.id);
        else if (!e.shiftKey && picked.length > 1) {
          onGroup(picked);
          setPicked([]);
        }
        return;
      }
      if (e.key === 'Escape') {
        setPicked([]);
        onSelect(null);
        return;
      }
      const shortcut = (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase();
      if (shortcut === 'v' && canPaste) {
        e.preventDefault();
        onPaste();
        return;
      }
      if (!ids.length) return;
      if (shortcut === 'c') {
        e.preventDefault();
        onCopy(ids);
        return;
      }
      if (shortcut === 'd') {
        e.preventDefault();
        onDuplicate(ids);
        setPicked([]);
        return;
      }
      const step = e.shiftKey ? 5 : 0.5;
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      if (moves[e.key]) {
        e.preventDefault();
        const [dx, dy] = moves[e.key];
        onFrames(
          Object.fromEntries(
            ids.map((id) => {
              const f = frameFor(page, page.blocks.find((b) => b.id === id)!, layout);
              return [id, { ...f, x: f.x + dx, y: f.y + dy }];
            }),
          ),
        );
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        onRemove(ids);
        setPicked([]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    selectedId,
    picked,
    page,
    layout,
    onFrames,
    onRemove,
    onSelect,
    onGroup,
    onUngroup,
    onCopy,
    onDuplicate,
    onPaste,
    canPaste,
  ]);

  const menuIds = picked.length > 1 ? picked : selectedIds;
  const openMenu = (e: ReactMouseEvent, id: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    if (id && !menuIds.includes(id)) {
      setPicked([]);
      const g = groupBy.get(id);
      onSelect(g && selectedId !== id ? g.id : id);
    } else if (!id) {
      setPicked([]);
      onSelect(null);
    }
    setMenu({ x: e.clientX, y: e.clientY });
  };
  const menuItems = objectMenuItems({
    ids: menuIds,
    canPaste,
    onCopy,
    onPaste,
    onDuplicate: (ids) => {
      onDuplicate(ids);
      setPicked([]);
    },
    onRemove: (ids) => {
      onRemove(ids);
      setPicked([]);
    },
  });

  const toPct = (e: { clientX: number; clientY: number }) => {
    const r = stage.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
      rect: r,
    };
  };

  const pick = (id: string) => {
    const g = groupBy.get(id);
    const add = g && selectedId !== id ? g.members : [id];
    const current = picked.length ? picked : selectedIds;
    const has = add.every((x) => current.includes(x));
    setPicked(has ? current.filter((x) => !add.includes(x)) : [...new Set([...current, ...add])]);
    onSelect(null);
  };

  const begin = (e: ReactPointerEvent, id: string, mode: Mode) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const backdrop = page.blocks.find((b) => b.id === id);
    const deselects = selectedId !== null || picked.length > 0;
    if (mode === 'move' && backdrop && isDecor(backdrop) && selectedId !== id && deselects) {
      setPicked([]);
      return onSelect(null);
    }
    if (mode === 'move' && e.shiftKey) return pick(id);
    if (mode === 'move' && picked.length > 1 && picked.includes(id)) {
      const p = toPct(e);
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      const frames = picked.map((m) => frameFor(page, page.blocks.find((b) => b.id === m)!, layout));
      setDrag({ id: PICKED, mode, startX: p.x, startY: p.y, orig: { ...bounds(frames), r: 0 } });
      return;
    }
    setPicked([]);
    const g = groupBy.get(id);
    const target = mode === 'move' && g && selectedId !== id ? g.id : id;
    onSelect(target);
    const group = groups.find((x) => x.id === target);
    const block = page.blocks.find((b) => b.id === target);
    const orig = group ? groupFrame(page, group, layout) : frameFor(page, block!, layout);
    const p = toPct(e);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setDrag({ id: target, mode, startX: p.x, startY: p.y, orig });
  };

  const move = (e: ReactPointerEvent) => {
    if (!drag) return;
    const p = toPct(e);
    const dx = p.x - drag.startX;
    const dy = p.y - drag.startY;
    const o = drag.orig;
    let f: Frame = { ...o };
    const g: Guides = { x: [], y: [] };

    if (drag.mode === 'move') {
      f = { ...o, x: o.x + dx, y: o.y + dy };
      if (snap && !e.altKey) {
        const others = page.blocks
          .filter((b) => b.id !== drag.id && !dragMembers?.includes(b.id))
          .map((b) => frameFor(page, b, layout));
        const sx = snapAxis(f.x, f.w, [
          0,
          50,
          100,
          ...others.flatMap((o2) => [o2.x, o2.x + o2.w / 2, o2.x + o2.w]),
        ]);
        const sy = snapAxis(f.y, f.h, [
          0,
          50,
          100,
          ...others.flatMap((o2) => [o2.y, o2.y + o2.h / 2, o2.y + o2.h]),
        ]);
        f.x += sx.delta;
        f.y += sy.delta;
        if (sx.at !== null) g.x.push(sx.at);
        if (sy.at !== null) g.y.push(sy.at);
      }
    } else if (drag.mode === 'rotate') {
      const cx = p.rect.left + ((o.x + o.w / 2) / 100) * p.rect.width;
      const cy = p.rect.top + ((o.y + o.h / 2) / 100) * p.rect.height;
      let deg = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI + 90;
      deg = ((deg % 360) + 360) % 360;
      const nearest = Math.round(deg / 15) * 15;
      if (!e.shiftKey && Math.abs(deg - nearest) < 4) deg = nearest;
      f = { ...o, r: deg > 180 ? deg - 360 : deg };
    } else {
      const west = drag.mode === 'nw' || drag.mode === 'sw';
      const north = drag.mode === 'nw' || drag.mode === 'ne';
      const w = Math.max(MIN, west ? o.w - dx : o.w + dx);
      const h = Math.max(MIN, north ? o.h - dy : o.h + dy);
      f = { ...o, w, h, x: west ? o.x + o.w - w : o.x, y: north ? o.y + o.h - h : o.y };
    }
    setLive(f);
    setGuides(g);
  };

  const end = () => {
    if (drag && live && dragMembers)
      onFrames(
        Object.fromEntries(
          dragMembers.map((id) => {
            const f = frameFor(page, page.blocks.find((b) => b.id === id)!, layout);
            return [id, refit(f, drag.orig, live)];
          }),
        ),
      );
    else if (drag && live) onFrame(drag.id, live);
    setDrag(null);
    setLive(null);
    setGuides({ x: [], y: [] });
  };

  return (
    <div
      className="flex min-h-full w-full flex-col items-center gap-2 p-6"
      onPointerDown={(e) => {
        if (e.target !== e.currentTarget) return;
        setPicked([]);
        onSelect(null);
      }}
    >
      {missing > 0 && (
        <p className="relative z-30 rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
          {missing === page.blocks.length
            ? `Nothing is placed in the ${layout} layout yet.`
            : `${missing} ${missing === 1 ? "object isn't" : "objects aren't"} placed in the ${layout} layout yet.`}{' '}
          Drag them into place, or copy positions from the other layout.
        </p>
      )}
      <div className="sticky top-0 z-40 flex items-center gap-4 rounded-md bg-[#eceaef]/90 px-2 py-1 text-xs text-ph-charcoal/60">
        <span className="flex items-center gap-1">
          <button
            type="button"
            title="Zoom out"
            disabled={zoom === ZOOMS[0]}
            onClick={() => setZoom(ZOOMS[ZOOMS.indexOf(zoom) - 1])}
            className="flex h-6 w-6 items-center justify-center rounded border border-ph-charcoal/20 bg-white text-sm font-semibold text-ph-charcoal hover:border-ph-purple hover:text-ph-purple disabled:opacity-40"
          >
            −
          </button>
          <button
            type="button"
            title="Back to fit"
            onClick={() => setZoom(1)}
            className="w-12 text-center tabular-nums hover:text-ph-purple"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            title="Zoom in"
            disabled={zoom === ZOOMS[ZOOMS.length - 1]}
            onClick={() => setZoom(ZOOMS[ZOOMS.indexOf(zoom) + 1])}
            className="flex h-6 w-6 items-center justify-center rounded border border-ph-charcoal/20 bg-white text-sm font-semibold text-ph-charcoal hover:border-ph-purple hover:text-ph-purple disabled:opacity-40"
          >
            +
          </button>
        </span>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={snap}
            onChange={(e) => {
              setSnap(e.target.checked);
              saveFlag(SNAP_KEY, e.target.checked);
            }}
          />
          Snap to guides
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={showSafeZone}
            onChange={(e) => {
              setShowSafeZone(e.target.checked);
              saveFlag(SAFE_ZONE_KEY, e.target.checked);
            }}
          />
          Show safe zone
        </label>
      </div>
      <div
        ref={stage}
        className={cn(
          'cp [&_.cp-stage]:overflow-visible',
          zoom === 1 ? 'w-full' : 'mx-auto shrink-0 self-start',
          zoom === 1 && (layout === 'phone' ? 'max-w-[360px]' : 'max-w-[960px]'),
        )}
        style={zoom === 1 ? undefined : { width: STAGE_PX[layout] * zoom }}
        onPointerMove={move}
        onPointerUp={end}
        onPointerDown={() => {
          setPicked([]);
          onSelect(null);
        }}
        onContextMenu={(e) => openMenu(e, null)}
      >
        <div className="shadow-[0_2px_12px_rgba(0,0,0,0.08)]">
          <CanvasStage
            page={page}
            layout={layout}
            ctx={editContext(doc)}
            renderObject={(b, frame, content) => {
              if (isHiddenPopup(b)) return null;
              const f =
                drag && live
                  ? drag.id === b.id
                    ? live
                    : dragMembers?.includes(b.id)
                      ? refit(frame, drag.orig, live)
                      : frame
                  : frame;
              const on = b.id === selectedId;
              const typing = editing === b.id && (b.type === 'heading' || b.type === 'text');
              const notes = page.notes?.filter((n) => n.blockId === b.id) ?? [];
              return (
                <div
                  key={b.id}
                  data-obj={b.id}
                  className={cn(
                    'cp-obj',
                    backdropClass(b, f),
                    !typing &&
                      'cursor-move touch-none select-none [&>*:first-child]:pointer-events-none',
                    !b.frames?.[layout] && 'opacity-60 outline-dashed outline-1 outline-amber-500',
                    notes.length > 0 && !on && 'outline outline-2 outline-amber-400',
                    picked.includes(b.id) && 'outline-dashed outline-2 outline-ph-purple',
                  )}
                  style={frameStyle(f, growsToFit(b))}
                  onPointerDown={typing ? undefined : (e) => begin(e, b.id, 'move')}
                  onContextMenu={typing ? undefined : (e) => openMenu(e, b.id)}
                  onDoubleClick={() => {
                    if (groupBy.has(b.id) && selectedId !== b.id) onSelect(b.id);
                    else if (growsToFit(b)) setEditing(b.id);
                  }}
                >
                  {typing ? (
                    <InlineText
                      block={b}
                      doc={doc}
                      onDone={(value) => {
                        setEditing(null);
                        onText(b.id, value);
                      }}
                    />
                  ) : (
                    content
                  )}
                  {notes.length > 0 && (
                    <button
                      type="button"
                      title={notes.map((n) => n.text).join('\n\n')}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => onSelect(b.id)}
                      className="absolute -left-2.5 -top-2.5 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white shadow"
                    >
                      {notes.length}
                    </button>
                  )}
                </div>
              );
            }}
            overlay={
              <>
                <div
                  className="pointer-events-none absolute inset-0 z-20"
                  style={{ boxShadow: '0 0 0 2000px rgba(236, 233, 240, 0.72)' }}
                />
                {(selected || selectedGroup) && box && (
                  <div
                    className="pointer-events-none absolute z-30"
                    style={{
                      left: box.left,
                      top: box.top,
                      width: box.width,
                      height: box.height,
                      transform: box.transform || undefined,
                    }}
                  >
                    <i className="absolute -inset-[3px] rounded-[2px] border-2 border-ph-purple" />
                    {(['nw', 'ne', 'sw', 'se'] as const).map((m) => (
                      <i
                        key={m}
                        onPointerDown={(e) => begin(e, selectedId!, m)}
                        className={cn(
                          'pointer-events-auto absolute h-2.5 w-2.5 rounded-[2px] border-2 border-ph-purple bg-white',
                          m[0] === 'n' ? '-top-[7px]' : '-bottom-[7px]',
                          m[1] === 'w' ? '-left-[7px]' : '-right-[7px]',
                          m === 'nw' || m === 'se' ? 'cursor-nwse-resize' : 'cursor-nesw-resize',
                        )}
                      />
                    ))}
                    {selected && (
                      <i
                        title="Rotate"
                        onPointerDown={(e) => begin(e, selected.id, 'rotate')}
                        className="pointer-events-auto absolute -top-6 left-1/2 h-3 w-3 -translate-x-1/2 cursor-grab rounded-full border-2 border-ph-purple bg-white"
                      />
                    )}
                  </div>
                )}
                {selected?.type === 'popup' && isHiddenPopup(selected) && (
                  <div
                    className="absolute inset-0 z-[35] [&_.cp-layer]:absolute"
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <PopupLayer block={selected} onClose={() => onSelect(null)} />
                  </div>
                )}
                {showSafeZone && (
                  <div
                    title="Clinical Studio's menu button sits over this corner on phones. Keep buttons out of it."
                    className="pointer-events-none absolute left-0 top-0 flex items-center justify-center border-b border-r border-dashed border-ph-pink/50 bg-ph-pink/[0.06]"
                    style={{
                      width: `${MENU_CORNER[layout].w}%`,
                      height: `${MENU_CORNER[layout].h}%`,
                    }}
                  >
                    <span className="text-[10px] font-medium text-ph-pink/80">Menu</span>
                  </div>
                )}
                {guides.x.map((x) => (
                  <i
                    key={`x${x}`}
                    className="pointer-events-none absolute inset-y-0 border-l border-dashed border-ph-pink"
                    style={{ left: `${x}%` }}
                  />
                ))}
                {guides.y.map((y) => (
                  <i
                    key={`y${y}`}
                    className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ph-pink"
                    style={{ top: `${y}%` }}
                  />
                ))}
              </>
            }
          />
        </div>
      </div>
      {picked.length > 1 ? (
        <p className="relative z-30 flex items-center gap-2 text-xs text-ph-charcoal/70">
          {picked.length} objects selected. Drag one to move them all, or
          <button
            type="button"
            onClick={() => {
              onGroup(picked);
              setPicked([]);
            }}
            className="rounded-md border border-ph-purple px-2 py-0.5 font-medium text-ph-purple hover:bg-ph-purple/5"
          >
            Group them
          </button>
          <span className="text-ph-charcoal/50">or press Ctrl+G</span>
        </p>
      ) : selectedGroup ? (
        <p className="relative z-30 text-xs text-ph-charcoal/50">
          Group selected. Double-click an object to work on it on its own. Ctrl+Shift+G ungroups.
        </p>
      ) : (
        <p className="relative z-30 text-xs text-ph-charcoal/50">
          Drag to move, corners to resize, top handle to rotate. Shift-click to select several and
          Ctrl+G to group them. Arrow keys nudge. Right-click to copy, duplicate or paste.
        </p>
      )}
      {menu && <ObjectMenu at={menu} items={menuItems} onClose={closeMenu} />}
    </div>
  );
}
