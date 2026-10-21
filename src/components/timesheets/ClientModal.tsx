import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ts, type Client } from '@/api/timesheets';
import { errorText } from '@/hooks/useTimesheets';
import { TsModal } from './TsModal';

export function ClientModal({
  client,
  onClose,
  onSaved,
}: {
  client: Client | null;
  onClose: () => void;
  onSaved?: (client: Client) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(client?.name ?? '');
  const [prefix, setPrefix] = useState(client?.codePrefix ?? '');
  const [ownCodes, setOwnCodes] = useState(client?.suppliesOwnCodes ?? false);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name,
        codePrefix: ownCodes ? null : prefix,
        suppliesOwnCodes: ownCodes,
      };
      return client ? ts.updateClient(client.id, body) : ts.createClient(body);
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['ts', 'clients'] });
      onSaved?.(saved);
      onClose();
    },
  });

  return (
    <TsModal onClose={onClose}>
      <div className="tool">Client</div>
      <div className="field" style={{ marginTop: 8 }}>
        <label>Client name</label>
        <input className="inp" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      {!ownCodes && (
        <div className="field">
          <label>Job code prefix</label>
          <input
            className="inp"
            style={{ width: 120 }}
            value={prefix}
            onChange={(e) => setPrefix(e.target.value.toUpperCase())}
          />
        </div>
      )}
      <label className="ck2">
        <input type="checkbox" checked={ownCodes} onChange={(e) => setOwnCodes(e.target.checked)} />{' '}
        Client gives us their own job codes
      </label>
      {save.error && <p className="err">{errorText(save.error)}</p>}
      <div className="mfoot">
        <button
          type="button"
          className="primary"
          disabled={save.isPending}
          onClick={() => save.mutate()}
        >
          Save client
        </button>
        <button type="button" className="link" onClick={onClose}>
          Cancel
        </button>
      </div>
    </TsModal>
  );
}
