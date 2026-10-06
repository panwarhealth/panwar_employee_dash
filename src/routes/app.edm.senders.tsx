import { useState, type FormEvent } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listSenders, saveSender, type EdmSender, type EdmSenderBody } from '@/api/edm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Notice } from '@/components/edm/Notice';
import { labelClass } from '@/lib/edm';

export const Route = createFileRoute('/app/edm/senders')({
  component: SendersPage,
});

function SendersPage() {
  const { data: senders = [], isLoading } = useQuery({
    queryKey: ['edm-senders'],
    queryFn: listSenders,
  });
  const [editing, setEditing] = useState<EdmSender | 'new' | null>(null);

  return (
    <div>
      <h2 className="text-2xl font-bold leading-tight text-ph-charcoal">Senders</h2>
      <p className="mb-6 mt-1.5 text-[15px] text-ph-charcoal/60">
        Who an email comes from. The colour and footer brand the unsubscribe link and page.
        Unsubscribing from one sender's email stops every list that sends as them.
      </p>

      {isLoading ? (
        <p className="py-8 text-sm text-ph-charcoal/60">Loading…</p>
      ) : senders.length === 0 ? (
        <p className="py-8 text-sm text-ph-charcoal/60">No senders yet.</p>
      ) : (
        <ul className="divide-y divide-ph-charcoal/10">
          {senders.map((s) => (
            <li key={s.id} className="flex items-center gap-4 py-5">
              <span
                className="h-10 w-10 shrink-0 rounded-md"
                style={{ backgroundColor: s.brandColour }}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ph-charcoal">{s.name}</p>
                <p className="mt-0.5 truncate text-sm text-ph-charcoal/60">
                  {s.fromAddress}
                  {s.replyTo && ` · replies to ${s.replyTo}`}
                </p>
              </div>
              <Button variant="outline" onClick={() => setEditing(s)}>
                Edit
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Button variant="outline" size="lg" className="mt-6" onClick={() => setEditing('new')}>
        New sender
      </Button>
      {editing && (
        <SenderModal sender={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

const EMPTY: EdmSenderBody = {
  name: '',
  fromAddress: '',
  replyTo: null,
  brandColour: '#702f8f',
  logoUrl: null,
  footerText: '',
};

function SenderModal({ sender, onClose }: { sender: EdmSender | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<EdmSenderBody>(sender ?? EMPTY);
  const set = (patch: Partial<EdmSenderBody>) => setForm({ ...form, ...patch });

  const save = useMutation({
    mutationFn: () => saveSender(sender?.id ?? null, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['edm-senders'] });
      queryClient.invalidateQueries({ queryKey: ['edm-lists'] });
      onClose();
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={sender ? `Edit ${sender.name}` : 'New sender'}
      className="max-w-lg"
    >
      <form onSubmit={submit} className="flex flex-col gap-5 p-6">
        <div>
          <label htmlFor="s-name" className={labelClass}>
            Name people see
          </label>
          <Input
            id="s-name"
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="PharmaChat"
            autoFocus
          />
        </div>
        <div>
          <label htmlFor="s-from" className={labelClass}>
            From address
          </label>
          <Input
            id="s-from"
            type="email"
            value={form.fromAddress}
            onChange={(e) => set({ fromAddress: e.target.value })}
            placeholder="updates@pharmachat.com.au"
          />
          <p className="mt-1.5 text-xs text-ph-charcoal/60">
            Its domain has to be verified in Azure Communication Services, with this address added
            as a sender and the same display name.
          </p>
        </div>
        <div>
          <label htmlFor="s-reply" className={labelClass}>
            Replies go to (optional)
          </label>
          <Input
            id="s-reply"
            type="email"
            value={form.replyTo ?? ''}
            onChange={(e) => set({ replyTo: e.target.value || null })}
            placeholder="hello@pharmachat.com.au"
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
          <div>
            <label htmlFor="s-colour" className={labelClass}>
              Brand colour
            </label>
            <input
              id="s-colour"
              type="color"
              value={form.brandColour}
              onChange={(e) => set({ brandColour: e.target.value })}
              className="h-9 w-16 cursor-pointer rounded-md border border-ph-charcoal/20 bg-white p-1"
            />
          </div>
          <div>
            <label htmlFor="s-logo" className={labelClass}>
              Logo URL for the unsubscribe page (optional)
            </label>
            <Input
              id="s-logo"
              type="url"
              value={form.logoUrl ?? ''}
              onChange={(e) => set({ logoUrl: e.target.value || null })}
              placeholder="https://…"
            />
          </div>
        </div>
        <div>
          <label htmlFor="s-footer" className={labelClass}>
            Footer
          </label>
          <textarea
            id="s-footer"
            rows={3}
            value={form.footerText}
            onChange={(e) => set({ footerText: e.target.value })}
            placeholder="You're getting this because you signed up to PharmaChat. Panwar Health, Sydney NSW."
            className="w-full rounded-md border border-ph-charcoal/20 bg-white px-3 py-2 text-sm text-ph-charcoal shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ph-purple/40"
          />
          <p className="mt-1.5 text-xs text-ph-charcoal/60">
            Added above the unsubscribe link on every email, unless the eDM has its own. The Spam
            Act needs who it's from and how to reach us.
          </p>
        </div>
        {save.isError && <Notice tone="error">{save.error.message}</Notice>}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
