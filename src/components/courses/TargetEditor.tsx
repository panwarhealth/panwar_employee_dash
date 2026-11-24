import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { uid, type DropTarget } from '@/course/doc';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { cn } from '@/lib/utils';

type Edge = { l?: true; r?: true; t?: true; b?: true };
type Grab = { id: string; edge: Edge | null; x0: number; y0: number; start: DropTarget };

const HANDLES: Edge[] = [
  { l: true, t: true },
  { t: true },
  { r: true, t: true },
  { r: true },
  { r: true, b: true },
  { b: true },
  { l: true, b: true },
  { l: true },
];

const MIN = 2;
const round = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function handleStyle(e: Edge) {
  return {
    left: e.l ? '0%' : e.r ? '100%' : '50%',
    top: e.t ? '0%' : e.b ? '100%' : '50%',
    cursor:
      (e.l && e.t) || (e.r && e.b)
        ? 'nwse-resize'
        : (e.r && e.t) || (e.l && e.b)
          ? 'nesw-resize'
          : e.l || e.r
            ? 'ew-resize'
            : 'ns-resize',
  };
}

function reshape(s: DropTarget, edge: Edge | null, dx: number, dy: number): DropTarget {
  if (!edge)
    return {
      ...s,
      x: round(clamp(s.x + dx, 0, 100 - s.w)),
      y: round(clamp(s.y + dy, 0, 100 - s.h)),
    };
  let { x, y, w, h } = s;
  if (edge.l) {
    const nx = clamp(s.x + dx, 0, s.x + s.w - MIN);
    w = s.w + (s.x - nx);
    x = nx;
  }
  if (edge.r) w = clamp(s.w + dx, MIN, 100 - s.x);
  if (edge.t) {
    const ny = clamp(s.y + dy, 0, s.y + s.h - MIN);
    h = s.h + (s.y - ny);
    y = ny;
  }
  if (edge.b) h = clamp(s.h + dy, MIN, 100 - s.y);
  return { ...s, x: round(x), y: round(y), w: round(w), h: round(h) };
}

export function TargetEditor({
  src,
  targets,
  onDone,
  onClose,
}: {
  src: string;
  targets: DropTarget[];
  onDone: (targets: DropTarget[]) => void;
  onClose: () => void;
}) {
  const [list, setList] = useState(targets);
  const [selected, setSelected] = useState<string | null>(targets[0]?.id ?? null);
  const area = useRef<HTMLDivElement>(null);
  const grab = useRef<Grab | null>(null);

  const pct = (e: { clientX: number; clientY: number }) => {
    const r = area.current!.getBoundingClientRect();
    return {
      x: clamp(((e.clientX - r.left) / r.width) * 100, 0, 100),
      y: clamp(((e.clientY - r.top) / r.height) * 100, 0, 100),
    };
  };
  const update = (id: string, t: DropTarget) =>
    setList((all) => all.map((x) => (x.id === id ? t : x)));
  const remove = (id: string) => {
    setList((all) => all.filter((x) => x.id !== id));
    setSelected(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selected || (e.key !== 'Delete' && e.key !== 'Backspace')) return;
      if (e.target instanceof Element && e.target.closest('input, textarea')) return;
      e.preventDefault();
      remove(selected);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selected]);

  const start = (e: ReactPointerEvent, id: string, edge: Edge | null) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    area.current!.setPointerCapture(e.pointerId);
    const p = pct(e);
    grab.current = { id, edge, x0: p.x, y0: p.y, start: list.find((t) => t.id === id)! };
    setSelected(id);
  };

  const draw = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    area.current!.setPointerCapture(e.pointerId);
    const p = pct(e);
    const t: DropTarget = {
      id: uid(),
      label: `Target ${list.length + 1}`,
      x: round(p.x),
      y: round(p.y),
      w: 0,
      h: 0,
    };
    setList((all) => [...all, t]);
    setSelected(t.id);
    grab.current = { id: t.id, edge: { r: true, b: true }, x0: p.x, y0: p.y, start: t };
  };

  const move = (e: ReactPointerEvent) => {
    const g = grab.current;
    if (!g) return;
    const p = pct(e);
    if (g.start.w === 0)
      update(g.id, {
        ...g.start,
        x: round(Math.min(g.x0, p.x)),
        y: round(Math.min(g.y0, p.y)),
        w: round(Math.abs(p.x - g.x0)),
        h: round(Math.abs(p.y - g.y0)),
      });
    else update(g.id, reshape(g.start, g.edge, p.x - g.x0, p.y - g.y0));
  };

  const end = () => {
    const g = grab.current;
    grab.current = null;
    if (!g || g.start.w) return;
    setList((all) =>
      all.map((t) =>
        t.id === g.id && (t.w < MIN * 2 || t.h < MIN * 2)
          ? {
              ...t,
              x: round(clamp(g.x0 - 10, 0, 80)),
              y: round(clamp(g.y0 - 6, 0, 88)),
              w: 20,
              h: 12,
            }
          : t,
      ),
    );
  };

  return (
    <Modal open onClose={onClose} title="Drop targets" className="max-w-6xl">
      <div className="flex gap-6 px-6 py-5">
        <div className="min-w-0 flex-1">
          <p className="mb-3 text-sm text-ph-charcoal/60">
            Drag on the picture to draw a target. Drag a target to move it and pull its handles to
            resize. Delete removes the selected one.
          </p>
          <div
            ref={area}
            className="relative mx-auto w-fit cursor-crosshair touch-none select-none"
            onPointerDown={draw}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
          >
            <img
              src={src}
              alt=""
              draggable={false}
              className="block max-h-[68vh] max-w-full"
            />
            {list.map((t) => {
              const on = t.id === selected;
              return (
                <div
                  key={t.id}
                  onPointerDown={(e) => start(e, t.id, null)}
                  className={cn(
                    'absolute flex cursor-move items-center justify-center border-2 text-xs font-semibold',
                    on
                      ? 'border-ph-purple bg-ph-purple/25 text-ph-purple'
                      : 'border-ph-purple/70 bg-white/50 text-ph-charcoal',
                  )}
                  style={{
                    left: `${t.x}%`,
                    top: `${t.y}%`,
                    width: `${t.w}%`,
                    height: `${t.h}%`,
                  }}
                >
                  <span className="pointer-events-none truncate px-1">{t.label}</span>
                  {on &&
                    HANDLES.map((h, i) => (
                      <span
                        key={i}
                        onPointerDown={(e) => start(e, t.id, h)}
                        className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-sm border-2 border-ph-purple bg-white"
                        style={handleStyle(h)}
                      />
                    ))}
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex w-60 shrink-0 flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-ph-charcoal/50">
            Targets
          </span>
          {list.length === 0 && (
            <p className="text-sm text-ph-charcoal/60">None yet. Draw one on the picture.</p>
          )}
          {list.map((t) => (
            <div
              key={t.id}
              onClick={() => setSelected(t.id)}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-2 py-1.5',
                t.id === selected ? 'border-ph-purple bg-ph-purple/5' : 'border-ph-charcoal/15',
              )}
            >
              <input
                value={t.label}
                onChange={(e) => update(t.id, { ...t, label: e.target.value })}
                onFocus={() => setSelected(t.id)}
                className="min-w-0 flex-1 bg-transparent text-sm text-ph-charcoal outline-none"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(t.id);
                }}
                className="text-xs text-ph-charcoal/50 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-ph-charcoal/10 px-6 py-4">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            onDone(list);
            onClose();
          }}
        >
          Done
        </Button>
      </div>
    </Modal>
  );
}
