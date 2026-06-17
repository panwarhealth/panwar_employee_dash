import { useEffect, useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Pencil, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/api/client';
import { usePublishYears, useWorkspaceYear } from '@/lib/workspaceYear';
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

/** Pre-selection for the create form when adding from an empty matrix cell. */
interface CellPreset {
  publisherId: string;
  templateId: string;
  metricKey: string;
}

type FormState =
  | { mode: 'new'; preset?: CellPreset }
  | { mode: 'edit'; baseline: Baseline }
  | null;

function KpiTargetsTab() {
  const { clientSlug } = Route.useParams();
  const [formState, setFormState] = useState<FormState>(null);
  const { year: selectedYear } = useWorkspaceYear();

  const { data, isLoading } = useQuery({
    queryKey: ['manage', 'clients', clientSlug, 'baselines', selectedYear],
    queryFn: () => listBaselines(clientSlug, selectedYear),
  });
  const targets = data?.baselines ?? [];
  usePublishYears(data?.years);

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
          <Button type="button" size="sm" onClick={() => setFormState({ mode: 'new' })}>
            <Plus className="h-4 w-4" />
            New target
          </Button>
        </div>
      </div>

      <Modal
        open={formState !== null}
        onClose={() => setFormState(null)}
        title={`${formState?.mode === 'edit' ? 'Edit' : 'New'} KPI target · ${selectedYear}`}
      >
        {formState !== null && (
          <TargetForm
            key={formState.mode === 'edit' ? formState.baseline.id : 'new'}
            clientSlug={clientSlug}
            publishers={publishers}
            templates={templates}
            targets={targets}
            year={selectedYear}
            editing={formState.mode === 'edit' ? formState.baseline : null}
            onDone={() => setFormState(null)}
          />
        )}
      </Modal>

      <Card>
        <CardContent className="pt-6">
          {isLoading && <p className="text-sm text-ph-charcoal/60">Loading…</p>}
          {!isLoading && targets.length === 0 && (
            <p className="text-sm text-ph-charcoal/60">
              No KPI targets for {selectedYear} yet - create the first one.
            </p>
          )}
          {targets.length > 0 && (
            <TargetTable targets={targets} onEdit={(b) => setFormState({ mode: 'edit', baseline: b })} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// templateCode (lowercased enum name) → display label, as on the Placements tab.
const TEMPLATE_LABELS: Record<string, string> = {
  digitaldisplay: 'Digital display',
  edm: 'eDM',
  print: 'Print',
  sponsoredcontent: 'Sponsored content',
  education: 'Education',
};
const templateLabel = (code: string) => TEMPLATE_LABELS[code] ?? code;

const isRateKey = (key: string) => key === 'ctr' || key.endsWith('_rate');

const titleCaseKey = (key: string) =>
  key === 'ctr'
    ? 'CTR'
    : key
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

/** Rates read as percentages ("1.9%"); counts as whole numbers ("349,580"). */
const formatTarget = (b: Baseline) =>
  isRateKey(b.metricKey)
    ? `${(b.value * 100).toLocaleString('en-AU', { maximumFractionDigits: 2 })}%`
    : Math.round(b.value).toLocaleString('en-AU');

// Canonical chip order: volume → engagements → rates, so every row reads the
// way targets are quoted ("120,960 impressions at 0.62% CTR = 750 clicks").
const KEY_ORDER: Record<string, number> = {
  impressions: 0,
  sends: 1,
  opens: 2,
  views: 3,
  page_views: 4,
  completions: 10,
  downloads: 11,
  clicks: 12,
  ctr: 20,
  completion_rate: 21,
};
const keyOrder = (key: string) => KEY_ORDER[key] ?? 15;

type SortKey = 'publisher' | 'type' | 'metric' | 'target' | 'note';

const sortValue = (b: Baseline, key: SortKey): string | number => {
  switch (key) {
    case 'publisher': return b.publisherName.toLowerCase();
    case 'type': return templateLabel(b.templateCode).toLowerCase();
    case 'metric': return keyOrder(b.metricKey);
    case 'target': return b.value;
    case 'note': return (b.note ?? '').toLowerCase();
  }
};

const compareByKey = (a: Baseline, b: Baseline, key: SortKey): number => {
  const av = sortValue(a, key);
  const bv = sortValue(b, key);
  return typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
};

function TargetTable({
  targets,
  onEdit,
}: {
  targets: Baseline[];
  onEdit: (b: Baseline) => void;
}) {
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'publisher', dir: 'asc' });

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const rows = q
      ? targets.filter((b) =>
          [b.publisherName, templateLabel(b.templateCode), titleCaseKey(b.metricKey), b.note ?? ''].some((s) =>
            s.toLowerCase().includes(q),
          ),
        )
      : targets;
    return [...rows].sort((a, b) => {
      const primary = compareByKey(a, b, sort.key);
      if (primary !== 0) return sort.dir === 'asc' ? primary : -primary;
      for (const k of ['publisher', 'type', 'metric', 'target'] as SortKey[]) {
        const c = compareByKey(a, b, k);
        if (c !== 0) return c;
      }
      return a.id.localeCompare(b.id);
    });
  }, [targets, filter, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  const isDefault = filter === '' && sort.key === 'publisher' && sort.dir === 'asc';
  const reset = () => {
    setFilter('');
    setSort({ key: 'publisher', dir: 'asc' });
  };

  const SortTh = ({ k, label, align = 'left', w }: { k: SortKey; label: string; align?: 'left' | 'right'; w?: string }) => (
    <th className={`${w ?? ''} py-2 ${align === 'right' ? 'text-right' : ''} pr-4 font-medium`}>
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className={`inline-flex items-center gap-1 hover:text-ph-charcoal ${align === 'right' ? 'flex-row-reverse' : ''}`}
      >
        {label}
        {sort.key === k ? (
          sort.dir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-30" />
        )}
      </button>
    </th>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter (publisher, type, metric, note)..."
          className="h-8 max-w-md text-sm"
        />
        {!isDefault && (
          <Button type="button" size="sm" variant="ghost" onClick={reset}>
            Reset
          </Button>
        )}
        <span className="ml-auto text-xs text-ph-charcoal/50">
          {visible.length} of {targets.length}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-left text-sm">
          <thead className="border-b border-ph-charcoal/10 text-xs uppercase tracking-wide text-ph-charcoal/60">
            <tr>
              <SortTh k="publisher" label="Publisher" w="w-[26%]" />
              <SortTh k="type" label="Type" w="w-[16%]" />
              <SortTh k="metric" label="Metric" w="w-[16%]" />
              <SortTh k="target" label="Target" align="right" w="w-[12%]" />
              <SortTh k="note" label="Notes" w="w-[26%]" />
              <th className="w-[4%] py-2 text-right font-medium" />
            </tr>
          </thead>
          <tbody>
            {visible.map((b, i) => (
              <tr
                key={b.id}
                className={`border-b border-ph-charcoal/5 last:border-0 ${i % 2 === 1 ? 'bg-slate-100/50' : ''}`}
              >
                <td className="truncate py-2 pr-4 font-medium text-ph-charcoal" title={b.publisherName}>{b.publisherName}</td>
                <td className="truncate py-2 pr-4 text-ph-charcoal/70">{templateLabel(b.templateCode)}</td>
                <td className="truncate py-2 pr-4 text-ph-charcoal/70">{titleCaseKey(b.metricKey)}</td>
                <td className="py-2 pr-4 text-right tabular-nums text-ph-charcoal/80">{formatTarget(b)}</td>
                <td className="truncate py-2 pr-4 text-ph-charcoal/60" title={b.note ?? ''}>{b.note}</td>
                <td className="py-2 text-right whitespace-nowrap">
                  <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(b)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
  preset,
  onDone,
}: {
  clientSlug: string;
  publishers: Publisher[];
  templates: MetricTemplate[];
  targets: Baseline[];
  year: number;
  editing: Baseline | null;
  preset?: CellPreset;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const formYear = editing?.year ?? year;
  const defaults = (b: Baseline | null): Values => ({
    publisherId: b?.publisherId ?? preset?.publisherId ?? '',
    templateId: b?.templateId ?? preset?.templateId ?? '',
    metricKey: b?.metricKey ?? preset?.metricKey ?? '',
    value: b?.value ?? 0,
    note: b?.note ?? '',
  });
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: defaults(editing),
  });

  useEffect(() => {
    form.reset(defaults(editing));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- defaults closes over preset
  }, [editing, preset, form]);

  const selectedPublisherId = form.watch('publisherId');
  const selectedTemplateId = form.watch('templateId');

  // Only offer templates this publisher supports
  const availableTemplates = useMemo(() => {
    const publisher = publishers.find((p) => p.id === selectedPublisherId);
    if (!publisher) return [];
    const ids = new Set(publisher.templates.map((t) => t.templateId));
    return templates.filter((t) => ids.has(t.id));
  }, [publishers, templates, selectedPublisherId]);

  // New targets only for stored metrics — calculated ones (CTR, CPM…) derive.
  // The row's own / preset metric stays selectable even if calculated
  // (seeded benchmark rates like CTR are legitimate existing targets).
  const availableMetrics = useMemo(() => {
    const template = templates.find((t) => t.id === selectedTemplateId);
    return (template?.fields ?? []).filter(
      (f) => !f.isCalculated || f.key === editing?.metricKey || f.key === preset?.metricKey,
    );
  }, [templates, selectedTemplateId, editing, preset]);

  const mutation = useMutation({
    mutationFn: async (v: Values) => {
      const body = {
        publisherId: v.publisherId,
        templateId: v.templateId,
        year: formYear,
        metricKey: v.metricKey,
        value: v.value,
        note: v.note?.trim() || undefined,
      };
      if (editing) await updateBaseline(clientSlug, editing.id, body);
      else await createBaseline(clientSlug, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manage', 'clients', clientSlug, 'baselines'] });
      onDone();
    },
  });

  const del = useMutation({
    mutationFn: () => deleteBaseline(clientSlug, editing!.id),
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
    <div className="p-6">
        <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select
            label="Publisher"
            {...form.register('publisherId')}
            error={form.formState.errors.publisherId?.message}
          >
            <option value="">-</option>
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
            <option value="">-</option>
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
            <option value="">-</option>
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
            onUse={(v) => {
              form.setValue('value', v, { shouldValidate: true });
            }}
          />

          <div className="col-span-full flex items-center gap-2">
            <Button type="submit" size="sm" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving...' : editing ? 'Save changes' : 'Create target'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
            {error && <span className="text-xs text-red-600">{error}</span>}
            {editing && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="ml-auto text-red-600 hover:text-red-700"
                disabled={del.isPending}
                onClick={() => {
                  if (confirm('Remove this KPI target?')) del.mutate();
                }}
              >
                <Trash2 className="h-4 w-4" />
                Delete target
              </Button>
            )}
          </div>
        </form>
    </div>
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
