import { createFileRoute, redirect } from '@tanstack/react-router';

/** Default tab for a client workspace is Details. */
export const Route = createFileRoute('/app/clients/$clientSlug/')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/app/clients/$clientSlug/details',
      params: { clientSlug: params.clientSlug },
    });
  },
});
