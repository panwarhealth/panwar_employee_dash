import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { BlockContext } from '@/course/blocks';
import { CanvasStage } from '@/course/canvas';
import { frameFor, frameStyle } from '@/course/canvasLayout';
import type { Frame, Layout, Page } from '@/course/doc';
import { cn } from '@/lib/utils';

type Mode = 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'rotate';

interface Drag {
  id: string;
  mode: Mode;
  startX: number;
  startY: number;
  orig: Frame;
}

interface Guides {
  x: number[];
  y: number[];
}

const SNAP = 1;
const MIN = 2;

const EDIT_CTX: BlockContext = {
  edit: true,
  answers: {},
  answer: () => {},
  next: () => {},
  goTo: () => {},
};

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
  page,
  layout,
  selectedId,
  onSelect,
  onFrame,
  onRemove,
}: {
  page: Page;
  layout: Layout;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onFrame: (blockId: string, frame: Frame) => void;
  onRemove: (blockId: string) => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [live, setLive] = useState<Frame | null>(null);
  const [guides, setGuides] = useState<Guides>({ x: [], y: [] });
  const missing = page.blocks.filter((b) => !b.frames?.[layout]).length;

  const selected = page.blocks.find((b) => b.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable="true"]')) return;
      const step = e.shiftKey ? 5 : 0.5;
      const f = frameFor(page, selected, layout);
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      if (moves[e.key]) {
        e.preventDefault();
        onFrame(selected.id, { ...f, x: f.x + moves[e.key][0], y: f.y + moves[e.key][1] });
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        onRemove(selected.id);
      } else if (e.key === 'Escape') {
        onSelect(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, page, layout, onFrame, onRemove, onSelect]);

  const toPct = (e: { clientX: number; clientY: number }) => {
    const r = stage.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
      rect: r,
    };
  };

  const begin = (e: ReactPointerEvent, id: string, mode: Mode) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    onSelect(id);
    const block = page.blocks.find((b) => b.id === id)!;
    const p = toPct(e);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setDrag({ id, mode, startX: p.x, startY: p.y, orig: frameFor(page, block, layout) });
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
      if (!e.altKey) {
        const others = page.blocks
          .filter((b) => b.id !== drag.id)
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
    if (drag && live) onFrame(drag.id, live);
    setDrag(null);
    setLive(null);
    setGuides({ x: [], y: [] });
  };

  return (
    <div className="flex w-full flex-col items-center gap-2">
      {missing > 0 && (
        <p className="rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
          {missing === page.blocks.length
            ? `Nothing is placed in the ${layout} layout yet.`
            : `${missing} ${missing === 1 ? "object isn't" : "objects aren't"} placed in the ${layout} layout yet.`}{' '}
          Drag them into place, or copy positions from the other layout.
        </p>
      )}
      <div
        ref={stage}
        className={cn('cp w-full', layout === 'phone' ? 'max-w-[360px]' : 'max-w-[960px]')}
        onPointerMove={move}
        onPointerUp={end}
        onPointerDown={() => onSelect(null)}
      >
        <div className="shadow-[0_2px_12px_rgba(0,0,0,0.08)]">
          <CanvasStage
            page={page}
            layout={layout}
            ctx={EDIT_CTX}
            renderObject={(b, frame, content) => {
              const f = drag?.id === b.id && live ? live : frame;
              const on = b.id === selectedId;
              return (
                <div
                  key={b.id}
                  className={cn(
                    'cp-obj cursor-move touch-none select-none [&>*:first-child]:pointer-events-none',
                    !b.frames?.[layout] && 'opacity-60 outline-dashed outline-1 outline-amber-500',
                  )}
                  style={frameStyle(f)}
                  onPointerDown={(e) => begin(e, b.id, 'move')}
                >
                  {content}
                  {on && (
                    <>
                      <i className="pointer-events-none absolute -inset-[3px] rounded-[2px] border-2 border-ph-purple" />
                      {(['nw', 'ne', 'sw', 'se'] as const).map((m) => (
                        <i
                          key={m}
                          onPointerDown={(e) => begin(e, b.id, m)}
                          className={cn(
                            'absolute h-2.5 w-2.5 rounded-[2px] border-2 border-ph-purple bg-white',
                            m[0] === 'n' ? '-top-[7px]' : '-bottom-[7px]',
                            m[1] === 'w' ? '-left-[7px]' : '-right-[7px]',
                            m === 'nw' || m === 'se' ? 'cursor-nwse-resize' : 'cursor-nesw-resize',
                          )}
                        />
                      ))}
                      <i
                        title="Rotate"
                        onPointerDown={(e) => begin(e, b.id, 'rotate')}
                        className="absolute -top-6 left-1/2 h-3 w-3 -translate-x-1/2 cursor-grab rounded-full border-2 border-ph-purple bg-white"
                      />
                    </>
                  )}
                </div>
              );
            }}
            overlay={
              <>
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
      <p className="text-xs text-ph-charcoal/50">
        Drag to move, corners to resize, top handle to rotate. Arrow keys nudge, Shift for bigger
        steps, hold Alt to stop snapping.
      </p>
    </div>
  );
}
