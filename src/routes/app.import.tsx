import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Bulk importer — upload a publisher's monthly Excel/CSV data-mine
 * template, parse it with one of 4 template handlers, validate against the
 * placement list, show a diff, editor confirms. The big time-saver vs the
 * current spreadsheet workflow. Stub for now.
 */
export const Route = createFileRoute('/app/import')({
  component: BulkImportPage,
});

function BulkImportPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ph-charcoal">Bulk import</h1>
        <p className="mt-1 text-sm text-ph-charcoal/70">
          Upload monthly publisher templates, validate against placements, confirm a diff,
          publish.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
          <CardDescription>
            Lands with Phase 3 — needs the 4 publisher template parsers in panwar_api and
            the diff/confirm flow on the front end. Until then the only data path is the
            dev seed endpoint.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
