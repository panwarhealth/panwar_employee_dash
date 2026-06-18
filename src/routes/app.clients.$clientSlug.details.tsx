import { useEffect, useMemo, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Send, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { YearPicker } from '@/components/YearPicker';
import { ApiError } from '@/api/client';
import {
  addClientUser,
  listClientUsers,
  removeClientUser,
  type ClientUser,
} from '@/api/clients';
import { MONTHS } from '@/api/cpdInvestments';
import {
  listInvites,
  sendInvites,
  previewInvite,
  invitePeriodLabel,
  inviteTemplateLabel,
  INVITE_TEMPLATES,
  type PreviewMode,
} from '@/api/mailer';

export const Route = createFileRoute('/app/clients/$clientSlug/details')({
  component: DetailsTab,
});

function DetailsTab() {
  const { clientSlug } = Route.useParams();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['manage', 'clients', clientSlug, 'users'],
    queryFn: () => listClientUsers(clientSlug),
  });

  return (
    <div className="flex flex-col gap-6 pb-[40vh]">
      <AddUserCard clientSlug={clientSlug} />
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-base font-semibold text-ph-charcoal">Users with access</h2>
          <p className="mt-1 text-sm text-ph-charcoal/60">
            Client users who can sign in and view this client&rsquo;s dashboards.
          </p>
          {isLoading && <p className="mt-3 text-sm text-ph-charcoal/60">Loading…</p>}
          {!isLoading && users.length === 0 && (
            <p className="mt-3 text-sm text-ph-charcoal/60">
              No users yet — add an email above to grant access.
            </p>
          )}
          {users.length > 0 && <UserList users={users} clientSlug={clientSlug} />}
        </CardContent>
      </Card>

      <ReportInvitesCard clientSlug={clientSlug} users={users} />
      <InviteHistory clientSlug={clientSlug} />
    </div>
  );
}

