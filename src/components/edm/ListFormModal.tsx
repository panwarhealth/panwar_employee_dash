import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createList, listSenders, updateList, type EdmList } from '@/api/edm';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Notice } from './Notice';
import { labelClass, selectClass } from '@/lib/edm';

/** Create a custom (CSV) list, or rename / re-sender an existing one (list given). The synced lists are built in. */
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

  const save = useMutation({
    mutationFn: () =>
      list ? updateList(list.id, { name, senderId }) : createList({ name, senderId }),
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
              No senders are set up yet. They're added when a domain is set up in Azure.
            </p>
          )}
        </div>
        {!list && (
          <p className="text-xs text-ph-charcoal/60">
            Fill it by importing a CSV. The PharmaChat and Clinical Studio lists are already set up
            and sync on their own.
          </p>
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
