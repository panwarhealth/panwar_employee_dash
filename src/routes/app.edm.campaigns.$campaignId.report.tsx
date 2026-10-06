import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelCampaign,
  downloadReportCsv,
  duplicateCampaign,
  getReport,
  type EdmCampaign,
  type EdmReportRow,
} from '@/api/edm';
import { Button } from '@/components/ui/button';
import { BackLink } from '@/components/edm/BackLink';
import { Notice } from '@/components/edm/Notice';
import { StatusBadge } from '@/components/edm/StatusBadge';
import { SummaryBox } from '@/components/edm/SummaryBox';
import { fmtDate, fmtLong, fmtTime, num, pct, readableTags } from '@/lib/edm';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/app/edm/campaigns/$campaignId/report')({
  component: ReportPage,
});

function ReportPage() {
  const { campaignId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: report, error } = useQuery({
    queryKey: ['edm-report', campaignId],
    queryFn: () => getReport(campaignId),
    refetchInterval: (q) => (q.state.data?.campaign.status === 'Sending' ? 10_000 : false),
  });

  const stop = useMutation({
    mutationFn: () => cancelCampaign(campaignId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['edm-report', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['edm-campaigns'] });
    },
  });
  const duplicate = useMutation({
    mutationFn: () => duplicateCampaign(campaignId),
    onSuccess: (c) => {
      queryClient.invalidateQueries({ queryKey: ['edm-campaigns'] });
      navigate({
        to: '/app/edm/campaigns/$campaignId',
        params: { campaignId: c.id },
        search: { step: 1 },
      });
    },
  });
  const csv = useMutation({
    mutationFn: (c: EdmCampaign) => downloadReportCsv(c.id, c.campaignCode ?? c.name),
  });

  if (error) return <Notice tone="error">{error.message}</Notice>;
  if (!report) return <p className="text-sm text-ph-charcoal/60">Loading…</p>;

  const c = report.campaign;
  const s = c.stats;

  return (
    <div>
      <BackLink to="/app/edm">Campaigns</BackLink>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <StatusBadge status={c.status} />
        <h2 className="text-3xl font-bold leading-tight text-ph-charcoal">
          {c.subject ? readableTags(c.subject) : c.name}
        </h2>
      </div>
      <p className="mt-2 text-[15px] text-ph-charcoal/60">{whenLine(c)}</p>

      {c.status === 'Sending' && (
        <div className="mt-6">
          <div className="h-2 overflow-hidden rounded-full bg-ph-charcoal/10">
            <div
              className="h-full bg-ph-coral transition-[width]"
              style={{ width: pct(s.sent, s.total) }}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-sm text-ph-charcoal/70">
            <span>
              {num(s.sent)} of {num(s.total)} sent. This page updates on its own.
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={stop.isPending}
              onClick={() =>
                window.confirm(
                  `Stop sending? The ${num(s.pending)} people not reached yet won't get it.`,
                ) && stop.mutate()
              }
            >
              Stop sending
            </Button>
          </div>
        </div>
      )}

      <div className="mt-8">
        <SummaryBox
          items={[
            { label: 'List', value: c.listName ?? '—' },
            {
              label: 'From',
              value: c.sender ? `${c.sender.name} <${c.sender.fromAddress}>` : '—',
            },
            { label: 'Sent by', value: c.sentByName ?? c.createdByName },
            { label: 'Campaign id', value: c.campaignCode ?? '—' },
          ]}
        />
      </div>

      <dl className="mt-8 divide-y divide-ph-charcoal/10">
        <FunnelRow label="Sent" value={s.sent} of={s.total} />
        <FunnelRow
          label="Delivered"
          value={s.delivered}
          of={s.sent}
          note={pct(s.delivered, s.sent)}
        />
        <FunnelRow
          label="Opened"
          hint="est."
          value={s.opened}
          of={s.sent}
          note={pct(s.opened, s.delivered)}
        />
        <FunnelRow label="Bounced" value={s.bounced} of={s.sent} note="removed" bad />
        <FunnelRow label="Unsubscribed" value={s.unsubscribed} of={s.sent} bad />
        {s.failed > 0 && <FunnelRow label="Failed" value={s.failed} of={s.sent} bad />}
      </dl>

      <Notice className="mt-8">
        Opens are estimated. Apple Mail and Gmail load the tracking image whether the email is read
        or not.
        {c.campaignCode ? (
          <>
            {' '}
            Clicks are in Google Analytics under campaign <strong>{c.campaignCode}</strong>.
          </>
        ) : (
          ' Clicks are in Google Analytics under the utm_campaign in the eDM links.'
        )}
      </Notice>

      <div className="mt-8 flex flex-wrap items-center gap-6">
        <Button variant="outline" size="lg" disabled={csv.isPending} onClick={() => csv.mutate(c)}>
          Download report (CSV)
        </Button>
        <button
          type="button"
          className="text-sm text-ph-charcoal/60 underline underline-offset-4 hover:text-ph-purple disabled:opacity-50"
          disabled={duplicate.isPending}
          onClick={() => duplicate.mutate()}
        >
          Duplicate this campaign
        </button>
      </div>
      {(csv.isError || duplicate.isError || stop.isError) && (
        <Notice tone="error" className="mt-4">
          {(csv.error ?? duplicate.error ?? stop.error)?.message}
        </Notice>
      )}

      <div className="mt-10 flex flex-col gap-3">
        <PeopleTable title="Bounced" rows={report.bounces} />
        <PeopleTable title="Unsubscribed" rows={report.unsubscribes} />
        <PeopleTable title="Failed to send" rows={report.failures} />
      </div>
    </div>
  );
}

