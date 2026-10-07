import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { createFileRoute, Link, Navigate, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Monitor, Smartphone } from 'lucide-react';
import {
  cancelCampaign,
  deleteCampaign,
  getAudience,
  getCampaign,
  listLists,
  listSenders,
  previewCampaign,
  sendCampaign,
  sendTest,
  updateCampaign,
  uploadContent,
  type EdmCampaign,
  type EdmCampaignPatch,
} from '@/api/edm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BackLink } from '@/components/edm/BackLink';
import { Notice } from '@/components/edm/Notice';
import { SummaryBox } from '@/components/edm/SummaryBox';
import {
  defaultSchedule,
  fmtDayTime,
  kb,
  labelClass,
  num,
  people,
  readableTags,
  selectClass,
  sydneyParts,
} from '@/lib/edm';
import { cn } from '@/lib/utils';

type Step = 1 | 2 | 3 | 4;

const STEP_NAMES: Record<Step, string> = { 1: 'List', 2: 'Content', 3: 'Preview', 4: 'Send' };

export const Route = createFileRoute('/app/edm/campaigns/$campaignId/')({
  // No step means "wherever this draft is up to".
  validateSearch: (search: Record<string, unknown>): { step?: Step } => {
    const step = Number(search.step);
    return step === 1 || step === 2 || step === 3 || step === 4 ? { step } : {};
  },
  component: WizardPage,
});

interface StepProps {
  campaign: EdmCampaign;
  go: (step: Step) => void;
}

function WizardPage() {
  const { campaignId } = Route.useParams();
  const { step } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: campaign, error } = useQuery({
    queryKey: ['edm-campaign', campaignId],
    queryFn: () => getCampaign(campaignId),
  });

  const unschedule = useMutation({
    mutationFn: () => cancelCampaign(campaignId),
    onSuccess: (c) => {
      queryClient.setQueryData(['edm-campaign', campaignId], c);
      queryClient.invalidateQueries({ queryKey: ['edm-campaigns'] });
    },
  });
  const remove = useMutation({
    mutationFn: () => deleteCampaign(campaignId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['edm-campaigns'] });
      navigate({ to: '/app/edm' });
    },
  });

  if (error) return <Notice tone="error">{error.message}</Notice>;
  if (!campaign) return <p className="text-sm text-ph-charcoal/60">Loading…</p>;
  if (campaign.status !== 'Draft' && campaign.status !== 'Scheduled')
    return <Navigate to="/app/edm/campaigns/$campaignId/report" params={{ campaignId }} replace />;

  const go = (next: Step) => navigate({ to: '.', search: { step: next } });
  // Later steps only open once what they depend on exists.
  const reachable: Record<Step, boolean> = {
    1: true,
    2: !!campaign.listId,
    3: !!campaign.listId && !!campaign.content && !!campaign.subject,
    4: !!campaign.listId && !!campaign.content && !!campaign.subject,
  };
  const furthest: Step = reachable[3] ? 3 : reachable[2] ? 2 : 1;
  const current = step && reachable[step] ? step : furthest;

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <BackLink to="/app/edm">Campaigns</BackLink>
        {campaign.status === 'Draft' && (
          <Button
            variant="link"
            size="sm"
            className="text-ph-charcoal/50 hover:text-red-700"
            disabled={remove.isPending}
            onClick={() => window.confirm('Delete this draft?') && remove.mutate()}
          >
            Delete draft
          </Button>
        )}
      </div>

      <ol className="mt-6 flex gap-2" aria-label="Steps">
        {([1, 2, 3, 4] as const).map((s) => (
          <li key={s}>
            <button
              type="button"
              aria-current={s === current ? 'step' : undefined}
              disabled={!reachable[s]}
              onClick={() => go(s)}
              className="group flex w-20 flex-col gap-1.5 text-left text-xs disabled:cursor-not-allowed"
            >
              <span
                className={cn(
                  'block h-1.5 rounded-full transition-colors',
                  s <= current ? 'bg-ph-purple' : 'bg-ph-charcoal/15',
                  reachable[s] && s !== current && 'group-hover:bg-ph-purple/60',
                )}
              />
              <span
                className={cn(
                  s === current
                    ? 'font-semibold text-ph-charcoal'
                    : reachable[s]
                      ? 'text-ph-charcoal/60 group-hover:text-ph-charcoal'
                      : 'text-ph-charcoal/30',
                )}
              >
                {STEP_NAMES[s]}
              </span>
            </button>
          </li>
        ))}
      </ol>

      {campaign.status === 'Scheduled' && campaign.scheduledFor && (
        <Notice className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              Scheduled for <strong>{fmtDayTime(campaign.scheduledFor)}</strong> Sydney time.
              Changes you make here go out with it.
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={unschedule.isPending}
              onClick={() => unschedule.mutate()}
            >
              Cancel schedule
            </Button>
          </div>
        </Notice>
      )}

      <div className="mt-8">
        {current === 1 && <ListStep campaign={campaign} go={go} />}
        {current === 2 && <ContentStep campaign={campaign} go={go} />}
        {current === 3 && <PreviewStep campaign={campaign} go={go} />}
        {current === 4 && <SendStep campaign={campaign} go={go} />}
      </div>
    </div>
  );
}

