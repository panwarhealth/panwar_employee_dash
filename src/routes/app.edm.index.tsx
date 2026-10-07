import { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createCampaign, listCampaigns, type EdmCampaignSummary } from '@/api/edm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/edm/Notice';
import { StatusBadge } from '@/components/edm/StatusBadge';
import { fmtAgo, fmtDate, fmtDayTime, fmtTime, num, pct, people } from '@/lib/edm';

export const Route = createFileRoute('/app/edm/')({
  component: CampaignsPage,
});

function CampaignsPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['edm-campaigns'],
    queryFn: listCampaigns,
    // Keep live counts moving while anything is going out.
    refetchInterval: (q) => (q.state.data?.some((c) => c.status === 'Sending') ? 10_000 : false),
  });

  const create = useMutation({
    mutationFn: () => createCampaign(),
    onSuccess: (c) =>
      navigate({
        to: '/app/edm/campaigns/$campaignId',
        params: { campaignId: c.id },
      }),
  });

  const needle = query.trim().toLowerCase();
  const rows = campaigns.filter(
    (c) =>
      !needle ||
      [c.name, c.listName ?? '', c.status, c.createdByName]
        .join(' ')
        .toLowerCase()
        .includes(needle),
  );

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold leading-tight text-ph-charcoal">Campaigns</h2>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Button size="lg" onClick={() => create.mutate()} disabled={create.isPending}>
          {create.isPending ? 'Creating…' : 'New campaign'}
        </Button>
        <Link
          to="/app/edm/lists"
          className="text-sm text-ph-charcoal/60 underline underline-offset-4 hover:text-ph-purple"
        >
          Lists
        </Link>
      </div>
      {create.isError && (
        <Notice tone="error" className="mb-4">
          {create.error.message}
        </Notice>
      )}

      <Input
        className="mb-2 h-11 text-base"
        placeholder="Search campaigns"
        aria-label="Search campaigns"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {isLoading ? (
        <p className="py-8 text-sm text-ph-charcoal/60">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-sm text-ph-charcoal/60">
          {campaigns.length === 0
            ? 'No campaigns yet. Start one with New campaign.'
            : 'Nothing matches that search.'}
        </p>
      ) : (
        <ul className="divide-y divide-ph-charcoal/10">
          {rows.map((c) => (
            <CampaignRow key={c.id} campaign={c} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CampaignRow({ campaign: c }: { campaign: EdmCampaignSummary }) {
  const editable = c.status === 'Draft' || c.status === 'Scheduled';
  return (
    <li className="flex items-center gap-4 py-5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <StatusBadge status={c.status} />
          <span className="font-semibold text-ph-charcoal">{c.name}</span>
        </div>
        <p className="mt-1 text-sm text-ph-charcoal/60">{meta(c).join(' · ')}</p>
      </div>
      {editable ? (
        <Button variant="outline" asChild>
          <Link to="/app/edm/campaigns/$campaignId" params={{ campaignId: c.id }}>
            Edit
          </Link>
        </Button>
      ) : (
        <Button variant="outline" asChild>
          <Link to="/app/edm/campaigns/$campaignId/report" params={{ campaignId: c.id }}>
            Report
          </Link>
        </Button>
      )}
    </li>
  );
}

function meta(c: EdmCampaignSummary): string[] {
  const list = c.listName ?? 'No list picked';
  const s = c.stats;
  switch (c.status) {
    case 'Sending':
      return [
        `Started ${c.startedAt ? fmtTime(c.startedAt) : ''}`,
        list,
        `${num(s.sent)} of ${num(s.total)} sent`,
      ];
    case 'Scheduled':
      return [
        c.scheduledFor ? fmtDayTime(c.scheduledFor) : 'Scheduled',
        list,
        people(c.listSize ?? 0),
      ];
    case 'Draft':
      return [`Last edited ${fmtAgo(c.updatedAt)}`, list];
    case 'Cancelled':
      return [
        `Stopped ${c.completedAt ? fmtDate(c.completedAt) : ''}`,
        list,
        `${num(s.sent)} sent`,
      ];
    case 'Sent':
      return [
        c.completedAt ? fmtDate(c.completedAt) : '',
        list,
        `${num(s.sent)} sent`,
        `${num(s.delivered)} delivered`,
        `${pct(s.opened, s.delivered)} opened (est.)`,
      ];
  }
}
