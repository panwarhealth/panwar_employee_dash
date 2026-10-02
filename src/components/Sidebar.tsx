import { Link } from '@tanstack/react-router';
import {
  BarChart3,
  LayoutGrid,
  Link2,
  QrCode,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHasRole } from '@/hooks/useAuth';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutGrid;
  exact?: boolean;
}

// Labels fade in after the panel has widened (delay on hover) and out instantly
// on collapse (no delay at rest), so text never fights the width animation.
const label =
  'whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-hover:delay-150';

/**
 * Collapsed icon rail that expands over the content on hover (Cloudflare-style).
 * The nav animates between two DEFINITE widths (w-14 <-> w-56) so it always
 * collapses fully; labels are clipped by overflow when narrow. A fixed-width
 * spacer holds the layout and the nav overlays the content, so nothing reflows.
 */
export function Sidebar() {
  const isAdmin = useHasRole('panwar-admin');
  const canEdit = useHasRole('panwar-admin', 'dashboard-editor', 'medical-writer');

  return (
    <div className="relative w-14 shrink-0">
      <nav className="group absolute inset-y-0 left-0 z-30 flex w-14 flex-col gap-1 overflow-hidden border-r border-ph-charcoal/10 bg-white p-2 shadow-sm transition-[width] duration-200 ease-in-out hover:w-56 hover:shadow-lg">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-ph-purple text-xs font-bold text-white">
            PH
          </div>
          <span className={cn(label, 'text-base font-semibold text-ph-purple')}>Panwar Health</span>
        </div>

        <NavLink item={{ to: '/app', label: 'Home', icon: LayoutGrid, exact: true }} />
        {canEdit && (
          <NavLink item={{ to: '/app/clients', label: 'Client Dashboards', icon: BarChart3 }} />
        )}
        <NavLink item={{ to: '/app/qr', label: 'QR Codes', icon: QrCode }} />
        <NavLink item={{ to: '/app/links', label: 'UTM Links', icon: Link2 }} />
        {isAdmin && <NavLink item={{ to: '/app/admin', label: 'Users & Roles', icon: Shield }} />}
      </nav>
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
        'flex items-center gap-2 rounded-md py-2 text-sm font-medium text-ph-charcoal/80 transition-colors',
        'hover:bg-ph-charcoal/5 hover:text-ph-charcoal',
      )}
      activeProps={{
        className: 'bg-ph-purple/10 text-ph-purple hover:bg-ph-purple/15 hover:text-ph-purple',
      }}
    >
      <span className="flex w-9 shrink-0 justify-center">
        <Icon className="h-4 w-4" />
      </span>
      <span className={label}>{item.label}</span>
    </Link>
  );
}
