import { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { listLists } from '@/api/edm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ListFormModal } from '@/components/edm/ListFormModal';
import { listMeta } from '@/lib/edm';

export const Route = createFileRoute('/app/edm/lists/')({
  component: ListsPage,
});

function ListsPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const { data: lists = [], isLoading } = useQuery({
    queryKey: ['edm-lists'],
    queryFn: listLists,
  });

  const needle = query.trim().toLowerCase();
  const rows = lists.filter(
    (l) =>
      !needle ||
      [l.name, l.sender.name, l.sender.fromAddress].join(' ').toLowerCase().includes(needle),
  );

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold leading-tight text-ph-charcoal">Lists</h2>

      <Input
        className="mb-2 h-11 text-base"
        placeholder="Search lists"
        aria-label="Search lists"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {isLoading ? (
        <p className="py-8 text-sm text-ph-charcoal/60">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-sm text-ph-charcoal/60">
          {lists.length === 0 ? 'No lists yet.' : 'Nothing matches that search.'}
        </p>
      ) : (
        <ul className="divide-y divide-ph-charcoal/10">
          {rows.map((l) => (
            <li key={l.id} className="flex items-center gap-4 py-5">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ph-charcoal">{l.name}</p>
                <p className="mt-1 text-sm text-ph-charcoal/60">{listMeta(l).join(' · ')}</p>
                {l.lastSyncError && <p className="mt-1 text-sm text-red-700">{l.lastSyncError}</p>}
              </div>
              <Button variant="outline" asChild>
                <Link to="/app/edm/lists/$listId" params={{ listId: l.id }}>
                  Open
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Button variant="outline" size="lg" className="mt-6" onClick={() => setCreating(true)}>
        New list
      </Button>
      {creating && (
        <ListFormModal
          open
          onClose={() => setCreating(false)}
          onSaved={(l) => navigate({ to: '/app/edm/lists/$listId', params: { listId: l.id } })}
        />
      )}
    </div>
  );
}
