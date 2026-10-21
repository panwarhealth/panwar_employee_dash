import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ts, type Task } from '@/api/timesheets';
import { errorText } from '@/hooks/useTimesheets';
import { ActionsMenu } from '@/components/timesheets/ActionsMenu';
import { TsModal } from '@/components/timesheets/TsModal';
import { downloadCsv } from '@/lib/csv';

export const Route = createFileRoute('/app/timesheets/tasks')({
  component: TasksPage,
});

function TasksPage() {
  const queryClient = useQueryClient();
  const tasks = useQuery({ queryKey: ['ts', 'tasks'], queryFn: ts.tasks });
  const [search, setSearch] = useState('');
  const [archived, setArchived] = useState(false);
  const [editing, setEditing] = useState<Task | 'new' | null>(null);

  const update = useMutation({
    mutationFn: (t: Task) => ts.updateTask(t.id, t),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ts', 'tasks'] }),
  });

  const term = search.trim().toLowerCase();
  const shown = (tasks.data ?? []).filter(
    (t) => t.archived === archived && t.name.toLowerCase().includes(term),
  );

  const table = (title: string, note: string, list: Task[]) => (
    <div className="card rt" style={{ marginBottom: 16 }}>
      <table>
        <thead>
          <tr>
            <th>
              <b style={{ color: 'var(--ink)' }}>{title}</b>
              <small style={{ display: 'block' }}>{note}</small>
            </th>
            <th />
          </tr>
        </thead>
        <tbody>
          {list.map((t) => (
            <tr key={t.id}>
              <td>
                <b>{t.name}</b>
              </td>
              <td className="ja">
                <ActionsMenu
                  actions={[
                    { label: 'Edit', onSelect: () => setEditing(t) },
                    ...(t.archived
                      ? [
                          {
                            label: 'Restore',
                            onSelect: () => update.mutate({ ...t, archived: false }),
                          },
                        ]
                      : [
                          {
                            label: t.isCommon ? 'Make it an other task' : 'Make it a common task',
                            onSelect: () => update.mutate({ ...t, isCommon: !t.isCommon }),
                          },
                          {
                            label: 'Archive',
                            onSelect: () => update.mutate({ ...t, archived: true }),
                          },
                        ]),
                  ]}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.length === 0 && <div className="empty">None</div>}
    </div>
  );

  return (
    <>
      <div className="head">
        <input
          className="inp"
          placeholder="Filter by task name"
          style={{ width: 280 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="weeknav">
          <button type="button" className="primary" onClick={() => setEditing('new')}>
            + New task
          </button>
          <button
            type="button"
            className="btn"
            onClick={() =>
              downloadCsv('tasks.csv', [
                ['Task', 'Common task', 'Archived'],
                ...shown.map((t) => [t.name, t.isCommon ? 'Yes' : 'No', t.archived ? 'Yes' : 'No']),
              ])
            }
          >
            Export
          </button>
          <button type="button" className="btn" onClick={() => setArchived((a) => !a)}>
            {archived ? 'View active tasks' : 'View archived tasks'} &rarr;
          </button>
        </div>
      </div>
      {(tasks.error || update.error) && (
        <p className="err">{errorText(tasks.error ?? update.error)}</p>
      )}
      {archived ? (
        table('Archived tasks', 'These cannot be added to jobs.', shown)
      ) : (
        <>
          {table(
            'Common tasks',
            'These tasks are added to every new job.',
            shown.filter((t) => t.isCommon),
          )}
          {table(
            'Other tasks',
            'Add these to a job when you need them.',
            shown.filter((t) => !t.isCommon),
          )}
        </>
      )}
      {editing && (
        <TaskModal task={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

function TaskModal({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(task?.name ?? '');
  const [isCommon, setIsCommon] = useState(task?.isCommon ?? false);
  const save = useMutation({
    mutationFn: () => {
      const body = { name, isCommon, archived: task?.archived ?? false };
      return task ? ts.updateTask(task.id, body) : ts.createTask(body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ts', 'tasks'] });
      onClose();
    },
  });

  return (
    <TsModal onClose={onClose}>
      <div className="tool">Task</div>
      <div className="field" style={{ marginTop: 8 }}>
        <label>Task name</label>
        <input className="inp" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <label className="ck2">
        <input type="checkbox" checked={isCommon} onChange={(e) => setIsCommon(e.target.checked)} />{' '}
        Add this task to every new job
      </label>
      {save.error && <p className="err">{errorText(save.error)}</p>}
      <div className="mfoot">
        <button
          type="button"
          className="primary"
          disabled={save.isPending}
          onClick={() => save.mutate()}
        >
          Save task
        </button>
        <button type="button" className="link" onClick={onClose}>
          Cancel
        </button>
      </div>
    </TsModal>
  );
}
