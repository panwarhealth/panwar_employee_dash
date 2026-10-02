import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { listLinks } from '@/api/links';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CopyButton } from '@/components/links/CopyButton';
import { formatDay } from '@/lib/utm';

export const Route = createFileRoute('/app/links/register')({
  component: RegisterPage,
});

function RegisterPage() {
  const [query, setQuery] = useState('');
  const { data: links = [], isLoading } = useQuery({ queryKey: ['links'], queryFn: listLinks });

  const needle = query.trim().toLowerCase();
  const rows = links.filter(
    (l) =>
      !needle ||
      [l.campaignId, l.clientName ?? '', l.url, l.source, l.medium, l.content ?? '', l.createdByName]
        .join(' ')
        .toLowerCase()
        .includes(needle),
  );

  return (
    <div>
      <h2 className="text-2xl font-bold leading-tight text-ph-charcoal">Past links</h2>
      <p className="mb-6 mt-1.5 text-[15px] text-ph-charcoal/60">
        Everything the team has made. Search by campaign, client, page, source or who made it.
      </p>

      <Input
        className="mb-4 h-11 text-base"
        placeholder="Search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {isLoading && <p className="text-sm text-ph-charcoal/60">Loading...</p>}
      {!isLoading && rows.length === 0 && (
        <p className="text-sm text-ph-charcoal/60">
          {links.length === 0 ? 'No links yet.' : 'Nothing matches.'}
        </p>
      )}

      <div className="flex flex-col">
        {rows.map((l) => (
          <div
            key={l.id}
            className="flex flex-col gap-3 border-t border-ph-charcoal/10 py-4 first:border-t-0 sm:flex-row sm:items-center"
          >
            <div className="min-w-0 flex-1">
              <div className="font-bold text-ph-charcoal">
                {l.campaignId}
                <span className="ml-2 text-sm font-normal text-ph-charcoal/60">
                  {l.clientName ? `${l.clientName} · ` : ''}
                  {l.source} / {l.medium}
                  {l.content ? ` / ${l.content}` : ''} · {l.createdByName}, {formatDay(l.createdAt)}
                </span>
              </div>
              <div className="mt-1 break-all font-mono text-[13px] text-ph-charcoal/60">{l.url}</div>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <CopyButton text={l.url} label="Copy" variant="outline" size="sm" />
              <Button asChild variant="outline" size="sm">
                <Link to="/app/qr" search={{ url: l.url }}>
                  QR
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link
                  to="/app/links"
                  search={{ dest: l.destinationUrl, campaign: l.campaignId }}
                  title="Same page and campaign, new source"
                >
                  Duplicate
                </Link>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