/** Saves a partial update and keeps the cached campaign in step. */
function usePatch(campaignId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: EdmCampaignPatch) => updateCampaign(campaignId, patch),
    onSuccess: (c) => {
      queryClient.setQueryData(['edm-campaign', campaignId], c);
      queryClient.invalidateQueries({ queryKey: ['edm-campaigns'] });
    },
  });
}

function StepHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <>
      <h2 className="text-3xl font-bold leading-tight text-ph-charcoal">{title}</h2>
      {children && <p className="mb-8 mt-2 text-[15px] text-ph-charcoal/60">{children}</p>}
    </>
  );
}

// ---- 1. list ----

function ListStep({ campaign, go }: StepProps) {
  const { data: lists = [], isLoading } = useQuery({
    queryKey: ['edm-lists'],
    queryFn: listLists,
  });
  const patch = usePatch(campaign.id);

  return (
    <div>
      <StepHeading title="Who is it going to?">
        Pick a list. The sender address comes with it.
      </StepHeading>
      {isLoading ? (
        <p className="text-sm text-ph-charcoal/60">Loading…</p>
      ) : lists.length === 0 ? (
        <Notice>
          There are no lists yet.{' '}
          <Link to="/app/edm/lists" className="underline">
            Make one first
          </Link>
          .
        </Notice>
      ) : (
        <div role="radiogroup" aria-label="List" className="flex flex-col gap-3">
          {lists.map((l) => {
            const selected = campaign.listId === l.id;
            return (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => !selected && patch.mutate({ listId: l.id })}
                className={cn(
                  'flex items-center justify-between gap-4 rounded-md border px-5 py-4 text-left transition-colors',
                  selected
                    ? 'border-ph-purple bg-ph-purple/5'
                    : 'border-ph-charcoal/15 hover:border-ph-purple/50',
                )}
              >
                <span className="min-w-0">
                  <span className="block font-semibold text-ph-charcoal">{l.name}</span>
                  <span className="block truncate text-sm text-ph-charcoal/60">
                    {l.sender.fromAddress}
                  </span>
                </span>
                <span className="font-mono text-ph-charcoal/60">{num(l.subscribed)}</span>
              </button>
            );
          })}
        </div>
      )}
      {patch.isError && (
        <Notice tone="error" className="mt-4">
          {patch.error.message}
        </Notice>
      )}
      <div className="mt-8">
        <Button size="lg" disabled={!campaign.listId || patch.isPending} onClick={() => go(2)}>
          Next
        </Button>
      </div>
    </div>
  );
}

// ---- 2. content ----

