import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent } from '@/components/ui/card';

export const Route = createFileRoute('/app/clients/$clientSlug/import')({
  component: ImportTab,
});

function ImportTab() {
  return (
    <Card>
      <CardContent className="pt-6 text-sm text-ph-charcoal/70">
        Bulk import — upload publisher monthly reports (CSV/Excel) scoped to this client.
      </CardContent>
    </Card>
  );
}
