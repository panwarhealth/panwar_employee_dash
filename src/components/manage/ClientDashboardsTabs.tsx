import { Link } from '@tanstack/react-router';

const TABS = [
  { to: '/app/clients', label: 'Clients' },
  { to: '/app/publishers', label: 'Publishers' },
] as const;

export function ClientDashboardsTabs() {
  return (
    <nav className="flex items-center gap-1 border-b border-ph-charcoal/10">
      {TABS.map((t) => (
        <Link
          key={t.to}
          to={t.to}
          activeOptions={{ exact: true }}
          className="-mb-px border-b-2 border-transparent px-4 py-2 text-sm font-medium text-ph-charcoal/70 transition-colors hover:text-ph-charcoal"
          activeProps={{ className: 'border-ph-purple text-ph-purple' }}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
