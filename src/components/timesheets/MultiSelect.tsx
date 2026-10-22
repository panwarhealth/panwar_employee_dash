import { useEffect, useRef, useState } from 'react';

export function MultiSelect({
  options,
  value,
  all,
  onChange,
}: {
  options: { id: string; name: string }[];
  value: string[];
  all: string;
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => box.current?.contains(e.target as Node) || setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const picked = options.filter((o) => value.includes(o.id));
  const term = search.trim().toLowerCase();
  const shown = options.filter((o) => o.name.toLowerCase().includes(term));
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div className="msel" ref={box}>
      <button type="button" className="sel msel-btn" onClick={() => setOpen((o) => !o)}>
        {picked.length === 0
          ? all
          : picked.length === 1
            ? picked[0]!.name
            : `${picked[0]!.name} +${picked.length - 1}`}
      </button>
      {open && (
        <div className="msel-list">
          <input
            className="inp"
            autoFocus
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {value.length > 0 && (
            <button type="button" className="link" onClick={() => onChange([])}>
              Clear ({value.length})
            </button>
          )}
          <div className="msel-items">
            {shown.map((o) => (
              <label key={o.id} className="ck2">
                <input
                  type="checkbox"
                  checked={value.includes(o.id)}
                  onChange={() => toggle(o.id)}
                />{' '}
                {o.name}
              </label>
            ))}
            {shown.length === 0 && <span className="hint">No matches</span>}
          </div>
        </div>
      )}
    </div>
  );
}
