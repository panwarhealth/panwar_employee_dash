import { useEffect, useState, type FormEvent } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addContact,
  deleteList,
  getList,
  listContacts,
  setContactStatus,
  syncList,
  type EdmContact,
} from '@/api/edm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BackLink } from '@/components/edm/BackLink';
import { ImportContactsModal } from '@/components/edm/ImportContactsModal';
import { ListFormModal } from '@/components/edm/ListFormModal';
import { Notice } from '@/components/edm/Notice';
import { fmtDate, listMeta, num, selectClass } from '@/lib/edm';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/app/edm/lists/$listId')({
  component: ListPage,
});

const STATUS_STYLE: Record<EdmContact['status'], string> = {
  Subscribed: 'text-emerald-700',
  Unsubscribed: 'text-ph-charcoal/50',
  Bounced: 'text-red-700',
};

function ListPage() {
  const { listId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<'edit' | 'import' | null>(null);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: list, error: listError } = useQuery({
    queryKey: ['edm-list', listId],
    queryFn: () => getList(listId),
  });
  const { data: contacts } = useQuery({
    queryKey: ['edm-contacts', listId, debounced, status, page],
    queryFn: () => listContacts(listId, { search: debounced, status, page }),
    placeholderData: keepPreviousData,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['edm-list', listId] });
    queryClient.invalidateQueries({ queryKey: ['edm-contacts', listId] });
    queryClient.invalidateQueries({ queryKey: ['edm-lists'] });
  };

  const sync = useMutation({
    mutationFn: () => syncList(listId),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: () => deleteList(listId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['edm-lists'] });
      navigate({ to: '/app/edm/lists' });
    },
  });
  const toggle = useMutation({
    mutationFn: (c: EdmContact) =>
      setContactStatus(listId, c.id, c.status === 'Subscribed' ? 'unsubscribed' : 'subscribed'),
    onSuccess: refresh,
  });

  if (listError) return <Notice tone="error">{listError.message}</Notice>;
  if (!list) return <p className="text-sm text-ph-charcoal/60">Loading…</p>;

  const isCustom = list.kind === 'Custom';
  const pages = contacts ? Math.max(1, Math.ceil(contacts.total / contacts.pageSize)) : 1;
  const everyone = list.subscribed + list.unsubscribed + list.bounced;

  return (
    <div>
      <BackLink to="/app/edm/lists">Lists</BackLink>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold leading-tight text-ph-charcoal">{list.name}</h2>
          <p className="mt-1.5 text-[15px] text-ph-charcoal/60">{listMeta(list).join(' · ')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isCustom ? (
            <Button onClick={() => setModal('import')}>Import CSV</Button>
          ) : (
            <Button onClick={() => sync.mutate()} disabled={sync.isPending}>
              {sync.isPending ? 'Syncing…' : 'Sync now'}
            </Button>
          )}
          <Button variant="outline" onClick={() => setModal('edit')}>
            Edit
          </Button>
          {isCustom && (
            <Button
              variant="ghost"
              className="text-red-700 hover:bg-red-50"
              disabled={remove.isPending}
              onClick={() => {
                if (window.confirm(`Delete "${list.name}" and its ${num(everyone)} contacts?`))
                  remove.mutate();
              }}
            >
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {list.lastSyncError && <Notice tone="error">{list.lastSyncError}</Notice>}
        {sync.data && !sync.data.error && (
          <Notice tone="success">
            Synced: {num(sync.data.added)} new, {num(sync.data.unsubscribed)} opted out on the
            platform, {num(sync.data.writtenBack)} unsubscribes sent back.
          </Notice>
        )}
        {remove.isError && <Notice tone="error">{remove.error.message}</Notice>}
        {toggle.isError && <Notice tone="error">{toggle.error.message}</Notice>}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Input
          className="h-10 flex-1 basis-60"
          placeholder="Search by name or email"
          aria-label="Search contacts"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Filter by status"
          className={cn(selectClass, 'h-10 w-auto min-w-40')}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Everyone</option>
          <option value="Subscribed">Subscribed</option>
          <option value="Unsubscribed">Unsubscribed</option>
          <option value="Bounced">Bounced</option>
        </select>
      </div>

      {isCustom && <AddContactForm listId={listId} onAdded={refresh} />}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ph-charcoal/10 text-ph-charcoal/60">
            <tr>
              <th className="py-2 pr-4 font-medium">Email</th>
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {contacts?.contacts.map((c) => (
              <tr key={c.id} className="border-b border-ph-charcoal/5">
                <td className="py-2.5 pr-4 text-ph-charcoal">{c.email}</td>
                <td className="py-2.5 pr-4 text-ph-charcoal/80">
                  {[c.firstName, c.lastName].filter(Boolean).join(' ')}
                </td>
                <td className={cn('py-2.5 pr-4', STATUS_STYLE[c.status])}>
                  {c.status}
                  {c.statusChangedAt && c.status !== 'Subscribed' && (
                    <span className="text-ph-charcoal/40"> {fmtDate(c.statusChangedAt)}</span>
                  )}
                </td>
                <td className="py-2.5 text-right">
                  {c.status !== 'Bounced' && (
                    <Button
                      variant="link"
                      size="sm"
                      disabled={toggle.isPending}
                      onClick={() => toggle.mutate(c)}
                    >
                      {c.status === 'Subscribed' ? 'Unsubscribe' : 'Resubscribe'}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {contacts?.total === 0 && (
          <p className="py-6 text-sm text-ph-charcoal/60">
            {debounced || status
              ? 'Nobody matches.'
              : isCustom
                ? 'No contacts yet. Import a CSV to fill the list.'
                : 'No contacts yet. Sync to pull them in.'}
          </p>
        )}
      </div>

      {contacts && pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-ph-charcoal/60">
          <span>{num(contacts.total)} contacts</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <span>
              Page {page} of {pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {modal === 'edit' && <ListFormModal open list={list} onClose={() => setModal(null)} />}
      <ImportContactsModal
        listId={listId}
        open={modal === 'import'}
        onClose={() => setModal(null)}
      />
    </div>
  );
}

function AddContactForm({ listId, onAdded }: { listId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const add = useMutation({
    mutationFn: () => addContact(listId, { email, firstName, lastName }),
    onSuccess: () => {
      setEmail('');
      setFirstName('');
      setLastName('');
      onAdded();
    },
  });

  if (!open)
    return (
      <Button variant="link" className="mt-2 px-0" onClick={() => setOpen(true)}>
        + Add one person
      </Button>
    );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    add.mutate();
  };

  return (
    <form
      onSubmit={submit}
      className="mt-3 flex flex-wrap items-start gap-2 rounded-md bg-ph-charcoal/5 p-3"
    >
      <Input
        className="flex-1 basis-56"
        type="email"
        placeholder="Email"
        aria-label="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoFocus
      />
      <Input
        className="flex-1 basis-32"
        placeholder="First name"
        aria-label="First name"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
      />
      <Input
        className="flex-1 basis-32"
        placeholder="Last name"
        aria-label="Last name"
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
      />
      <Button type="submit" disabled={!email.trim() || add.isPending}>
        Add
      </Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
        Close
      </Button>
      {add.isError && <p className="basis-full text-sm text-red-700">{add.error.message}</p>}
    </form>
  );
}
