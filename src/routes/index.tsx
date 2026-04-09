import { createFileRoute, redirect } from '@tanstack/react-router';

/**
 * Root path: redirect straight into the app shell. The /app guard will
 * forward to /login if the user isn't signed in.
 */
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/app' });
  },
});
