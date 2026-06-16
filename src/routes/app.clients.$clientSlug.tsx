import { createFileRoute, Link, Outlet, useMatchRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { listClients } from '@/api/clients';
import { YearPicker } from '@/components/YearPicker';
import { WorkspaceYearProvider, useWorkspaceYear } from '@/lib/workspaceYear';

/**
 * Client workspace layout. Everything under /app/clients/{slug}/... renders
 * inside this shell: breadcrumb + title + horizontal tab nav. Tabs share the
 * reporting year via WorkspaceYearProvider.
 */
export const Route = createFileRoute('/app/clients/$clientSlug')({
  component: ClientWorkspaceLayout,
});

// hasYear marks tabs whose content is scoped to the workspace reporting year;
// the shared YearPicker in the tab bar only shows on those.
const TABS = [
  { to: '/app/clients/$clientSlug/details', label: 'Details', hasYear: false },
  { to: '/app/clients/$clientSlug/brands', label: 'Brands', hasYear: false },
  { to: '/app/clients/$clientSlug/audiences', label: 'Audiences', hasYear: false },
  { to: '/app/clients/$clientSlug/placements', label: 'Placements', hasYear: true },
  { to: '/app/clients/$clientSlug/cpd-investments', label: 'CPD Investments', hasYear: true },
  { to: '/app/clients/$clientSlug/education', label: 'Education Engagement', hasYear: true },
  { to: '/app/clients/$clientSlug/baselines', label: 'KPI Targets', hasYear: true },
  { to: '/app/clients/$clientSlug/summary', label: 'Summary', hasYear: true },
  { to: '/app/clients/$clientSlug/import', label: 'Import', hasYear: false },
] as const;

function ClientWorkspaceLayout() {
  const { clientSlug } = Route.useParams();
  const matchRoute = useMatchRoute();
  const onYearTab = TABS.some((t) => t.hasYear && matchRoute({ to: t.to }));
  const { data: clients = [] } = useQuery({
    queryKey: ['manage', 'clients'],
    queryFn: listClients,
  });
  const client = clients.find((c) => c.slug === clientSlug);

  return (
    <WorkspaceYearProvider>
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

      <div className="flex flex-col-reverse gap-2 min-[1450px]:flex-row min-[1450px]:items-end min-[1450px]:gap-0">
        <nav className="flex flex-wrap items-center gap-1 border-b border-ph-charcoal/10 min-[1450px]:flex-1">
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
        {onYearTab && (
          <div className="flex justify-end pb-1.5 min-[1450px]:pl-4">
            <WorkspaceYearControl />
          </div>
        )}
      </div>

      <Outlet />
      </div>
    </WorkspaceYearProvider>
  );
}

/** The one shared YearPicker for the client workspace. */
function WorkspaceYearControl() {
  const { year, setYear } = useWorkspaceYear();
  return <YearPicker year={year} onChange={setYear} />;
}
