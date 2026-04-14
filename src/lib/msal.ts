import { PublicClientApplication } from '@azure/msal-browser';

const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID as string | undefined;
const tenantId = import.meta.env.VITE_ENTRA_TENANT_ID as string | undefined;

if (!clientId || !tenantId) {
  console.warn(
    'MSAL not configured — set VITE_ENTRA_CLIENT_ID and VITE_ENTRA_TENANT_ID in .env',
  );
}

export const msalInstance = new PublicClientApplication({
  auth: {
    clientId: clientId ?? '',
    authority: `https://login.microsoftonline.com/${tenantId ?? 'common'}`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
  },
});

export const loginRequest = {
  scopes: ['openid', 'profile', 'email'],
  prompt: 'select_account',
};
