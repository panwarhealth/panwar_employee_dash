import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Brands and audiences management — both belong to a client. Stub for now.
 */
export const Route = createFileRoute('/app/brands')({
  component: BrandsPage,
});

function BrandsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ph-charcoal">Brands & audiences</h1>
        <p className="mt-1 text-sm text-ph-charcoal/70">
          The brand × audience matrix that drives the client dashboards.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
          <CardDescription>
            Reckitt currently has Nurofen, Nurofen for Children and Gaviscon, each running to
            Pharmacists and GPs. CRUD lands here once the API endpoints exist.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
