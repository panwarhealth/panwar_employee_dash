import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent } from '@/components/ui/card';

export const Route = createFileRoute('/app/clients/$clientSlug/placements')({
  component: PlacementsTab,
});

function PlacementsTab() {
  return (
    <Card>
      <CardContent className="pt-6 text-sm text-ph-charcoal/70">
        Placements — the per-client creative cards (artwork + monthly actuals). Building next.
      </CardContent>
    </Card>
  );
}
