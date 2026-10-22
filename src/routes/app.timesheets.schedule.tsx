import { Fragment, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ts,
  type Booking,
  type JobRow,
  type ScheduleDay,
  type ScheduleWeek,
} from '@/api/timesheets';
import { errorText, useTsViewer } from '@/hooks/useTimesheets';
import {
  addDays,
  dateRange,
  daysApart,
  fmtDate,
  fromIso,
  initials,
  isAdmin,
  jobLabel,
  todayIso,
  weekStart,
} from '@/lib/timesheets';
import { BookingModal } from '@/components/timesheets/BookingModal';
import { PersonModal } from '@/components/timesheets/PersonModals';
import { ScheduleExportModal } from '@/components/timesheets/ScheduleExportModal';

const WEEKS = 3;
const DAYS = WEEKS * 7;
const COLOURS = [
  '#1f6fbf',
  '#2f8a7d',
  '#c2477e',
  '#702f8f',
  '#b4762f',
  '#5b6b8c',
  '#3a8f3a',
  '#a0522d',
];
const LEAVE_COLOUR = '#8a8f96';

interface ScheduleSearch {
  week?: string;
  view?: 'jobs';
  daily?: boolean;
}

export const Route = createFileRoute('/app/timesheets/schedule')({
  validateSearch: (search: Record<string, unknown>): ScheduleSearch => ({
    week:
      typeof search.week === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(search.week)
        ? weekStart(search.week)
        : undefined,
    view: search.view === 'jobs' ? 'jobs' : undefined,
    daily: search.daily === true || search.daily === 'true' ? true : undefined,
  }),
  component: SchedulePage,
});

const colourFor = (clientName: string) =>
  COLOURS[[...clientName].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % COLOURS.length]!;

const heatOf = (percent: number | null) =>
  percent === null
    ? 'none'
    : percent > 100
      ? 'over'
      : percent >= 90
        ? 'hi'
        : percent >= 50
          ? 'mid'
          : 'lo';

const dayPercent = (d: ScheduleDay) =>
  d.capacity - d.off > 0 ? Math.round((d.booked / (d.capacity - d.off)) * 100) : null;

const pct = (days: number) => `${(days / DAYS) * 100}%`;

type Drag = { id: string; mode: 'move' | 'start' | 'end'; days: number };

const shifted = (b: Booking, drag: Drag | null) => {
  if (!drag || drag.id !== b.id) return { startDate: b.startDate, endDate: b.endDate };
  const from = addDays(b.startDate, drag.days);
  const to = addDays(b.endDate, drag.days);
  if (drag.mode === 'start')
    return { startDate: from < b.endDate ? from : b.endDate, endDate: b.endDate };
  if (drag.mode === 'end')
    return { startDate: b.startDate, endDate: to > b.startDate ? to : b.startDate };
  return { startDate: from, endDate: to };
};

type Editing = {
  booking: Booking | null;
  personId: string | null;
  job: Pick<JobRow, 'id' | 'code' | 'title' | 'clientName'> | null;
  date?: string;
};

