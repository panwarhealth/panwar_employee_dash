import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Clients management — onboarding, per-client branding (logo + colours),
 * client user invites. Stub for now.
 */
export const Route = createFileRoute('/app/clients')({
  component: ClientsPage,
});

function ClientsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ph-charcoal">Clients</h1>
        <p className="mt-1 text-sm text-ph-charcoal/70">
          Onboard clients, set per-client branding colours and logo, invite client users.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
          <CardDescription>
            Reckitt is currently the only seeded client. New clients land via this page once
            the clients CRUD endpoints are wired in panwar_api.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
