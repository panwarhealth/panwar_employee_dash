import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ts, type CapacityChange, type Person } from '@/api/timesheets';
import { errorText } from '@/hooks/useTimesheets';
import { DAY_NAMES, fmtDate, parseHours, todayIso } from '@/lib/timesheets';
import { TsModal } from './TsModal';

export function PersonModal({
  person,
  placeholder = false,
  onClose,
}: {
  person: Person | null;
  placeholder?: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const isPlaceholder = person?.isPlaceholder ?? placeholder;
  const [firstName, setFirstName] = useState(person?.firstName ?? '');
  const [lastName, setLastName] = useState(person?.lastName ?? '');
  const [email, setEmail] = useState(person?.email ?? '');
  const [title, setTitle] = useState(person?.title ?? '');
  const [isContractor, setIsContractor] = useState(person?.isContractor ?? false);
  const [manages, setManages] = useState(new Set(person?.managedPersonIds ?? []));
  const people = useQuery({ queryKey: ['ts', 'people'], queryFn: ts.people });
  const others = (people.data ?? []).filter(
    (p) => p.id !== person?.id && !p.archived && !p.isPlaceholder,
  );

  const save = useMutation({
    mutationFn: () => {
      const body = {
        firstName,
        lastName,
        email,
        title,
        isContractor,
        isPlaceholder,
        archived: person?.archived ?? false,
        managedPersonIds: [...manages],
      };
      return person ? ts.updatePerson(person.id, body) : ts.createPerson(body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ts'] });
      onClose();
    },
  });

  return (
    <TsModal onClose={onClose}>
      <div className="tool">{isPlaceholder ? 'Placeholder' : 'Person'}</div>
      <div className="row" style={{ marginTop: 8 }}>
        <div className="field">
          <label>{isPlaceholder ? 'Name' : 'First name'}</label>
          <input
            className="inp"
            autoFocus
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
        {!isPlaceholder && (
          <div className="field">
            <label>Last name</label>
            <input className="inp" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        )}
      </div>
      {!isPlaceholder && (
        <>
          <div className="field">
            <label>
              Work email <span>they sign in with this</span>
            </label>
            <input className="inp" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label>
              Role <span>e.g. Senior Medical Writer</span>
            </label>
            <input className="inp" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <label className="ck2">
            <input
              type="checkbox"
              checked={isContractor}
              onChange={(e) => setIsContractor(e.target.checked)}
            />{' '}
            Contractor
          </label>
          <div className="field" style={{ marginTop: 16 }}>
            <label>
              Manages <span>a Manager can see and edit these people's time</span>
            </label>
            <div style={{ maxHeight: 180, overflow: 'auto' }}>
              {others.map((p) => (
                <label key={p.id} className="ck2" style={{ padding: '3px 0' }}>
                  <input
                    type="checkbox"
                    checked={manages.has(p.id)}
                    onChange={(e) =>
                      setManages((m) => {
                        const next = new Set(m);
                        if (e.target.checked) next.add(p.id);
                        else next.delete(p.id);
                        return next;
                      })
                    }
                  />{' '}
                  {p.firstName} {p.lastName}
                </label>
              ))}
            </div>
          </div>
        </>
      )}
      {save.error && <p className="err">{errorText(save.error)}</p>}
      <div className="mfoot">
        <button
          type="button"
          className="primary"
          disabled={save.isPending}
          onClick={() => save.mutate()}
        >
          Save
        </button>
        <button type="button" className="link" onClick={onClose}>
          Cancel
        </button>
      </div>
    </TsModal>
  );
}

export function CapacityModal({ person, onClose }: { person: Person; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [days, setDays] = useState(person.dayHours.map(String));
  const [changes, setChanges] = useState<CapacityChange[]>(person.capacityChanges);
  const [newDate, setNewDate] = useState(todayIso());
  const [newHours, setNewHours] = useState('');
  const [newNote, setNewNote] = useState('');

  const parsed = days.map((d) => parseHours(d));
  const week = parsed.reduce<number>((s, h) => s + (h ?? 0), 0);

  const save = useMutation({
    mutationFn: () =>
      ts.setCapacity(
        person.id,
        parsed.map((h) => h ?? 0),
        changes,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ts'] });
      onClose();
    },
  });

  const addChange = () => {
    const hours = parseHours(newHours);
    if (hours === null || newHours.trim() === '') return;
    setChanges((c) =>
      [
        ...c.filter((x) => x.date !== newDate),
        { date: newDate, hours, note: newNote || null },
      ].sort((a, b) => a.date.localeCompare(b.date)),
    );
    setNewHours('');
    setNewNote('');
  };

  return (
    <TsModal onClose={onClose}>
      <div className="tool">Capacity</div>
      <h2 className="q">
        {person.firstName} {person.lastName}
      </h2>
      <p className="why">Normal hours each day. The schedule and Team page work from this.</p>
      <div className="days">
        {DAY_NAMES.map((name, i) => (
          <div key={name}>
            <label>{name}</label>
            <input
              className="inp"
              value={days[i]}
              onChange={(e) => setDays((d) => d.map((v, j) => (j === i ? e.target.value : v)))}
            />
          </div>
        ))}
      </div>
      <p className="hint" style={{ marginBottom: 20 }}>
        {week}h a week
      </p>
      <h2 className="sub">One-off changes</h2>
      {changes.map((c) => (
        <div key={c.date} className="ovr">
          <span>
            {fmtDate(c.date, {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })}
          </span>
          <span>{c.hours}h</span>
          <span className="hint">{c.note}</span>
          <button
            type="button"
            className="link"
            onClick={() => setChanges((all) => all.filter((x) => x.date !== c.date))}
          >
            Remove
          </button>
        </div>
      ))}
      <div className="ovr">
        <input
          className="inp"
          type="date"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
        />
        <input
          className="inp"
          placeholder="Hours"
          value={newHours}
          onChange={(e) => setNewHours(e.target.value)}
        />
        <input
          className="inp"
          placeholder="Why, optional"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
        />
        <button type="button" className="btn" onClick={addChange}>
          + Change a day
        </button>
      </div>
      {parsed.some((h) => h === null) && <p className="err">Type hours like 7.5</p>}
      {save.error && <p className="err">{errorText(save.error)}</p>}
      <div className="mfoot">
        <button
          type="button"
          className="primary"
          disabled={save.isPending || parsed.some((h) => h === null)}
          onClick={() => save.mutate()}
        >
          Save
        </button>
        <button type="button" className="link" onClick={onClose}>
          Cancel
        </button>
      </div>
    </TsModal>
  );
}