function ContentStep({ campaign, go }: StepProps) {
  const queryClient = useQueryClient();
  const { data: senders = [] } = useQuery({
    queryKey: ['edm-senders'],
    queryFn: listSenders,
  });
  const patch = usePatch(campaign.id);
  const [dragging, setDragging] = useState(false);
  const [fields, setFields] = useState(() => fieldsOf(campaign));

  const upload = useMutation({
    mutationFn: (file: File) => uploadContent(campaign.id, file),
    onSuccess: (r) => {
      queryClient.setQueryData(['edm-campaign', campaign.id], r.campaign);
      queryClient.invalidateQueries({ queryKey: ['edm-campaigns'] });
      // Pick up whatever the upload filled in, without losing anything typed meanwhile.
      setFields((f) => ({ ...fieldsOf(r.campaign), ...nonEmpty(f) }));
    },
  });

  const save = (key: keyof typeof fields) => {
    if (fields[key] !== (campaign[key] ?? '')) patch.mutate({ [key]: fields[key] });
  };

  const next = async () => {
    const changed = Object.fromEntries(
      Object.entries(fields).filter(([k, v]) => v !== (campaign[k as keyof typeof fields] ?? '')),
    );
    if (Object.keys(changed).length > 0) await patch.mutateAsync(changed);
    go(3);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) upload.mutate(file);
  };

  const content = campaign.content;

  return (
    <div>
      <StepHeading title="What are you sending?">
        Drop in the zip from the eDM build. Images are hosted for you, links are sent exactly as
        built, and the unsubscribe footer is added unless the eDM has its own{' '}
        <code className="text-xs">{'{{unsubscribe_url}}'}</code>.
      </StepHeading>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed px-6 py-10 text-center transition-colors',
          dragging
            ? 'border-ph-purple bg-ph-purple/5'
            : 'border-ph-charcoal/25 hover:border-ph-purple',
        )}
      >
        {upload.isPending ? (
          <span className="font-semibold text-ph-charcoal">Uploading and checking…</span>
        ) : content ? (
          <>
            <span className="font-semibold text-ph-charcoal">{campaign.sourceFileName}</span>
            <span className="text-sm text-ph-charcoal/60">
              {kb(content.htmlBytes)} · {content.linkCount} links found · {content.imageCount}{' '}
              images
              {content.hasTextVersion && ' · plain-text version included'}
            </span>
            <span className="mt-2 text-xs text-ph-charcoal/50">Drop a new file to replace it</span>
          </>
        ) : (
          <>
            <span className="font-semibold text-ph-charcoal">Drop the eDM zip here</span>
            <span className="text-sm text-ph-charcoal/60">
              or click to choose it (.zip with index.html and images, or a single .html)
            </span>
          </>
        )}
        <input
          type="file"
          accept=".zip,.html,.htm"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload.mutate(f);
            e.target.value = '';
          }}
        />
      </label>
      {upload.isError && (
        <Notice tone="error" className="mt-3">
          {upload.error.message}
        </Notice>
      )}
      {content && content.warnings.length > 0 && (
        <Notice tone="warning" className="mt-3">
          <ul className="flex list-disc flex-col gap-1 pl-4">
            {content.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          {content.linksMissingUtm.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer">Links without utm_campaign</summary>
              <ul className="mt-1 flex flex-col gap-0.5 break-all text-xs">
                {content.linksMissingUtm.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </details>
          )}
          {content.missingImages.length > 0 && (
            <p className="mt-2 break-all text-xs">Missing: {content.missingImages.join(', ')}</p>
          )}
        </Notice>
      )}

      <div className="mt-8 flex flex-col gap-6">
        <div>
          <label htmlFor="subject" className={labelClass}>
            Subject line
          </label>
          <Input
            id="subject"
            className="h-11 text-base"
            value={fields.subject}
            onChange={(e) => setFields({ ...fields, subject: e.target.value })}
            onBlur={() => save('subject')}
          />
          <p className="mt-1.5 flex justify-between text-xs text-ph-charcoal/50">
            <span>Personalise with {'{{first_name|there}}'}</span>
            <span className={cn(fields.subject.length > 60 && 'text-amber-700')}>
              {fields.subject.length} characters
              {fields.subject.length > 60 && ', may be cut off on phones'}
            </span>
          </p>
        </div>
        <div>
          <label htmlFor="preview" className={labelClass}>
            Preview text (shows under the subject in the inbox)
          </label>
          <Input
            id="preview"
            className="h-11 text-base"
            value={fields.previewText}
            onChange={(e) => setFields({ ...fields, previewText: e.target.value })}
            onBlur={() => save('previewText')}
          />
        </div>
        <div>
          <label htmlFor="sender" className={labelClass}>
            From
          </label>
          <select
            id="sender"
            className={cn(selectClass, 'h-11 text-base')}
            value={campaign.senderId ?? ''}
            onChange={(e) => patch.mutate({ senderId: e.target.value })}
          >
            {senders.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} &lt;{s.fromAddress}&gt;
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="name" className={labelClass}>
            Campaign name (just for us)
          </label>
          <Input
            id="name"
            value={fields.name}
            onChange={(e) => setFields({ ...fields, name: e.target.value })}
            onBlur={() => save('name')}
          />
        </div>
      </div>

      {patch.isError && (
        <Notice tone="error" className="mt-4">
          {patch.error.message}
        </Notice>
      )}
      <div className="mt-8 flex items-center gap-6">
        <Button
          size="lg"
          disabled={!content || !fields.subject.trim() || patch.isPending || upload.isPending}
          onClick={next}
        >
          Next
        </Button>
        <button
          type="button"
          className="text-sm text-ph-charcoal/60 underline underline-offset-4"
          onClick={() => go(1)}
        >
          Back
        </button>
      </div>
    </div>
  );
}

