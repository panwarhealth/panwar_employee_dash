import { Fragment, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  ChevronsDownUp,
  ChevronsUpDown,
  Clock,
  FileText,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  ts,
  type Booking,
  type Person,
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
  workingDays,
  dayCapacity,
  JOB_COLOURS,
} from '@/lib/timesheets';
import { BookingModal } from '@/components/timesheets/BookingModal';
import { TsModal } from '@/components/timesheets/TsModal';
import { PersonModal } from '@/components/timesheets/PersonModals';
import { ScheduleExportModal } from '@/components/timesheets/ScheduleExportModal';
import { ActionsMenu } from '@/components/timesheets/ActionsMenu';
import { CalendarFeedModal } from '@/components/timesheets/CalendarFeedModal';

const SCALES = {
  day: { label: 'Day', weeks: 3, step: 1 },
  week: { label: 'Week', weeks: 12, step: 4 },
  month: { label: 'Month', weeks: 26, step: 13 },
} as const;
type Scale = keyof typeof SCALES;
const SCALE_ORDER: Scale[] = ['day', 'week', 'month'];
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
  scale?: 'week' | 'month';
}

export const Route = createFileRoute('/app/timesheets/schedule')({
  validateSearch: (search: Record<string, unknown>): ScheduleSearch => ({
    week:
      typeof search.week === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(search.week)
        ? weekStart(search.week)
        : undefined,
    view: search.view === 'jobs' ? 'jobs' : undefined,
    daily: search.daily === true || search.daily === 'true' ? true : undefined,
    scale: search.scale === 'week' || search.scale === 'month' ? search.scale : undefined,
  }),
  component: SchedulePage,
});

const colourFor = (clientName: string) =>
  COLOURS[[...clientName].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % COLOURS.length]!;

const jobBg = (color: string | null, clientName: string) =>
  (color && JOB_COLOURS[color]) || colourFor(clientName);

const colorOf = (j: { color?: string | null; jobColor?: string | null }) =>
  j.color ?? j.jobColor ?? null;

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

const hrs = (n: number) => Math.round(n * 100) / 100;

const dayPercent = (d: ScheduleDay) =>
  d.capacity - d.off > 0 ? Math.round((d.booked / (d.capacity - d.off)) * 100) : null;

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
  onDaysOff?: boolean;
};

