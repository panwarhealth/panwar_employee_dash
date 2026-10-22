import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ts, type PickJob } from '@/api/timesheets';
import { errorText } from '@/hooks/useTimesheets';
import { fmtDate, parseHours, todayIso } from '@/lib/timesheets';
import { TsModal } from './TsModal';
import { JobPicker } from './JobPicker';

export function TrackTimeModal({
  date,
  personId,
  onClose,
}: {
  date: string;
  personId?: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const jobs = useQuery({
    queryKey: ['ts', 'pickable', personId],
    queryFn: () => ts.pickableJobs(personId),
  });
  const [job, setJob] = useState<PickJob | null>(null);
  const [taskId, setTaskId] = useState('');
  const [notes, setNotes] = useState('');
  const [hoursText, setHoursText] = useState('');
  const [star, setStar] = useState(true);

  const hours = parseHours(hoursText);
  const startTimer = !personId && hoursText.trim() === '' && date === todayIso();

  const save = useMutation({
    mutationFn: async () => {
      if (!job || !taskId) throw new Error('Pick a job and task');
      await ts.createEntry({
        personId,
        date,
        jobId: job.id,
        taskId,
        hours: hours ?? 0,
        notes,
        startTimer,
      });
      if (star && !personId) await ts.setStar(job.id, taskId, true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ts', 'time'] });
      onClose();
    },
  });

  const pickJob = (j: PickJob) => {
    setJob(j);
    setTaskId(j.tasks.some((t) => t.id === taskId) ? taskId : (j.tasks[0]?.id ?? ''));
  };

  const ready =
    !!job && !!taskId && (startTimer || (hours !== null && hours > 0 && notes.trim() !== ''));

  return (
    <TsModal onClose={onClose} className="te">
      <div className="te-h">
        New time entry for {fmtDate(date, { weekday: 'long', day: 'numeric', month: 'short' })}
      </div>
      <div className="te-b">
        <div className="te-l">Job / Task</div>
        <JobPicker jobs={jobs.data ?? []} value={job} onChange={pickJob} />
        <select
          className="pick-btn"
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
          disabled={!job}
        >
          {!job && <option value="">Pick a job first</option>}
          {job?.tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <div className="te-row">
          <textarea
            className="inp te-n"
            placeholder="Notes (required)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <input
            className="inp te-t"
            placeholder="0:00"
            value={hoursText}
            onChange={(e) => setHoursText(e.target.value)}
          />
        </div>
        <div className="te-f">
          <button
            type="button"
            className="primary"
            disabled={!ready || save.isPending}
            onClick={() => save.mutate()}
          >
            {startTimer ? 'Start timer' : 'Save entry'}
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          {!personId && (
            <label className="te-s">
              <input type="checkbox" checked={star} onChange={(e) => setStar(e.target.checked)} />{' '}
              Star this job
            </label>
          )}
        </div>
        {hours === null && <p className="err">Type hours like 1:30 or 1.5</p>}
        {save.error && <p className="err">{errorText(save.error)}</p>}
      </div>
    </TsModal>
  );
}
