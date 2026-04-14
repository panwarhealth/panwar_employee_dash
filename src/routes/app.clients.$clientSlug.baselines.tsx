import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/api/client';
import {
  createBaseline,
  deleteBaseline,
  listBaselines,
  listPublishers,
  listTemplates,
  type Baseline,
  type MetricTemplate,
  type Publisher,
} from '@/api/taxonomy';

export const Route = createFileRoute('/app/clients/$clientSlug/baselines')({
  component: BaselinesTab,
});

function BaselinesTab() {
  const { clientSlug } = Route.useParams();
  const [showForm, setShowForm] = useState(false);

  const { data: baselines = [], isLoading } = useQuery({
    queryKey: ['manage', 'clients', clientSlug, 'baselines'],
    queryFn: () => listBaselines(clientSlug),
  });
  const { data: publishers = [] } = useQuery({
    queryKey: ['manage', 'publishers'],
    queryFn: listPublishers,
  });
  const { data: templates = [] } = useQuery({
    queryKey: ['manage', 'templates'],
    queryFn: listTemplates,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ph-charcoal/70">
          Expected performance per (publisher, metric). Editors use these as defaults when
          setting placement KPI targets.
        </p>
        {!showForm && (
          <Button type="button" size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
            New baseline
          </Button>
        )}
      </div>

      {showForm && (
        <NewBaselineForm
          clientSlug={clientSlug}
          publishers={publishers}
          templates={templates}
          onDone={() => setShowForm(false)}
        />
      )}

      <Card>
        <CardContent className="pt-6">
          {isLoading && <p className="text-sm text-ph-charcoal/60">Loading…</p>}
          {!isLoading && baselines.length === 0 && (
            <p className="text-sm text-ph-charcoal/60">
              No baselines yet — create the first one.
            </p>
          )}
          {baselines.length > 0 && <BaselineTable clientSlug={clientSlug} baselines={baselines} />}
        </CardContent>
      </Card>
    </div>
  );
}

function BaselineTable({ clientSlug, baselines }: { clientSlug: string; baselines: Baseline[] }) {
  const queryClient = useQueryClient();
  const del = useMutation({
    mutationFn: (id: string) => deleteBaseline(clientSlug, id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['manage', 'clients', clientSlug, 'baselines'] }),
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-ph-charcoal/10 text-xs uppercase tracking-wide text-ph-charcoal/60">
          <tr>
            <th className="py-2 pr-4 font-medium">Publisher</th>
            <th className="py-2 pr-4 font-medium">Template</th>
            <th className="py-2 pr-4 font-medium">Metric</th>
            <th className="py-2 pr-4 text-right font-medium">Value</th>
            <th className="py-2 pr-4 font-medium">Effective from</th>
            <th className="py-2 pr-4 font-medium">Note</th>
            <th className="py-2 text-right font-medium" />
          </tr>
        </thead>
        <tbody>
          {baselines.map((b) => (
            <tr key={b.id} className="border-b border-ph-charcoal/5 last:border-0">
              <td className="py-2 pr-4 font-medium text-ph-charcoal">{b.publisherName}</td>
              <td className="py-2 pr-4 text-ph-charcoal/60">{b.templateCode}</td>
              <td className="py-2 pr-4 font-mono text-xs text-ph-charcoal/80">{b.metricKey}</td>
              <td className="py-2 pr-4 text-right tabular-nums text-ph-charcoal/80">
                {b.value.toLocaleString('en-AU')}
              </td>
              <td className="py-2 pr-4 text-ph-charcoal/60">{b.effectiveFrom}</td>
              <td className="py-2 pr-4 text-ph-charcoal/60">{b.note ?? '—'}</td>
              <td className="py-2 text-right">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={del.isPending}
                  onClick={() => {
                    if (confirm('Remove this baseline?')) del.mutate(b.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const schema = z.object({
  publisherId: z.string().min(1, 'Pick a publisher'),
  templateId: z.string().min(1, 'Pick a template'),
  metricKey: z.string().min(1, 'Metric key required'),
  value: z.coerce.number().nonnegative('Must be ≥ 0'),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  note: z.string().optional(),
});
type Values = z.infer<typeof schema>;

function NewBaselineForm({
  clientSlug,
  publishers,
  templates,
  onDone,
}: {
  clientSlug: string;
  publishers: Publisher[];
  templates: MetricTemplate[];
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      publisherId: '',
      templateId: '',
      metricKey: '',
      value: 0,
      effectiveFrom: new Date().toISOString().slice(0, 10),
      note: '',
    },
  });

  const selectedPublisherId = form.watch('publisherId');
  const selectedTemplateId = form.watch('templateId');

  // Only offer templates this publisher supports
  const availableTemplates = useMemo(() => {
    const publisher = publishers.find((p) => p.id === selectedPublisherId);
    if (!publisher) return [];
    const ids = new Set(publisher.templates.map((t) => t.templateId));
    return templates.filter((t) => ids.has(t.id));
  }, [publishers, templates, selectedPublisherId]);

  // Metric keys come from the selected template's fields
  const availableMetrics = useMemo(() => {
    const template = templates.find((t) => t.id === selectedTemplateId);
    return template?.fields ?? [];
  }, [templates, selectedTemplateId]);

  const mutation = useMutation({
    mutationFn: (v: Values) =>
      createBaseline(clientSlug, {
        publisherId: v.publisherId,
        templateId: v.templateId,
        metricKey: v.metricKey,
        value: v.value,
        effectiveFrom: v.effectiveFrom,
        note: v.note?.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manage', 'clients', clientSlug, 'baselines'] });
      onDone();
    },
  });

  const error = mutation.error instanceof ApiError ? mutation.error.message : null;

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="text-base font-semibold text-ph-charcoal">New baseline</h2>
        <form
          onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
          className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3"
        >
          <Select
            label="Publisher"
            {...form.register('publisherId')}
            error={form.formState.errors.publisherId?.message}
          >
            <option value="">—</option>
            {publishers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>

          <Select
            label="Template"
            {...form.register('templateId')}
            error={form.formState.errors.templateId?.message}
            disabled={!selectedPublisherId}
          >
            <option value="">—</option>
            {availableTemplates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>

          <Select
            label="Metric"
            {...form.register('metricKey')}
            error={form.formState.errors.metricKey?.message}
            disabled={!selectedTemplateId}
          >
            <option value="">—</option>
            {availableMetrics.map((f) => (
              <option key={f.key} value={f.key}>{f.label}</option>
            ))}
          </Select>

          <LabeledField label="Value" error={form.formState.errors.value?.message}>
            <Input type="number" step="any" {...form.register('value')} />
          </LabeledField>

          <LabeledField label="Effective from" error={form.formState.errors.effectiveFrom?.message}>
            <Input type="date" {...form.register('effectiveFrom')} />
          </LabeledField>

          <LabeledField label="Note (optional)">
            <Input {...form.register('note')} placeholder="e.g. negotiated Q1 2026" />
          </LabeledField>

          <div className="col-span-full flex items-center gap-2">
            <Button type="submit" size="sm" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Save baseline'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onDone}>
              Cancel
            </Button>
            {error && <span className="text-xs text-red-600">{error}</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function LabeledField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-ph-charcoal">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

const Select = ({
  label,
  error,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-medium text-ph-charcoal">{label}</label>
    <select
      {...props}
      className="h-9 rounded-md border border-ph-charcoal/20 bg-white px-2 text-sm text-ph-charcoal focus:border-ph-purple focus:outline-none disabled:bg-ph-charcoal/5"
    >
      {children}
    </select>
    {error && <p className="text-xs text-red-600">{error}</p>}
  </div>
);
