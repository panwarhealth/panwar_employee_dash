import { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ts, type DetailedEntry, type JobRow, type ReportOption } from '@/api/timesheets';
import { errorText } from '@/hooks/useTimesheets';
import { fmtDate, fmtDec, jobLabel } from '@/lib/timesheets';
import { ActionsMenu } from '@/components/timesheets/ActionsMenu';
import { EntryModal } from '@/components/timesheets/EntryModal';
import { JobPicker } from '@/components/timesheets/JobPicker';
import { MultiSelect } from '@/components/timesheets/MultiSelect';
import { SaveReportButton } from '@/components/timesheets/SaveReportButton';
import { TimeframeBar } from '@/components/timesheets/TimeframeBar';
import { TsModal } from '@/components/timesheets/TsModal';
import {
  periodOf,
  toFilter,
  validateReportSearch,
  type DetailBy,
  type ReportSearch,
} from '@/components/timesheets/reportSearch';

export const Route = createFileRoute('/app/timesheets/reports/detailed')({
  validateSearch: validateReportSearch,
  component: DetailedPage,
});

const GROUP_BY: { value: DetailBy; label: string }[] = [
  { value: 'date', label: 'Date' },
  { value: 'client', label: 'Client' },
  { value: 'job', label: 'Job' },
  { value: 'task', label: 'Task' },
  { value: 'person', label: 'Teammate' },
];

const listOf = (v: string | undefined, separator: string) => (v ? v.split(separator) : []);

function DetailedPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const queryClient = useQueryClient();
  const [showFilters, setShowFilters] = useState(false);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<DetailedEntry | null>(null);
  const [moving, setMoving] = useState(false);
  const period = periodOf(search);
  const filter = toFilter(search);
  const by = search.by ?? 'date';
  const report = useQuery({
    queryKey: ['ts', 'detailed', filter, by],
    queryFn: () => ts.detailed(filter, by),
  });
  const options = useQuery({
    queryKey: ['ts', 'report-options'],
    queryFn: ts.reportOptions,
  });
  const set = (next: Partial<ReportSearch>) => {
    setTicked(new Set());
    navigate({ search: (prev) => ({ ...prev, ...next }) });
  };

  const usable = (list: ReportOption[] | undefined) =>
    (list ?? []).filter((o) => search.archived || !o.archived);
  const named = (list: ReportOption[] | undefined, ids: string[], all: string) =>
    ids.length === 0
      ? all
      : ids
          .map((id) => list?.find((x) => x.id === id)?.name ?? '')
          .filter(Boolean)
          .join(', ') || all;

  const idFilter = (
    label: string,
    key: 'clientIds' | 'jobIds' | 'taskIds' | 'personIds',
    list: ReportOption[] | undefined,
    all: string,
  ) => (
    <div>
      <label>{label}</label>
      <MultiSelect
        options={usable(list)}
        value={listOf(search[key], ',')}
        all={all}
        onChange={(ids) => set({ [key]: ids.join(',') || undefined })}
      />
    </div>
  );

  const roles = listOf(search.roles, '|');
  const rows = report.data?.groups.flatMap((g) => g.rows) ?? [];
  const allTicked = rows.length > 0 && rows.every((r) => ticked.has(r.id));
  const toggle = (id: string) =>
    setTicked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const groupLabel = (label: string) =>
    by === 'date'
      ? fmtDate(label, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
      : label;
  const cols = by === 'date' ? 7 : 8;

  return (
    <>
      <Link
        className="back no-print"
        to="/app/timesheets/reports"
        search={{ period, from: filter.from, to: filter.to }}
      >
        &larr; Back to Reports
      </Link>
      <div className="jh">
        <h1 className="jt1" style={{ fontSize: 28 }}>
          <b style={{ fontWeight: 700 }}>Detailed time report</b>
        </h1>
        <div className="weeknav no-print">
          <SaveReportButton />
          <button type="button" className="btn" onClick={() => setShowFilters((s) => !s)}>
            {showFilters ? 'Hide filters' : 'Show filters'}
          </button>
          <button type="button" className="btn" onClick={() => window.print()}>
            Print
          </button>
        </div>
      </div>
      <div className="head no-print">
        <TimeframeBar period={period} from={filter.from} to={filter.to} onChange={set} />
      </div>
      {showFilters && (
        <div className="card rflt no-print">
          {idFilter('Clients', 'clientIds', options.data?.clients, 'All clients')}
          {idFilter('Jobs', 'jobIds', options.data?.jobs, 'All jobs')}
          {idFilter('Tasks', 'taskIds', options.data?.tasks, 'All tasks')}
          {idFilter('Teammates', 'personIds', options.data?.people, 'Everyone')}
          <div>
            <label>Roles</label>
            <MultiSelect
              options={(options.data?.roles ?? []).map((r) => ({ id: r, name: r }))}
              value={roles}
              all="All roles"
              onChange={(list) => set({ roles: list.join('|') || undefined })}
            />
          </div>
          <label className="ck2" style={{ gridColumn: '1 / -1', margin: 0 }}>
            <input
              type="checkbox"
              checked={!!search.archived}
              onChange={(e) => set({ archived: e.target.checked || undefined })}
            />{' '}
            Include archived items in filters
          </label>
        </div>
      )}
      <div className="card rsum rsum2">
        <div>
          <span>Total hours</span>
          <b>{fmtDec(report.data?.total ?? 0)}</b>
        </div>
        <dl>
          <dt>Clients</dt>
          <dd>{named(options.data?.clients, listOf(search.clientIds, ','), 'All clients')}</dd>
          <dt>Jobs</dt>
          <dd>{named(options.data?.jobs, listOf(search.jobIds, ','), 'All jobs')}</dd>
          <dt>Tasks</dt>
          <dd>{named(options.data?.tasks, listOf(search.taskIds, ','), 'All tasks')}</dd>
          <dt>Teammates</dt>
          <dd>{named(options.data?.people, listOf(search.personIds, ','), 'Everyone')}</dd>
          <dt>Roles</dt>
          <dd>{roles.length ? roles.join(', ') : 'All roles'}</dd>
        </dl>
      </div>
      <div className="rtools no-print" style={{ justifyContent: 'space-between' }}>
        <div className="weeknav">
          <select
            className="sel"
            style={{ width: 'auto' }}
            value={by}
            onChange={(e) =>
              set({ by: e.target.value === 'date' ? undefined : (e.target.value as DetailBy) })
            }
          >
            {GROUP_BY.map((g) => (
              <option key={g.value} value={g.value}>
                Group by: {g.label}
              </option>
            ))}
          </select>
          <label className="ck2" style={{ color: 'var(--ink-2)' }}>
            <input
              type="checkbox"
              checked={!!search.openOnly}
              onChange={(e) => set({ openOnly: e.target.checked || undefined })}
            />{' '}
            Open jobs only
          </label>
        </div>
        <div className="weeknav">
          <ActionsMenu
            actions={[
              {
                label: ticked.size
                  ? `Move ${ticked.size} ticked to another job or task`
                  : 'Move ticked time to another job or task',
                onSelect: () => ticked.size && setMoving(true),
              },
            ]}
          />
          <ActionsMenu
            label="Export"
            actions={[
              { label: 'Excel', onSelect: () => ts.exportReport(filter, 'xlsx') },
              { label: 'CSV', onSelect: () => ts.exportReport(filter, 'csv') },
            ]}
          />
        </div>
      </div>
      {report.error && <p className="err">{errorText(report.error)}</p>}
      <div className="card rt rd">
        <table>
          <thead>
            <tr>
              <th className="cb no-print">
                <input
                  type="checkbox"
                  aria-label="Tick all"
                  checked={allTicked}
                  onChange={() => setTicked(allTicked ? new Set() : new Set(rows.map((r) => r.id)))}
                />
              </th>
              {by !== 'date' && <th>Date</th>}
              <th>Client</th>
              <th>Job</th>
              <th>Task</th>
              <th>Roles</th>
              <th>Person</th>
              <th className="rh">Hours</th>
            </tr>
          </thead>
          <tbody>
            {report.data?.groups.map((g) => [
              <tr key={`g-${g.label}`} className="cg">
                <th colSpan={cols - 1}>{groupLabel(g.label)}</th>
                <th className="rh">{fmtDec(g.hours)}</th>
              </tr>,
              ...g.rows.map((r) => (
                <tr key={r.id}>
                  <td className="cb no-print">
                    <input
                      type="checkbox"
                      aria-label="Tick"
                      checked={ticked.has(r.id)}
                      onChange={() => toggle(r.id)}
                    />
                  </td>
                  {by !== 'date' && (
                    <td className="nw">{fmtDate(r.date, { day: 'numeric', month: 'short' })}</td>
                  )}
                  <td>{r.clientName}</td>
                  <td>
                    {jobLabel(r.jobCode, r.jobTitle)}
                    {r.notes && <div className="nt">{r.notes}</div>}
                  </td>
                  <td>{r.taskName}</td>
                  <td>{r.roles}</td>
                  <td className="nw">{r.personName}</td>
                  <td className="rh">
                    <button type="button" className="link" onClick={() => setEditing(r)}>
                      {fmtDec(r.hours)}
                    </button>
                  </td>
                </tr>
              )),
            ])}
          </tbody>
        </table>
        {report.data?.count === 0 && <div className="empty">No time matches these filters</div>}
        {report.data && report.data.count > report.data.shown && (
          <div className="empty">
            Showing the first {report.data.shown} of {report.data.count} entries. Totals include
            them all. Export to get every entry.
          </div>
        )}
      </div>
      {editing && <EntryModal entry={editing} onClose={() => setEditing(null)} />}
      {moving && (
        <MoveModal
          ids={[...ticked]}
          onClose={() => setMoving(false)}
          onMoved={() => {
            setMoving(false);
            setTicked(new Set());
            queryClient.invalidateQueries({ queryKey: ['ts'] });
          }}
        />
      )}
    </>
  );
}

