import {
  PERIODS,
  periodLabel,
  periodStart,
  shiftPeriod,
  todayIso,
  type Period,
} from '@/lib/timesheets';
import type { ReportSearch } from './reportSearch';

export function TimeframeBar({
  period,
  from,
  to,
  onChange,
}: {
  period: Period;
  from?: string;
  to?: string;
  onChange: (next: Partial<ReportSearch>) => void;
}) {
  const stepped = period !== 'all' && period !== 'custom';
  return (
    <div className="weeknav">
      <select
        className="sel"
        value={period}
        onChange={(e) => {
          const next = e.target.value as Period;
          onChange({
            period: next,
            from:
              next === 'custom'
                ? (from ?? todayIso())
                : next === 'all'
                  ? undefined
                  : periodStart(next, todayIso()),
            to: next === 'custom' ? (to ?? todayIso()) : undefined,
          });
        }}
      >
        {PERIODS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      {stepped && from && (
        <button
          type="button"
          className="btn"
          aria-label="Previous"
          onClick={() => onChange({ from: shiftPeriod(period, from, -1) })}
        >
          &larr;
        </button>
      )}
      {period === 'custom' ? (
        <>
          <input
            className="inp"
            type="date"
            value={from ?? ''}
            onChange={(e) => onChange({ from: e.target.value })}
          />
          <span className="hint">to</span>
          <input
            className="inp"
            type="date"
            value={to ?? ''}
            onChange={(e) => onChange({ to: e.target.value })}
          />
        </>
      ) : (
        <b>{periodLabel(period, from, to)}</b>
      )}
      {stepped && from && (
        <button
          type="button"
          className="btn"
          aria-label="Next"
          onClick={() => onChange({ from: shiftPeriod(period, from, 1) })}
        >
          &rarr;
        </button>
      )}
    </div>
  );
}
