import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ts, type PickJob, type TsEntry } from '@/api/timesheets';
import { errorText } from '@/hooks/useTimesheets';
import { fmtDate, fmtHm, jobLabel, parseHours } from '@/lib/timesheets';
import { TsModal } from './TsModal';
import { JobPicker } from './JobPicker';

export function EntryModal({ entry, onClose }: { entry: TsEntry; onClose: () => void }) {
  const queryClient = useQueryClient();
  const jobs = useQuery({
    queryKey: ['ts', 'pickable', entry.personId],
    queryFn: () => ts.pickableJobs(entry.personId),
  });
  const [moving, setMoving] = useState(false);
  const [job, setJob] = useState<PickJob | null>(null);
  const [taskId, setTaskId] = useState(entry.taskId);
  const [hoursText, setHoursText] = useState(fmtHm(entry.hours));
  const [notes, setNotes] = useState(entry.notes);

  const running = entry.timerStartedAt !== null;
  const currentJob = job ?? jobs.data?.find((j) => j.id === entry.jobId) ?? null;
  const tasks = currentJob?.tasks ?? [{ id: entry.taskId, name: entry.taskName }];
  const hours = parseHours(hoursText);

  const done = () => {
    queryClient.invalidateQueries({ queryKey: ['ts'] });
    onClose();
  };
  const save = useMutation({
    mutationFn: () =>
      ts.updateEntry(entry.id, {
        date: entry.date,
        jobId: currentJob?.id ?? entry.jobId,
        taskId,
        hours: running ? entry.hours : (hours ?? 0),
        notes,
      }),
    onSuccess: done,
  });
  const remove = useMutation({
    mutationFn: () => ts.deleteEntry(entry.id),
    onSuccess: done,
  });

  const pickJob = (j: PickJob) => {
    setJob(j);
    setTaskId(j.tasks.some((t) => t.id === taskId) ? taskId : (j.tasks[0]?.id ?? ''));
  };

  return (
    <TsModal onClose={onClose}>
      <div className="tool">
        {fmtDate(entry.date, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })}
      </div>
      <h2 className="q">
        {jobLabel(currentJob?.code ?? entry.jobCode, currentJob?.title ?? entry.jobTitle)}
      </h2>
      <p className="why">
        {currentJob?.clientName ?? entry.clientName} ·{' '}
        {tasks.find((t) => t.id === taskId)?.name ?? entry.taskName}
      </p>
      {moving && (
        <div className="field">
          <label>Move to</label>
          <JobPicker jobs={jobs.data ?? []} value={currentJob} onChange={pickJob} />
        </div>
      )}
      <div className="row">
        <div className="field" style={{ flex: '0 0 120px' }}>
          <label>Hours</label>
          <input
            className="inp"
            value={hoursText}
            disabled={running}
            onChange={(e) => setHoursText(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Task</label>
          <select className="sel" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label>What did you do?</label>
        <textarea className="inp" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="req">Required</div>
      </div>
      {hours === null && <p className="err">Type hours like 1:30 or 1.5</p>}
      {(save.error || remove.error) && (
        <p className="err">{errorText(save.error ?? remove.error)}</p>
      )}
      <div className="mfoot">
        <button
          type="button"
          className="primary"
          disabled={
            save.isPending || (!running && (hours === null || hours <= 0)) || notes.trim() === ''
          }
          onClick={() => save.mutate()}
        >
          Save
        </button>
        {!moving && (
          <button type="button" className="btn" onClick={() => setMoving(true)}>
            Move to another job
          </button>
        )}
        <button
          type="button"
          className="link"
          disabled={remove.isPending}
          onClick={() => window.confirm('Delete this time entry?') && remove.mutate()}
        >
          Delete
        </button>
      </div>
    </TsModal>
  );
}