function SchedulePage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const admin = isAdmin(useTsViewer().data!.level);
  const thisWeek = weekStart(todayIso());
  const start = search.week ?? thisWeek;
  const schedule = useQuery({
    queryKey: ['ts', 'schedule', start],
    queryFn: () => ts.schedule(start, WEEKS),
  });
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Editing | null>(null);
  const [addingPlaceholder, setAddingPlaceholder] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragged = useRef(false);
  const queryClient = useQueryClient();
  const move = useMutation({
    mutationFn: (v: { id: string; startDate: string; endDate: string }) =>
      ts.moveBooking(v.id, v.startDate, v.endDate),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ts', 'schedule'] });
      setDrag(null);
    },
  });
  const set = (next: ScheduleSearch) => navigate({ search: (prev) => ({ ...prev, ...next }) });
  const go = (week: string) => set({ week: week === thisWeek ? undefined : week });

  const days = dateRange(start, addDays(start, DAYS - 1));
  const today = todayIso();
  const term = filter.trim().toLowerCase();
  const bookings = schedule.data?.bookings ?? [];
  const people = (schedule.data?.people ?? []).filter((p) => p.name.toLowerCase().includes(term));
  const jobs = (schedule.data?.jobs ?? []).filter((j) =>
    `${j.jobCode} ${j.jobTitle} ${j.clientName}`.toLowerCase().includes(term),
  );
  const personName = (id: string) => schedule.data?.people.find((p) => p.id === id)?.name ?? '';
  const toggle = (id: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const grid = { backgroundSize: `calc(100% / ${DAYS}) 100%` };

  const startDrag = (e: ReactPointerEvent, b: Booking, mode: Drag['mode']) => {
    if (e.button !== 0 || move.isPending) return;
    e.stopPropagation();
    const grid = (e.currentTarget as HTMLElement).closest('.fc-grid')!;
    const dayWidth = grid.getBoundingClientRect().width / DAYS;
    const x0 = e.clientX;
    let days = 0;
    dragged.current = false;
    const onMove = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - x0) > 4) dragged.current = true;
      days = Math.round((ev.clientX - x0) / dayWidth);
      if (dragged.current) setDrag({ id: b.id, mode, days });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const next = shifted(b, { id: b.id, mode, days });
      if (!dragged.current || (next.startDate === b.startDate && next.endDate === b.endDate)) {
        setDrag(null);
        return;
      }
      move.mutate({ id: b.id, ...next });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const bars = (list: Booking[]) =>
    list.map((b) => {
      const at = shifted(b, drag);
      const first = Math.max(0, daysApart(start, at.startDate));
      const last = Math.min(DAYS - 1, daysApart(start, at.endDate));
      if (last < first) return null;
      return (
        <button
          type="button"
          key={b.id}
          className={['fbar', b.isLeave ? 'leave' : '', drag?.id === b.id ? 'dragging' : ''].join(
            ' ',
          )}
          title={b.note ?? undefined}
          style={{
            left: pct(first),
            width: pct(last - first + 1),
            background: b.isLeave ? undefined : colourFor(b.clientName),
          }}
          onPointerDown={(e) => startDrag(e, b, 'move')}
          onClick={() => {
            if (dragged.current) return;
            setEditing({ booking: b, personId: b.personId, job: null });
          }}
        >
          <span className="fh l" onPointerDown={(e) => startDrag(e, b, 'start')} />
          {b.isLeave ? b.jobTitle : `${Math.round(b.hoursPerDay * 100) / 100} h/d`}
          <span className="fh r" onPointerDown={(e) => startDrag(e, b, 'end')} />
        </button>
      );
    });

  const dayCells = (personId: string | null, job: Editing['job']) =>
    days.map((d, i) => (
      <button
        type="button"
        key={d}
        className="fc-day"
        aria-label={`Schedule ${fmtDate(d, { day: 'numeric', month: 'short' })}`}
        style={{ left: pct(i), width: pct(1) }}
        onClick={() => setEditing({ booking: null, personId, job, date: d })}
      >
        +
      </button>
    ));

  const weekBlock = (w: ScheduleWeek, i: number) =>
    w.booked === 0 && w.off === 0 ? null : (
      <div
        key={w.start}
        className={`hm ${heatOf(w.percent)}`}
        style={{ left: pct(i * 7), width: pct(7) }}
      >
        <b>{w.percent === null ? '–' : `${w.percent}%`}</b>
        <small>
          {w.booked} hrs{w.off > 0 ? ` + ${w.off} off` : ''}
        </small>
      </div>
    );

  const dayBlock = (d: ScheduleDay, i: number) =>
    d.booked === 0 && d.off === 0 ? null : (
      <div
        key={d.date}
        className={`hm ${heatOf(dayPercent(d))}`}
        style={{ left: pct(i), width: pct(1), padding: '7px 4px' }}
      >
        <b>{d.booked}h</b>
        {d.off > 0 && <small>off</small>}
      </div>
    );

  return (
    <>
      {schedule.error && <p className="err">{errorText(schedule.error)}</p>}
      <div className="card fc">
        <div className="fc-bar">
          <div className="fc-lt" style={{ gap: 18 }}>
            <a className={search.view ? undefined : 'on'} onClick={() => set({ view: undefined })}>
              Team
            </a>
            <a className={search.view ? 'on' : undefined} onClick={() => set({ view: 'jobs' })}>
              Jobs
            </a>
          </div>
          <div className="fc-tools">
            {!search.view && (
              <select
                className="sel"
                value={search.daily ? 'daily' : 'weekly'}
                onChange={(e) => set({ daily: e.target.value === 'daily' || undefined })}
              >
                <option value="weekly">Weekly capacity</option>
                <option value="daily">Daily capacity</option>
              </select>
            )}
            <span className="sp" />
            <button
              type="button"
              className="btn"
              aria-label="Previous week"
              onClick={() => go(addDays(start, -7))}
            >
              &larr;
            </button>
            <button type="button" className="btn" onClick={() => go(thisWeek)}>
              This week
            </button>
            <button
              type="button"
              className="btn"
              aria-label="Next week"
              onClick={() => go(addDays(start, 7))}
            >
              &rarr;
            </button>
          </div>
        </div>
        <div className="fc-row fc-head">
          <div className="fc-l">
            <input
              className="fc-search"
              placeholder="Search..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <div className="fc-t">
            <div className="fc-wk">
              {Array.from({ length: WEEKS }, (_, w) => (
                <span key={w} style={{ left: pct(w * 7), width: pct(7) }}>
                  {fmtDate(days[w * 7]!, { month: 'short' })}
                </span>
              ))}
            </div>
            <div className="fc-dd">
              {days.map((d, i) => (
                <span
                  key={d}
                  className={d === today ? 'today' : undefined}
                  style={{ left: pct(i), width: pct(1) }}
                >
                  {fromIso(d).getDate()}
                </span>
              ))}
            </div>
          </div>
        </div>

        {!search.view &&
          people.map((p) => {
            const expanded = open.has(p.id);
            const mine = bookings.filter((b) => b.personId === p.id);
            const jobRows = [...new Map(mine.map((b) => [b.jobId, b])).values()];
            return (
              <Fragment key={p.id}>
                <div className={expanded ? 'fc-row fc-p open' : 'fc-row fc-p'}>
                  <div className="fc-l">
                    <span className={p.isPlaceholder ? 'av pl' : 'av'}>{initials(p.name)}</span>
                    <div style={{ minWidth: 0 }}>
                      <b>{p.name}</b>
                      {p.title && <small>{p.title}</small>}
                    </div>
                    <button
                      type="button"
                      className="fc-x"
                      aria-label={expanded ? 'Collapse' : 'Expand'}
                      onClick={() => toggle(p.id)}
                    >
                      {expanded ? '▴' : '▾'}
                    </button>
                  </div>
                  <div className="fc-t fc-grid" style={grid}>
                    {search.daily ? p.days.map(dayBlock) : p.weeks.map(weekBlock)}
                  </div>
                </div>
                {expanded && (
                  <>
                    {jobRows.map((j) => (
                      <div key={j.jobId} className="fc-row fc-k">
                        <div className="fc-l">
                          <div>
                            <small>{j.clientName}</small>
                            <b title={jobLabel(j.jobCode, j.jobTitle)}>
                              {jobLabel(j.jobCode, j.jobTitle)}
                            </b>
                          </div>
                          <i
                            className="stripe"
                            style={{
                              background: j.isLeave ? LEAVE_COLOUR : colourFor(j.clientName),
                            }}
                          />
                        </div>
                        <div className="fc-t fc-grid" style={grid}>
                          {dayCells(p.id, {
                            id: j.jobId,
                            code: j.jobCode,
                            title: j.jobTitle,
                            clientName: j.clientName,
                          })}
                          {bars(mine.filter((b) => b.jobId === j.jobId))}
                        </div>
                      </div>
                    ))}
                    <div className="fc-row fc-k fc-act">
                      <div className="fc-l">
                        <button
                          type="button"
                          className="btn"
                          onClick={() =>
                            setEditing({
                              booking: null,
                              personId: p.id,
                              job: null,
                            })
                          }
                        >
                          Assign to job...
                        </button>
                      </div>
                      <div className="fc-t fc-grid" style={grid}>
                        {dayCells(p.id, null)}
                      </div>
                    </div>
                  </>
                )}
              </Fragment>
            );
          })}

        {search.view === 'jobs' &&
          jobs.map((j) => {
            const expanded = open.has(j.jobId);
            const mine = bookings.filter((b) => b.jobId === j.jobId);
            const personIds = [...new Set(mine.map((b) => b.personId))];
            return (
              <Fragment key={j.jobId}>
                <div className={expanded ? 'fc-row fc-p open' : 'fc-row fc-p'}>
                  <div className="fc-l">
                    <div style={{ minWidth: 0 }}>
                      <small>{j.clientName}</small>
                      <b
                        style={{
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={jobLabel(j.jobCode, j.jobTitle)}
                      >
                        {jobLabel(j.jobCode, j.jobTitle)}
                      </b>
                    </div>
                    <button
                      type="button"
                      className="fc-x"
                      aria-label={expanded ? 'Collapse' : 'Expand'}
                      onClick={() => toggle(j.jobId)}
                    >
                      {expanded ? '▴' : '▾'}
                    </button>
                    <i
                      className="stripe"
                      style={{
                        background: j.isLeave ? LEAVE_COLOUR : colourFor(j.clientName),
                        right: 2,
                      }}
                    />
                  </div>
                  <div className="fc-t fc-grid" style={grid}>
                    {j.weeks.map((hours, i) =>
                      hours === 0 ? null : (
                        <div
                          key={i}
                          className="hm"
                          style={{
                            left: pct(i * 7),
                            width: pct(7),
                            background: j.isLeave ? LEAVE_COLOUR : colourFor(j.clientName),
                          }}
                        >
                          <b>{hours} hrs</b>
                        </div>
                      ),
                    )}
                  </div>
                </div>
                {expanded && (
                  <>
                    {personIds.map((id) => (
                      <div key={id} className="fc-row fc-k">
                        <div className="fc-l">
                          <div>
                            <b>{personName(id)}</b>
                          </div>
                        </div>
                        <div className="fc-t fc-grid" style={grid}>
                          {dayCells(id, {
                            id: j.jobId,
                            code: j.jobCode,
                            title: j.jobTitle,
                            clientName: j.clientName,
                          })}
                          {bars(mine.filter((b) => b.personId === id))}
                        </div>
                      </div>
                    ))}
                    <div className="fc-row fc-k fc-act">
                      <div className="fc-l">
                        <button
                          type="button"
                          className="btn"
                          onClick={() =>
                            setEditing({
                              booking: null,
                              personId: null,
                              job: {
                                id: j.jobId,
                                code: j.jobCode,
                                title: j.jobTitle,
                                clientName: j.clientName,
                              },
                            })
                          }
                        >
                          Assign person...
                        </button>
                      </div>
                      <div className="fc-t fc-grid" style={grid}>
                        {dayCells(null, {
                          id: j.jobId,
                          code: j.jobCode,
                          title: j.jobTitle,
                          clientName: j.clientName,
                        })}
                      </div>
                    </div>
                  </>
                )}
              </Fragment>
            );
          })}
        {search.view === 'jobs' && schedule.isSuccess && jobs.length === 0 && (
          <div className="empty">Nothing booked in these weeks</div>
        )}
      </div>
      <div className="fc-foot">
        <button
          type="button"
          className="btn"
          onClick={() => setEditing({ booking: null, personId: null, job: null })}
        >
          + Schedule someone
        </button>
        {admin && (
          <button type="button" className="btn" onClick={() => setAddingPlaceholder(true)}>
            + Add placeholder
          </button>
        )}
        <button type="button" className="btn" onClick={() => setExporting(true)}>
          Export
        </button>
      </div>
      {editing && (
        <BookingModal
          booking={editing.booking}
          personId={editing.personId}
          job={editing.job}
          date={editing.date}
          onClose={() => setEditing(null)}
        />
      )}
      {exporting && <ScheduleExportModal onClose={() => setExporting(false)} />}
      {addingPlaceholder && (
        <PersonModal person={null} placeholder onClose={() => setAddingPlaceholder(false)} />
      )}
    </>
  );
}
