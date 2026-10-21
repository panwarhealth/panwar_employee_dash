import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ts, type Booking, type JobRow } from '@/api/timesheets';
import { errorText } from '@/hooks/useTimesheets';
import { addDays, dateRange, parseHours, todayIso, weekdayIndex } from '@/lib/timesheets';
import { TsModal } from './TsModal';
import { JobPicker } from './JobPicker';

type JobChoice = Pick<JobRow, 'id' | 'code' | 'title' | 'clientName'>;

export function BookingModal({
  booking,
  personId,
  job: presetJob,
  onClose,
}: {
  booking: Booking | null;
  personId: string | null;
  job: JobChoice | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const people = useQuery({ queryKey: ['ts', 'people'], queryFn: ts.people });
  const jobs = useQuery({
    queryKey: ['ts', 'jobs', 'open'],
    queryFn: () => ts.jobs('open'),
  });
  const [who, setWho] = useState(booking?.personId ?? personId ?? '');
  const [job, setJob] = useState<JobChoice | null>(
    booking
      ? {
          id: booking.jobId,
          code: booking.jobCode,
          title: booking.jobTitle,
          clientName: booking.clientName,
        }
      : presetJob,
  );
  const [taskId, setTaskId] = useState(booking?.taskId ?? '');
  const jobTasks = useQuery({
    queryKey: ['ts', 'job', job?.id, 'all'],
    queryFn: () => ts.job(job!.id),
    enabled: !!job,
  });
  const [from, setFrom] = useState(booking?.startDate ?? todayIso());
  const [to, setTo] = useState(booking?.endDate ?? addDays(todayIso(), 4));
  const [hoursText, setHoursText] = useState(booking ? String(booking.hoursPerDay) : '');
  const [note, setNote] = useState(booking?.note ?? '');

  const done = () => {
    queryClient.invalidateQueries({ queryKey: ['ts', 'schedule'] });
    onClose();
  };
  const hours = parseHours(hoursText);
  const save = useMutation({
    mutationFn: () => {
      const body = {
        personId: who,
        jobId: job!.id,
        taskId: taskId || null,
        startDate: from,
        endDate: to,
        hoursPerDay: hours ?? 0,
        note,
      };
      return booking ? ts.updateBooking(booking.id, body) : ts.createBooking(body);
    },
    onSuccess: done,
  });
  const remove = useMutation({
    mutationFn: () => ts.deleteBooking(booking!.id),
    onSuccess: done,
  });

  const person = people.data?.find((p) => p.id === who);
  const workingDays = person
    ? dateRange(from, to).filter((d) => (person.dayHours[weekdayIndex(d)] ?? 0) > 0).length
    : 0;

  return (
    <TsModal onClose={onClose}>
      <div className="tool">Schedule someone</div>
      <div className="field" style={{ marginTop: 8 }}>
        <label>Who</label>
        <select className="sel" value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="">Pick someone</option>
          {people.data
            ?.filter((p) => !p.archived)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.firstName} {p.lastName}
              </option>
            ))}
        </select>
      </div>
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
        <label>
          Task <span>optional</span>
        </label>
        <select
          className="sel"
          value={taskId}
          disabled={!job}
          onChange={(e) => setTaskId(e.target.value)}
        >
          <option value="">Any task</option>
          {jobTasks.data?.tasks.map((t) => (
            <option key={t.taskId} value={t.taskId}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <div className="row">
        <div className="field">
          <label>From</label>
          <input
            className="inp"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="field">
          <label>To</label>
          <input className="inp" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="field" style={{ flex: '0 0 110px' }}>
          <label>Hours a day</label>
          <input className="inp" value={hoursText} onChange={(e) => setHoursText(e.target.value)} />
        </div>
      </div>
      {person && hours !== null && hours > 0 && (
        <p className="hint">
          {Math.round(hours * workingDays * 100) / 100}h total over {workingDays} working days.
        </p>
      )}
      <div className="field" style={{ marginTop: 14 }}>
        <label>
          Note <span>optional</span>
        </label>
        <input
          className="inp"
          placeholder="e.g. second round of changes"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      {(save.error || remove.error) && (
        <p className="err">{errorText(save.error ?? remove.error)}</p>
      )}
      <div className="mfoot">
        <button
          type="button"
          className="primary"
          disabled={save.isPending || !who || !job || hours === null || hours <= 0}
          onClick={() => save.mutate()}
        >
          {booking ? 'Save' : 'Schedule'}
        </button>
        {booking && (
          <button
            type="button"
            className="btn"
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
          >
            Delete
          </button>
        )}
        <button type="button" className="link" onClick={onClose}>
          Cancel
        </button>
      </div>
    </TsModal>
  );
}
