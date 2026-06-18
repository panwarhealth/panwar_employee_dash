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

// Reveal a label horizontally: a 1-col grid whose track animates 0fr -> 1fr on
// hover. overflow-hidden clips the text to the 0-width track when collapsed, so
// there's no opacity/display hack and nothing fights the panel widening.
const reveal =
  'grid grid-cols-[0fr] overflow-hidden transition-[grid-template-columns] duration-200 ease-in-out group-hover:grid-cols-[1fr]';

/**
 * Collapsed icon rail that expands over the content on hover (Cloudflare-style).
 * The nav is w-max, so its width simply follows the grid reveals as they
 * animate - no `width` transition (which reflows and stutters). A fixed-width
 * spacer holds the layout; the nav overlays the content, so nothing reflows.
 */
export function Sidebar() {
  const isAdmin = useHasRole('panwar-admin');
  const canEdit = useHasRole('panwar-admin', 'dashboard-editor', 'medical-writer');

  return (
    <div className="relative w-14 shrink-0">
      <nav className="group absolute inset-y-0 left-0 z-30 flex w-max max-w-56 flex-col gap-1 overflow-hidden border-r border-ph-charcoal/10 bg-white p-2 shadow-sm transition-shadow duration-200 hover:shadow-lg">
        <div className="mb-3 flex items-center">
          <div className="flex h-9 w-10 shrink-0 items-center justify-center text-base font-bold text-ph-purple">
            PH
          </div>
          <span className={reveal}>
            <span className="overflow-hidden whitespace-nowrap pr-2 text-base font-semibold text-ph-purple">
              Panwar Health
            </span>
          </span>
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
    </div>
  );
}

// A divider that's always present, plus the title text revealed vertically
// (grid-rows 0fr -> 1fr) so it takes no space - and leaves no gap - when collapsed.
function GroupHeading({ title }: { title: string }) {
  return (
    <div className="mx-1 mt-2">
      <hr className="border-ph-charcoal/10" />
      <div className="grid grid-rows-[0fr] overflow-hidden transition-[grid-template-rows] duration-200 ease-in-out group-hover:grid-rows-[1fr]">
        <span className="overflow-hidden whitespace-nowrap pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-ph-charcoal/40">
          {title}
        </span>
      </div>
    </div>
  );
}

function NavLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      activeOptions={{ exact: item.exact ?? false }}
      title={item.label}
      className={cn(
        'flex items-center rounded-md py-2 text-sm font-medium text-ph-charcoal/80 transition-colors',
        'hover:bg-ph-charcoal/5 hover:text-ph-charcoal',
      )}
      activeProps={{
        className: 'bg-ph-purple/10 text-ph-purple hover:bg-ph-purple/15 hover:text-ph-purple',
      }}
    >
      <span className="flex h-5 w-10 shrink-0 items-center justify-center">
        <Icon className="h-4 w-4" />
      </span>
      <span className={reveal}>
        <span className="overflow-hidden whitespace-nowrap pr-3">{item.label}</span>
      </span>
    </Link>
  );
}
