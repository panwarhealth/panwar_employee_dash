import { createFileRoute } from '@tanstack/react-router';
import { AuthShell } from '@/components/AuthShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { msalInstance, loginRequest } from '@/lib/msal';

export const Route = createFileRoute('/login')({
  component: LoginPage,
});

function LoginPage() {
  return (
    <AuthShell>
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <Button
            type="button"
            size="lg"
            onClick={() => msalInstance.loginRedirect(loginRequest)}
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
