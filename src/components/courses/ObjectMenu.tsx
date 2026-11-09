import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface ObjectMenuItem {
  label: string;
  keys: string;
  run: () => void;
  danger?: boolean;
}

export function ObjectMenu({
  at,
  items,
  onClose,
}: {
  at: { x: number; y: number };
  items: ObjectMenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(at);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const gap = 8;
    setPos({
      x: Math.max(gap, Math.min(at.x, window.innerWidth - el.offsetWidth - gap)),
      y: Math.max(gap, Math.min(at.y, window.innerHeight - el.offsetHeight - gap)),
    });
  }, [at]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('pointerdown', onClose);
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', onClose);
    window.addEventListener('wheel', onClose);
    return () => {
      window.removeEventListener('pointerdown', onClose);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', onClose);
      window.removeEventListener('wheel', onClose);
    };
  }, [onClose]);

  if (!items.length) return null;
  return (
    <div
      ref={ref}
      role="menu"
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      className="fixed z-50 min-w-44 rounded-xl border border-ph-charcoal/10 bg-white py-1.5 text-sm font-normal shadow-lg"
      style={{ left: pos.x, top: pos.y }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          onClick={() => {
            onClose();
            item.run();
          }}
          className={cn(
            'flex w-full items-center justify-between gap-6 px-4 py-1.5 text-left hover:bg-ph-purple/5',
            item.danger ? 'text-red-700' : 'text-ph-charcoal',
          )}
        >
          {item.label}
          <span className="text-xs text-ph-charcoal/40">{item.keys}</span>
        </button>
      ))}
    </div>
  );
}
