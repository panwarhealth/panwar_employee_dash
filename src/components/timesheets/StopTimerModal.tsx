import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ts, type TsEntry } from '@/api/timesheets';
import { errorText } from '@/hooks/useTimesheets';
import { fmtHm, runningHours } from '@/lib/timesheets';
import { TsModal } from './TsModal';

export function StopTimerModal({ entry, onClose }: { entry: TsEntry; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(entry.notes);
  const elapsed = fmtHm(runningHours(entry.hours, entry.timerStartedAt, Date.now()));

  const done = () => {
    queryClient.invalidateQueries({ queryKey: ['ts', 'time'] });
    onClose();
  };
  const stop = useMutation({
    mutationFn: () => ts.stopTimer(entry.id, notes),
    onSuccess: done,
  });
  const discard = useMutation({
    mutationFn: () => ts.deleteEntry(entry.id),
    onSuccess: done,
  });

  return (
    <TsModal onClose={onClose}>
      <div className="tool">Timer stopped · {elapsed}</div>
      <h2 className="q">What did you work on?</h2>
      <p className="why">
        {entry.jobCode} {entry.jobTitle} · {entry.taskName}
      </p>
      <div className="field">
        <textarea
          autoFocus
          className="inp"
          placeholder="A few words is fine"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className="req">A note is needed to save time</div>
      </div>
      {(stop.error || discard.error) && (
        <p className="err">{errorText(stop.error ?? discard.error)}</p>
      )}
      <div className="mfoot">
        <button
          type="button"
          className="primary"
          disabled={notes.trim() === '' || stop.isPending}
          onClick={() => stop.mutate()}
        >
          Save {elapsed}
        </button>
        <button type="button" className="btn" onClick={onClose}>
          Keep going
        </button>
        {entry.hours === 0 && (
          <button
            type="button"
            className="link"
            disabled={discard.isPending}
            onClick={() => discard.mutate()}
          >
            Discard
          </button>
        )}
      </div>
    </TsModal>
  );
}
