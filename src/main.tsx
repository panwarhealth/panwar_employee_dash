import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { msalInstance } from '@/lib/msal';
import { exchangeEntraToken } from '@/api/auth';
import { routeTree } from './routeTree.gen';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  context: { queryClient },
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const rootEl = document.getElementById('root')!;

function render() {
  createRoot(rootEl).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
}

/**
 * Boot sequence: initialise MSAL and handle any pending redirect from
 * Microsoft before rendering the app. If the user just came back from
 * Entra sign-in, exchange the ID token for a panwar_session cookie so
 * the router's auth guard sees them as signed in.
 */
async function boot() {
  await msalInstance.initialize();

  const result = await msalInstance.handleRedirectPromise();
  if (result?.idToken) {
    try {
      await exchangeEntraToken(result.idToken);
      queryClient.invalidateQueries({ queryKey: ['me'] });
      // MSAL restores the pre-redirect URL (/login) — move to /app now that cookie is set
      window.history.replaceState({}, '', '/app');
    } catch (err) {
      console.error('Entra token exchange failed:', err);
    }
  }

  render();
}

boot();
