import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ts, type Client } from '@/api/timesheets';
import { errorText } from '@/hooks/useTimesheets';
import { ClientModal } from '@/components/timesheets/ClientModal';
import { downloadCsv } from '@/lib/csv';

export const Route = createFileRoute('/app/timesheets/clients')({
  component: ClientsPage,
});

function ClientsPage() {
  const clients = useQuery({
    queryKey: ['ts', 'clients'],
    queryFn: ts.clients,
  });
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Client | 'new' | null>(null);
  const term = search.trim().toLowerCase();
  const shown = (clients.data ?? []).filter((c) => c.name.toLowerCase().includes(term));

  return (
    <>
      <div className="head">
        <input
          className="inp"
          placeholder="Filter by client"
          style={{ width: 280 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="weeknav">
          <button type="button" className="primary" onClick={() => setEditing('new')}>
            + New client
          </button>
          <button
            type="button"
            className="btn"
            onClick={() =>
              downloadCsv('clients.csv', [
                ['Client', 'Job code prefix', 'Own job codes', 'Next code'],
                ...shown.map((c) => [
                  c.name,
                  c.codePrefix ?? '',
                  c.suppliesOwnCodes ? 'Yes' : 'No',
                  c.nextCode ?? '',
                ]),
              ])
            }
          >
            Export
          </button>
        </div>
      </div>
      {clients.error && <p className="err">{errorText(clients.error)}</p>}
      <div className="card rt">
        <table>
          <thead>
            <tr>
              <th style={{ width: 70 }} />
              <th>Client</th>
              <th>Job code prefix</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.id}>
                <td>
                  <button type="button" className="btn" onClick={() => setEditing(c)}>
                    Edit
                  </button>
                </td>
                <td>
                  <b>{c.name}</b>
                </td>
                <td>{c.codePrefix ?? '–'}</td>
                <td className="hint">
                  {c.suppliesOwnCodes
                    ? 'Client gives us their own job codes'
                    : c.nextCode
                      ? `Next code ${c.nextCode}`
                      : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {clients.isSuccess && shown.length === 0 && <div className="empty">No clients match</div>}
      </div>
      {editing && (
        <ClientModal client={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
