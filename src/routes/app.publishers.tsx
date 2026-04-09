import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Publishers management — global list of publishers and which metric
 * templates each one offers (digital display / eDM / print / sponsored
 * content / education). Shared across all clients. Stub for now.
 */
export const Route = createFileRoute('/app/publishers')({
  component: PublishersPage,
});

function PublishersPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ph-charcoal">Publishers</h1>
        <p className="mt-1 text-sm text-ph-charcoal/70">
          Publishers and the metric templates each one uses to report monthly data.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
          <CardDescription>
            10 publishers are seeded for Reckitt (AJP, AP, Arterial, Healthed, AJGP, ADG,
            Princeton, NewsGP, Medical Today, PraxHub). CRUD lands once the API endpoints exist.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
