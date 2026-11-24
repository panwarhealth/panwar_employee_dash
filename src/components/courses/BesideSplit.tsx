import { useLayoutEffect, useRef, useState } from 'react';

const cols = (p: number) => `minmax(0, ${p}fr) minmax(0, ${100 - p}fr)`;

export function BesideSplit({
  value,
  onChange,
}: {
  value: number;
  onChange: (pct: number) => void;
}) {
  const self = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ left: number; top: number; height: number } | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  const aside = () => self.current?.parentElement?.querySelector<HTMLElement>('.cp-aside') ?? null;

  const measure = () => {
    const el = self.current;
    const grid = aside();
    const image = grid?.querySelector<HTMLElement>('.cp-dnd > .cp-dnd-image');
    const bank = grid?.querySelector<HTMLElement>('.cp-bank');
    const host = el?.parentElement;
    if (!el || !grid || !image || !bank || !host) return setBox((was) => (was ? null : was));
    const h = host.getBoundingClientRect();
    const s = h.width / host.offsetWidth || 1;
    const g = grid.getBoundingClientRect();
    const mid = (image.getBoundingClientRect().right + bank.getBoundingClientRect().left) / 2;
    const next = { left: (mid - h.left) / s, top: (g.top - h.top) / s, height: g.height / s };
    setBox((was) =>
      was &&
      Math.abs(was.left - next.left) < 0.5 &&
      Math.abs(was.top - next.top) < 0.5 &&
      Math.abs(was.height - next.height) < 0.5
        ? was
        : next,
    );
  };

  useLayoutEffect(() => {
    measure();
    const grid = aside();
    if (!grid) return;
    const resize = new ResizeObserver(measure);
    resize.observe(grid);
    return () => resize.disconnect();
  });

  if (!box) return <div ref={self} className="hidden" />;
  return (
    <div
      ref={self}
      title="Drag to change the image width"
      className="group absolute z-10 flex w-4 -translate-x-1/2 cursor-ew-resize touch-none justify-center"
      style={{ left: box.left, top: box.top, height: box.height }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(value);
      }}
      onPointerMove={(e) => {
        const grid = aside();
        if (dragging === null || !grid) return;
        const g = grid.getBoundingClientRect();
        const p = Math.round(Math.min(85, Math.max(30, ((e.clientX - g.left) / g.width) * 100)));
        grid.style.setProperty('--cp-aside-cols', cols(p));
        setDragging(p);
        measure();
      }}
      onPointerUp={() => {
        if (dragging === null) return;
        aside()?.style.removeProperty('--cp-aside-cols');
        if (dragging !== value) onChange(dragging);
        setDragging(null);
      }}
    >
      <span className="h-full w-1 rounded-full bg-ph-purple/60 group-hover:bg-ph-purple" />
      {dragging !== null && (
        <span className="absolute -top-7 rounded bg-ph-purple px-1.5 py-0.5 text-[11px] font-semibold text-white">
          {dragging}%
        </span>
      )}
    </div>
  );
}
