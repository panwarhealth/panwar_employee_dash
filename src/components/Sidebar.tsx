import { Link } from '@tanstack/react-router';
import { BarChart3, Clock, LayoutGrid, Link2, Mail, QrCode, Shield, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHasRole } from '@/hooks/useAuth';
import { MAILER_ROLES } from '@/lib/roles';

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

function useNavItems(): NavItem[] {
  const isAdmin = useHasRole('panwar-admin');
  const canEdit = useHasRole('panwar-admin', 'dashboard-editor', 'medical-writer');
  const canMail = useHasRole(...MAILER_ROLES);

  return [
    { to: '/app', label: 'Home', icon: LayoutGrid, exact: true },
    ...(canEdit ? [{ to: '/app/clients', label: 'Client Dashboards', icon: BarChart3 }] : []),
    ...(canMail ? [{ to: '/app/edm', label: 'eDM Mailer', icon: Mail }] : []),
    { to: '/app/timesheets', label: 'Timesheets', icon: Clock },
    { to: '/app/qr', label: 'QR Codes', icon: QrCode },
    { to: '/app/links', label: 'UTM Links', icon: Link2 },
    ...(isAdmin ? [{ to: '/app/admin', label: 'Users & Roles', icon: Shield }] : []),
  ];
}

function Logo({ labelClass }: { labelClass: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-ph-purple text-xs font-bold text-white">
        PH
      </div>
      <span className={cn(labelClass, 'text-base font-semibold text-ph-purple')}>
        Panwar Health
      </span>
    </div>
  );
}

/**
 * Collapsed icon rail that expands over the content on hover (Cloudflare-style).
 * The nav animates between two DEFINITE widths (w-14 <-> w-56) so it always
 * collapses fully; labels are clipped by overflow when narrow. A fixed-width
 * spacer holds the layout and the nav overlays the content, so nothing reflows.
 */
export function Sidebar() {
  const items = useNavItems();

  return (
    <div className="relative hidden w-14 shrink-0 md:block">
      <nav className="group absolute inset-y-0 left-0 z-30 flex w-14 flex-col gap-1 overflow-hidden border-r border-ph-charcoal/10 bg-white p-2 shadow-sm transition-[width] duration-200 ease-in-out hover:w-56 hover:shadow-lg">
        <Logo labelClass={label} />
        {items.map((item) => (
          <NavLink key={item.to} item={item} labelClass={label} />
        ))}
      </nav>
    </div>
  );
}

export function MobileNav({ onClose }: { onClose: () => void }) {
  const items = useNavItems();

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div className="absolute inset-0 bg-ph-charcoal/40" onClick={onClose} />
      <nav className="absolute inset-y-0 left-0 flex w-64 flex-col gap-1 bg-white p-3 shadow-xl">
        <div className="flex items-start justify-between">
          <Logo labelClass="" />
          <button
            type="button"
            onClick={onClose}
            title="Close menu"
            className="rounded-md p-2 text-ph-charcoal/60 hover:bg-ph-charcoal/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {items.map((item) => (
          <NavLink key={item.to} item={item} labelClass="" onClick={onClose} />
        ))}
      </nav>
    </div>
  );
}

function NavLink({
  item,
  labelClass,
  onClick,
}: {
  item: NavItem;
  labelClass: string;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onClick}
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
      <span className={labelClass}>{item.label}</span>
    </Link>
  );
}
