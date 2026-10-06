import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createList, listSenders, updateList, type EdmList, type EdmSyncSource } from '@/api/edm';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Notice } from './Notice';
import { labelClass, selectClass } from '@/lib/edm';

const SOURCES: { value: EdmSyncSource | ''; label: string }[] = [
  { value: '', label: 'A CSV I upload (custom list)' },
  { value: 'PharmaChat', label: 'PharmaChat users who opted in (synced)' },
  {
    value: 'ClinicalStudio',
    label: 'Clinical Studio users who opted in (synced)',
  },
];

/** Create a list, or rename / re-sender an existing one (list given). */
export function ListFormModal({
  open,
  onClose,
  list,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  list?: EdmList;
  onSaved?: (list: EdmList) => void;
}) {
  const queryClient = useQueryClient();
  const { data: senders = [] } = useQuery({
    queryKey: ['edm-senders'],
    queryFn: listSenders,
    enabled: open,
  });
  const [name, setName] = useState(list?.name ?? '');
  const [senderId, setSenderId] = useState(list?.sender.id ?? '');
  const [source, setSource] = useState<EdmSyncSource | ''>('');

  const save = useMutation({
    mutationFn: () =>
      list
        ? updateList(list.id, { name, senderId })
        : createList({ name, senderId, syncSource: source || null }),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['edm-lists'] });
      queryClient.invalidateQueries({ queryKey: ['edm-list', saved.id] });
      onSaved?.(saved);
      onClose();
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={list ? 'Edit list' : 'New list'}
      className="max-w-lg"
    >
      <form onSubmit={submit} className="flex flex-col gap-5 p-6">
        <div>
          <label htmlFor="list-name" className={labelClass}>
            Name
          </label>
          <Input
            id="list-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Panwar Health contacts"
            autoFocus
          />
        </div>
        <div>
          <label htmlFor="list-sender" className={labelClass}>
            Sends as
          </label>
          <select
            id="list-sender"
            className={selectClass}
            value={senderId}
            onChange={(e) => setSenderId(e.target.value)}
          >
            <option value="" disabled>
              Pick a sender
            </option>
            {senders.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} &lt;{s.fromAddress}&gt;
              </option>
            ))}
          </select>
          {senders.length === 0 && (
            <p className="mt-1.5 text-xs text-ph-charcoal/60">
              Add a sender on the Senders tab first.
            </p>
          )}
        </div>
        {!list && (
          <div>
            <label htmlFor="list-source" className={labelClass}>
              Who's on it
            </label>
            <select
              id="list-source"
              className={selectClass}
              value={source}
              onChange={(e) => setSource(e.target.value as EdmSyncSource | '')}
            >
              {SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            {source && (
              <p className="mt-1.5 text-xs text-ph-charcoal/60">
                Synced lists refresh every 15 minutes. Unsubscribes flow back to{' '}
                {source === 'PharmaChat' ? 'PharmaChat' : 'Clinical Studio'}.
              </p>
            )}
          </div>
        )}
        {save.isError && <Notice tone="error">{save.error.message}</Notice>}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!name.trim() || !senderId || save.isPending}>
            {save.isPending ? 'Saving…' : list ? 'Save' : 'Create list'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
