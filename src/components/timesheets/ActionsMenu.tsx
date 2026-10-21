import { useEffect, useRef, useState } from 'react';

export interface MenuAction {
  label: string;
  onSelect: () => void;
}

export function ActionsMenu({
  label = 'Actions',
  actions,
}: {
  label?: string;
  actions: MenuAction[];
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => box.current?.contains(e.target as Node) || setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="menu" ref={box} onClick={(e) => e.stopPropagation()}>
      <button type="button" className="btn" onClick={() => setOpen((o) => !o)}>
        {label} &#9662;
      </button>
      {open && (
        <div className="menu-list">
          {actions.map((a) => (
            <button
              type="button"
              key={a.label}
              onClick={() => {
                setOpen(false);
                a.onSelect();
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
