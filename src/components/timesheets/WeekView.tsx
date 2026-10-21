import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ts, type TsEntry, type TsStar } from '@/api/timesheets';
import { errorText } from '@/hooks/useTimesheets';
import {
  DAY_NAMES,
  fmtDate,
  fmtHm,
  jobLabel,
  parseHours,
  runningHours,
  todayIso,
} from '@/lib/timesheets';

interface Row {
  key: string;
  jobId: string;
  taskId: string;
  jobCode: string;
  jobTitle: string;
  clientName: string;
  taskName: string;
  starred: boolean;
}

export function WeekView({
  start,
  days,
  entries,
  stars,
  now,
  onEdit,
  onOpenDay,
  onTrack,
}: {
  start: string;
  days: string[];
  entries: TsEntry[];
  stars: TsStar[];
  now: number;
  onEdit: (entry: TsEntry) => void;
  onOpenDay: (day: string) => void;
  onTrack: () => void;
}) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['ts', 'time'] });
  const star = useMutation({
    mutationFn: (r: Row) => ts.setStar(r.jobId, r.taskId, !r.starred),
    onSuccess: refresh,
  });
  const removeRow = useMutation({
    mutationFn: (r: Row) => ts.deleteRow(start, r.jobId, r.taskId),
    onSuccess: refresh,
  });

  const rows = useMemo(() => {
    const map = new Map<string, Row>();
    const add = (s: Omit<Row, 'key' | 'starred'>, starred: boolean) => {
      const key = `${s.jobId}|${s.taskId}`;
      const existing = map.get(key);
      map.set(key, {
        ...s,
        key,
        starred: starred || (existing?.starred ?? false),
      });
    };
    stars.forEach((s) => add(s, true));
    entries.forEach((e) => add(e, false));
    return [...map.values()].sort(
      (a, b) =>
        a.clientName.localeCompare(b.clientName) ||
        a.jobCode.localeCompare(b.jobCode) ||
        a.taskName.localeCompare(b.taskName),
    );
  }, [entries, stars]);

  const hoursOf = (e: TsEntry) => runningHours(e.hours, e.timerStartedAt, now);
  const cellEntries = (r: Row, day: string) =>
    entries.filter((e) => e.jobId === r.jobId && e.taskId === r.taskId && e.date === day);
  const dayTotal = (day: string) =>
    entries.filter((e) => e.date === day).reduce((s, e) => s + hoursOf(e), 0);
  const today = todayIso();

  return (
    <>
      <div className="card wv">
        <table>
          <thead>
            <tr>
              <th className="nm" />
              <th className="nb" />
              {days.map((day, i) => (
                <th key={day} className={day === today ? 'dy td' : 'dy'}>
                  {DAY_NAMES[i]}
                  <span>{fmtDate(day, { day: 'numeric', month: 'short' })}</span>
                </th>
              ))}
              <th className="tt" />
              <th className="dl" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const rowEntries = entries.filter(
                (e) => e.jobId === r.jobId && e.taskId === r.taskId,
              );
              return (
                <tr key={r.key}>
                  <td className="nm">
                    <b>{jobLabel(r.jobCode, r.jobTitle)}</b>
                    <div>({r.clientName})</div>
                    <div>{r.taskName}</div>
                  </td>
                  <td className="nb">
                    <button
                      type="button"
                      className={r.starred ? 'ib on' : 'ib'}
                      title="Star"
                      onClick={() => star.mutate(r)}
                    >
                      {r.starred ? '★' : '☆'}
                    </button>
                    <button
                      type="button"
                      className="ib"
                      title="Notes"
                      disabled={rowEntries.length === 0}
                      onClick={() =>
                        rowEntries.length > 0 && onEdit(rowEntries[rowEntries.length - 1]!)
                      }
                    >
                      &#9776;
                    </button>
                  </td>
                  {days.map((day, i) => (
                    <td key={day} className="dy">
                      <WeekCell
                        row={r}
                        day={day}
                        dayName={DAY_NAMES[i]!}
                        entries={cellEntries(r, day)}
                        hoursOf={hoursOf}
                        onOpenDay={onOpenDay}
                        onSaved={refresh}
                      />
                    </td>
                  ))}
                  <td className="tt">{fmtHm(rowEntries.reduce((s, e) => s + hoursOf(e), 0))}</td>
                  <td className="dl">
                    <button
                      type="button"
                      className="ib"
                      title="Delete row"
                      onClick={() =>
                        (rowEntries.length === 0 ||
                          window.confirm('Delete this row and its time for the week?')) &&
                        removeRow.mutate(r)
                      }
                    >
                      &times;
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="nm" />
              <td className="nb" />
              {days.map((day) => (
                <td key={day} className="dy">
                  {fmtHm(dayTotal(day))}
                </td>
              ))}
              <td className="tt">{fmtHm(days.reduce((s, d) => s + dayTotal(d), 0))}</td>
              <td className="dl" />
            </tr>
          </tfoot>
        </table>
      </div>
      {(star.error || removeRow.error) && (
        <p className="err">{errorText(star.error ?? removeRow.error)}</p>
      )}
      <div className="wfoot">
        <button type="button" className="btn" onClick={onTrack}>
          + Add row
        </button>
      </div>
    </>
  );
}

