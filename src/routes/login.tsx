import { createFileRoute } from '@tanstack/react-router';
import { AuthShell } from '@/components/AuthShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Employee sign-in page. Single "Sign in with Microsoft" button — the
 * actual MSAL.js / Entra ID flow is not yet wired up. The Entra app
 * registration ("Panwar Portals — Employee SSO") is on Rob's punch list;
 * once it exists and panwar_api can validate Entra JWTs, this button calls
 * `msalInstance.loginRedirect(...)` and the API exchanges the resulting
 * token for the standard HttpOnly session cookie used by the rest of the
 * app.
 *
 * Until then, the button is a deliberate dead end (alert + console hint)
 * so anyone running the dash locally sees what's missing rather than a
 * confusing infinite loading spinner.
 */
export const Route = createFileRoute('/login')({
  component: LoginPage,
});

function LoginPage() {
  return (
    <AuthShell>
      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button
            type="button"
            size="lg"
            onClick={() => {
              // TODO: replace with msalInstance.loginRedirect once
              // ENTRA_EMPLOYEE_SSO_CLIENT_ID is set in the Function App.
              // eslint-disable-next-line no-alert
              alert(
                'Microsoft sign-in is not wired up yet — the Entra ID app registration ' +
                  'is on the punch list. See login.tsx for the TODO.',
              );
            }}
          >
            Sign in with Microsoft
          </Button>
          <p className="text-center text-xs text-ph-charcoal/60">
            Access is restricted to Panwar Health staff.
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
