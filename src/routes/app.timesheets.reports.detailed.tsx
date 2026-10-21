import { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ts, type Named } from '@/api/timesheets';
import { errorText } from '@/hooks/useTimesheets';
import { fmtDec } from '@/lib/timesheets';
import { ActionsMenu } from '@/components/timesheets/ActionsMenu';
import { SaveReportButton } from '@/components/timesheets/SaveReportButton';
import { TimeframeBar } from '@/components/timesheets/TimeframeBar';
import {
  periodOf,
  toFilter,
  validateReportSearch,
  type ReportSearch,
} from '@/components/timesheets/reportSearch';

export const Route = createFileRoute('/app/timesheets/reports/detailed')({
  validateSearch: validateReportSearch,
  component: DetailedPage,
});

const RIGHT_ALIGNED = new Set([
  'Hours',
  'Billable Rate',
  'Billable Amount',
  'Cost Rate',
  'Cost Amount',
]);

function DetailedPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [showFilters, setShowFilters] = useState(false);
  const period = periodOf(search);
  const filter = toFilter(search);
  const report = useQuery({
    queryKey: ['ts', 'detailed', filter],
    queryFn: () => ts.detailed(filter),
  });
  const options = useQuery({
    queryKey: ['ts', 'report-options'],
    queryFn: ts.reportOptions,
  });
  const set = (next: Partial<ReportSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...next }) });

  const picked = (list: Named[] | undefined, ids: string | undefined, all: string) =>
    ids
      ? ids
          .split(',')
          .map((id) => list?.find((x) => x.id === id)?.name ?? '')
          .filter(Boolean)
          .join(', ') || all
      : all;

  const filterSelect = (
    label: string,
    key: keyof ReportSearch,
    list: Named[] | undefined,
    all: string,
  ) => (
    <div>
      <label>{label}</label>
      <select
        className="sel"
        value={(search[key] as string | undefined) ?? ''}
        onChange={(e) => set({ [key]: e.target.value || undefined })}
      >
        <option value="">{all}</option>
        {list?.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <>
      <Link
        className="back"
        to="/app/timesheets/reports"
        search={{ period, from: filter.from, to: filter.to }}
      >
        &larr; Back to Reports
      </Link>
      <div className="jh">
        <h1 className="jt1" style={{ fontSize: 28 }}>
          <b style={{ fontWeight: 700 }}>Detailed time report</b>
        </h1>
        <div className="weeknav">
          <SaveReportButton />
          <button type="button" className="btn" onClick={() => setShowFilters((s) => !s)}>
            {showFilters ? 'Hide filters' : 'Show filters'}
          </button>
        </div>
      </div>
      <div className="head">
        <TimeframeBar period={period} from={filter.from} to={filter.to} onChange={set} />
      </div>
      {showFilters && (
        <div className="card rflt">
          {filterSelect('Clients', 'clientIds', options.data?.clients, 'All clients')}
          {filterSelect('Jobs', 'jobIds', options.data?.jobs, 'All jobs')}
          {filterSelect('Tasks', 'taskIds', options.data?.tasks, 'All tasks')}
          {filterSelect('Teammates', 'personIds', options.data?.people, 'Everyone')}
        </div>
      )}
      <div className="card rsum rsum2">
        <div>
          <span>Total hours</span>
          <b>{fmtDec(report.data?.total ?? 0)}</b>
        </div>
        <dl>
          <dt>Clients</dt>
          <dd>{picked(options.data?.clients, search.clientIds, 'All clients')}</dd>
          <dt>Jobs</dt>
          <dd>{picked(options.data?.jobs, search.jobIds, 'All jobs')}</dd>
          <dt>Tasks</dt>
          <dd>{picked(options.data?.tasks, search.taskIds, 'All tasks')}</dd>
          <dt>Teammates</dt>
          <dd>{picked(options.data?.people, search.personIds, 'Everyone')}</dd>
        </dl>
      </div>
      <div className="rtools" style={{ justifyContent: 'space-between' }}>
        <label className="ck2" style={{ color: 'var(--ink-2)' }}>
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
            { label: 'Excel', onSelect: () => ts.exportReport(filter, 'xlsx') },
            { label: 'CSV', onSelect: () => ts.exportReport(filter, 'csv') },
          ]}
        />
      </div>
      {report.error && <p className="err">{errorText(report.error)}</p>}
      <div className="card rt rx">
        <div className="scroll">
          <table>
            <thead>
              <tr>
                {report.data?.headers.map((h) => (
                  <th key={h} className={RIGHT_ALIGNED.has(h) ? 'rh' : undefined}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.data?.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, c) => (
                    <td
                      key={c}
                      className={RIGHT_ALIGNED.has(report.data.headers[c]!) ? 'rh' : undefined}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {report.data?.rows.length === 0 && (
          <div className="empty">No time matches these filters</div>
        )}
        {report.data && report.data.count > report.data.rows.length && (
          <div className="empty">
            Showing the first {report.data.rows.length} of {report.data.count} entries. Export to
            get them all.
          </div>
        )}
      </div>
    </>
  );
}
