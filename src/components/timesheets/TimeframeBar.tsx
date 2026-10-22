import {
  fmtDate,
  PERIODS,
  periodLabel,
  periodStart,
  shiftPeriod,
  todayIso,
  type Period,
} from '@/lib/timesheets';

const PRESETS: { period: Period; offset: number; label: string }[] = [
  { period: 'week', offset: 0, label: 'This week' },
  { period: 'week', offset: -1, label: 'Last week' },
  { period: 'semimonth', offset: 0, label: 'This semimonth' },
  { period: 'semimonth', offset: -1, label: 'Last semimonth' },
  { period: 'month', offset: 0, label: 'This month' },
  { period: 'month', offset: -1, label: 'Last month' },
  { period: 'quarter', offset: 0, label: 'This quarter' },
  { period: 'quarter', offset: -1, label: 'Last quarter' },
  { period: 'year', offset: 0, label: 'This year' },
  { period: 'year', offset: -1, label: 'Last year' },
];

const startFor = (period: Period, offset: number) =>
  shiftPeriod(period, periodStart(period, todayIso()), offset);

const presetLabel = (p: (typeof PRESETS)[number]) =>
  p.period === 'month'
    ? `${p.label} (${fmtDate(startFor('month', p.offset), { month: 'long' })})`
    : p.label;
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
  const preset = stepped
    ? PRESETS.find((p) => p.period === period && startFor(period, p.offset) === from)
    : undefined;
  const value = !stepped ? period : preset ? `${period}:${preset.offset}` : `${period}:other`;
  return (
    <div className="weeknav">
      <select
        className="sel"
        value={value}
        onChange={(e) => {
          const [next, offset] = e.target.value.split(':') as [Period, string | undefined];
          onChange({
            period: next,
            from:
              next === 'custom'
                ? (from ?? todayIso())
                : next === 'all'
                  ? undefined
                  : startFor(next, Number(offset) || 0),
            to: next === 'custom' ? (to ?? todayIso()) : undefined,
          });
        }}
      >
        {PRESETS.map((p) => (
          <option key={`${p.period}:${p.offset}`} value={`${p.period}:${p.offset}`}>
            {presetLabel(p)}
          </option>
        ))}
        {stepped && !preset && (
          <option value={`${period}:other`}>
            {PERIODS.find((p) => p.value === period)!.label}
          </option>
        )}
        <option value="all">All time</option>
        <option value="custom">Custom</option>
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
