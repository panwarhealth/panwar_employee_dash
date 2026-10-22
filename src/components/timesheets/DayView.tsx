import type { TsEntry } from '@/api/timesheets';
import { DAY_NAMES, fmtHm, jobLabel, runningHours } from '@/lib/timesheets';

export function DayView({
  days,
  selected,
  entries,
  now,
  onSelect,
  onTrack,
  onEdit,
  onStart,
  onStop,
}: {
  days: string[];
  selected: string;
  entries: TsEntry[];
  now: number;
  onSelect: (day: string) => void;
  onTrack: () => void;
  onEdit: (entry: TsEntry) => void;
  onStart?: (entry: TsEntry) => void;
  onStop?: (entry: TsEntry) => void;
}) {
  const hoursOf = (e: TsEntry) => runningHours(e.hours, e.timerStartedAt, now);
  const dayTotal = (day: string) =>
    entries.filter((e) => e.date === day).reduce((s, e) => s + hoursOf(e), 0);
  const dayEntries = entries.filter((e) => e.date === selected);

  return (
    <div className="card dv">
      <div className="dtabs">
        {days.map((day, i) => (
          <button
            type="button"
            key={day}
            className={[day === selected ? 'on' : '', i > 4 ? 'we' : ''].join(' ')}
            onClick={() => onSelect(day)}
          >
            <b>{DAY_NAMES[i]}</b>
            {fmtHm(dayTotal(day))}
          </button>
        ))}
        <span>
          <b>Week total</b>
          {fmtHm(days.reduce((s, d) => s + dayTotal(d), 0))}
        </span>
      </div>
      {dayEntries.map((e) => {
        const running = e.timerStartedAt !== null;
        return (
          <div key={e.id} className={running ? 'de run' : 'de'}>
            <div>
              <b>{jobLabel(e.jobCode, e.jobTitle)}</b> <span className="cl">({e.clientName})</span>
              <div>{e.taskName}</div>
              {e.notes && <div className="nt">{e.notes}</div>}
            </div>
            <div className="hh">{fmtHm(hoursOf(e))}</div>
            <div className="da">
              {running && onStop && (
                <button type="button" className="primary" onClick={() => onStop(e)}>
                  <i className="ck" />
                  Stop
                </button>
              )}
              {!running && onStart && (
                <button type="button" className="btn st" onClick={() => onStart(e)}>
                  <i className="ck" />
                  Start
                </button>
              )}
              <button type="button" className="btn" onClick={() => onEdit(e)}>
                Edit
              </button>
            </div>
          </div>
        );
      })}
      <div className="dfoot">
        <div className="fl">
          <button type="button" onClick={onTrack}>
            + Track time
          </button>
          <span>Total:</span>
        </div>
        <b>{fmtHm(dayTotal(selected))}</b>
        <span />
      </div>
    </div>
  );
}
