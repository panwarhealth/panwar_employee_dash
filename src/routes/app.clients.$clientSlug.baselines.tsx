import { useEffect, useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/api/client';
import { YearPicker } from '@/components/YearPicker';
import {
  createBaseline,
  updateBaseline,
  deleteBaseline,
  listBaselines,
  listPublishers,
  listTemplates,
  type Baseline,
  type MetricTemplate,
  type Publisher,
} from '@/api/taxonomy';

export const Route = createFileRoute('/app/clients/$clientSlug/baselines')({
  component: KpiTargetsTab,
});

const CURRENT_YEAR = new Date().getFullYear();

function KpiTargetsTab() {
  const { clientSlug } = Route.useParams();
  // null = no form; 'new' = create; a Baseline = edit that target.
  const [formState, setFormState] = useState<Baseline | 'new' | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(CURRENT_YEAR);

  const { data, isLoading } = useQuery({
    queryKey: ['manage', 'clients', clientSlug, 'baselines', selectedYear],
    queryFn: () => listBaselines(clientSlug, selectedYear),
  });
  const targets = data?.baselines ?? [];
  const years = data?.years ?? [];

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ph-charcoal/70">
          KPI targets per (publisher, metric) for a reporting year. New placements for that
          year pick these up automatically as their KPI targets.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <YearPicker year={selectedYear} onChange={setSelectedYear} yearsWithData={years} />
          {formState === null && (
            <Button type="button" size="sm" onClick={() => setFormState('new')}>
              <Plus className="h-4 w-4" />
              New target
            </Button>
          )}
        </div>
      </div>

      {formState !== null && (
        <TargetForm
          clientSlug={clientSlug}
          publishers={publishers}
          templates={templates}
          targets={targets}
          year={selectedYear}
          editing={formState === 'new' ? null : formState}
          onDone={() => setFormState(null)}
        />
      )}

      <Card>
        <CardContent className="pt-6">
          {isLoading && <p className="text-sm text-ph-charcoal/60">Loading…</p>}
          {!isLoading && targets.length === 0 && (
            <p className="text-sm text-ph-charcoal/60">
              No KPI targets for {selectedYear} yet - create the first one.
            </p>
          )}
          {targets.length > 0 && (
            <TargetTable clientSlug={clientSlug} targets={targets} onEdit={(b) => setFormState(b)} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TargetTable({
  clientSlug,
  targets,
  onEdit,
}: {
  clientSlug: string;
  targets: Baseline[];
  onEdit: (b: Baseline) => void;
}) {
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
            <th className="py-2 pr-4 text-right font-medium">Target</th>
            <th className="py-2 pr-4 font-medium">Note</th>
            <th className="py-2 text-right font-medium" />
          </tr>
        </thead>
        <tbody>
          {targets.map((b) => (
            <tr key={b.id} className="border-b border-ph-charcoal/5 last:border-0">
              <td className="py-2 pr-4 font-medium text-ph-charcoal">{b.publisherName}</td>
              <td className="py-2 pr-4 text-ph-charcoal/60">{b.templateCode}</td>
              <td className="py-2 pr-4 font-mono text-xs text-ph-charcoal/80">{b.metricKey}</td>
              <td className="py-2 pr-4 text-right tabular-nums text-ph-charcoal/80">
                {b.value.toLocaleString('en-AU')}
              </td>
              <td className="py-2 pr-4 text-ph-charcoal/60">{b.note ?? '—'}</td>
              <td className="py-2 text-right">
                <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(b)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={del.isPending}
                  onClick={() => {
                    if (confirm('Remove this KPI target?')) del.mutate(b.id);
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
  note: z.string().optional(),
});
type Values = z.infer<typeof schema>;

function TargetForm({
  clientSlug,
  publishers,
  templates,
  targets,
  year,
  editing,
  onDone,
}: {
  clientSlug: string;
  publishers: Publisher[];
  templates: MetricTemplate[];
  targets: Baseline[];
  year: number;
  editing: Baseline | null;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const formYear = editing?.year ?? year;
  const defaults = (b: Baseline | null): Values => ({
    publisherId: b?.publisherId ?? '',
    templateId: b?.templateId ?? '',
    metricKey: b?.metricKey ?? '',
    value: b?.value ?? 0,
    note: b?.note ?? '',
  });
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: defaults(editing),
  });

  useEffect(() => {
    form.reset(defaults(editing));
  }, [editing, form]);

  const selectedPublisherId = form.watch('publisherId');
  const selectedTemplateId = form.watch('templateId');

  // Only offer templates this publisher supports
  const availableTemplates = useMemo(() => {
    const publisher = publishers.find((p) => p.id === selectedPublisherId);
    if (!publisher) return [];
    const ids = new Set(publisher.templates.map((t) => t.templateId));
    return templates.filter((t) => ids.has(t.id));
  }, [publishers, templates, selectedPublisherId]);

  // Targets only exist for stored metrics — calculated ones (CTR, CPM…) derive.
  const availableMetrics = useMemo(() => {
    const template = templates.find((t) => t.id === selectedTemplateId);
    return (template?.fields ?? []).filter((f) => !f.isCalculated);
  }, [templates, selectedTemplateId]);

  const mutation = useMutation({
    mutationFn: (v: Values) => {
      const body = {
        publisherId: v.publisherId,
        templateId: v.templateId,
        year: formYear,
        metricKey: v.metricKey,
        value: v.value,
        note: v.note?.trim() || undefined,
      };
      return editing ? updateBaseline(clientSlug, editing.id, body) : createBaseline(clientSlug, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manage', 'clients', clientSlug, 'baselines'] });
      onDone();
    },
  });

  const error = mutation.error instanceof ApiError ? mutation.error.message : null;

  // Rate calculator seed: a volume target already saved for the same
  // publisher + template + year (impressions or sends - the usual base the
  // publisher quotes a rate against).
  const calcBase = useMemo(() => {
    const row = targets.find(
      (t) =>
        t.publisherId === selectedPublisherId &&
        t.templateId === selectedTemplateId &&
        (t.metricKey === 'impressions' || t.metricKey === 'sends'),
    );
    return row?.value ?? null;
  }, [targets, selectedPublisherId, selectedTemplateId]);

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="flex items-baseline gap-2 text-base font-semibold text-ph-charcoal">
          {editing ? 'Edit KPI target' : 'New KPI target'}
          <span className="text-sm font-normal text-ph-charcoal/50">· {formYear}</span>
        </h2>
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

          <LabeledField label="Target value" error={form.formState.errors.value?.message}>
            <Input type="number" step="any" {...form.register('value')} />
          </LabeledField>

          <LabeledField label="Note (optional)">
            <Input {...form.register('note')} placeholder="e.g. from client media plan" />
          </LabeledField>

          <RateCalculator
            seedBase={calcBase}
            onUse={(v) => form.setValue('value', v, { shouldValidate: true })}
          />

          <div className="col-span-full flex items-center gap-2">
            <Button type="submit" size="sm" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : editing ? 'Update target' : 'Save target'}
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

/**
 * Publishers quote derived targets as "volume x rate" (e.g. 10,000 impressions
 * at 0.5% CTR = 50 clicks). This does that arithmetic so no one reaches for a
 * calculator: enter the base volume and the rate, then apply the result.
 */
function RateCalculator({
  seedBase,
  onUse,
}: {
  seedBase: number | null;
  onUse: (value: number) => void;
}) {
  const [base, setBase] = useState('');
  const [rate, setRate] = useState('');

  // Pre-fill the base from the already-saved volume target when one exists.
  useEffect(() => {
    if (seedBase != null) setBase(String(seedBase));
  }, [seedBase]);

  const result = useMemo(() => {
    const b = Number(base);
    const r = Number(rate);
    if (!base.trim() || !rate.trim() || !Number.isFinite(b) || !Number.isFinite(r)) return null;
    return Math.round(b * (r / 100));
  }, [base, rate]);

  return (
    <div className="col-span-full rounded-md border border-dashed border-ph-charcoal/15 p-3">
      <p className="text-xs font-medium text-ph-charcoal">Rate calculator</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ph-charcoal/70">
        <Input
          type="number"
          step="any"
          value={base}
          onChange={(e) => setBase(e.target.value)}
          placeholder="Base, e.g. 10000"
          className="w-36"
        />
        <span>×</span>
        <Input
          type="number"
          step="any"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          placeholder="Rate %"
          className="w-24"
        />
        <span>% =</span>
        <span className="min-w-16 font-semibold tabular-nums text-ph-charcoal">
          {result != null ? result.toLocaleString('en-AU') : '—'}
        </span>
        <Button type="button" size="sm" variant="ghost" disabled={result == null} onClick={() => result != null && onUse(result)}>
          Use as target
        </Button>
      </div>
      <p className="mt-1.5 text-xs text-ph-charcoal/50">
        For targets quoted as a rate, e.g. 10,000 impressions at 0.5% CTR = 50 clicks.
      </p>
    </div>
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