function ReportInvitesCard({ clientSlug, users }: { clientSlug: string; users: ClientUser[] }) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [template, setTemplate] = useState<string>(INVITE_TEMPLATES[0].value);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [scope, setScope] = useState<'year' | 'month'>('year');
  const [month, setMonth] = useState(1);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('stats');
  const [previewNote, setPreviewNote] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [initialised, setInitialised] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const fitIframe = () => {
    const el = iframeRef.current;
    const doc = el?.contentWindow?.document;
    if (!el || !doc) return;
    const h = Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0);
    el.style.height = `${h + 2}px`;
  };

  // The email reflows when the iframe width changes - re-measure after switching device.
  useEffect(() => {
    const id = setTimeout(fitIframe, 60);
    return () => clearTimeout(id);
  }, [previewDevice]);

  const onPreviewLoad = () => {
    fitIframe();
    const doc = iframeRef.current?.contentWindow?.document;
    doc?.querySelectorAll('img').forEach((img) => {
      if (!img.complete) img.addEventListener('load', fitIframe, { once: true });
    });
    setTimeout(fitIframe, 600);
  };

  useEffect(() => {
    if (!initialised && users.length > 0) {
      setSelected(new Set(users.map((u) => u.id)));
      setInitialised(true);
    }
  }, [users, initialised]);

  const startMonth = scope === 'month' ? month : null;
  const endMonth = scope === 'month' ? month : null;
  const noteToSend = previewMode === 'note' ? previewNote.trim() : null;

  useEffect(() => {
    if (!creating) return;
    let cancelled = false;
    setPreviewLoading(true);
    const t = setTimeout(() => {
      previewInvite(clientSlug, {
        template,
        year,
        startMonth,
        endMonth,
        previewMode,
        previewNote: noteToSend,
        recipientUserIds: [],
      })
        .then((res) => {
          if (cancelled) return;
          setPreviewHtml(res.html);
          setPreviewError(null);
        })
        .catch((e) => {
          if (cancelled) return;
          setPreviewError(e instanceof ApiError ? e.message : 'Could not load preview');
        })
        .finally(() => {
          if (!cancelled) setPreviewLoading(false);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [creating, clientSlug, template, year, startMonth, endMonth, previewMode, noteToSend]);

  const send = useMutation({
    mutationFn: () =>
      sendInvites(clientSlug, {
        template,
        year,
        startMonth,
        endMonth,
        previewMode,
        previewNote: noteToSend,
        recipientUserIds: [...selected],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manage', 'clients', clientSlug, 'invites'] });
      setCreating(false);
    },
  });

  const error = send.error instanceof ApiError ? send.error.message : null;
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const periodLabel = scope === 'month'
    ? `${MONTHS.find((m) => m.value === month)?.label} ${year}`
    : String(year);
  const recipientsLabel = selected.size === 1 ? '1 recipient' : `${selected.size} recipients`;
  const closeConfirm = () => {
    setConfirming(false);
    setConfirmText('');
  };
  const confirmed = confirmText.trim().toLowerCase() === 'send';

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ph-charcoal">Emailer</h2>
            <p className="mt-1 max-w-md text-sm text-ph-charcoal/60">
              Alert clients of updates or changes. Used rarely, so it stays tucked away here.
            </p>
          </div>
          {!creating && (
            <Button type="button" size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              New email
            </Button>
          )}
        </div>

        {creating && (
          <>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ph-charcoal">Email</span>
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="h-9 rounded border border-ph-charcoal/15 px-2 text-sm"
            >
              {INVITE_TEMPLATES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ph-charcoal">Year</span>
            <YearPicker year={year} onChange={setYear} label="" />
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ph-charcoal">Period</span>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as 'year' | 'month')}
              className="h-9 rounded border border-ph-charcoal/15 px-2 text-sm"
            >
              <option value="year">Whole year</option>
              <option value="month">Specific month</option>
            </select>
          </label>

          {scope === 'month' && (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ph-charcoal">Month</span>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="h-9 rounded border border-ph-charcoal/15 px-2 text-sm"
              >
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ph-charcoal">Preview block</span>
            <select
              value={previewMode}
              onChange={(e) => setPreviewMode(e.target.value as PreviewMode)}
              className="h-9 rounded border border-ph-charcoal/15 px-2 text-sm"
            >
              <option value="stats">Headline stats (auto)</option>
              <option value="chart">Spend by brand (auto)</option>
              <option value="summary">Summary excerpt (auto)</option>
              <option value="note">Custom note</option>
              <option value="none">None</option>
            </select>
          </label>
          {previewMode === 'note' && (
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-ph-charcoal">Note</span>
              <textarea
                value={previewNote}
                onChange={(e) => setPreviewNote(e.target.value)}
                rows={2}
                placeholder="e.g. A strong period - reach targets exceeded across all channels."
                className="rounded border border-ph-charcoal/15 px-2 py-1.5 text-sm"
              />
            </label>
          )}
        </div>
        {(previewMode === 'stats' || previewMode === 'chart' || previewMode === 'summary') && (
          <p className="mt-1 text-xs text-ph-charcoal/45">
            Pulled live from this client's data for the chosen period.
          </p>
        )}

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ph-charcoal">Preview</span>
            <div className="flex items-center gap-3">
              {previewLoading && <span className="text-xs text-ph-charcoal/45">Updating…</span>}
              <div className="flex overflow-hidden rounded border border-ph-charcoal/15 text-xs">
                {(['desktop', 'mobile'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setPreviewDevice(d)}
                    className={`px-3 py-1 capitalize ${
                      previewDevice === d
                        ? 'bg-ph-purple text-white'
                        : 'text-ph-charcoal/60 hover:text-ph-charcoal'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {previewError ? (
            <p className="mt-2 rounded border border-red-200 bg-red-50 p-3 text-xs text-red-600">
              Preview failed: {previewError}
            </p>
          ) : (
            <div className="mt-2 flex justify-center rounded border border-ph-charcoal/15 bg-[#f0ecf7] p-4">
              <iframe
                ref={iframeRef}
                title="Email preview"
                srcDoc={previewHtml}
                onLoad={onPreviewLoad}
                scrolling="no"
                style={{ width: previewDevice === 'mobile' ? 390 : 600, maxWidth: '100%' }}
                className="block"
              />
            </div>
          )}
        </div>

        <div className="mt-4">
          <span className="text-xs font-medium text-ph-charcoal">Recipients</span>
          {users.length === 0 ? (
            <p className="mt-1 text-sm text-ph-charcoal/60">
              No users with access yet - grant access above first.
            </p>
          ) : (
            <div className="mt-2 flex flex-col gap-1.5">
              {users.map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-sm text-ph-charcoal/80">
                  <input
                    type="checkbox"
                    checked={selected.has(u.id)}
                    onChange={() => toggle(u.id)}
                  />
                  {u.email}
                  {u.name ? <span className="text-ph-charcoal/50">({u.name})</span> : null}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button
            type="button"
            size="sm"
            disabled={send.isPending || selected.size === 0}
            onClick={() => setConfirming(true)}
          >
            <Send className="h-4 w-4" />
            {send.isPending ? 'Sending...' : `Send to ${selected.size}`}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)}>
            Cancel
          </Button>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
          </>
        )}

        <Modal open={confirming} onClose={closeConfirm} title="Confirm send" className="max-w-md">
          <div className="flex flex-col gap-3 p-6">
            <p className="text-sm text-ph-charcoal/80">
              This emails the "{inviteTemplateLabel(template)}" template for {periodLabel} to{' '}
              {recipientsLabel} right now.
            </p>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ph-charcoal">
                Type "send" to confirm
              </span>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="send"
                autoFocus
              />
            </label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                disabled={!confirmed || send.isPending}
                onClick={() => {
                  send.mutate();
                  closeConfirm();
                }}
              >
                <Send className="h-4 w-4" />
                Send now
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={closeConfirm}>
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      </CardContent>
    </Card>
  );
}

function InviteHistory({ clientSlug }: { clientSlug: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['manage', 'clients', clientSlug, 'invites'],
    queryFn: () => listInvites(clientSlug),
  });
  const invites = useMemo(() => data?.items ?? [], [data]);
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-AU') : '-');

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="text-base font-semibold text-ph-charcoal">Send history</h2>
        {isLoading && <p className="mt-3 text-sm text-ph-charcoal/60">Loading…</p>}
        {!isLoading && invites.length === 0 && (
          <p className="mt-3 text-sm text-ph-charcoal/60">No emails sent yet.</p>
        )}
        {invites.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ph-charcoal/10 text-xs uppercase tracking-wide text-ph-charcoal/60">
              <tr>
                <th className="py-2 pr-4 font-medium">Recipient</th>
                <th className="py-2 pr-4 font-medium">Type</th>
                <th className="py-2 pr-4 font-medium">Period</th>
                <th className="py-2 pr-4 font-medium">Last sent</th>
                <th className="py-2 pr-4 font-medium">Sends</th>
                <th className="py-2 pr-4 font-medium">Clicked</th>
                <th className="py-2 pr-4 font-medium">Viewed</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((inv, i) => (
                <tr
                  key={inv.id}
                  className={`border-b border-ph-charcoal/5 last:border-0 ${i % 2 === 1 ? 'bg-slate-100/50' : ''}`}
                >
                  <td className="py-2 pr-4 font-medium text-ph-charcoal">{inv.recipientEmail}</td>
                  <td className="py-2 pr-4 text-ph-charcoal/70">{inviteTemplateLabel(inv.template)}</td>
                  <td className="py-2 pr-4 text-ph-charcoal/70">{invitePeriodLabel(inv)}</td>
                  <td className="py-2 pr-4 text-ph-charcoal/70">{fmt(inv.sentAt)}</td>
                  <td className="py-2 pr-4 text-ph-charcoal/70">{inv.sendCount > 1 ? `×${inv.sendCount}` : '1'}</td>
                  <td className="py-2 pr-4 text-ph-charcoal/70">{fmt(inv.clickedAt)}</td>
                  <td className="py-2 pr-4 text-ph-charcoal/70">
                    {inv.viewedAt ? (
                      <span className="text-green-700">{fmt(inv.viewedAt)}</span>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </CardContent>
    </Card>
  );
}

function UserList({ users, clientSlug }: { users: ClientUser[]; clientSlug: string }) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: (userId: string) => removeClientUser(clientSlug, userId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['manage', 'clients', clientSlug, 'users'] }),
  });

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-ph-charcoal/10 text-xs uppercase tracking-wide text-ph-charcoal/60">
          <tr>
            <th className="py-2 pr-4 font-medium">Email</th>
            <th className="py-2 pr-4 font-medium">Name</th>
            <th className="py-2 pr-4 font-medium">Last login</th>
            <th className="py-2 text-right font-medium" />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-ph-charcoal/5 last:border-0">
              <td className="py-2 pr-4 font-medium text-ph-charcoal">{u.email}</td>
              <td className="py-2 pr-4 text-ph-charcoal/80">{u.name ?? '—'}</td>
              <td className="py-2 pr-4 text-ph-charcoal/60">
                {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('en-AU') : 'Never'}
              </td>
              <td className="py-2 text-right">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (confirm(`Revoke access for ${u.email}?`)) remove.mutate(u.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Revoke
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const addUserSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  name: z.string().optional(),
});
type AddUserValues = z.infer<typeof addUserSchema>;

function AddUserCard({ clientSlug }: { clientSlug: string }) {
  const queryClient = useQueryClient();
  const form = useForm<AddUserValues>({
    resolver: zodResolver(addUserSchema),
    defaultValues: { email: '', name: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: AddUserValues) =>
      addClientUser(clientSlug, {
        email: values.email,
        name: values.name?.trim() ? values.name.trim() : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manage', 'clients', clientSlug, 'users'] });
      queryClient.invalidateQueries({ queryKey: ['manage', 'clients'] });
      form.reset();
    },
  });

  const error = mutation.error instanceof ApiError ? mutation.error.message : null;

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="text-base font-semibold text-ph-charcoal">Grant access</h2>
        <p className="mt-1 text-sm text-ph-charcoal/60">
          Enter a client user&rsquo;s email. If they don&rsquo;t exist yet, we&rsquo;ll create
          the account so they can sign in via magic link.
        </p>
        <form
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]"
        >
          <div className="flex flex-col gap-1.5">
            <Input placeholder="client@company.com" {...form.register('email')} />
            {form.formState.errors.email && (
              <p className="text-xs text-red-600">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Input placeholder="Name (optional)" {...form.register('name')} />
          </div>
          <Button type="submit" size="sm" disabled={mutation.isPending}>
            {mutation.isPending ? 'Adding…' : 'Add user'}
          </Button>
          {error && <p className="col-span-full text-xs text-red-600">{error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
