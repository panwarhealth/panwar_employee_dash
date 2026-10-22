import { useState } from 'react';
import { createFileRoute, Link, useNavigate, useRouter } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ts, type GroupBy } from '@/api/timesheets';
import { errorText, useTsViewer } from '@/hooks/useTimesheets';
import { fmtDate, fmtDec, isManager } from '@/lib/timesheets';
import { ActionsMenu } from '@/components/timesheets/ActionsMenu';
import { SaveReportButton } from '@/components/timesheets/SaveReportButton';
import { TimeframeBar } from '@/components/timesheets/TimeframeBar';
import {
  periodOf,
  toFilter,
  validateReportSearch,
  type ReportSearch,
} from '@/components/timesheets/reportSearch';

export const Route = createFileRoute('/app/timesheets/reports/')({
  validateSearch: validateReportSearch,
  component: ReportsPage,
});

const GROUP_TABS: {
  value: GroupBy;
  label: string;
  idKey: keyof ReportSearch;
}[] = [
  { value: 'client', label: 'Clients', idKey: 'clientIds' },
  { value: 'job', label: 'Jobs', idKey: 'jobIds' },
  { value: 'task', label: 'Tasks', idKey: 'taskIds' },
  { value: 'person', label: 'Teammates', idKey: 'personIds' },
];

function ReportsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [tab, setTab] = useState<'time' | 'saved'>('time');
  const manager = isManager(useTsViewer().data!.level);
  const group = GROUP_TABS.find((g) => g.value === (search.group ?? 'client'))!;
  const period = periodOf(search);
  const filter = toFilter(search);
  const summary = useQuery({
    queryKey: ['ts', 'summary', filter, group.value],
    queryFn: () => ts.summary(filter, group.value),
    enabled: tab === 'time',
  });
  const set = (next: Partial<ReportSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...next }) });
  const max = Math.max(...(summary.data?.rows.map((r) => r.hours) ?? [0]), 0.01);
  const detailedSearch = {
    ...search,
    period,
    from: filter.from,
    to: filter.to,
    group: undefined,
  };

  return (
    <>
      <div className="jh" style={{ marginTop: 0 }}>
        <div className="jtabs" style={{ margin: 0, border: 0 }}>
          <button
            type="button"
            className={tab === 'time' ? 'on' : ''}
            onClick={() => setTab('time')}
          >
            Time
          </button>
          <button
            type="button"
            className={tab === 'saved' ? 'on' : ''}
            onClick={() => setTab('saved')}
          >
            Saved reports
          </button>
          <button
            type="button"
            onClick={() => navigate({ to: '/app/timesheets/reports/activity' })}
          >
            Activity log
          </button>
        </div>
        <Link className="primary" to="/app/timesheets/reports/detailed" search={detailedSearch}>
          Detailed time report
        </Link>
      </div>

      {tab === 'saved' ? (
        <SavedReports />
      ) : (
        <>
          <div
            className="head"
            style={{ borderBottom: '1px solid var(--line)', paddingBottom: 14 }}
          >
            <TimeframeBar period={period} from={filter.from} to={filter.to} onChange={set} />
            <SaveReportButton />
          </div>
          <div className="card rsum">
            <span>Total hours</span>
            <b>{fmtDec(summary.data?.total ?? 0)}</b>
          </div>
          <div className="jtabs">
            {GROUP_TABS.map((g) => (
              <button
                key={g.value}
                type="button"
                className={g === group ? 'on' : ''}
                onClick={() => set({ group: g.value })}
              >
                {g.label}
              </button>
            ))}
          </div>
          <div className="rtools">
            <label className="ck2" style={{ color: 'var(--ink-2)', marginRight: 6 }}>
              <input
                type="checkbox"
                checked={!!search.openOnly}
                onChange={(e) => set({ openOnly: e.target.checked || undefined })}
              />{' '}
              Open jobs only
            </label>
            <ActionsMenu
              label="Export"
              actions={[
                {
                  label: 'Excel',
                  onSelect: () => ts.exportReport(filter, 'xlsx'),
                },
                {
                  label: 'CSV',
                  onSelect: () => ts.exportReport(filter, 'csv'),
                },
              ]}
            />
          </div>
          {summary.error && <p className="err">{errorText(summary.error)}</p>}
          <div className="card rt">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th className="rh" style={{ width: 90 }}>
                    Hours
                  </th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {summary.data?.rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link
                        to="/app/timesheets/reports/detailed"
                        search={{ ...detailedSearch, [group.idKey]: r.id }}
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="rh">{fmtDec(r.hours)}</td>
                    <td style={{ width: '45%' }}>
                      {manager && group.value === 'person' && (
                        <Link
                          className="btn"
                          style={{ float: 'right', marginLeft: 10 }}
                          to="/app/timesheets/team/$personId"
                          params={{ personId: r.id }}
                          search={{ week: filter.from }}
                        >
                          Timesheet
                        </Link>
                      )}
                      <span className="hb" style={{ width: `${(r.hours / max) * 100}%` }} />
                    </td>
                  </tr>
                ))}
                {summary.data && summary.data.rows.length > 0 && (
                  <tr className="tot">
                    <td>Total</td>
                    <td className="rh">{fmtDec(summary.data.total)}</td>
                    <td />
                  </tr>
                )}
              </tbody>
            </table>
            {summary.data?.rows.length === 0 && (
              <div className="empty">No time in this timeframe</div>
            )}
          </div>
        </>
      )}
    </>
  );
}

function SavedReports() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const reports = useQuery({
    queryKey: ['ts', 'saved-reports'],
    queryFn: ts.savedReports,
  });
  const remove = useMutation({
    mutationFn: ts.deleteSavedReport,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ts', 'saved-reports'] }),
  });

  return (
    <div className="card rt saved">
      {(reports.error || remove.error) && (
        <p className="err">{errorText(reports.error ?? remove.error)}</p>
      )}
      <table>
        <tbody>
          {reports.data?.map((r) => (
            <tr key={r.id}>
              <td>
                <a onClick={() => router.history.push(r.query)}>{r.name}</a>
              </td>
              <td className="hint">
                Saved{' '}
                {fmtDate(r.createdAt.slice(0, 10), {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </td>
              <td className="ja">
                <button type="button" className="link" onClick={() => remove.mutate(r.id)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {reports.data?.length === 0 && (
        <div className="empty">No saved reports yet. Use Save report on any report.</div>
      )}
    </div>
  );
}
