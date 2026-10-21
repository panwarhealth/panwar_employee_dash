import { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ts, type TsEntry } from '@/api/timesheets';
import { errorText, useTsViewer } from '@/hooks/useTimesheets';
import {
  addDays,
  isAdmin,
  DAY_NAMES,
  fmtDate,
  fmtDec,
  fmtWeek,
  initials,
  jobLabel,
  todayIso,
  weekDays,
  weekStart,
} from '@/lib/timesheets';
import { EntryModal } from '@/components/timesheets/EntryModal';
import { CapacityModal, PersonModal } from '@/components/timesheets/PersonModals';

const PALETTE = [
  '#702f8f',
  '#1f6fbf',
  '#2f8a7d',
  '#c2477e',
  '#8a8f96',
  '#c3abd6',
  '#5b6b8c',
  '#b4762f',
];

interface PersonSearch {
  week?: string;
}

export const Route = createFileRoute('/app/timesheets/team/$personId')({
  validateSearch: (search: Record<string, unknown>): PersonSearch => ({
    week:
      typeof search.week === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(search.week)
        ? weekStart(search.week)
        : undefined,
  }),
  component: PersonPage,
});

interface Slice {
  name: string;
  hours: number;
  colour: string;
}

function Breakdown({ title, items }: { title: string; items: Slice[] }) {
  if (items.length === 0) return null;
  return (
    <div className="card pbx">
      <h3>{title}</h3>
      <div className="stk">
        {items.map((b) => (
          <i key={b.name} style={{ flex: b.hours, background: b.colour }} />
        ))}
      </div>
      {items.map((b) => (
        <div key={b.name} className="lg2">
          <span>
            <i style={{ background: b.colour }} />
            {b.name}
          </span>
          <b>{fmtDec(b.hours)}</b>
        </div>
      ))}
    </div>
  );
}

const breakdown = (entries: TsEntry[], key: (e: TsEntry) => string): Slice[] => {
  const totals = new Map<string, number>();
  entries.forEach((e) => totals.set(key(e), (totals.get(key(e)) ?? 0) + e.hours));
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, hours], i) => ({
      name,
      hours,
      colour: PALETTE[i % PALETTE.length]!,
    }));
};

function PersonPage() {
  const { personId } = Route.useParams();
  const navigate = useNavigate({ from: Route.fullPath });
  const thisWeek = weekStart(todayIso());
  const start = Route.useSearch().week ?? thisWeek;
  const days = weekDays(start);
  const time = useQuery({
    queryKey: ['ts', 'time', start, personId],
    queryFn: () => ts.time(start, days[6]!, personId),
  });
  const team = useQuery({
    queryKey: ['ts', 'team', start],
    queryFn: () => ts.team(start),
  });
  const people = useQuery({ queryKey: ['ts', 'people'], queryFn: ts.people });
  const admin = isAdmin(useTsViewer().data!.level);
  const [editing, setEditing] = useState<TsEntry | null>(null);
  const [profile, setProfile] = useState(false);
  const [capacity, setCapacity] = useState(false);

  const person = people.data?.find((p) => p.id === personId);
  const row = team.data?.find((r) => r.personId === personId);
  const entries = time.data?.entries ?? [];
  const total = entries.reduce((s, e) => s + e.hours, 0);
  const available = row ? row.baseCapacity - row.leave : 0;
  const jobs = breakdown(entries, (e) => jobLabel(e.jobCode, e.jobTitle));
  const tasks = breakdown(entries, (e) => e.taskName);
  const go = (week: string) => navigate({ search: { week: week === thisWeek ? undefined : week } });

  if (!person) return people.isError ? <p className="err">{errorText(people.error)}</p> : null;
  const name = `${person.firstName} ${person.lastName}`.trim();

  return (
    <>
      {admin ? (
        <Link
          className="back"
          to="/app/timesheets/team"
          search={{ week: start === thisWeek ? undefined : start }}
        >
          &larr; Back to Team
        </Link>
      ) : (
        <Link className="back" to="/app/timesheets/reports" search={{ group: 'person' }}>
          &larr; Back to Reports
        </Link>
      )}
      <div className="head" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 14 }}>
        <div className="weeknav">
          <button
            type="button"
            className="btn"
            aria-label="Previous week"
            onClick={() => go(addDays(start, -7))}
          >
            &larr;
          </button>
          <b>
            {start === thisWeek ? 'This week ' : ''}
            {fmtWeek(start)}
          </b>
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
      <div className="jh">
        <div className="ph">
          <span className="av lg">{initials(name)}</span>
          <div>
            <h1 className="jt1" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {name} {row?.role && <span className="badge">{row.role}</span>}
            </h1>
            {person.title && (
              <div className="hint" style={{ fontSize: 15 }}>
                {person.title}
              </div>
            )}
            {person.email && (
              <div className="hint" style={{ fontSize: 15 }}>
                {person.email}
              </div>
            )}
          </div>
        </div>
        {admin && (
          <div className="weeknav">
            <button type="button" className="btn" onClick={() => setProfile(true)}>
              Edit profile
            </button>
            <button type="button" className="btn" onClick={() => setCapacity(true)}>
              Capacity
            </button>
          </div>
        )}
      </div>
      {time.error && <p className="err">{errorText(time.error)}</p>}

      <div className="pg">
        <div>
          <div className="card pbx">
            <div className="pr2">
              <div>
                <span>Total hours</span>
                <b>{fmtDec(total)}</b>
              </div>
              <div>
                <span>Capacity</span>
                <b>{fmtDec(available)}</b>
              </div>
            </div>
            <span className="tb wide">
              <i
                style={{
                  width: `${available > 0 ? Math.min(100, (total / available) * 100) : 0}%`,
                }}
              />
            </span>
          </div>
          <div className="card pbx pdays">
            {days.map((d, i) => (
              <div key={d}>
                <span>{DAY_NAMES[i]}</span>
                <b>
                  {fmtDec(entries.filter((e) => e.date === d).reduce((s, e) => s + e.hours, 0))}
                </b>
              </div>
            ))}
          </div>
          <Breakdown title="Jobs breakdown" items={jobs} />
          <Breakdown title="Tasks breakdown" items={tasks} />
        </div>
        <div>
          {days.map((d) => {
            const dayEntries = entries.filter((e) => e.date === d);
            const weekday = days.indexOf(d) < 5;
            if (dayEntries.length === 0 && (d > todayIso() || !weekday)) return null;
            return (
              <div key={d} className="card pday">
                <div className="pdh">
                  {fmtDate(d, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'short',
                  })}
                </div>
                {dayEntries.length === 0 ? (
                  <div className="pnone">No time tracked</div>
                ) : (
                  <>
                    {dayEntries.map((e) => (
                      <div key={e.id} className="pe">
                        <div>
                          <b>{jobLabel(e.jobCode, e.jobTitle)}</b> ({e.clientName})
                          <div>
                            {e.taskName} &ndash; <span className="hint">{e.notes}</span>
                          </div>
                        </div>
                        <span>{fmtDec(e.hours)}</span>
                        <button type="button" className="btn" onClick={() => setEditing(e)}>
                          Edit
                        </button>
                      </div>
                    ))}
                    <div className="pt">
                      Total: <b>{fmtDec(dayEntries.reduce((s, e) => s + e.hours, 0))}</b>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {editing && <EntryModal entry={editing} onClose={() => setEditing(null)} />}
      {profile && <PersonModal person={person} onClose={() => setProfile(false)} />}
      {capacity && <CapacityModal person={person} onClose={() => setCapacity(false)} />}
    </>
  );
}
