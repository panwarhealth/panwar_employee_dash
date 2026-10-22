import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ts, type ActivityRow, type ReportOption } from '@/api/timesheets';
import { errorText } from '@/hooks/useTimesheets';
import { fmtDate, fmtDec, jobLabel } from '@/lib/timesheets';
import { MultiSelect } from '@/components/timesheets/MultiSelect';
import { TimeframeBar } from '@/components/timesheets/TimeframeBar';
import {
  periodOf,
  toFilter,
  validateReportSearch,
  type ReportSearch,
} from '@/components/timesheets/reportSearch';

interface ActivitySearch extends ReportSearch {
  performedByIds?: string;
  kinds?: string;
}

const KINDS = [
  { id: 'Created', name: 'Created' },
  { id: 'Edited', name: 'Edited' },
  { id: 'Deleted', name: 'Deleted' },
  { id: 'TimerStarted', name: 'Timer started' },
  { id: 'TimerStopped', name: 'Timer stopped' },
];

export const Route = createFileRoute('/app/timesheets/reports/activity')({
  validateSearch: (s: Record<string, unknown>): ActivitySearch => ({
    ...validateReportSearch(s),
    performedByIds:
      typeof s.performedByIds === 'string' && /^[0-9a-f,-]+$/i.test(s.performedByIds)
        ? s.performedByIds
        : undefined,
    kinds: typeof s.kinds === 'string' && /^[A-Za-z,]+$/.test(s.kinds) ? s.kinds : undefined,
  }),
  component: ActivityPage,
});

const SYDNEY = 'Australia/Sydney';
const dayOf = (iso: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: SYDNEY }).format(new Date(iso));
const timeOf = (iso: string) =>
  new Intl.DateTimeFormat('en-AU', { timeZone: SYDNEY, hour: 'numeric', minute: '2-digit' })
    .format(new Date(iso))
    .replace(' ', '')
    .toLowerCase();
const longDate = (date: string) =>
  fmtDate(date, { day: 'numeric', month: 'short', year: 'numeric' });

const describe = (r: ActivityRow) => {
  const owner = r.personName !== r.performedByName ? ` (${r.personName})` : '';
  switch (r.kind) {
    case 'Created':
      return `Created a time entry for ${longDate(r.date)}${owner}`;
    case 'Edited':
      return `Edited a time entry for ${longDate(r.date)}${owner}`;
    case 'Deleted':
      return `Deleted a time entry for ${longDate(r.date)}${owner}`;
    case 'TimerStarted':
      return `Started a timer for a time entry from ${longDate(r.date)}${owner}`;
    default:
      return `Stopped a timer for a time entry from ${longDate(r.date)}${owner}`;
  }
};

const hoursText = (r: ActivityRow) => {
  if (r.kind === 'TimerStarted') return null;
  if (r.kind === 'Edited' && r.hoursBefore !== null && r.hoursBefore !== r.hours)
    return `${fmtDec(r.hoursBefore)} → ${fmtDec(r.hours)} hours`;
  return `${fmtDec(r.hours)} hours`;
};

const listOf = (v: string | undefined) => (v ? v.split(',') : []);

function ActivityPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const period = periodOf(search);
  const filter = toFilter(search);
  const performedByIds = listOf(search.performedByIds);
  const kinds = listOf(search.kinds);
  const log = useQuery({
    queryKey: ['ts', 'activity', filter, performedByIds, kinds],
    queryFn: () => ts.activity({ ...filter, performedByIds, kinds }),
  });
  const options = useQuery({ queryKey: ['ts', 'report-options'], queryFn: ts.reportOptions });
  const set = (next: Partial<ActivitySearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...next }) });

  const pick = (
    label: string,
    key: 'clientIds' | 'jobIds' | 'taskIds' | 'personIds' | 'performedByIds' | 'kinds',
    list: { id: string; name: string }[],
    all: string,
  ) => (
    <div>
      <label>{label}</label>
      <MultiSelect
        options={list}
        value={listOf(search[key])}
        all={all}
        onChange={(ids) => set({ [key]: ids.join(',') || undefined })}
      />
    </div>
  );
  const live = (list: ReportOption[] | undefined) => (list ?? []).filter((o) => !o.archived);

  const rows = log.data?.rows ?? [];
  const days = [...new Set(rows.map((r) => dayOf(r.at)))];

  return (
    <>
      <Link className="back" to="/app/timesheets/reports">
        &larr; Back to Reports
      </Link>
      <div className="jh">
        <h1 className="jt1" style={{ fontSize: 28 }}>
          <b style={{ fontWeight: 700 }}>Activity log</b>
        </h1>
      </div>
      <div className="head">
        <TimeframeBar period={period} from={filter.from} to={filter.to} onChange={set} />
      </div>
      <div className="card rflt rflt6">
        {pick('Clients', 'clientIds', live(options.data?.clients), 'All clients')}
        {pick('Jobs', 'jobIds', live(options.data?.jobs), 'All jobs')}
        {pick('Tasks', 'taskIds', live(options.data?.tasks), 'All tasks')}
        {pick('Event types', 'kinds', KINDS, 'All events')}
        {pick('Owned by', 'personIds', live(options.data?.people), 'Everyone')}
        {pick('Performed by', 'performedByIds', live(options.data?.people), 'Everyone')}
      </div>
      {log.error && <p className="err">{errorText(log.error)}</p>}
      <div className="card rt rd">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Activity</th>
              <th>Client</th>
              <th>Job</th>
              <th>Task</th>
              <th>Performed by</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => [
              <tr key={day} className="cg">
                <th colSpan={6}>
                  {fmtDate(day, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </th>
              </tr>,
              ...rows
                .filter((r) => dayOf(r.at) === day)
                .map((r, i) => (
                  <tr key={`${r.at}-${i}`}>
                    <td className="nw">{timeOf(r.at)}</td>
                    <td>
                      {describe(r)}
                      {hoursText(r) && <div className="nt">{hoursText(r)}</div>}
                      {r.fromJob && <div className="nt">Moved from {r.fromJob}</div>}
                    </td>
                    <td>{r.clientName}</td>
                    <td>{jobLabel(r.jobCode, r.jobTitle)}</td>
                    <td>{r.taskName}</td>
                    <td className="nw">{r.performedByName}</td>
                  </tr>
                )),
            ])}
          </tbody>
        </table>
        {log.data?.count === 0 && <div className="empty">No activity matches these filters</div>}
        {log.data && log.data.count > rows.length && (
          <div className="empty">
            Showing the latest {rows.length} of {log.data.count}. Narrow the dates or filters to see
            the rest.
          </div>
        )}
      </div>
    </>
  );
}
