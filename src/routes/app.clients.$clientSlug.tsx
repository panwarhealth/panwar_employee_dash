import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { listClients } from '@/api/clients';

/**
 * Client workspace layout. Everything under /app/clients/{slug}/... renders
 * inside this shell: breadcrumb + title + horizontal tab nav.
 */
export const Route = createFileRoute('/app/clients/$clientSlug')({
  component: ClientWorkspaceLayout,
});

const TABS = [
  { to: '/app/clients/$clientSlug/details', label: 'Details' },
  { to: '/app/clients/$clientSlug/brands', label: 'Brands' },
  { to: '/app/clients/$clientSlug/audiences', label: 'Audiences' },
  { to: '/app/clients/$clientSlug/placements', label: 'Placements' },
  { to: '/app/clients/$clientSlug/baselines', label: 'Baselines' },
  { to: '/app/clients/$clientSlug/import', label: 'Import' },
] as const;

function ClientWorkspaceLayout() {
  const { clientSlug } = Route.useParams();
  const { data: clients = [] } = useQuery({
    queryKey: ['manage', 'clients'],
    queryFn: listClients,
  });
  const client = clients.find((c) => c.slug === clientSlug);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          to="/app/clients"
          className="text-xs uppercase tracking-wide text-ph-charcoal/60 hover:text-ph-purple"
        >
          ← All clients
        </Link>
        <div className="mt-2 flex items-center gap-3">
          {client?.logoUrl ? (
            <img src={client.logoUrl} alt={client.name} className="h-10 w-10 rounded object-contain" />
          ) : client ? (
            <div
              className="flex h-10 w-10 items-center justify-center rounded text-lg font-semibold text-white"
              style={{ backgroundColor: client.primaryColor ?? '#702f8f' }}
            >
              {client.name.charAt(0)}
            </div>
          ) : null}
          <h1 className="text-2xl font-semibold text-ph-charcoal">{client?.name ?? clientSlug}</h1>
        </div>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-ph-charcoal/10">
        {TABS.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            params={{ clientSlug }}
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

      <Outlet />
    </div>
  );
}
