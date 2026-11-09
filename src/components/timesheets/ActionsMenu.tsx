import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';

export interface MenuAction {
  label: string;
  onSelect: () => void;
}

const LIST_ROOM = 200;

export function ActionsMenu({
  label = 'Actions',
  actions,
}: {
  label?: string;
  actions: MenuAction[];
}) {
  const [pos, setPos] = useState<CSSProperties | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pos) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!box.current?.contains(target) && !list.current?.contains(target)) setPos(null);
    };
    const shut = () => setPos(null);
    document.addEventListener('mousedown', close);
    window.addEventListener('scroll', shut, true);
    window.addEventListener('resize', shut);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', shut, true);
      window.removeEventListener('resize', shut);
    };
  }, [pos]);

  const toggle = () => {
    if (pos || !box.current) return setPos(null);
    const r = box.current.getBoundingClientRect();
    const right = window.innerWidth - r.right;
    setPos(
      window.innerHeight - r.bottom < LIST_ROOM
        ? { right, bottom: window.innerHeight - r.top + 4 }
        : { right, top: r.bottom + 4 },
    );
  };

  return (
    <div className="menu" ref={box} onClick={(e) => e.stopPropagation()}>
      <button type="button" className="btn" onClick={toggle}>
        {label} &#9662;
      </button>
      {pos &&
        createPortal(
          <div className="ts">
            <div className="menu-list" ref={list} style={pos}>
              {actions.map((a) => (
                <button
                  type="button"
                  key={a.label}
                  onClick={() => {
                    setPos(null);
                    a.onSelect();
                  }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