function whenLine(c: EdmCampaign): string {
  if (c.status === 'Sending' && c.startedAt) return `Sending since ${fmtTime(c.startedAt)}`;
  if (c.status === 'Cancelled' && c.cancelledAt) return `Stopped ${fmtLong(c.cancelledAt)}`;
  if (c.startedAt) return `Sent ${fmtLong(c.startedAt)}`;
  return '';
}

function FunnelRow({
  label,
  hint,
  value,
  of,
  note,
  bad,
}: {
  label: string;
  hint?: string;
  value: number;
  of: number;
  note?: string;
  bad?: boolean;
}) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-4 py-4 sm:grid-cols-[10rem_1fr_9rem]">
      <dt className="text-ph-charcoal/70">
        {label}
        {hint && <span className="ml-2 text-xs text-ph-charcoal/50">{hint}</span>}
      </dt>
      <dd className="h-4">
        <div
          className={cn('h-full rounded-sm', bad ? 'bg-red-700' : 'bg-ph-purple')}
          style={{ width: of === 0 ? 0 : `max(3px, ${(value / of) * 100}%)` }}
        />
      </dd>
      <dd className="text-right sm:text-left">
        <span className="text-xl font-semibold text-ph-charcoal">{num(value)}</span>
        {note && <span className="ml-2 text-sm text-ph-charcoal/50">{note}</span>}
      </dd>
    </div>
  );
}

function PeopleTable({ title, rows }: { title: string; rows: EdmReportRow[] }) {
  if (rows.length === 0) return null;
  return (
    <details className="rounded-md border border-ph-charcoal/10">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-ph-charcoal">
        {title} ({num(rows.length)})
      </summary>
      <div className="overflow-x-auto border-t border-ph-charcoal/10">
        <table className="w-full text-left text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r.email} className="border-b border-ph-charcoal/5 last:border-0">
                <td className="px-4 py-2 text-ph-charcoal">{r.email}</td>
                <td className="px-4 py-2 text-ph-charcoal/70">
                  {[r.firstName, r.lastName].filter(Boolean).join(' ')}
                </td>
                <td className="px-4 py-2 text-ph-charcoal/50">{r.at ? fmtDate(r.at) : ''}</td>
                <td className="px-4 py-2 text-ph-charcoal/50">{r.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
