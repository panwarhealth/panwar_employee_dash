import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Per-client publisher baselines — the negotiated KPI rates per client per
 * publisher (e.g. Reckitt's CTR baseline at AJP). Drives the default KPI
 * targets when creating new placements; can be overridden per placement.
 * Stub for now.
 */
export const Route = createFileRoute('/app/baselines')({
  component: BaselinesPage,
});

function BaselinesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ph-charcoal">Client baselines</h1>
        <p className="mt-1 text-sm text-ph-charcoal/70">
          Negotiated KPI rates per client per publisher. New placements default to these and
          can override per-placement.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
          <CardDescription>
            Baselines lands once we've decided the data entry shape — probably a sparse
            client × publisher × metric grid. Not seeded for Reckitt; the per-placement KPIs
            from the workbook are sufficient for the dashboards.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
