import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ts, type TsEntry } from '@/api/timesheets';
import { errorText } from '@/hooks/useTimesheets';
import { useNow } from '@/hooks/useNow';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { addDays, fmtDate, fmtWeek, todayIso, weekDays, weekStart } from '@/lib/timesheets';
import { DayView } from '@/components/timesheets/DayView';
import { WeekView } from '@/components/timesheets/WeekView';
import { TrackTimeModal } from '@/components/timesheets/TrackTimeModal';
import { EntryModal } from '@/components/timesheets/EntryModal';
import { StopTimerModal } from '@/components/timesheets/StopTimerModal';

interface TimesheetSearch {
  date?: string;
  view?: 'day' | 'week';
}

export const Route = createFileRoute('/app/timesheets/')({
  validateSearch: (search: Record<string, unknown>): TimesheetSearch => ({
    date:
      typeof search.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(search.date)
        ? search.date
        : undefined,
    view: search.view === 'week' ? 'week' : undefined,
  }),
  component: TimesheetPage,
});

const PHONE = '(max-width: 600px)';

function TimesheetPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const queryClient = useQueryClient();
  const today = todayIso();
  const date = search.date ?? today;
  const phone = useMediaQuery(PHONE);
  const view = phone ? 'day' : (search.view ?? 'day');
  const start = weekStart(date);
  const days = weekDays(start);

  const [tracking, setTracking] = useState(false);
  const [editing, setEditing] = useState<TsEntry | null>(null);
  const [stopping, setStopping] = useState<TsEntry | null>(null);

  const time = useQuery({
    queryKey: ['ts', 'time', start],
    queryFn: () => ts.time(start, days[6]!),
  });
  const entries = time.data?.entries ?? [];
  const now = useNow(entries.some((e) => e.timerStartedAt !== null));

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['ts', 'time'] });
  const startTimer = useMutation({
    mutationFn: (e: TsEntry) => ts.startTimer(e.id),
    onSuccess: refresh,
  });
  const stopTimer = useMutation({
    mutationFn: (e: TsEntry) => ts.stopTimer(e.id, e.notes),
    onSuccess: refresh,
  });

  const go = (next: TimesheetSearch) => navigate({ search: (prev) => ({ ...prev, ...next }) });
  const step = view === 'day' ? 1 : 7;
  const label =
    view === 'day'
      ? `${date === today ? 'Today, ' : ''}${fmtDate(date, { weekday: 'long', day: 'numeric', month: 'short' })}`
      : `${start === weekStart(today) ? 'This week, ' : ''}${fmtWeek(start)}`;

  return (
    <>
      <div className="head">
        <div className="weeknav">
          <button type="button" className="primary track" onClick={() => setTracking(true)}>
            + Track time
          </button>
          <button
            type="button"
            className="btn"
            aria-label="Previous"
            onClick={() => go({ date: addDays(date, -step) })}
          >
            &larr;
          </button>
          <b>{label}</b>
          <button
            type="button"
            className="btn"
            aria-label="Next"
            onClick={() => go({ date: addDays(date, step) })}
          >
            &rarr;
          </button>
          {date !== today && (
            <button type="button" className="link" onClick={() => go({ date: undefined })}>
              Return to today
            </button>
          )}
        </div>
        {!phone && (
          <div className="seg">
            <button
              type="button"
              className={view === 'day' ? 'on' : ''}
              onClick={() => go({ view: undefined })}
            >
              Day
            </button>
            <button
              type="button"
              className={view === 'week' ? 'on' : ''}
              onClick={() => go({ view: 'week' })}
            >
              Week
            </button>
          </div>
        )}
      </div>

      {time.isError && <p className="err">{errorText(time.error)}</p>}
      {(startTimer.error || stopTimer.error) && (
        <p className="err">{errorText(startTimer.error ?? stopTimer.error)}</p>
      )}

      {view === 'day' ? (
        <DayView
          days={days}
          selected={date}
          entries={entries}
          now={now}
          onSelect={(d) => go({ date: d })}
          onTrack={() => setTracking(true)}
          onEdit={setEditing}
          onStart={(e) => startTimer.mutate(e)}
          onStop={(e) => (e.notes.trim() ? stopTimer.mutate(e) : setStopping(e))}
        />
      ) : (
        <WeekView
          start={start}
          days={days}
          entries={entries}
          stars={time.data?.stars ?? []}
          now={now}
          onEdit={setEditing}
          onOpenDay={(d) => go({ date: d, view: undefined })}
          onTrack={() => setTracking(true)}
        />
      )}

      {tracking && <TrackTimeModal date={date} onClose={() => setTracking(false)} />}
      {editing && <EntryModal entry={editing} onClose={() => setEditing(null)} />}
      {stopping && <StopTimerModal entry={stopping} onClose={() => setStopping(null)} />}
    </>
  );
}
