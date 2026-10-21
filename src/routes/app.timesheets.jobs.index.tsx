import { useMemo, useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ts, type JobRow } from '@/api/timesheets';
import { errorText, useTsViewer } from '@/hooks/useTimesheets';
import { fmtDec, isAdmin, jobLabel } from '@/lib/timesheets';
import { ActionsMenu } from '@/components/timesheets/ActionsMenu';
import { downloadCsv } from '@/lib/csv';

export const Route = createFileRoute('/app/timesheets/jobs/')({
  component: JobsPage,
});

type Status = 'open' | 'archived' | 'all';

function JobsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const admin = isAdmin(useTsViewer().data!.level);
  const [status, setStatus] = useState<Status>('open');
  const [search, setSearch] = useState('');
  const [client, setClient] = useState('');
  const jobs = useQuery({
    queryKey: ['ts', 'jobs', status],
    queryFn: () => ts.jobs(status),
  });

  const archive = useMutation({
    mutationFn: (j: JobRow) => ts.setJobArchived(j.id, !j.archived),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ts', 'jobs'] }),
  });

  const all = jobs.data ?? [];
  const clients = [...new Set(all.map((j) => j.clientName))];
  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const shown = all.filter(
      (j) =>
        (!client || j.clientName === client) &&
        `${j.code} ${j.title} ${j.clientName}`.toLowerCase().includes(term),
    );
    const byClient = new Map<string, JobRow[]>();
    shown.forEach((j) => byClient.set(j.clientName, [...(byClient.get(j.clientName) ?? []), j]));
    return [...byClient.entries()];
  }, [all, search, client]);

  return (
    <>
      <div className="head">
        <div className="weeknav">
          {admin && (
            <Link className="primary" to="/app/timesheets/jobs/new">
              + New job
            </Link>
          )}
          <select
            className="sel"
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
          >
            <option value="open">
              Open jobs
              {status === 'open' && jobs.data ? ` (${all.length})` : ''}
            </option>
            <option value="archived">Archived jobs</option>
            <option value="all">All jobs</option>
          </select>
        </div>
        <div className="weeknav">
          <button
            type="button"
            className="btn"
            onClick={() =>
              downloadCsv('jobs.csv', [
                ['Client', 'Job Code', 'Job', 'Spent', 'Status'],
                ...groups.flatMap(([, list]) =>
                  list.map((j) => [
                    j.clientName,
                    j.code,
                    j.title,
                    fmtDec(j.spent),
                    j.archived ? 'Archived' : 'Open',
                  ]),
                ),
              ])
            }
          >
            Export
          </button>
          <input
            className="inp"
            placeholder="Search by job or client"
            style={{ width: 240 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="sel" value={client} onChange={(e) => setClient(e.target.value)}>
            <option value="">Filter by client</option>
            {clients.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
      {(jobs.error || archive.error) && (
        <p className="err">{errorText(jobs.error ?? archive.error)}</p>
      )}
      <div className="card rt">
        <table>
          <thead>
            <tr>
              <th>Client</th>
              <th className="rh">Spent</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {groups.map(([clientName, list]) => [
              <tr key={clientName} className="cg">
                <th colSpan={3}>{clientName}</th>
              </tr>,
              ...list.map((j) => (
                <tr
                  key={j.id}
                  className="click"
                  onClick={() =>
                    navigate({
                      to: '/app/timesheets/jobs/$jobId',
                      params: { jobId: j.id },
                    })
                  }
                >
                  <td>
                    <b>{jobLabel(j.code, j.title)}</b>
                  </td>
                  <td className="rh">{fmtDec(j.spent)}</td>
                  <td className="ja">
                    {admin && (
                      <ActionsMenu
                        actions={[
                          {
                            label: 'Edit',
                            onSelect: () =>
                              navigate({
                                to: '/app/timesheets/jobs/$jobId/edit',
                                params: { jobId: j.id },
                              }),
                          },
                          {
                            label: j.archived ? 'Restore' : 'Archive',
                            onSelect: () => archive.mutate(j),
                          },
                        ]}
                      />
                    )}
                  </td>
                </tr>
              )),
            ])}
          </tbody>
        </table>
        {jobs.isSuccess && groups.length === 0 && <div className="empty">No jobs match</div>}
      </div>
    </>
  );
}
