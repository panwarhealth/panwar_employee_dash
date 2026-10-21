import { useQuery } from '@tanstack/react-query';
import { ts } from '@/api/timesheets';

export function useTsViewer() {
  return useQuery({ queryKey: ['ts', 'me'], queryFn: ts.me, staleTime: 5 * 60 * 1000 });
}

export const errorText = (error: unknown) =>
  error instanceof Error ? error.message : error ? 'Something went wrong, try again' : null;
