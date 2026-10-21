import { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ts, type Person, type TeamRow } from '@/api/timesheets';
import { errorText } from '@/hooks/useTimesheets';
import { addDays, fmtDec, fmtWeek, initials, todayIso, weekStart } from '@/lib/timesheets';
import { ActionsMenu } from '@/components/timesheets/ActionsMenu';
import { CapacityModal, PersonModal } from '@/components/timesheets/PersonModals';
import { downloadCsv } from '@/lib/csv';

interface TeamSearch {
  week?: string;
}

export const Route = createFileRoute('/app/timesheets/team/')({
  validateSearch: (search: Record<string, unknown>): TeamSearch => ({
    week:
      typeof search.week === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(search.week)
        ? weekStart(search.week)
        : undefined,
  }),
  component: TeamPage,
});

function TeamPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const queryClient = useQueryClient();
  const thisWeek = weekStart(todayIso());
  const start = Route.useSearch().week ?? thisWeek;
  const team = useQuery({
    queryKey: ['ts', 'team', start],
    queryFn: () => ts.team(start),
  });
  const people = useQuery({ queryKey: ['ts', 'people'], queryFn: ts.people });
  const [filter, setFilter] = useState('');
  const [notDoneOnly, setNotDoneOnly] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Person | 'new' | null>(null);
  const [capacity, setCapacity] = useState<Person | null>(null);

  const setArchived = useMutation({
    mutationFn: (p: Person) => ts.updatePerson(p.id, { ...p, archived: !p.archived }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ts'] }),
  });

  const rows = (team.data ?? []).filter(
    (r) =>
      r.name.toLowerCase().includes(filter.trim().toLowerCase()) && (!notDoneOnly || r.notDone),
  );
  const totalHours = rows.reduce((s, r) => s + r.hours, 0);
  const base = rows.reduce((s, r) => s + r.baseCapacity, 0);
  const leave = rows.reduce((s, r) => s + r.leave, 0);
  const personOf = (id: string) => people.data?.find((p) => p.id === id);
  const go = (week: string) => navigate({ search: { week: week === thisWeek ? undefined : week } });

  const section = (title: string, list: TeamRow[]) =>
    list.length > 0 && (
      <>
        <thead>
          <tr className="cg">
            <th>
              {title} ({list.length})
            </th>
            <th className="rh">Hours</th>
            <th />
            <th className="rh">Available capacity</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {list.map((r) => {
            const available = r.baseCapacity - r.leave;
            const person = personOf(r.personId);
            return (
              <tr key={r.personId}>
                <td className="tnm">
                  <span className="av sm">{initials(r.name)}</span>
                  <Link
                    to="/app/timesheets/team/$personId"
                    params={{ personId: r.personId }}
                    search={{ week: start }}
                  >
                    {r.name}
                  </Link>
                  {r.role && <span className="badge">{r.role}</span>}
                  {r.notDone && <span className="tflag">Not done</span>}
                </td>
                <td className="rh">{fmtDec(r.hours)}</td>
                <td style={{ width: '28%' }}>
                  <span className="tb wide">
                    <i
                      style={{
                        width: `${available > 0 ? Math.min(100, (r.hours / available) * 100) : 0}%`,
                      }}
                    />
                  </span>
                </td>
                <td className="rh cap">
                  <b>{fmtDec(available)}</b>
                  <small>
                    Base {fmtDec(r.baseCapacity)} / Leave -{fmtDec(r.leave)}
                  </small>
                </td>
                <td className="ja">
                  {person && (
                    <ActionsMenu
                      actions={[
                        { label: 'Edit', onSelect: () => setEditing(person) },
                        {
                          label: 'Capacity',
                          onSelect: () => setCapacity(person),
                        },
                        {
                          label: 'Archive',
                          onSelect: () => setArchived.mutate(person),
                        },
                      ]}
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </>
    );

  const archived = (people.data ?? []).filter((p) => p.archived);

  return (
    <>
      <div className="head">
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
        <div className="weeknav">
          <button type="button" className="primary" onClick={() => setEditing('new')}>
            + Add person
          </button>
          <button
            type="button"
            className="btn"
            onClick={() =>
              downloadCsv(`team_${start}.csv`, [
                [
                  'Name',
                  'Role',
                  'Employee?',
                  'Hours',
                  'Capacity',
                  'Leave',
                  'Available',
                  'Not done',
                ],
                ...rows.map((r) => [
                  r.name,
                  r.role ?? '',
                  r.isContractor ? 'No' : 'Yes',
                  fmtDec(r.hours),
                  fmtDec(r.baseCapacity),
                  fmtDec(r.leave),
                  fmtDec(r.baseCapacity - r.leave),
                  r.notDone ? 'Yes' : 'No',
                ]),
              ])
            }
          >
            Export
          </button>
          <button type="button" className="btn" onClick={() => setShowArchived((s) => !s)}>
            {showArchived ? 'Back to the team' : 'View archived people'} &rarr;
          </button>
        </div>
      </div>
      {(team.error || setArchived.error) && (
        <p className="err">{errorText(team.error ?? setArchived.error)}</p>
      )}

      {showArchived ? (
        <div className="card rt">
          <table>
            <tbody>
              {archived.map((p) => (
                <tr key={p.id}>
                  <td>
                    <b>
                      {p.firstName} {p.lastName}
                    </b>{' '}
                    <span className="hint">{p.email}</span>
                  </td>
                  <td className="ja">
                    <button type="button" className="btn" onClick={() => setArchived.mutate(p)}>
                      Restore
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {archived.length === 0 && <div className="empty">No archived people</div>}
        </div>
      ) : (
        <>
          <div className="card rsum tsum">
            <div>
              <span>Total hours</span>
              <b>{fmtDec(totalHours)}</b>
            </div>
            <div>
              <span>Team capacity</span>
              <b>{fmtDec(base - leave)}</b>
              <small>
                Base {fmtDec(base)} / Leave -{fmtDec(leave)}
              </small>
            </div>
          </div>
          <div className="rtools" style={{ justifyContent: 'flex-start' }}>
            <input
              className="inp"
              placeholder="Filter by name"
              style={{ width: 260 }}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <select
              className="sel"
              value={notDoneOnly ? 'nd' : ''}
              onChange={(e) => setNotDoneOnly(e.target.value === 'nd')}
            >
              <option value="">Everyone</option>
              <option value="nd">Not done this week</option>
            </select>
          </div>
          <div className="card rt">
            <table>
              {section(
                'Employees',
                rows.filter((r) => !r.isContractor),
              )}
              {section(
                'Contractors',
                rows.filter((r) => r.isContractor),
              )}
            </table>
            {team.isSuccess && rows.length === 0 && <div className="empty">Nobody matches</div>}
          </div>
        </>
      )}
      {editing && (
        <PersonModal person={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
      {capacity && <CapacityModal person={capacity} onClose={() => setCapacity(null)} />}
    </>
  );
}
