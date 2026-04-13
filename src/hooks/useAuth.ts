import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import { getMe, logout, type MeResponse } from '@/api/auth';

const ME_QUERY_KEY = ['me'] as const;

/**
 * Fetches the current user from /api/auth/me. Returns null when not signed in
 * (401), or the MeResponse object on success. Employees should see
 * `type === 'employee'`; if a client user somehow ends up here we send them
 * away (the route guard handles that).
 */
export function useAuth() {
  const query = useQuery<MeResponse | null, Error>({
    queryKey: ME_QUERY_KEY,
    queryFn: async () => {
      try {
        return await getMe();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });

  return {
    user: query.data ?? null,
    isLoading: query.isLoading,
    isAuthenticated: !!query.data,
    error: query.error,
    refetch: query.refetch,
  };
}

/** Logout mutation that clears the cookie + invalidates the /me cache. */
export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(ME_QUERY_KEY, null);
      window.location.href = '/login';
    },
  });
}

/**
 * True if the current user has *any* of the given roles. Roles are mapped from
 * Entra ID group membership server-side (see panwar_api AuthService). Use this
 * to gate whole modules and individual destructive actions.
 */
export function useHasRole(...required: string[]) {
  const { user } = useAuth();
  if (!user) return false;
  return required.some((r) => user.roles.includes(r));
}