function WeekCell({
  row,
  day,
  dayName,
  entries,
  hoursOf,
  onOpenDay,
  onSaved,
}: {
  row: Row;
  day: string;
  dayName: string;
  entries: TsEntry[];
  hoursOf: (e: TsEntry) => number;
  onOpenDay: (day: string) => void;
  onSaved: () => void;
}) {
  const total = entries.reduce((s, e) => s + hoursOf(e), 0);
  const shown = total > 0 ? fmtHm(total) : '';
  const [text, setText] = useState(shown);
  const [needNote, setNeedNote] = useState(false);
  const [note, setNote] = useState('');
  useEffect(() => setText(shown), [shown]);

  const single = entries.length === 1 ? entries[0]! : null;
  const running = entries.some((e) => e.timerStartedAt !== null);
  const locked = entries.length > 1 || running;

  const save = useMutation({
    mutationFn: async (hours: number) => {
      if (single && hours === 0) return ts.deleteEntry(single.id);
      if (single)
        return ts
          .updateEntry(single.id, {
            date: single.date,
            jobId: single.jobId,
            taskId: single.taskId,
            hours,
            notes: single.notes,
          })
          .then(() => undefined);
      return ts
        .createEntry({
          date: day,
          jobId: row.jobId,
          taskId: row.taskId,
          hours,
          notes: note,
        })
        .then(() => undefined);
    },
    onSuccess: () => {
      setNeedNote(false);
      setNote('');
      onSaved();
    },
  });

  const commit = () => {
    const hours = parseHours(text);
    if (hours === null) return setText(shown);
    if (fmtHm(hours) === fmtHm(total) || (hours === 0 && total === 0)) return setText(shown);
    if (!single) return setNeedNote(true);
    save.mutate(hours);
  };

  const cancel = () => {
    setNeedNote(false);
    setNote('');
    setText(shown);
  };

  return (
    <>
      <input
        className={['wi', running ? 'run' : '', needNote ? 'need' : ''].join(' ')}
        value={text}
        readOnly={locked}
        title={locked ? 'Edit this in Day view' : undefined}
        onClick={() => locked && onOpenDay(day)}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => !locked && !needNote && commit()}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      {needNote && (
        <div className="npop">
          <b>What did you do on {dayName}?</b>
          <textarea
            autoFocus
            placeholder="A few words is fine"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="r">
            <button
              type="button"
              className="primary"
              disabled={note.trim() === '' || save.isPending}
              onClick={() => save.mutate(parseHours(text) ?? 0)}
            >
              Save
            </button>
            <button type="button" className="link" onClick={cancel}>
              Cancel
            </button>
            <small>{save.error ? errorText(save.error) : 'Note required'}</small>
          </div>
        </div>
      )}
      {!needNote && save.error && (
        <div className="npop">
          <small className="err">{errorText(save.error)}</small>
        </div>
      )}
    </>
  );
}