function MoveModal({
  ids,
  onClose,
  onMoved,
}: {
  ids: string[];
  onClose: () => void;
  onMoved: () => void;
}) {
  const jobs = useQuery({ queryKey: ['ts', 'jobs', 'open'], queryFn: () => ts.jobs('open') });
  const [job, setJob] = useState<JobRow | null>(null);
  const [taskId, setTaskId] = useState('');
  const detail = useQuery({
    queryKey: ['ts', 'job', job?.id, 'all'],
    queryFn: () => ts.job(job!.id),
    enabled: !!job,
  });
  const move = useMutation({
    mutationFn: () => ts.moveEntries(ids, job!.id, taskId),
    onSuccess: onMoved,
  });

  return (
    <TsModal onClose={onClose}>
      <div className="tool">Move time</div>
      <p className="hint" style={{ margin: '8px 0 16px' }}>
        Moves the {ids.length} ticked {ids.length === 1 ? 'entry' : 'entries'} to this job and task.
        Dates, hours and notes stay the same.
      </p>
      <div className="field">
        <label>Job</label>
        <JobPicker
          jobs={jobs.data ?? []}
          value={job}
          onChange={(j) => {
            setJob(j);
            setTaskId('');
          }}
        />
      </div>
      <div className="field">
        <label>Task</label>
        <select
          className="sel"
          value={taskId}
          disabled={!job}
          onChange={(e) => setTaskId(e.target.value)}
        >
          <option value="">Pick a task</option>
          {detail.data?.tasks.map((t) => (
            <option key={t.taskId} value={t.taskId}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      {move.error && <p className="err">{errorText(move.error)}</p>}
      <div className="mfoot">
        <button
          type="button"
          className="primary"
          disabled={!job || !taskId || move.isPending}
          onClick={() => move.mutate()}
        >
          Move
        </button>
        <button type="button" className="link" onClick={onClose}>
          Cancel
        </button>
      </div>
    </TsModal>
  );
}
