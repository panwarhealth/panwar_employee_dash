import { createFileRoute, redirect } from '@tanstack/react-router';
import { ApiError } from '@/api/client';
import { getMe } from '@/api/auth';
import { EmployeeShell } from '@/components/EmployeeShell';

/**
 * Authed shell route. Every /app/* route renders inside the EmployeeShell.
 * The beforeLoad guard runs /api/auth/me; on 401 we redirect to /login,
 * and on a client-type user we also redirect (this dash is staff-only,
 * client users belong on portal.panwarhealth.com.au).
 *
 * NOTE: until the Entra ID app reg is wired and panwar_api can mint a
 * session cookie for employees, the only way to actually pass this guard
 * locally is to manually create an AppUser row with type=Employee. The
 * /login button is a stub.
 */
export const Route = createFileRoute('/app')({
  beforeLoad: async ({ context }) => {
    try {
      const me = await context.queryClient.fetchQuery({
        queryKey: ['me'],
        queryFn: getMe,
        staleTime: 5 * 60 * 1000,
      });
      if (me.type !== 'employee') {
        throw redirect({ to: '/login' });
      }
      return { me };
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        throw redirect({ to: '/login' });
      }
      throw error;
    }
  },
  component: EmployeeShell,
});
