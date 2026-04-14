import { Link } from '@tanstack/react-router';
import {
  Building2,
  LayoutDashboard,
  Shield,
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

export function Sidebar() {
  const isAdmin = useHasRole('panwar-admin');
  const canEdit = useHasRole('panwar-admin', 'dashboard-editor', 'medical-writer');

  return (
    <nav className="flex h-full w-56 shrink-0 flex-col gap-1 border-r border-ph-charcoal/10 bg-white p-3">
      <div className="mb-3 px-3 py-2">
        <div className="text-base font-semibold text-ph-purple">Panwar Health</div>
      </div>

      <NavLink item={{ to: '/app', label: 'Overview', icon: LayoutDashboard, exact: true }} />

      {isAdmin && (
        <>
          <GroupHeading title="Admin" />
          <NavLink item={{ to: '/app/admin', label: 'Users & Roles', icon: Shield }} />
        </>
      )}

      {canEdit && (
        <>
          <GroupHeading title="Client Dashboards" />
          <NavLink item={{ to: '/app/clients', label: 'Clients', icon: Users }} />
          <NavLink item={{ to: '/app/publishers', label: 'Publishers', icon: Building2 }} />
        </>
      )}
    </nav>
  );
}

function GroupHeading({ title }: { title: string }) {
  return (
    <div className="mt-4 mb-1 px-3 text-[10px] font-semibold uppercase tracking-wide text-ph-charcoal/40">
      {title}
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