function SchedulePage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const goTo = useNavigate();
  const viewer = useTsViewer().data!;
  const admin = isAdmin(viewer.level);
  const thisWeek = weekStart(todayIso());
  const start = search.week ?? thisWeek;
  const scale: Scale = search.scale ?? 'day';
  const WEEKS = SCALES[scale].weeks;
  const DAYS = WEEKS * 7;
  const pct = (days: number) => `${(days / DAYS) * 100}%`;
  const daily = scale === 'day' && search.daily;
  const schedule = useQuery({
    queryKey: ['ts', 'schedule', start, WEEKS],
    queryFn: () => ts.schedule(start, WEEKS),
  });
  const jump = useRef<HTMLInputElement>(null);
  const [showHours, setShowHours] = useState(false);
  const [shifting, setShifting] = useState<{ id: string; label: string } | null>(null);
  const [shiftText, setShiftText] = useState('7');
  const openJobs = useQuery({
    queryKey: ['ts', 'jobs', 'open'],
    queryFn: () => ts.jobs('open'),
    enabled: search.view === 'jobs',
  });
  const futureHours = useQuery({
    queryKey: ['ts', 'schedule', 'future-hours'],
    queryFn: ts.futureHours,
    enabled: search.view === 'jobs',
  });
  const [filter, setFilter] = useState('');
  const [role, setRole] = useState('');
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [showFeed, setShowFeed] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Editing | null>(null);
  const [addingPlaceholder, setAddingPlaceholder] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [offDay, setOffDay] = useState<Editing | null>(null);
  const staff = useQuery({ queryKey: ['ts', 'people'], queryFn: ts.people });
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
  const archive = useMutation({
    mutationFn: (id: string) => ts.setJobArchived(id, true),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ts'] }),
  });
  const shift = useMutation({
    mutationFn: (v: { id: string; days: number }) => ts.shiftJob(v.id, v.days),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ts', 'schedule'] });
      setShifting(null);
    },
  });
  const set = (next: ScheduleSearch) => navigate({ search: (prev) => ({ ...prev, ...next }) });
  const go = (week: string) => set({ week: week === thisWeek ? undefined : week });

  const days = dateRange(start, addDays(start, DAYS - 1));
  const today = todayIso();
  const term = filter.trim().toLowerCase();
  const bookings = schedule.data?.bookings ?? [];
  const rolesOf = (title: string | null) => (title ? title.split(', ') : []);
  const roles = [...new Set((schedule.data?.people ?? []).flatMap((p) => rolesOf(p.title)))].sort();
  const people = (schedule.data?.people ?? []).filter(
    (p) => p.name.toLowerCase().includes(term) && (!role || rolesOf(p.title).includes(role)),
  );
  const scheduledJobs = schedule.data?.jobs ?? [];
  const jobs = [
    ...scheduledJobs,
    ...(openJobs.data ?? [])
      .filter((o) => !scheduledJobs.some((s) => s.jobId === o.id))
      .map((o) => ({
        jobId: o.id,
        jobCode: o.code,
        jobTitle: o.title,
        clientName: o.clientName,
        isLeave: o.isLeave,
        color: o.color,
        weeks: [] as number[],
      })),
  ]
    .filter((j) => `${j.jobCode} ${j.jobTitle} ${j.clientName}`.toLowerCase().includes(term))
    .sort(
      (a, b) =>
        Number(b.isLeave) - Number(a.isLeave) ||
        a.clientName.localeCompare(b.clientName) ||
        a.jobCode.localeCompare(b.jobCode),
    );
  const futureOf = (jobId: string) =>
    hrs(futureHours.data?.find((f) => f.jobId === jobId)?.hours ?? 0);
  const daysOff = (personId: string) =>
    schedule.data?.people
      .find((p) => p.id === personId)
      ?.days.map((d, i) =>
        d.off > 0 || d.capacity === 0 ? (
          <span
            key={d.date}
            className={d.off > 0 ? 'dayoff leave' : 'dayoff'}
            style={{ left: pct(i), width: pct(1) }}
          />
        ) : null,
      );
  const personName = (id: string) => schedule.data?.people.find((p) => p.id === id)?.name ?? '';
  const zoom = (by: number) => {
    const next = SCALE_ORDER[SCALE_ORDER.indexOf(scale) + by];
    if (next) set({ scale: next === 'day' ? undefined : next });
  };
  const visibleIds = search.view ? jobs.map((j) => j.jobId) : people.map((p) => p.id);
  const allOpen = visibleIds.length > 0 && visibleIds.every((id) => open.has(id));
  const toggleAll = () => setOpen(allOpen ? new Set() : new Set(visibleIds));
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

  const barLabel = (b: Booking, at: { startDate: string; endDate: string }) => {
    const person = staff.data?.find((p) => p.id === b.personId);
    const days = person ? workingDays(person, at.startDate, at.endDate, b.onDaysOff) : 0;
    const perDay = Math.round(b.hoursPerDay * 100) / 100;
    const total = Math.round(b.hoursPerDay * days * 100) / 100;
    if (days <= 1) return `${perDay}h`;
    return (
      <>
        {perDay} h/d <small>{total}h</small>
      </>
    );
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
            background: b.isLeave ? undefined : jobBg(b.jobColor, b.clientName),
          }}
          onPointerDown={(e) => startDrag(e, b, 'move')}
          onClick={() => {
            if (dragged.current) return;
            setEditing({ booking: b, personId: b.personId, job: null });
          }}
        >
          <span className="fh l" onPointerDown={(e) => startDrag(e, b, 'start')} />
          {b.isLeave ? b.jobTitle : barLabel(b, at)}
          {b.note && <FileText className="fn" aria-label="Has a note" />}
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
        onClick={() => {
          const person = staff.data?.find((p) => p.id === personId);
          const next = { booking: null, personId, job, date: d };
          if (person && dayCapacity(person, d) === 0) setOffDay(next);
          else setEditing(next);
        }}
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
          {hrs(w.booked)} hrs{w.off > 0 ? ` + ${hrs(w.off)} off` : ''}
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
        <b>{hrs(d.booked)}h</b>
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
            <button
              type="button"
              className="btn ico"
              title={allOpen ? 'Collapse all' : 'Expand all'}
              aria-label={allOpen ? 'Collapse all' : 'Expand all'}
              onClick={toggleAll}
            >
              {allOpen ? <ChevronsDownUp /> : <ChevronsUpDown />}
            </button>
            {search.view === 'jobs' && (
              <button
                type="button"
                className={showHours ? 'btn ico on' : 'btn ico'}
                title="Future scheduled hours from today"
                aria-label="Future scheduled hours from today"
                onClick={() => setShowHours((v) => !v)}
              >
                <Clock />
              </button>
            )}
            {!search.view && (
              <select className="sel" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="">All roles</option>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            )}
            {!search.view && scale === 'day' && (
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
              className="btn ico"
              title="Zoom out"
              aria-label="Zoom out"
              disabled={scale === 'month'}
              onClick={() => zoom(1)}
            >
              <ZoomOut />
            </button>
            <button
              type="button"
              className="btn ico"
              title="Zoom in"
              aria-label="Zoom in"
              disabled={scale === 'day'}
              onClick={() => zoom(-1)}
            >
              <ZoomIn />
            </button>
            <select
              className="sel"
              value={scale}
              onChange={(e) =>
                set({
                  scale:
                    e.target.value === 'day' ? undefined : (e.target.value as 'week' | 'month'),
                })
              }
            >
              {SCALE_ORDER.map((s) => (
                <option key={s} value={s}>
                  {SCALES[s].label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn ico"
              title="Jump to a date"
              aria-label="Jump to a date"
              onClick={() => jump.current?.showPicker()}
            >
              <CalendarDays />
            </button>
            <input
              ref={jump}
              type="date"
              className="fc-jump"
              tabIndex={-1}
              aria-hidden="true"
              value={start}
              onChange={(e) => e.target.value && go(weekStart(e.target.value))}
            />
            <button
              type="button"
              className="btn"
              aria-label="Previous"
              onClick={() => go(addDays(start, -7 * SCALES[scale].step))}
            >
              &larr;
            </button>
            <button type="button" className="btn" onClick={() => go(thisWeek)}>
              This week
            </button>
            <button
              type="button"
              className="btn"
              aria-label="Next"
              onClick={() => go(addDays(start, 7 * SCALES[scale].step))}
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
              {Array.from({ length: WEEKS }, (_, w) => {
                const monday = days[w * 7]!;
                const newMonth =
                  w === 0 || fromIso(monday).getMonth() !== fromIso(days[w * 7 - 7]!).getMonth();
                return scale === 'day' || newMonth ? (
                  <span key={w} style={{ left: pct(w * 7), width: pct(7) }}>
                    {fmtDate(monday, { month: 'short' })}
                    {(w === 0 || (newMonth && fromIso(monday).getMonth() === 0)) &&
                      ` ${fromIso(monday).getFullYear()}`}
                  </span>
                ) : null;
              })}
            </div>
            <div className="fc-dd">
              {scale === 'day'
                ? days.map((d, i) => (
                    <span
                      key={d}
                      className={d === today ? 'today' : undefined}
                      style={{ left: pct(i), width: pct(1) }}
                    >
                      {fromIso(d).getDate()}
                    </span>
                  ))
                : Array.from({ length: WEEKS }, (_, w) => {
                    const monday = days[w * 7]!;
                    return (
                      <span
                        key={monday}
                        className={monday === thisWeek ? 'today' : undefined}
                        style={{ left: pct(w * 7), width: pct(7) }}
                      >
                        {fromIso(monday).getDate()}
                      </span>
                    );
                  })}
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
                    {daily ? p.days.map(dayBlock) : p.weeks.map(weekBlock)}
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
                              background: j.isLeave
                                ? LEAVE_COLOUR
                                : jobBg(colorOf(j), j.clientName),
                            }}
                          />
                        </div>
                        <div className="fc-t fc-grid" style={grid}>
                          {daysOff(p.id)}
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
                        {(admin || p.id === viewer.personId) && (
                          <ActionsMenu
                            actions={[
                              ...(admin
                                ? [
                                    {
                                      label: 'Edit',
                                      onSelect: () =>
                                        setEditingPerson(
                                          staff.data?.find((x) => x.id === p.id) ?? null,
                                        ),
                                    },
                                  ]
                                : []),
                              ...(p.id === viewer.personId
                                ? [{ label: 'My calendar feed', onSelect: () => setShowFeed(true) }]
                                : []),
                            ]}
                          />
                        )}
                      </div>
                      <div className="fc-t fc-grid" style={grid}>
                        {daysOff(p.id)}
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
            const personIds = [
              ...new Set([
                ...mine.map((b) => b.personId),
                ...(futureHours.data?.find((f) => f.jobId === j.jobId)?.personIds ?? []),
              ]),
            ];
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
                    {showHours && (
                      <span className="fc-hrs" title="Future scheduled hours from today">
                        {futureOf(j.jobId)} hrs
                      </span>
                    )}
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
                        background: j.isLeave ? LEAVE_COLOUR : jobBg(colorOf(j), j.clientName),
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
                            background: j.isLeave ? LEAVE_COLOUR : jobBg(colorOf(j), j.clientName),
                          }}
                        >
                          <b>{hrs(hours)} hrs</b>
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
                          {daysOff(id)}
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
                        <ActionsMenu
                          actions={[
                            {
                              label: 'Edit job',
                              onSelect: () =>
                                goTo({
                                  to: '/app/timesheets/jobs/$jobId/edit',
                                  params: { jobId: j.jobId },
                                }),
                            },
                            {
                              label: 'Shift timeline',
                              onSelect: () =>
                                setShifting({
                                  id: j.jobId,
                                  label: jobLabel(j.jobCode, j.jobTitle),
                                }),
                            },
                            { label: 'Archive job', onSelect: () => archive.mutate(j.jobId) },
                          ]}
                        />
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
          <div className="empty">No open jobs match</div>
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
          onDaysOff={editing.onDaysOff}
          onClose={() => setEditing(null)}
        />
      )}
      {exporting && <ScheduleExportModal onClose={() => setExporting(false)} />}
      {editingPerson && (
        <PersonModal person={editingPerson} onClose={() => setEditingPerson(null)} />
      )}
      {showFeed && <CalendarFeedModal onClose={() => setShowFeed(false)} />}
      {shifting && (
        <TsModal onClose={() => setShifting(null)}>
          <div className="tool">Shift timeline</div>
          <p className="hint" style={{ margin: '8px 0 16px' }}>
            Moves every booking on {shifting.label} from today onwards. Use a minus number to move
            them earlier.
          </p>
          <div className="field">
            <label>Days</label>
            <input
              className="inp"
              style={{ width: 100 }}
              value={shiftText}
              onChange={(e) => setShiftText(e.target.value)}
            />
          </div>
          {shift.error && <p className="err">{errorText(shift.error)}</p>}
          <div className="mfoot">
            <button
              type="button"
              className="primary"
              disabled={
                shift.isPending || !/^-?\d+$/.test(shiftText.trim()) || Number(shiftText) === 0
              }
              onClick={() => shift.mutate({ id: shifting.id, days: Number(shiftText) })}
            >
              Shift
            </button>
            <button type="button" className="link" onClick={() => setShifting(null)}>
              Cancel
            </button>
          </div>
        </TsModal>
      )}
      {offDay && (
        <TsModal onClose={() => setOffDay(null)}>
          <div className="tool">Schedule on a non-work day?</div>
          <p className="hint">
            {fmtDate(offDay.date!, { weekday: 'long', day: 'numeric', month: 'short' })} isn't one
            of their working days.
          </p>
          <div className="mfoot">
            <button
              type="button"
              className="primary"
              onClick={() => {
                setEditing({ ...offDay, onDaysOff: true });
                setOffDay(null);
              }}
            >
              Yes
            </button>
            <button type="button" className="link" onClick={() => setOffDay(null)}>
              Cancel
            </button>
          </div>
        </TsModal>
      )}
      {addingPlaceholder && (
        <PersonModal person={null} placeholder onClose={() => setAddingPlaceholder(false)} />
      )}
    </>
  );
}
