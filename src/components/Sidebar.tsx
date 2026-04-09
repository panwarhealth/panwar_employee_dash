import { Link } from '@tanstack/react-router';
import {
  Building2,
  FileSpreadsheet,
  Inbox,
  LayoutDashboard,
  Settings,
  Tag,
  Upload,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Persistent left navigation. The brief calls for a "module registry" pattern
 * where the sidebar lists every module the user has access to and routes to
 * the active module's pages — but the Dashboard Updater is the only module so
 * far, so KISS: hardcoded list of its pages here. When a second module lands
 * (Reports, Settings, etc.) we'll extract a registry then.
 *
 * Role gating is also deferred — `useHasRole` exists but until the Entra ID
 * app registration is wired and groups are mapped server-side, every signed-in
 * employee sees every nav item.
 */

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}

const NAV: NavItem[] = [
  { to: '/app', label: 'Overview', icon: LayoutDashboard, exact: true },
  { to: '/app/inbox', label: 'Inbox', icon: Inbox },
  { to: '/app/placements', label: 'Placements', icon: FileSpreadsheet },
  { to: '/app/import', label: 'Bulk import', icon: Upload },
  { to: '/app/clients', label: 'Clients', icon: Users },
  { to: '/app/brands', label: 'Brands', icon: Tag },
  { to: '/app/publishers', label: 'Publishers', icon: Building2 },
  { to: '/app/baselines', label: 'Baselines', icon: Settings },
];

export function Sidebar() {
  return (
    <nav className="flex h-full w-56 shrink-0 flex-col gap-1 border-r border-ph-charcoal/10 bg-white p-3">
      <div className="mb-3 px-3 py-2">
        <div className="text-base font-semibold text-ph-purple">Panwar Health</div>
        <div className="text-[10px] uppercase tracking-wide text-ph-charcoal/60">
          Employee Portal
        </div>
      </div>
      {NAV.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.exact ?? false }}
            className={cn(
              'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-ph-charcoal/80 transition-colors',
              'hover:bg-ph-charcoal/5 hover:text-ph-charcoal',
            )}
            activeProps={{
              className: 'bg-ph-purple/10 text-ph-purple hover:bg-ph-purple/15 hover:text-ph-purple',
            }}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
