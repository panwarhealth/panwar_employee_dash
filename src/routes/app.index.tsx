import { createFileRoute, Link } from '@tanstack/react-router';
import { useAuth } from '@/hooks/useAuth';
import { appsForRoles } from '@/components/AppIcons';

export const Route = createFileRoute('/app/')({
  component: HomePage,
});

function HomePage() {
  const { user } = useAuth();
  const apps = appsForRoles(user?.roles ?? []).sort((a, b) => a.name.localeCompare(b.name));
  const groups = [...new Set(apps.map((a) => a.group))].sort();

  return (
    <div className="flex flex-col gap-7">
      {groups.map((group) => (
        <section key={group}>
          <h2 className="mb-2 border-b border-ph-charcoal/10 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ph-charcoal/50">
            {group}
          </h2>
          <div className="flex flex-wrap gap-2">
            {apps
              .filter((a) => a.group === group)
              .map((app) => (
                <Link
                  key={app.to}
                  to={app.to}
                  style={{ backgroundColor: app.colour }}
                  className="flex h-28 w-28 flex-col justify-between rounded p-3 text-white transition-[filter] hover:brightness-110 [&>svg]:h-8 [&>svg]:w-8"
                >
                  {app.glyph}
                  <span className="text-[13px] font-bold leading-tight">{app.name}</span>
                </Link>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
