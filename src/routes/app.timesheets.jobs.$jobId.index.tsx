import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ts, type ReportFilter } from '@/api/timesheets';
import { errorText, useTsViewer } from '@/hooks/useTimesheets';
import { addDays, fmtDec, isAdmin, jobLabel, todayIso, toIso } from '@/lib/timesheets';
import { ActionsMenu } from '@/components/timesheets/ActionsMenu';
import { JobChart } from '@/components/timesheets/JobChart';

export const Route = createFileRoute('/app/timesheets/jobs/$jobId/')({
  component: JobPage,
});

type Range = 'all' | 'this' | 'last';

const rangeDates = (range: Range): { from?: string; to?: string } => {
  const now = new Date();
  if (range === 'this')
    return {
      from: toIso(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: todayIso(),
    };
  if (range === 'last') {
    const first = toIso(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    return {
      from: first,
      to: addDays(toIso(new Date(now.getFullYear(), now.getMonth(), 1)), -1),
    };
  }
  return {};
};

function JobPage() {
  const { jobId } = Route.useParams();
  const queryClient = useQueryClient();
  const admin = isAdmin(useTsViewer().data!.level);
  const [cumulative, setCumulative] = useState(true);
  const [tab, setTab] = useState<'tasks' | 'team'>('tasks');
  const [range, setRange] = useState<Range>('all');
  const dates = rangeDates(range);

  const job = useQuery({
    queryKey: ['ts', 'job', jobId, range],
    queryFn: () => ts.job(jobId, dates.from, dates.to),
  });
  const archive = useMutation({
    mutationFn: (archived: boolean) => ts.setJobArchived(jobId, archived),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ts'] }),
  });

  if (job.isError) return <p className="err">{errorText(job.error)}</p>;
  const j = job.data;
  if (!j) return null;

  const filter: ReportFilter = { ...dates, jobIds: [j.id] };
  const budget = j.budget;
  const used = budget ? Math.min(100, Math.round((j.spent / budget) * 100)) : 0;
  const taskBudget = j.tasks.reduce((s, t) => s + (t.budget ?? 0), 0);
  const taskSpent = j.tasks.reduce((s, t) => s + t.spent, 0);

  return (
    <>
      <Link className="back" to="/app/timesheets/jobs">
        &larr; Back to Jobs
      </Link>
      <div className="jh">
        <div>
          <div className="jcl">{j.clientName}</div>
          <h1 className="jt1">
            {jobLabel(j.code, j.title)} {j.archived && <span className="badge">Archived</span>}
          </h1>
        </div>
        <div className="weeknav">
          {j.trelloCardUrl && (
            <a className="btn" href={j.trelloCardUrl} target="_blank" rel="noreferrer">
              Trello card &#8599;
            </a>
          )}
          {admin && (
            <>
              <Link className="btn" to="/app/timesheets/jobs/$jobId/edit" params={{ jobId }}>
                Edit job
              </Link>
              <ActionsMenu
                actions={[
                  {
                    label: j.archived ? 'Restore job' : 'Archive job',
                    onSelect: () => archive.mutate(!j.archived),
                  },
                ]}
              />
            </>
          )}
        </div>
      </div>
      {archive.error && <p className="err">{errorText(archive.error)}</p>}

      <div className="card pad">
        <div className="seg" style={{ marginBottom: 12 }}>
          <button
            type="button"
            className={cumulative ? 'on' : ''}
            onClick={() => setCumulative(true)}
          >
            Job progress
          </button>
          <button
            type="button"
            className={cumulative ? '' : 'on'}
            onClick={() => setCumulative(false)}
          >
            Hours per week
          </button>
        </div>
        <JobChart weeks={j.weeks} budget={budget} cumulative={cumulative} />
      </div>

      <div className="jst">
        <div className="card">
          <span>Total hours</span>
          <b>{fmtDec(j.spent)}</b>
        </div>
        {budget !== null && (
          <div className="card">
            <span>Budget remaining ({Math.max(0, 100 - used)}%)</span>
            <b>{fmtDec(budget - j.spent)}</b>
            <div className="jtb">
              <span>Total budget</span>
              <span>{fmtDec(budget)}</span>
            </div>
            <span className="tb wide">
              <i style={{ width: `${used}%` }} />
            </span>
          </div>
        )}
      </div>

      <div className="jtabs">
        <button
          type="button"
          className={tab === 'tasks' ? 'on' : ''}
          onClick={() => setTab('tasks')}
        >
          Tasks
        </button>
        <button type="button" className={tab === 'team' ? 'on' : ''} onClick={() => setTab('team')}>
          Team
        </button>
      </div>
      <div className="head">
        <h2 className="q">
          {range === 'all' ? 'All time' : range === 'this' ? 'This month' : 'Last month'}
        </h2>
        <div className="weeknav">
          <select className="sel" value={range} onChange={(e) => setRange(e.target.value as Range)}>
            <option value="all">All time</option>
            <option value="this">This month</option>
            <option value="last">Last month</option>
          </select>
          <ActionsMenu
            label="Export"
            actions={[
              {
                label: 'Excel',
                onSelect: () => ts.exportReport(filter, 'xlsx'),
              },
              { label: 'CSV', onSelect: () => ts.exportReport(filter, 'csv') },
            ]}
          />
        </div>
      </div>

      {tab === 'tasks' ? (
        <div className="card rt">
          <table>
            <thead>
              <tr>
                <th>Tasks</th>
                <th className="rh">Budget</th>
                <th className="rh">Spent</th>
                <th />
                <th className="rh">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {j.tasks.map((t) => {
                const remaining = t.budget === null ? null : t.budget - t.spent;
                const pct = t.budget ? Math.min(100, (t.spent / t.budget) * 100) : 0;
                return (
                  <tr key={t.taskId}>
                    <td>{t.name}</td>
                    <td className="rh">{t.budget === null ? '' : fmtDec(t.budget)}</td>
                    <td className="rh">
                      <Link
                        to="/app/timesheets/reports/detailed"
                        search={{ ...dates, jobIds: j.id, taskIds: t.taskId }}
                      >
                        {fmtDec(t.spent)}
                      </Link>
                    </td>
                    <td style={{ width: 140 }}>
                      {t.budget !== null && (
                        <span className="tb">
                          <i style={{ width: `${pct}%` }} />
                          {remaining !== null && remaining < 0 && (
                            <em
                              style={{
                                width: `${(-remaining / t.spent) * 100}%`,
                              }}
                            />
                          )}
                        </span>
                      )}
                    </td>
                    <td className={remaining !== null && remaining < 0 ? 'rh neg' : 'rh'}>
                      {remaining === null ? '' : fmtDec(remaining)}
                    </td>
                  </tr>
                );
              })}
              <tr className="tot">
                <td>Total</td>
                <td className="rh">{taskBudget ? fmtDec(taskBudget) : ''}</td>
                <td className="rh">{fmtDec(taskSpent)}</td>
                <td />
                <td className="rh">{taskBudget ? fmtDec(taskBudget - taskSpent) : ''}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card rt">
          <table>
            <thead>
              <tr>
                <th>Person</th>
                <th className="rh">Spent</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {j.people.map((p) => (
                <tr key={p.personId}>
                  <td>{p.name}</td>
                  <td className="rh">{fmtDec(p.spent)}</td>
                  <td className="ja">{p.isManager && <span className="badge">Manager</span>}</td>
                </tr>
              ))}
              <tr className="tot">
                <td>Total</td>
                <td className="rh">{fmtDec(j.people.reduce((s, p) => s + p.spent, 0))}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
