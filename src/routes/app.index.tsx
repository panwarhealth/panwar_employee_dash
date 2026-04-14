import { createFileRoute, Link } from '@tanstack/react-router';
import { Building2, Users } from 'lucide-react';

export const Route = createFileRoute('/app/')({
  component: OverviewPage,
});

const SHORTCUTS = [
  {
    to: '/app/clients',
    title: 'Clients',
    description: 'Pick a client to manage its brands, placements, baselines, and access.',
    icon: Users,
  },
  {
    to: '/app/publishers',
    title: 'Publishers',
    description: 'The shared publisher registry and their metric templates.',
    icon: Building2,
  },
] as const;

function OverviewPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ph-charcoal">Overview</h1>
        <p className="mt-1 text-sm text-ph-charcoal/70">
          Pick a section to get started.
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
    </div>
  );
}
