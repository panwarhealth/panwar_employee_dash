import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

export const Route = createFileRoute('/app/edm')({
  component: EdmLayout,
});

const TABS = [
  { to: '/app/edm', label: 'Campaigns', exact: true },
  { to: '/app/edm/lists', label: 'Lists', exact: false },
  { to: '/app/edm/senders', label: 'Senders', exact: false },
] as const;

function EdmLayout() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ph-charcoal">eDM Mailer</h1>
        <p className="mt-1 text-sm text-ph-charcoal/70">
          Send eDMs to our platform users and client lists, and see how they did.
        </p>
      </div>

      <nav className="flex flex-wrap items-center gap-1 border-b border-ph-charcoal/10">
        {TABS.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            activeOptions={{ exact: t.exact, includeSearch: false }}
            className={cn(
              '-mb-px border-b-2 border-transparent px-4 py-2 text-sm font-medium text-ph-charcoal/70 transition-colors',
              'hover:text-ph-charcoal',
            )}
            activeProps={{ className: 'border-ph-purple text-ph-purple' }}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <Card className="p-6 sm:p-10">
        <Outlet />
      </Card>
    </div>
  );
}
