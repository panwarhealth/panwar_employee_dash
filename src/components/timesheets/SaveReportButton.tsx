import { useState } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ts } from '@/api/timesheets';
import { errorText } from '@/hooks/useTimesheets';
import { TsModal } from './TsModal';

export function SaveReportButton() {
  const queryClient = useQueryClient();
  const href = useRouterState({ select: (s) => s.location.href });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const save = useMutation({
    mutationFn: () => ts.saveReport(name, href),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ts', 'saved-reports'] });
      setOpen(false);
      setName('');
    },
  });

  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        Save report
      </button>
      {open && (
        <TsModal onClose={() => setOpen(false)}>
          <div className="tool">Save report</div>
          <div className="field" style={{ marginTop: 8 }}>
            <label>Report name</label>
            <input
              className="inp"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {save.error && <p className="err">{errorText(save.error)}</p>}
          <div className="mfoot">
            <button
              type="button"
              className="primary"
              disabled={save.isPending || name.trim() === ''}
              onClick={() => save.mutate()}
            >
              Save
            </button>
            <button type="button" className="link" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </TsModal>
      )}
    </>
  );
}
