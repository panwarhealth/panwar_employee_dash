import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ts, type Booking, type JobRow } from '@/api/timesheets';
import { errorText } from '@/hooks/useTimesheets';
import { fmtAgo } from '@/lib/edm';
import {
  addDays,
  parseHours,
  todayIso,
  weekdayIndex,
  workingDays as countWorkingDays,
} from '@/lib/timesheets';
import { TsModal } from './TsModal';
import { JobPicker } from './JobPicker';

type JobChoice = Pick<JobRow, 'id' | 'code' | 'title' | 'clientName'>;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function BookingModal({
  booking,
  personId,
  job: presetJob,
  date,
  onClose,
}: {
  booking: Booking | null;
  personId: string | null;
  job: JobChoice | null;
  date?: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const people = useQuery({ queryKey: ['ts', 'people'], queryFn: ts.people });
  const jobs = useQuery({
    queryKey: ['ts', 'jobs', 'open'],
    queryFn: () => ts.jobs('open'),
  });
  const [copying, setCopying] = useState(false);
  const editing = booking !== null && !copying;
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
  const [from, setFrom] = useState(booking?.startDate ?? date ?? todayIso());
  const [to, setTo] = useState(booking?.endDate ?? date ?? addDays(todayIso(), 4));
  const [hoursText, setHoursText] = useState(booking ? String(round2(booking.hoursPerDay)) : '');
  const [totalText, setTotalText] = useState<string | null>(null);
  const [note, setNote] = useState(booking?.note ?? '');
  const [repeat, setRepeat] = useState((booking?.repeatWeeks ?? 1) > 1);
  const [weeksText, setWeeksText] = useState(String(Math.max(2, booking?.repeatWeeks ?? 2)));

  const person = people.data?.find((p) => p.id === who);
  const workingDays = person ? countWorkingDays(person, from, to) : 0;
  const fullDay = person
    ? (person.dayHours[weekdayIndex(from)] ?? 0) || Math.max(0, ...person.dayHours)
    : 0;
  const hours = parseHours(hoursText);
  const weeks = repeat ? Number(weeksText) : 1;

  useEffect(() => {
    if (!booking && date && fullDay > 0) setHoursText((h) => h || String(fullDay));
  }, [booking, date, fullDay]);

  const changeHours = (text: string) => {
    setHoursText(text);
    setTotalText(null);
  };
  const changeTotal = (text: string) => {
    setTotalText(text);
    const total = parseHours(text);
    if (total !== null && workingDays > 0) setHoursText(String(round2(total / workingDays)));
  };

  const done = () => {
    queryClient.invalidateQueries({ queryKey: ['ts', 'schedule'] });
    onClose();
  };
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
        repeatWeeks: weeks,
      };
      return editing ? ts.updateBooking(booking.id, body) : ts.createBooking(body);
    },
    onSuccess: done,
  });
  const remove = useMutation({
    mutationFn: (following: boolean) => ts.deleteBooking(booking!.id, following),
    onSuccess: done,
  });

  const name = person ? person.firstName : null;
  const title = copying
    ? 'Copy booking'
    : editing
      ? `${name ?? 'Their'}'s booking`
      : 'Schedule someone';
  const series = editing && booking.repeatWeeks > 1;
  const weeksValid = !repeat || (Number.isInteger(weeks) && weeks >= 2 && weeks <= 104);

  return (
    <TsModal onClose={onClose}>
      <div className="tool">{title}</div>
      <div className="field" style={{ marginTop: 8 }}>
        <label>Who</label>
        <div style={{ display: 'flex', gap: 8 }}>
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
          {editing && (
            <button
              type="button"
              className="btn"
              title="Copy this booking"
              onClick={() => setCopying(true)}
            >
              Copy
            </button>
          )}
        </div>
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
            onChange={(e) => {
              setFrom(e.target.value);
              setTotalText(null);
            }}
          />
        </div>
        <div className="field">
          <label>To</label>
          <input
            className="inp"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setTotalText(null);
            }}
          />
        </div>
      </div>
      <div className="bk-hours">
        <div className="bk-line">
          <label htmlFor="bk-hpd">Hours a day</label>
          <input
            id="bk-hpd"
            className="inp"
            value={hoursText}
            onChange={(e) => changeHours(e.target.value)}
          />
          <span>
            {hours !== null && fullDay > 0
              ? `${Math.round((hours / fullDay) * 100)}% of ${fullDay} h/d`
              : ''}
          </span>
        </div>
        <div className="bk-line">
          <label htmlFor="bk-total">Total hours</label>
          <input
            id="bk-total"
            className="inp"
            disabled={workingDays === 0}
            value={totalText ?? (hours !== null ? String(round2(hours * workingDays)) : '')}
            onChange={(e) => changeTotal(e.target.value)}
          />
          <span>
            across {workingDays} {workingDays === 1 ? 'day' : 'days'}
          </span>
        </div>
      </div>
      <div className="field">
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
      <label className="ck2">
        <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />{' '}
        Repeat weekly
        {repeat && (
          <>
            {' '}
            for{' '}
            <input
              className="inp"
              style={{ width: 64 }}
              value={weeksText}
              onChange={(e) => setWeeksText(e.target.value)}
            />{' '}
            weeks
          </>
        )}
      </label>
      {series && <p className="hint">Saving updates this week and every later week.</p>}
      {(save.error || remove.error) && (
        <p className="err">{errorText(save.error ?? remove.error)}</p>
      )}
      <div className="mfoot">
        <button
          type="button"
          className="primary"
          disabled={save.isPending || !who || !job || hours === null || hours <= 0 || !weeksValid}
          onClick={() => save.mutate()}
        >
          {editing ? 'Save' : 'Schedule'}
        </button>
        {editing && (
          <button
            type="button"
            className="btn"
            disabled={remove.isPending}
            onClick={() => remove.mutate(false)}
          >
            {series ? 'Delete this week' : 'Delete'}
          </button>
        )}
        {series && (
          <button
            type="button"
            className="btn"
            disabled={remove.isPending}
            onClick={() => remove.mutate(true)}
          >
            Delete this and later weeks
          </button>
        )}
        <button type="button" className="link" onClick={onClose}>
          Cancel
        </button>
      </div>
      {editing && (
        <p className="hint" style={{ marginTop: 14, textAlign: 'center' }}>
          Updated {fmtAgo(booking.updatedAt)}
          {booking.updatedByName ? ` by ${booking.updatedByName}` : ''}
        </p>
      )}
    </TsModal>
  );
}
