import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ts, type TsEntry } from '@/api/timesheets';
import { errorText, useTsViewer } from '@/hooks/useTimesheets';
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
  person?: string;
}

export const Route = createFileRoute('/app/timesheets/')({
  validateSearch: (search: Record<string, unknown>): TimesheetSearch => ({
    date:
      typeof search.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(search.date)
        ? search.date
        : undefined,
    view: search.view === 'week' ? 'week' : undefined,
    person:
      typeof search.person === 'string' && /^[0-9a-f-]{36}$/i.test(search.person)
        ? search.person
        : undefined,
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

  const viewer = useTsViewer().data!;
  const teammates = useQuery({
    queryKey: ['ts', 'teammates'],
    queryFn: ts.teammates,
    enabled: viewer.level !== 'Member',
  });
  const personId = search.person && search.person !== viewer.personId ? search.person : undefined;
  const other = personId ? teammates.data?.find((p) => p.id === personId) : undefined;
  const [tracking, setTracking] = useState(false);
  const [editing, setEditing] = useState<TsEntry | null>(null);
  const [stopping, setStopping] = useState<TsEntry | null>(null);

  const time = useQuery({
    queryKey: ['ts', 'time', start, personId],
    queryFn: () => ts.time(start, days[6]!, personId),
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
        <div className="weeknav">
          {(teammates.data?.length ?? 0) > 1 && (
            <select
              className="sel"
              style={{ width: 'auto' }}
              aria-label="Teammates"
              value={personId ?? viewer.personId}
              onChange={(e) =>
                go({ person: e.target.value === viewer.personId ? undefined : e.target.value })
              }
            >
              {teammates.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id === viewer.personId ? `${p.name} (me)` : p.name}
                </option>
              ))}
            </select>
          )}
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
      </div>

      {other && (
        <p className="note">
          You're looking at {other.name}'s timesheet. Time you add or change here is saved for them.
        </p>
      )}
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
          onStart={personId ? undefined : (e) => startTimer.mutate(e)}
          onStop={
            personId ? undefined : (e) => (e.notes.trim() ? stopTimer.mutate(e) : setStopping(e))
          }
        />
      ) : (
        <WeekView
          start={start}
          days={days}
          entries={entries}
          stars={time.data?.stars ?? []}
          personId={personId}
          now={now}
          onEdit={setEditing}
          onOpenDay={(d) => go({ date: d, view: undefined })}
          onTrack={() => setTracking(true)}
        />
      )}

      {tracking && (
        <TrackTimeModal date={date} personId={personId} onClose={() => setTracking(false)} />
      )}
      {editing && <EntryModal entry={editing} onClose={() => setEditing(null)} />}
      {stopping && <StopTimerModal entry={stopping} onClose={() => setStopping(null)} />}
    </>
  );
}
