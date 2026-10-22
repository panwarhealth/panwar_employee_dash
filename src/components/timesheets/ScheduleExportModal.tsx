import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ts, type ScheduleExport } from '@/api/timesheets';
import { errorText } from '@/hooks/useTimesheets';
import { addDays, todayIso, weekStart } from '@/lib/timesheets';
import { TsModal } from './TsModal';

const DEFAULT_WEEKS = 16;

export function ScheduleExportModal({ onClose }: { onClose: () => void }) {
  const from = weekStart(todayIso());
  const [o, setO] = useState<ScheduleExport>({
    kind: 'projects',
    tasks: false,
    period: 'week',
    rows: false,
    from,
    to: addDays(from, DEFAULT_WEEKS * 7 - 1),
  });
  const set = (patch: Partial<ScheduleExport>) => setO((v) => ({ ...v, ...patch }));
  const run = useMutation({ mutationFn: () => ts.exportSchedule(o) });

  const radio = (label: string, checked: boolean, onChange: () => void) => (
    <label className="ck2">
      <input type="radio" checked={checked} onChange={onChange} /> {label}
    </label>
  );

  return (
    <TsModal onClose={onClose}>
      <div className="tool">Export scheduled hours</div>
      <p className="hint">Export the project or team schedule to a CSV file.</p>
      <div className="field" style={{ marginTop: 8 }}>
        <label>Export format</label>
        {radio('Projects schedule', o.kind === 'projects', () => set({ kind: 'projects' }))}
        {radio('Team schedule', o.kind === 'team', () => set({ kind: 'team' }))}
        {o.kind === 'projects' && (
          <label className="ck2" style={{ marginTop: 6 }}>
            <input
              type="checkbox"
              checked={o.tasks}
              onChange={(e) => set({ tasks: e.target.checked })}
            />{' '}
            Include tasks
          </label>
        )}
      </div>
      <div className="field">
        <label>Time format</label>
        {radio('Weekly', o.period === 'week', () => set({ period: 'week' }))}
        {radio('Monthly', o.period === 'month', () => set({ period: 'month' }))}
      </div>
      <div className="field">
        <label>{o.period === 'week' ? 'Weeks' : 'Months'} are added as</label>
        {radio('Columns', !o.rows, () => set({ rows: false }))}
        {radio('Rows', o.rows, () => set({ rows: true }))}
      </div>
      <div className="field">
        <label>Timeframe</label>
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
