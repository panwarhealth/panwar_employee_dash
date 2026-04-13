import { useState } from 'react';
import { Link, useMatchRoute } from '@tanstack/react-router';
import {
  Building2,
  ChevronDown,
  FileSpreadsheet,
  LayoutDashboard,
  Settings,
  Shield,
  Tag,
  Upload,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHasRole } from '@/hooks/useAuth';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}

interface NavGroup {
  title: string;
  prefix: string;
  items: NavItem[];
}

const ADMIN_MODULE: NavGroup = {
  title: 'Admin',
  prefix: '/app/admin',
  items: [
    { to: '/app/admin', label: 'Users & Roles', icon: Shield, exact: true },
  ],
};

const DASHBOARD_MODULE: NavGroup = {
  title: 'Client Dashboards',
  prefix: '/app/clients',
  items: [
    { to: '/app/clients', label: 'Clients', icon: Users },
    { to: '/app/brands', label: 'Brands', icon: Tag },
    { to: '/app/publishers', label: 'Publishers', icon: Building2 },
    { to: '/app/placements', label: 'Placements', icon: FileSpreadsheet },
    { to: '/app/baselines', label: 'Baselines', icon: Settings },
    { to: '/app/import', label: 'Bulk import', icon: Upload },
  ],
};

export function Sidebar() {
  const isAdmin = useHasRole('panwar-admin');

  return (
    <nav className="flex h-full w-56 shrink-0 flex-col gap-1 border-r border-ph-charcoal/10 bg-white p-3">
      <div className="mb-3 px-3 py-2">
        <div className="text-base font-semibold text-ph-purple">Panwar Health</div>
      </div>

      <NavLink
        item={{ to: '/app', label: 'Overview', icon: LayoutDashboard, exact: true }}
      />

      {isAdmin && <CollapsibleGroup group={ADMIN_MODULE} />}
      <CollapsibleGroup group={DASHBOARD_MODULE} />
    </nav>
  );
}

function CollapsibleGroup({ group }: { group: NavGroup }) {
  const matchRoute = useMatchRoute();
  const hasActiveChild = group.items.some((item) =>
    matchRoute({ to: item.to, fuzzy: !item.exact }),
  );
  const [open, setOpen] = useState(hasActiveChild);

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-semibold transition-colors',
          hasActiveChild
            ? 'text-ph-purple'
            : 'text-ph-charcoal/70 hover:bg-ph-charcoal/5 hover:text-ph-charcoal',
        )}
      >
        {group.title}
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && (
        <div className="mt-0.5 flex flex-col gap-0.5">
          {group.items.map((item) => (
            <NavLink key={item.to} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function NavLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      activeOptions={{ exact: item.exact ?? false }}
      className={cn(
        'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-ph-charcoal/80 transition-colors',
        'hover:bg-ph-charcoal/5 hover:text-ph-charcoal',
      )}
      activeProps={{
        className:
          'bg-ph-purple/10 text-ph-purple hover:bg-ph-purple/15 hover:text-ph-purple',
      }}
    >
      <Icon className="h-4 w-4" />
      {item.label}
    </Link>
  );
}
