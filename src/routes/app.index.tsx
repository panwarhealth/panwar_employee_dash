import { createFileRoute, Link } from '@tanstack/react-router';
import {
  Building2,
  FileSpreadsheet,
  Inbox,
  Tag,
  Upload,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Employee portal landing page. Currently a static "module overview" — once
 * the inbox endpoint exists this becomes a real dashboard with unread
 * comments, draft month snapshots awaiting review, and recent activity.
 */
export const Route = createFileRoute('/app/')({
  component: OverviewPage,
});

const SHORTCUTS = [
  {
    to: '/app/inbox',
    title: 'Inbox',
    description: 'Unread client comments and unapproved months across all clients.',
    icon: Inbox,
  },
  {
    to: '/app/placements',
    title: 'Placements',
    description: 'Manage placements and their monthly actuals.',
    icon: FileSpreadsheet,
  },
  {
    to: '/app/import',
    title: 'Bulk import',
    description: 'Upload publisher monthly templates and confirm the diff.',
    icon: Upload,
  },
  {
    to: '/app/clients',
    title: 'Clients',
    description: 'Onboard clients and configure per-client branding.',
    icon: Users,
  },
  {
    to: '/app/brands',
    title: 'Brands',
    description: 'Brands and audiences attached to each client.',
    icon: Tag,
  },
  {
    to: '/app/publishers',
    title: 'Publishers',
    description: 'Publishers and the templates they use for monthly data.',
    icon: Building2,
  },
] as const;

function OverviewPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ph-charcoal">Dashboard Updater</h1>
        <p className="mt-1 text-sm text-ph-charcoal/70">
          The first module — feeds the client dashboard portal. Pick a section to get started.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SHORTCUTS.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.to}
              to={s.to}
              className="group block rounded-lg border border-ph-charcoal/10 bg-white p-5 shadow-sm transition-colors hover:border-ph-purple"
            >
              <Icon className="h-6 w-6 text-ph-purple" />
              <div className="mt-3 text-base font-semibold text-ph-charcoal group-hover:text-ph-purple">
                {s.title}
              </div>
              <p className="mt-1 text-sm text-ph-charcoal/70">{s.description}</p>
            </Link>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What's next</CardTitle>
          <CardDescription>
            This page becomes a real overview once the API exposes inbox + month-snapshot
            endpoints. For now it's just a navigation index.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
