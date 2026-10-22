import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ts, type ScheduleExport } from '@/api/timesheets';
import { errorText } from '@/hooks/useTimesheets';
import { addDays, todayIso, weekStart } from '@/lib/timesheets';
import { TsModal } from './TsModal';

type Timeframe = 'weeks16' | 'month' | 'months3' | 'months6' | 'year' | 'custom';

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: 'weeks16', label: '16 weeks' },
  { value: 'month', label: 'This month' },
  { value: 'months3', label: 'Three months' },
  { value: 'months6', label: 'Six months' },
  { value: 'year', label: 'This year' },
  { value: 'custom', label: 'Custom' },
];

const iso = (y: number, m: number, d: number) => {
  const date = new Date(Date.UTC(y, m, d));
  return date.toISOString().slice(0, 10);
};

const rangeOf = (timeframe: Exclude<Timeframe, 'custom'>) => {
  const today = todayIso();
  const [y, m] = today.split('-').map(Number) as [number, number];
  const months = (n: number) => ({ from: iso(y, m - 1, 1), to: iso(y, m - 1 + n, 0) });
  switch (timeframe) {
    case 'weeks16': {
      const from = weekStart(today);
      return { from, to: addDays(from, 16 * 7 - 1) };
    }
    case 'month':
      return months(1);
    case 'months3':
      return months(3);
    case 'months6':
      return months(6);
    case 'year':
      return { from: iso(y, 0, 1), to: iso(y, 11, 31) };
  }
};

export function ScheduleExportModal({ onClose }: { onClose: () => void }) {
  const [timeframe, setTimeframe] = useState<Timeframe>('weeks16');
  const [o, setO] = useState<ScheduleExport>({
    kind: 'projects',
    tasks: false,
    period: 'week',
    rows: false,
    ...rangeOf('weeks16'),
  });
  const set = (patch: Partial<ScheduleExport>) => setO((v) => ({ ...v, ...patch }));
  const pick = (value: Timeframe) => {
    setTimeframe(value);
    if (value !== 'custom') set(rangeOf(value));
  };
  const run = useMutation({ mutationFn: () => ts.exportSchedule(o) });

  const radio = (label: string, checked: boolean, onChange: () => void) => (
    <label className="ck2">
      <input type="radio" checked={checked} onChange={onChange} /> {label}
    </label>
  );

  return (
    <TsModal onClose={onClose} className="sx">
      <div className="tool">Export scheduled hours</div>
      <p className="hint">Export the project or team schedule to a CSV file.</p>
      <div className="field">
        <label>Export format</label>
        <div>
          {radio('Projects schedule', o.kind === 'projects', () => set({ kind: 'projects' }))}
          {radio('Team schedule', o.kind === 'team', () => set({ kind: 'team' }))}
          {o.kind === 'projects' && (
            <label className="ck2">
              <input
                type="checkbox"
                checked={o.tasks}
                onChange={(e) => set({ tasks: e.target.checked })}
              />{' '}
              Include tasks
            </label>
          )}
        </div>
      </div>
      <div className="field">
        <label>Time format</label>
        <div>
          {radio('Weekly', o.period === 'week', () => set({ period: 'week' }))}
          {radio('Monthly', o.period === 'month', () => set({ period: 'month' }))}
        </div>
      </div>
      <div className="field">
        <label>{o.period === 'week' ? 'Weeks' : 'Months'} are added as</label>
        <div>
          {radio('Columns', !o.rows, () => set({ rows: false }))}
          {radio('Rows', o.rows, () => set({ rows: true }))}
        </div>
      </div>
      <div className="field">
        <label>Timeframe</label>
        <select
          className="sel"
          value={timeframe}
          onChange={(e) => pick(e.target.value as Timeframe)}
        >
          {TIMEFRAMES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      {timeframe === 'custom' && (
        <div className="field">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="date"
              className="inp"
              value={o.from}
              onChange={(e) => e.target.value && set({ from: e.target.value })}
            />
            to
            <input
              type="date"
              className="inp"
              value={o.to}
              onChange={(e) => e.target.value && set({ to: e.target.value })}
            />
          </div>
        </div>
      )}
      {run.error && <p className="err">{errorText(run.error)}</p>}
      <div className="mfoot">
        <button
          type="button"
          className="primary"
          disabled={run.isPending}
          onClick={() => run.mutate()}
        >
          Export
        </button>
        <button type="button" className="link" onClick={onClose}>
          Cancel
        </button>
      </div>
    </TsModal>
  );
}
