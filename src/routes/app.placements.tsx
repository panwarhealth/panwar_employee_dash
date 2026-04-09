import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Placements management — list, detail, create, edit. The biggest page in
 * the Dashboard Updater module. Stub for now.
 */
export const Route = createFileRoute('/app/placements')({
  component: PlacementsPage,
});

function PlacementsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ph-charcoal">Placements</h1>
        <p className="mt-1 text-sm text-ph-charcoal/70">
          Create and edit placements, attach KPIs, upload artwork, enter monthly actuals.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
          <CardDescription>
            This page lands once the placements CRUD endpoints are wired in panwar_api. For
            now the only way to populate placements is the dev seed endpoint
            (`POST /api/dev/seed-reckitt`).
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