const fieldsOf = (c: EdmCampaign) => ({
  subject: c.subject ?? '',
  previewText: c.previewText ?? '',
  name: c.name,
});

const nonEmpty = <T extends Record<string, string>>(o: T): Partial<T> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v.trim() !== '')) as Partial<T>;

// ---- 3. preview ----

function PreviewStep({ campaign, go }: StepProps) {
  const [contactId, setContactId] = useState<string | null>(null);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [testTo, setTestTo] = useState('');
  const { data: preview, error } = useQuery({
    queryKey: ['edm-preview', campaign.id, campaign.updatedAt, contactId],
    queryFn: () => previewCampaign(campaign.id, contactId),
  });

  const test = useMutation({
    mutationFn: () =>
      sendTest(
        campaign.id,
        testTo
          .split(/[,;\s]+/)
          .map((e) => e.trim())
          .filter(Boolean),
      ),
  });

  const who = preview ? (preview.recipient.firstName ?? preview.recipient.email) : 'someone';

  return (
    <div>
      <StepHeading title="Does it look right?">
        This is what {who} would get. Send yourself a test before it goes out.
      </StepHeading>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <select
          aria-label="Preview as"
          className={cn(selectClass, 'w-auto max-w-full')}
          value={preview?.recipient.contactId ?? ''}
          onChange={(e) => setContactId(e.target.value || null)}
          disabled={!preview || preview.samples.length === 0}
        >
          {preview?.samples.length ? (
            preview.samples.map((s) => (
              <option key={s.contactId} value={s.contactId ?? ''}>
                Preview as {[s.firstName, s.lastName].filter(Boolean).join(' ') || s.email}
              </option>
            ))
          ) : (
            <option value="">Preview as a sample person</option>
          )}
        </select>
        <div
          className="flex rounded-md border border-ph-charcoal/15 p-0.5"
          role="group"
          aria-label="Screen size"
        >
          {(['desktop', 'mobile'] as const).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={device === d}
              onClick={() => setDevice(d)}
              className={cn(
                'flex items-center gap-1.5 rounded px-3 py-1.5 text-sm',
                device === d
                  ? 'bg-ph-purple text-white'
                  : 'text-ph-charcoal/70 hover:text-ph-charcoal',
              )}
            >
              {d === 'desktop' ? (
                <Monitor className="h-4 w-4" />
              ) : (
                <Smartphone className="h-4 w-4" />
              )}
              {d === 'desktop' ? 'Desktop' : 'Mobile'}
            </button>
          ))}
        </div>
      </div>

      {error && <Notice tone="error">{error.message}</Notice>}
      {preview && (
        <div className="overflow-hidden rounded-md border border-ph-charcoal/15">
          <div className="flex items-start justify-between gap-4 border-b border-ph-charcoal/10 bg-white px-5 py-3 text-sm">
            <div className="min-w-0">
              <p className="font-semibold text-ph-charcoal">{campaign.sender?.name}</p>
              <p className="truncate text-ph-charcoal">
                {preview.subject}
                {campaign.previewText && (
                  <span className="text-ph-charcoal/50"> — {campaign.previewText}</span>
                )}
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 text-ph-purple underline underline-offset-4"
              onClick={() => go(2)}
            >
              Edit
            </button>
          </div>
          <div className="flex justify-center bg-ph-purple/5 p-4 sm:p-6">
            <EmailFrame html={preview.html} width={device === 'mobile' ? 375 : 680} />
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-end gap-3 rounded-md bg-ph-charcoal/5 p-4">
        <div className="min-w-0 flex-1 basis-64">
          <label htmlFor="test-to" className={labelClass}>
            Send a test to
          </label>
          <Input
            id="test-to"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="You. Add up to 5 addresses, separated by commas"
          />
        </div>
        <Button variant="outline" disabled={test.isPending} onClick={() => test.mutate()}>
          {test.isPending ? 'Sending…' : testTo.trim() ? 'Send test' : 'Send me a test'}
        </Button>
      </div>
      {test.isSuccess && (
        <Notice tone="success" className="mt-3">
          Test sent to {test.data.sentTo.join(', ')}. The subject starts with [Test]. Give it a
          minute, and check junk if it's not there.
        </Notice>
      )}
      {test.isError && (
        <Notice tone="error" className="mt-3">
          {test.error.message}
        </Notice>
      )}

      <div className="mt-8 flex items-center gap-6">
        <Button size="lg" onClick={() => go(4)}>
          Looks good
        </Button>
        <button
          type="button"
          className="text-sm text-ph-charcoal/60 underline underline-offset-4"
          onClick={() => go(2)}
        >
          Back
        </button>
      </div>
    </div>
  );
}

