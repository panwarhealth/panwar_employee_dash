import { Link, Outlet, useRouter, useRouterState } from '@tanstack/react-router';
import { useState } from 'react';
import { ArrowLeft, LogOut, Menu } from 'lucide-react';
import { useAuth, useLogout } from '@/hooks/useAuth';
import { MobileNav, Sidebar } from '@/components/Sidebar';

/**
 * Authed shell layout for /app/* routes. Persistent left sidebar + top bar
 * with the signed-in employee identity and a sign-out button. The route
 * guard in routes/app.tsx ensures we only render this when authenticated.
 */
export function EmployeeShell() {
  const { user } = useAuth();
  const logout = useLogout();
  const router = useRouter();
  const onHome = useRouterState({ select: (state) => state.location.pathname === '/app' });
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex h-full">
      <Sidebar />
      {menuOpen && <MobileNav onClose={() => setMenuOpen(false)} />}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-ph-charcoal/10 bg-white px-3 md:px-6">
          <div className="flex min-w-0 items-center gap-2 md:gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              title="Menu"
              className="rounded-md p-2 text-ph-charcoal/70 hover:bg-ph-charcoal/5 md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            {!onHome && (
              <button
                type="button"
                onClick={() => router.history.back()}
                className="flex items-center gap-1.5 rounded-md border border-ph-charcoal/20 px-3 py-1.5 text-xs font-medium text-ph-charcoal transition-colors hover:border-ph-purple hover:text-ph-purple"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
            )}
            <Link
              to="/app"
              title="Home"
              className="hidden rounded-md px-2 py-1.5 text-sm text-ph-charcoal/60 sm:block transition-colors hover:bg-ph-charcoal/5 hover:text-ph-purple"
            >
              Internal tools
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium text-ph-charcoal">
                {user?.name ?? user?.email ?? 'Loading…'}
              </div>
              {user?.email && user.name && (
                <div className="text-xs text-ph-charcoal/60">{user.email}</div>
              )}
            </div>
            <button
              type="button"
              onClick={() => logout.mutate()}
              className="flex items-center gap-1.5 rounded-md border border-ph-charcoal/20 px-3 py-1.5 text-xs font-medium text-ph-charcoal transition-colors hover:border-ph-purple hover:text-ph-purple"
              disabled={logout.isPending}
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-ph-charcoal/5 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
