import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ts, type JobDetail } from '@/api/timesheets';
import { errorText, useTsViewer } from '@/hooks/useTimesheets';
import { fmtDec, JOB_COLOURS } from '@/lib/timesheets';
import { ClientModal } from './ClientModal';

const DEFAULT_ALERT = 80;

export function JobForm({
  job,
  onSaved,
  onCancel,
}: {
  job: JobDetail | null;
  onSaved: (job: JobDetail) => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const viewer = useTsViewer().data!;
  const clients = useQuery({
    queryKey: ['ts', 'clients'],
    queryFn: ts.clients,
  });
  const tasks = useQuery({ queryKey: ['ts', 'tasks'], queryFn: ts.tasks });
  const people = useQuery({ queryKey: ['ts', 'people'], queryFn: ts.people });
  const active = (people.data ?? []).filter((p) => !p.archived && !p.isPlaceholder);

  const [clientId, setClientId] = useState(job?.clientId ?? '');
  const [title, setTitle] = useState(job?.title ?? '');
  const [code, setCode] = useState(job?.code ?? '');
  const [isLeave, setIsLeave] = useState(job?.isLeave ?? false);
  const [color, setColor] = useState(job?.color ?? '');
  const colorLabels = useQuery({ queryKey: ['ts', 'color-labels'], queryFn: ts.colorLabels });
  const [trello, setTrello] = useState(true);
  const [byTask, setByTask] = useState(job ? job.budget !== null : true);
  const [alertOn, setAlertOn] = useState(job ? job.alertPercent !== null : true);
  const [alertPercent, setAlertPercent] = useState(String(job?.alertPercent ?? DEFAULT_ALERT));
  const [budgets, setBudgets] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (job?.tasks ?? []).map((t) => [t.taskId, t.budget === null ? '' : String(t.budget)]),
    ),
  );
  const [canLog, setCanLog] = useState<Set<string> | null>(null);
  const [managers, setManagers] = useState<Set<string>>(
    () =>
      new Set(
        job ? job.people.filter((p) => p.isManager).map((p) => p.personId) : [viewer.personId],
      ),
  );
  const [addingClient, setAddingClient] = useState(false);

  useEffect(() => {
    if (job || !tasks.data || Object.keys(budgets).length > 0) return;
    setBudgets(Object.fromEntries(tasks.data.filter((t) => t.isCommon).map((t) => [t.id, ''])));
  }, [job, tasks.data, budgets]);

  useEffect(() => {
    if (canLog || !people.data) return;
    setCanLog(
      new Set(
        !job || job.everyone
          ? active.map((p) => p.id)
          : job.people.filter((p) => p.canLog).map((p) => p.personId),
      ),
    );
  }, [canLog, people.data, job, active]);

  const next = useQuery({
    queryKey: ['ts', 'next-code', clientId],
    queryFn: () => ts.nextCode(clientId),
    enabled: !!clientId,
  });
  useEffect(() => {
    if (!job && next.data) {
      setCode(next.data.code ?? '');
      setColor(next.data.lastColor ?? '');
    }
  }, [job, next.data]);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        clientId,
        code,
        title,
        isLeave,
        color: color || null,
        alertPercent: alertOn ? Number(alertPercent) : null,
        tasks: Object.entries(budgets).map(([taskId, b]) => ({
          taskId,
          budgetHours: byTask && b.trim() !== '' ? Number(b) : null,
        })),
        people: [...(canLog ?? [])].map((personId) => ({
          personId,
          isManager: managers.has(personId),
        })),
        createTrelloCard: !job && trello,
      };
      return job ? ts.updateJob(job.id, body) : ts.createJob(body);
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['ts'] });
      onSaved(saved);
    },
  });

  const toggle = (set: Set<string>, id: string, on: boolean) => {
    const copy = new Set(set);
    if (on) copy.add(id);
    else copy.delete(id);
    return copy;
  };

  const chosen = (tasks.data ?? []).filter((t) => t.id in budgets);
  const others = (tasks.data ?? []).filter((t) => !(t.id in budgets) && !t.archived);
  const total = Object.values(budgets).reduce((s, b) => s + (Number(b) || 0), 0);
  const clientName = clients.data?.find((c) => c.id === clientId)?.name;

  return (
    <>
      <div className="card nf">
        <div className="nfr">
          <label>Client</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              className="sel"
              style={{ flex: 1 }}
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">Pick a client</option>
              {clients.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <span className="hint">or</span>
            <button type="button" className="btn" onClick={() => setAddingClient(true)}>
              + New client
            </button>
          </div>
        </div>
        <div className="nfr">
          <label>Job name</label>
          <input
            className="inp"
            style={{ width: '100%' }}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="nfr">
          <label>Job code</label>
          <div>
            <div
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <input
                className="inp"
                style={{ width: 140 }}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
              {!job && next.data?.lastJob && (
                <span className="hint">
                  Last job code for {clientName}: {next.data.lastJob}
                </span>
              )}
            </div>
            {!job && (
              <small>
                Filled in with the next code for this client. Type over it if the client gave you a
                code.
              </small>
            )}
          </div>
        </div>
        <div className="nfr">
          <label>Trello</label>
          {job ? (
            job.trelloCardUrl ? (
              <a href={job.trelloCardUrl} target="_blank" rel="noreferrer">
                {job.code} | {job.title} &#8599;
              </a>
            ) : (
              <span className="hint">No Trello card</span>
            )
          ) : (
            <label className="ck2">
              <input
                type="checkbox"
                checked={trello}
                onChange={(e) => setTrello(e.target.checked)}
              />{' '}
              Create a Trello card in TO BE BRIEFED from the job card template
            </label>
          )}
        </div>
        <div className="nfr">
          <label>Colour</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <i
              className="swatch"
              style={{ background: color ? JOB_COLOURS[color] : 'transparent' }}
            />
            <select
              className="sel"
              style={{ width: 200 }}
              value={color}
              onChange={(e) => setColor(e.target.value)}
            >
              <option value="">No colour</option>
              {colorLabels.data?.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.name.charAt(0).toUpperCase() + c.name.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="nfr">
          <label>Leave</label>
          <label className="ck2">
            <input
              type="checkbox"
              checked={isLeave}
              onChange={(e) => setIsLeave(e.target.checked)}
            />{' '}
            Time on this job is leave
          </label>
        </div>
        <div className="nfr top">
          <label>Budget</label>
          <div>
            <select
              className="sel"
              value={byTask ? 'task' : 'none'}
              onChange={(e) => setByTask(e.target.value === 'task')}
            >
              <option value="task">Hours per task</option>
              <option value="none">No budget</option>
            </select>
            {byTask && (
              <label className="ck2" style={{ marginTop: 12 }}>
                <input
                  type="checkbox"
                  checked={alertOn}
                  onChange={(e) => setAlertOn(e.target.checked)}
                />{' '}
                Send email alerts if the job exceeds
                <input
                  className="inp"
                  style={{
                    width: 56,
                    textAlign: 'right',
                    padding: '4px 8px',
                    margin: '0 4px',
                  }}
                  value={alertPercent}
                  onChange={(e) => setAlertPercent(e.target.value)}
                />
                % of budget
              </label>
            )}
          </div>
        </div>
        <div className="nfr top">
          <label>Tasks</label>
          <div>
            <table className="nft">
              <thead>
                <tr>
                  <th />
                  {byTask && <th className="rh">Budget hours</th>}
                </tr>
              </thead>
              <tbody>
                {chosen.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <label className="ck2">
                        <input
                          type="checkbox"
                          checked
                          onChange={() => setBudgets(({ [t.id]: _gone, ...rest }) => rest)}
                        />{' '}
                        {t.name}
                      </label>
                    </td>
                    {byTask && (
                      <td className="rh">
                        <input
                          className="inp"
                          value={budgets[t.id]}
                          onChange={(e) =>
                            setBudgets((b) => ({
                              ...b,
                              [t.id]: e.target.value,
                            }))
                          }
                        />
                      </td>
                    )}
                  </tr>
                ))}
                {byTask && (
                  <tr className="tot">
                    <td>Total</td>
                    <td className="rh">{fmtDec(total)}</td>
                  </tr>
                )}
              </tbody>
            </table>
            {others.length > 0 && (
              <select
                className="sel"
                value=""
                onChange={(e) =>
                  e.target.value && setBudgets((b) => ({ ...b, [e.target.value]: '' }))
                }
              >
                <option value="">+ Add task</option>
                {others.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        <div className="nfr top">
          <label>Team</label>
          <div>
            <table className="nft">
              <thead>
                <tr>
                  <th>
                    <button
                      type="button"
                      className="link"
                      style={{ fontSize: 13 }}
                      onClick={() =>
                        setCanLog(
                          new Set(canLog?.size === active.length ? [] : active.map((p) => p.id)),
                        )
                      }
                    >
                      Select all / none
                    </button>
                  </th>
                  <th className="rh">Manages this job</th>
                </tr>
              </thead>
              <tbody>
                {active.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <label className="ck2">
                        <input
                          type="checkbox"
                          checked={canLog?.has(p.id) ?? false}
                          onChange={(e) =>
                            setCanLog(toggle(canLog ?? new Set(), p.id, e.target.checked))
                          }
                        />{' '}
                        {p.firstName} {p.lastName}
                      </label>
                    </td>
                    <td className="rh">
                      <input
                        type="checkbox"
                        checked={managers.has(p.id)}
                        onChange={(e) => {
                          setManagers(toggle(managers, p.id, e.target.checked));
                          if (e.target.checked) setCanLog(toggle(canLog ?? new Set(), p.id, true));
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <small>Everyone ticked can log time to this job. Managers get the budget alert.</small>
          </div>
        </div>
      </div>
      {save.error && <p className="err">{errorText(save.error)}</p>}
      <div className="wfoot">
        <button
          type="button"
          className="primary"
          disabled={save.isPending || !clientId}
          onClick={() => save.mutate()}
        >
          Save job
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
      {addingClient && (
        <ClientModal
          client={null}
          onClose={() => setAddingClient(false)}
          onSaved={(c) => setClientId(c.id)}
        />
      )}
    </>
  );
}
