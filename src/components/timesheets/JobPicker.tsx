import { useEffect, useMemo, useRef, useState } from 'react';
import { jobLabel } from '@/lib/timesheets';

export interface PickableJob {
  id: string;
  code: string;
  title: string;
  clientName: string;
}

export function JobPicker<T extends PickableJob>({
  jobs,
  value,
  onChange,
}: {
  jobs: T[];
  value: T | null;
  onChange: (job: T) => void;
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

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matches = jobs.filter((j) =>
      `${j.code} ${j.title} ${j.clientName}`.toLowerCase().includes(term),
    );
    const byClient = new Map<string, T[]>();
    matches.forEach((j) => byClient.set(j.clientName, [...(byClient.get(j.clientName) ?? []), j]));
    return [...byClient.entries()];
  }, [jobs, search]);

  return (
    <div className="pick" ref={box}>
      <button type="button" className="pick-btn" onClick={() => setOpen((o) => !o)}>
        <span>
          {value ? (
            <>
              <small>{value.clientName}</small>
              <b>{jobLabel(value.code, value.title)}</b>
            </>
          ) : (
            <b>Pick a job</b>
          )}
        </span>
        <i />
      </button>
      {open && (
        <div className="pick-list">
          <input
            autoFocus
            className="inp"
            placeholder="Search by job or client"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {groups.length === 0 && (
            <p className="hint" style={{ padding: 8 }}>
              No open jobs match
            </p>
          )}
          {groups.map(([client, list]) => (
            <div key={client}>
              <h6>{client}</h6>
              {list.map((j) => (
                <button
                  type="button"
                  key={j.id}
                  className={j.id === value?.id ? 'on' : undefined}
                  onClick={() => {
                    onChange(j);
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  {jobLabel(j.code, j.title)}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