/** Renders the email in a script-free sandbox and grows to its height so there's one scrollbar. */
function EmailFrame({ html, width }: { html: string; width: number }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(600);

  const fit = () => {
    const doc = ref.current?.contentDocument;
    if (doc?.documentElement) setHeight(doc.documentElement.scrollHeight);
  };

  useEffect(fit, [width]);

  return (
    <iframe
      ref={ref}
      title="Email preview"
      // Links open in a new tab; no scripts ever run.
      srcDoc={html.replace(/<head([^>]*)>/i, '<head$1><base target="_blank">')}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      onLoad={fit}
      style={{ width, height, maxWidth: '100%' }}
      className="block bg-white shadow-sm transition-[width] duration-200"
    />
  );
}

// ---- 4. send ----

function SendStep({ campaign }: StepProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const initial = campaign.scheduledFor
    ? sydneyParts(new Date(campaign.scheduledFor))
    : defaultSchedule();
  const [mode, setMode] = useState<'now' | 'schedule'>(
    campaign.status === 'Scheduled' ? 'schedule' : 'now',
  );
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [confirm, setConfirm] = useState('');
  const { data: audience } = useQuery({
    queryKey: ['edm-audience', campaign.id],
    queryFn: () => getAudience(campaign.id),
  });

  const send = useMutation({
    mutationFn: () =>
      sendCampaign(
        campaign.id,
        audience!.sendable,
        mode === 'schedule' ? `${date}T${time}` : undefined,
      ),
    onSuccess: (c) => {
      queryClient.setQueryData(['edm-campaign', c.id], c);
      queryClient.invalidateQueries({ queryKey: ['edm-campaigns'] });
      if (c.status === 'Scheduled') navigate({ to: '/app/edm' });
      else
        navigate({
          to: '/app/edm/campaigns/$campaignId/report',
          params: { campaignId: c.id },
        });
    },
    onError: () =>
      queryClient.invalidateQueries({
        queryKey: ['edm-audience', campaign.id],
      }),
  });

  if (!audience) return <p className="text-sm text-ph-charcoal/60">Counting who it'll go to…</p>;

  const count = audience.sendable;
  const confirmed = confirm.replace(/[,\s]/g, '') === String(count);
  const ready = count > 0 && confirmed && (mode === 'now' || (!!date && !!time));

  return (
    <div>
      <StepHeading title={`Ready to send to ${people(count)}`}>
        Goes out over a few minutes. Delivery and opens show on the report as they come in.
      </StepHeading>

      <SummaryBox
        items={[
          { label: 'List', value: audience.listName },
          {
            label: 'From',
            value: campaign.sender
              ? `${campaign.sender.name} <${campaign.sender.fromAddress}>`
              : '—',
          },
          { label: 'Subject', value: readableTags(campaign.subject ?? '') },
          {
            label: 'Skipped',
            value: `${num(audience.skipped)} unsubscribed or bounced`,
          },
        ]}
      />

      <div role="radiogroup" aria-label="When" className="mt-8 flex flex-col gap-3">
        <RadioCard checked={mode === 'now'} onSelect={() => setMode('now')} title="Send now" />
        <RadioCard
          checked={mode === 'schedule'}
          onSelect={() => setMode('schedule')}
          title="Schedule"
          description="Pick a day and time. You can cancel any time before it goes."
        />
      </div>
      {mode === 'schedule' && (
        <div className="mt-3 flex flex-wrap items-center gap-3 sm:pl-12">
          <Input
            type="date"
            aria-label="Date"
            className="h-11 w-auto"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Input
            type="time"
            aria-label="Time"
            className="h-11 w-auto"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
          <span className="text-sm text-ph-charcoal/60">Sydney time</span>
        </div>
      )}

      <div className="mt-8 max-w-sm">
        <label htmlFor="confirm" className={labelClass}>
          Type <strong className="text-ph-charcoal">{num(count)}</strong> to confirm the number of
          people
        </label>
        <Input
          id="confirm"
          inputMode="numeric"
          className="h-11 text-base"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>

      {send.isError && (
        <Notice tone="error" className="mt-4">
          {send.error.message}
        </Notice>
      )}
      <div className="mt-8 flex items-center gap-6">
        <Button size="lg" disabled={!ready || send.isPending} onClick={() => send.mutate()}>
          {send.isPending
            ? 'Working…'
            : mode === 'now'
              ? `Send to ${people(count)}`
              : 'Schedule it'}
        </Button>
        <Link
          to="."
          search={{ step: 3 }}
          className="text-sm text-ph-charcoal/60 underline underline-offset-4"
        >
          Back
        </Link>
      </div>
    </div>
  );
}

function RadioCard({
  checked,
  onSelect,
  title,
  description,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={cn(
        'flex items-start gap-4 rounded-md border px-5 py-4 text-left transition-colors',
        checked
          ? 'border-ph-purple bg-ph-purple/5'
          : 'border-ph-charcoal/15 hover:border-ph-purple/50',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
          checked ? 'border-ph-purple' : 'border-ph-charcoal/40',
        )}
      >
        {checked && <span className="h-2.5 w-2.5 rounded-full bg-ph-purple" />}
      </span>
      <span>
        <span className="block font-semibold text-ph-charcoal">{title}</span>
        {description && (
          <span className="mt-0.5 block text-sm text-ph-charcoal/60">{description}</span>
        )}
      </span>
    </button>
  );
}
