import { useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/api/client';
import { YearPicker } from '@/components/YearPicker';
import { getYearSummary, putYearSummary } from '@/api/summary';

export const Route = createFileRoute('/app/clients/$clientSlug/summary')({
  component: SummaryTab,
});

const CURRENT_YEAR = new Date().getFullYear();

/**
 * The analyst-written yearly summary (the workbook's FY RESULTS commentary).
 * Shown on the client overview - as a results summary once the year has
 * actuals, or as plan notes for a planned year.
 */
function SummaryTab() {
  const { clientSlug } = Route.useParams();
  const queryClient = useQueryClient();
  const [selectedYear, setSelectedYear] = useState<number>(CURRENT_YEAR);
  const [text, setText] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['manage', 'clients', clientSlug, 'summary', selectedYear],
    queryFn: () => getYearSummary(clientSlug, selectedYear),
  });

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
        <YearPicker year={selectedYear} onChange={setSelectedYear} yearsWithData={data?.years} />
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
    </div>
  );
}
