import { useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/api/client';
import { getYearSummary, putYearSummary } from '@/api/summary';
import { listClients, updateOverviewCharts } from '@/api/clients';
import { usePublishYears, useWorkspaceYear } from '@/lib/workspaceYear';

export const Route = createFileRoute('/app/clients/$clientSlug/summary')({
  component: SummaryTab,
});

/**
 * The analyst-written yearly summary (the workbook's FY RESULTS commentary).
 * Shown on the client overview - as a results summary once the year has
 * actuals, or as plan notes for a planned year.
 */
function SummaryTab() {
  const { clientSlug } = Route.useParams();
  const queryClient = useQueryClient();
  const { year: selectedYear } = useWorkspaceYear();
  const [text, setText] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['manage', 'clients', clientSlug, 'summary', selectedYear],
    queryFn: () => getYearSummary(clientSlug, selectedYear),
  });
  usePublishYears(data?.years);

  // Sync the textarea whenever a different year's summary loads.
  useEffect(() => {
    setText(data?.summary?.text ?? '');
  }, [data]);

  const save = useMutation({
    mutationFn: () => putYearSummary(clientSlug, { year: selectedYear, text }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['manage', 'clients', clientSlug, 'summary'] }),
  });

  const error = save.error instanceof ApiError ? save.error.message : null;
  const dirty = text !== (data?.summary?.text ?? '');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ph-charcoal/70">
          The written summary clients see on their overview for the selected year - results
          commentary once data is in, or plan notes for a year being planned.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-sm text-ph-charcoal/60">Loading…</p>
          ) : (
            <div className="flex flex-col gap-3">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={14}
                placeholder={`Write the ${selectedYear} summary…`}
                className="w-full rounded-md border border-ph-charcoal/20 bg-white p-3 text-sm leading-relaxed text-ph-charcoal focus:border-ph-purple focus:outline-none"
              />
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" disabled={save.isPending || !dirty} onClick={() => save.mutate()}>
                  {save.isPending ? 'Saving…' : 'Save summary'}
                </Button>
                {text.trim() === '' && data?.summary && (
                  <span className="text-xs text-ph-charcoal/50">
                    Saving with empty text removes the {selectedYear} summary.
                  </span>
                )}
                {error && <span className="text-xs text-red-600">{error}</span>}
                {save.isSuccess && !save.isPending && !dirty && (
                  <span className="text-xs text-green-700">Saved ✓</span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <OverviewChartsCard clientSlug={clientSlug} />
    </div>
  );
}

/**
 * Per-client toggles for the two derived charts on the client overview.
 * Client-scoped (not year-scoped) - they live here because this tab is where
 * the overview's content is curated.
 */
function OverviewChartsCard({ clientSlug }: { clientSlug: string }) {
  const queryClient = useQueryClient();
  const { data: clients = [] } = useQuery({
    queryKey: ['manage', 'clients'],
    queryFn: listClients,
  });
  const client = clients.find((c) => c.slug === clientSlug);

  const save = useMutation({
    mutationFn: (next: { showBrandMonthlyChart: boolean; showPublisherChart: boolean }) =>
      updateOverviewCharts(clientSlug, next),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['manage', 'clients'] }),
  });

  if (!client) return null;

  const toggle = (key: 'showBrandMonthlyChart' | 'showPublisherChart') =>
    save.mutate({
      showBrandMonthlyChart:
        key === 'showBrandMonthlyChart' ? !client.showBrandMonthlyChart : client.showBrandMonthlyChart,
      showPublisherChart:
        key === 'showPublisherChart' ? !client.showPublisherChart : client.showPublisherChart,
    });

  const saveError = save.error instanceof ApiError ? save.error.message : null;

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="text-base font-semibold text-ph-charcoal">Overview charts</h2>
        <p className="mt-1 text-sm text-ph-charcoal/70">
          Charts shown on this client's overview page. Applies to every year; charts are hidden
          automatically while a year is still in planning.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-ph-charcoal">
            <input
              type="checkbox"
              checked={client.showBrandMonthlyChart}
              disabled={save.isPending}
              onChange={() => toggle('showBrandMonthlyChart')}
              className="h-4 w-4 accent-ph-purple"
            />
            Monthly touchpoints by brand
          </label>
          <label className="flex items-center gap-2 text-sm text-ph-charcoal">
            <input
              type="checkbox"
              checked={client.showPublisherChart}
              disabled={save.isPending}
              onChange={() => toggle('showPublisherChart')}
              className="h-4 w-4 accent-ph-purple"
            />
            Publisher performance (touchpoints vs engagements)
          </label>
        </div>
        {saveError && <p className="mt-2 text-xs text-red-600">{saveError}</p>}
      </CardContent>
    </Card>
  );
}
