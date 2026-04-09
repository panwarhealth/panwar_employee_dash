import { Outlet } from '@tanstack/react-router';
import { LogOut } from 'lucide-react';
import { useAuth, useLogout } from '@/hooks/useAuth';
import { Sidebar } from '@/components/Sidebar';

/**
 * Authed shell layout for /app/* routes. Persistent left sidebar + top bar
 * with the signed-in employee identity and a sign-out button. The route
 * guard in routes/app.tsx ensures we only render this when authenticated.
 */
export function EmployeeShell() {
  const { user } = useAuth();
  const logout = useLogout();

  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-ph-charcoal/10 bg-white px-6">
          <div className="text-sm text-ph-charcoal/60">Internal tools</div>
          <div className="flex items-center gap-3">
            <div className="text-right">
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
              Sign out
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-ph-charcoal/5 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
