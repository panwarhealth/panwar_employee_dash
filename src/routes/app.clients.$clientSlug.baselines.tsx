import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Pencil, Check, X, MoreHorizontal } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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
          {formState === null && (
            <Button type="button" size="sm" onClick={() => setFormState({ mode: 'new' })}>
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
          editing={formState.mode === 'edit' ? formState.baseline : null}
          preset={formState.mode === 'new' ? formState.preset : undefined}
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
            <TargetMatrix
              clientSlug={clientSlug}
              targets={targets}
              templates={templates}
              onEditDetails={(b) => setFormState({ mode: 'edit', baseline: b })}
              onAddCell={(preset) => setFormState({ mode: 'new', preset })}
            />
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

/**
 * Clicks targets are quoted as impressions x CTR, so editing either side
 * keeps the clicks target in sync (when the row has all three). Editing
 * clicks directly is an explicit override - nothing recomputes from it.
 */
function clicksRecalc(
  edited: Baseline,
  newValue: number,
  siblings: Baseline[],
): { target: Baseline; value: number } | null {
  if (edited.metricKey !== 'ctr' && edited.metricKey !== 'impressions') return null;
  const clicksTarget = siblings.find((s) => s.metricKey === 'clicks');
  if (!clicksTarget) return null;
  const ctr =
    edited.metricKey === 'ctr' ? newValue : siblings.find((s) => s.metricKey === 'ctr')?.value;
  const impressions =
    edited.metricKey === 'impressions'
      ? newValue
      : siblings.find((s) => s.metricKey === 'impressions')?.value;
  if (ctr === undefined || impressions === undefined) return null;
  return { target: clicksTarget, value: Math.round(impressions * ctr) };
}

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

/**
 * Spreadsheet-style matrix: one table, publishers as group-header rows, a row
 * per template, metric columns. Values edit inline (click → input); empty
 * cells offer "+" when the template declares that metric. The form handles
 * creation and detail edits (note, rate calculator, delete).
 */
function TargetMatrix({
  clientSlug,
  targets,
  templates,
  onEditDetails,
  onAddCell,
}: {
  clientSlug: string;
  targets: Baseline[];
  templates: MetricTemplate[];
  onEditDetails: (b: Baseline) => void;
  onAddCell: (preset: CellPreset) => void;
}) {
  // Which metrics each template declares - gates the "+" on empty cells.
  const templateFields = useMemo(() => {
    const set = new Set<string>();
    for (const t of templates) {
      for (const f of t.fields) set.add(`${t.id}:${f.key}`);
    }
    return set;
  }, [templates]);

  // Columns: every metric present this year, volume → engagements → rates.
  const colKeys = useMemo(() => {
    const keys = [...new Set(targets.map((t) => t.metricKey))];
    return keys.sort((a, z) => keyOrder(a) - keyOrder(z) || a.localeCompare(z));
  }, [targets]);

  const groups = useMemo(() => {
    const byPublisher = new Map<string, Baseline[]>();
    for (const b of targets) {
      const list = byPublisher.get(b.publisherId);
      if (list) list.push(b);
      else byPublisher.set(b.publisherId, [b]);
    }
    return [...byPublisher.values()]
      .map((rows) => {
        const byTemplate = new Map<string, Baseline[]>();
        for (const b of rows) {
          const list = byTemplate.get(b.templateId);
          if (list) list.push(b);
          else byTemplate.set(b.templateId, [b]);
        }
        const templateGroups = [...byTemplate.values()]
          .map((trs) => ({
            templateId: trs[0].templateId,
            label: templateLabel(trs[0].templateCode),
            rows: [...trs].sort(
              (a, z) =>
                keyOrder(a.metricKey) - keyOrder(z.metricKey) ||
                a.metricKey.localeCompare(z.metricKey),
            ),
          }))
          .sort((a, z) => a.label.localeCompare(z.label));
        return {
          publisherId: rows[0].publisherId,
          publisherName: rows[0].publisherName,
          templates: templateGroups,
        };
      })
      .sort((a, z) => a.publisherName.localeCompare(z.publisherName));
  }, [targets]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ph-charcoal/10 text-xs uppercase tracking-wide text-ph-charcoal/60">
            <th className="w-56 py-2 pr-4 text-left font-medium">Publisher / type</th>
            {colKeys.map((k) => (
              <th key={k} className="px-3 py-2 text-right font-medium">
                {titleCaseKey(k)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((pub) => (
            <Fragment key={pub.publisherId}>
              <tr className="bg-ph-charcoal/[0.03]">
                <td
                  colSpan={colKeys.length + 1}
                  className="py-1.5 pl-2 pr-4 font-semibold text-ph-charcoal"
                >
                  {pub.publisherName}
                </td>
              </tr>
              {pub.templates.map((t) => (
                <tr key={t.templateId} className="border-b border-ph-charcoal/5">
                  <td className="py-1 pl-5 pr-4 text-xs uppercase tracking-wide text-ph-charcoal/50">
                    {t.label}
                  </td>
                  {colKeys.map((k) => {
                    const b = t.rows.find((r) => r.metricKey === k);
                    if (b) {
                      return (
                        <td key={k} className="px-3 py-1 text-right">
                          <EditableValue
                            clientSlug={clientSlug}
                            baseline={b}
                            siblings={t.rows}
                            onEditDetails={onEditDetails}
                          />
                        </td>
                      );
                    }
                    const canAdd = templateFields.has(`${t.templateId}:${k}`);
                    return (
                      <td key={k} className="px-3 py-1 text-right">
                        {canAdd ? (
                          <button
                            type="button"
                            title={`Add ${titleCaseKey(k)} target`}
                            onClick={() =>
                              onAddCell({
                                publisherId: pub.publisherId,
                                templateId: t.templateId,
                                metricKey: k,
                              })
                            }
                            className="rounded p-1 text-ph-charcoal/20 hover:bg-ph-purple/5 hover:text-ph-purple"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <span className="text-ph-charcoal/15">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Inline cell editor: the value is a click target; editing swaps in a number
 * input with save / cancel / details. Rates are edited in percent (stored as
 * a fraction). Enter saves, Escape cancels.
 */
function EditableValue({
  clientSlug,
  baseline,
  siblings,
  onEditDetails,
}: {
  clientSlug: string;
  baseline: Baseline;
  siblings: Baseline[];
  onEditDetails: (b: Baseline) => void;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const rate = isRateKey(baseline.metricKey);

  const save = useMutation({
    mutationFn: async (value: number) => {
      await updateBaseline(clientSlug, baseline.id, {
        publisherId: baseline.publisherId,
        templateId: baseline.templateId,
        year: baseline.year,
        metricKey: baseline.metricKey,
        value,
        note: baseline.note ?? undefined,
      });
      const recalc = clicksRecalc(baseline, value, siblings);
      if (recalc) {
        await updateBaseline(clientSlug, recalc.target.id, {
          publisherId: recalc.target.publisherId,
          templateId: recalc.target.templateId,
          year: recalc.target.year,
          metricKey: recalc.target.metricKey,
          value: recalc.value,
          note: recalc.target.note ?? undefined,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manage', 'clients', clientSlug, 'baselines'] });
      setEditing(false);
    },
  });

  if (!editing) {
    return (
      <button
        type="button"
        title={baseline.note ? `${baseline.note} - click to edit` : 'Click to edit'}
        onClick={() => {
          setText(String(rate ? parseFloat((baseline.value * 100).toFixed(6)) : baseline.value));
          setEditing(true);
        }}
        className="group inline-flex items-center gap-1 rounded px-1.5 py-0.5 tabular-nums text-ph-charcoal hover:bg-ph-purple/5"
      >
        {formatTarget(baseline)}
        <Pencil className="h-3 w-3 text-transparent group-hover:text-ph-purple/60" />
      </button>
    );
  }

  const commit = () => {
    const n = Number(text);
    if (!text.trim() || !Number.isFinite(n) || n < 0) return;
    save.mutate(rate ? n / 100 : n);
  };

  return (
    <span className="inline-flex items-center gap-1">
      <Input
        autoFocus
        type="number"
        step="any"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          }
          if (e.key === 'Escape') setEditing(false);
        }}
        className="h-7 w-24 text-right text-sm"
      />
      {rate && <span className="text-xs text-ph-charcoal/50">%</span>}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        title="Save"
        disabled={save.isPending}
        onClick={commit}
      >
        <Check className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        title="Cancel"
        onClick={() => setEditing(false)}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        title="Details (note, rate calculator, delete)"
        onClick={() => {
          setEditing(false);
          onEditDetails(baseline);
        }}
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </Button>
    </span>
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
  const [savedId, setSavedId] = useState<string | null>(editing?.id ?? null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: defaults(editing),
  });

  useEffect(() => {
    setSavedId(editing?.id ?? null);
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
      if (savedId) await updateBaseline(clientSlug, savedId, body);
      else {
        const created = await createBaseline(clientSlug, body);
        setSavedId(created.id);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['manage', 'clients', clientSlug, 'baselines'] }),
  });

  const del = useMutation({
    mutationFn: () => deleteBaseline(clientSlug, savedId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manage', 'clients', clientSlug, 'baselines'] });
      onDone();
    },
  });

  const error = mutation.error instanceof ApiError ? mutation.error.message : null;

  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(saveTimer.current), []);
  const triggerSave = () => {
    if (mutation.isPending) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => form.handleSubmit((v) => mutation.mutate(v))(), 500);
  };
  const flushDone = () => {
    clearTimeout(saveTimer.current);
    form.handleSubmit((v) => mutation.mutate(v))();
    onDone();
  };
  const selectSave = (name: Parameters<typeof form.register>[0]) => {
    const r = form.register(name);
    return {
      ...r,
      onChange: (e: React.ChangeEvent<HTMLSelectElement>) => {
        void r.onChange(e);
        triggerSave();
      },
    };
  };

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
          {savedId ? 'Edit KPI target' : 'New KPI target'}
          <span className="text-sm font-normal text-ph-charcoal/50">· {formYear}</span>
        </h2>
        <form onBlur={triggerSave} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select
            label="Publisher"
            {...selectSave('publisherId')}
            error={form.formState.errors.publisherId?.message}
          >
            <option value="">—</option>
            {publishers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>

          <Select
            label="Template"
            {...selectSave('templateId')}
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
            {...selectSave('metricKey')}
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
            onUse={(v) => {
              form.setValue('value', v, { shouldValidate: true });
              triggerSave();
            }}
          />

          <div className="col-span-full flex items-center gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={flushDone}>Done</Button>
            {mutation.isPending && <span className="text-xs text-ph-charcoal/50">Saving…</span>}
            {!mutation.isPending && mutation.isSuccess && <span className="text-xs text-green-700">Saved ✓</span>}
            {!savedId && <span className="text-xs text-ph-charcoal/45">Pick publisher, template, metric &amp; value to save</span>}
            {error && <span className="text-xs text-red-600">{error}</span>}
            {savedId && (
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
