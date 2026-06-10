import { useEffect, useMemo, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Pencil, Upload, CopyPlus, Copy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/api/client';
import { YearPicker } from '@/components/YearPicker';
import {
  listBrands,
  listAudiences,
  listPublishers,
  listTemplates,
  type BrandRow,
  type AudienceRow,
  type Publisher,
  type MetricTemplate,
  type MetricField,
} from '@/api/taxonomy';
import {
  listPlacements,
  getPlacement,
  createPlacement,
  updatePlacement,
  deletePlacement,
  duplicatePlacement,
  clonePlacementYear,
  setPlacementKpis,
  setPlacementActuals,
  requestArtworkUploadUrl,
  type PlacementListItem,
  type PlacementKpi,
  type PlacementActual,
  type PlacementWriteBody,
} from '@/api/placements';

export const Route = createFileRoute('/app/clients/$clientSlug/placements')({
  component: PlacementsTab,
});

const MONTHS = [
  { n: 1, label: 'Jan' }, { n: 2, label: 'Feb' }, { n: 3, label: 'Mar' },
  { n: 4, label: 'Apr' }, { n: 5, label: 'May' }, { n: 6, label: 'Jun' },
  { n: 7, label: 'Jul' }, { n: 8, label: 'Aug' }, { n: 9, label: 'Sep' },
  { n: 10, label: 'Oct' }, { n: 11, label: 'Nov' }, { n: 12, label: 'Dec' },
] as const;

const OBJECTIVES = ['awareness', 'consideration', 'engagement'] as const;
const CURRENT_YEAR = new Date().getFullYear(); // default entry year for a placement with no actuals yet

// templateCode (lowercased enum name) → display label for the Type column.
const TEMPLATE_LABELS: Record<string, string> = {
  digitaldisplay: 'Digital display',
  edm: 'eDM',
  print: 'Print',
  sponsoredcontent: 'Sponsored content',
  education: 'Education',
};
const templateLabel = (code: string) => TEMPLATE_LABELS[code] ?? code;

const EDM_SUBCATEGORIES = [
  { value: 'solus', label: 'Solus' },
  { value: 'sponsored_content', label: 'Sponsored content' },
  { value: 'banner', label: 'Banner' },
] as const;

const EDUCATION_SUBCATEGORIES = [
  { value: 'module', label: 'Module (course)' },
  { value: 'article', label: 'Article' },
  { value: 'podcast_webinar', label: 'Podcast / Webinar' },
  { value: 'clinical_audit', label: 'Clinical audit' },
  { value: 'research_paper', label: 'Research paper' },
  { value: 'quiz', label: 'Quiz' },
] as const;

const SUBCATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  [...EDM_SUBCATEGORIES, ...EDUCATION_SUBCATEGORIES].map((s) => [s.value, s.label]),
);

/** "2025-03-01" → "Mar 2025"; null/empty → "". */
function formatIsoMonth(iso: string | null): string {
  if (!iso) return '';
  const [y, m] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]?.label ?? '?'} ${y}`;
}

/** The cell shown in the table's date column, per placement date shape. */
function datesSummary(p: PlacementListItem): string {
  if (p.startDate && p.endDate) return `${formatIsoMonth(p.startDate)} - ${formatIsoMonth(p.endDate)}`;
  if (p.startDate) return formatIsoMonth(p.startDate);
  return p.liveMonths.map((m) => MONTHS[m - 1]?.label).join(', ') || '—';
}

/** Inclusive list of {year, month} from one "YYYY-MM-DD" to another. */
function enumerateMonths(startIso: string, endIso: string): { year: number; month: number }[] {
  const [sy, sm] = startIso.split('-').map(Number);
  const [ey, em] = endIso.split('-').map(Number);
  if (!sy || !sm || !ey || !em) return [];
  const out: { year: number; month: number }[] = [];
  let y = sy;
  let m = sm;
  // Guard against an inverted range producing a runaway loop.
  let guard = 0;
  while ((y < ey || (y === ey && m <= em)) && guard < 600) {
    out.push({ year: y, month: m });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    guard += 1;
  }
  return out;
}

function PlacementsTab() {
  const { clientSlug } = Route.useParams();
  const queryClient = useQueryClient();
  // null = list view; 'new' = create form; otherwise the placement id being edited.
  const [editing, setEditing] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(CURRENT_YEAR);
  const yearInitialised = useRef(false);

  const { data, isLoading } = useQuery({
    queryKey: ['manage', 'clients', clientSlug, 'placements', selectedYear],
    queryFn: () => listPlacements(clientSlug, { year: selectedYear }),
  });
  const placements = data?.placements ?? [];
  const years = data?.years ?? [];

  // Land on the latest reporting year that has placements (once).
  useEffect(() => {
    if (!yearInitialised.current && years.length) {
      setSelectedYear(years[years.length - 1]);
      yearInitialised.current = true;
    }
  }, [years]);

  const { data: brands = [] } = useQuery({
    queryKey: ['manage', 'clients', clientSlug, 'brands'],
    queryFn: () => listBrands(clientSlug),
  });
  const { data: audiences = [] } = useQuery({
    queryKey: ['manage', 'clients', clientSlug, 'audiences'],
    queryFn: () => listAudiences(clientSlug),
  });
  const { data: publishers = [] } = useQuery({
    queryKey: ['manage', 'publishers'],
    queryFn: listPublishers,
  });
  const { data: templates = [] } = useQuery({
    queryKey: ['manage', 'templates'],
    queryFn: listTemplates,
  });

  const cloneYear = useMutation({
    mutationFn: () => clonePlacementYear(clientSlug, selectedYear, selectedYear + 1),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manage', 'clients', clientSlug, 'placements'] });
      setSelectedYear(selectedYear + 1);
    },
  });

  if (editing !== null) {
    return (
      <PlacementEditor
        clientSlug={clientSlug}
        placementId={editing === 'new' ? null : editing}
        selectedYear={selectedYear}
        brands={brands}
        audiences={audiences}
        publishers={publishers}
        templates={templates}
        onDone={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ph-charcoal/70">
          Media placements for the selected reporting year. Each year holds its own buys and costs;
          carry a year forward to start the next without rebuilding.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <YearPicker year={selectedYear} onChange={setSelectedYear} yearsWithData={years} />
          {placements.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={cloneYear.isPending}
              onClick={() => {
                if (
                  confirm(
                    `Carry ${selectedYear}'s placements into ${selectedYear + 1}? ` +
                      `Names, publishers, creative and KPI targets copy over; media/CPD cost and monthly data start blank.`,
                  )
                ) {
                  cloneYear.mutate();
                }
              }}
            >
              <CopyPlus className="h-4 w-4" />
              {cloneYear.isPending ? 'Copying…' : `Start ${selectedYear + 1}`}
            </Button>
          )}
          <Button type="button" size="sm" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" />
            New placement
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading && <p className="text-sm text-ph-charcoal/60">Loading…</p>}
          {!isLoading && placements.length === 0 && (
            <p className="text-sm text-ph-charcoal/60">
              No placements for {selectedYear} yet — create one
              {years.length > 0 ? ', or carry a previous year forward.' : '.'}
            </p>
          )}
          {placements.length > 0 && (
            <PlacementTable
              clientSlug={clientSlug}
              placements={placements}
              onEdit={(id) => setEditing(id)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PlacementTable({
  clientSlug,
  placements,
  onEdit,
}: {
  clientSlug: string;
  placements: PlacementListItem[];
  onEdit: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const del = useMutation({
    mutationFn: (id: string) => deletePlacement(clientSlug, id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['manage', 'clients', clientSlug, 'placements'] }),
  });
  const dup = useMutation({
    mutationFn: (id: string) => duplicatePlacement(clientSlug, id),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['manage', 'clients', clientSlug, 'placements'] });
      onEdit(created.id); // drop straight into the copy to set its send date
    },
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-ph-charcoal/10 text-xs uppercase tracking-wide text-ph-charcoal/60">
          <tr>
            <th className="py-2 pr-4 font-medium">Placement</th>
            <th className="py-2 pr-4 font-medium">Type</th>
            <th className="py-2 pr-4 font-medium">Brand</th>
            <th className="py-2 pr-4 font-medium">Audience</th>
            <th className="py-2 pr-4 font-medium">Publisher</th>
            <th className="py-2 pr-4 font-medium">When</th>
            <th className="py-2 pr-4 text-right font-medium">Media cost</th>
            <th className="py-2 text-right font-medium" />
          </tr>
        </thead>
        <tbody>
          {placements.map((p) => (
            <tr key={p.id} className="border-b border-ph-charcoal/5 last:border-0">
              <td className="py-2 pr-4 font-medium text-ph-charcoal">
                {p.name}
                {p.isBonus && <Tag>bonus</Tag>}
                {p.isCpdPackage && <Tag>CPD</Tag>}
              </td>
              <td className="py-2 pr-4 text-ph-charcoal/70">
                {templateLabel(p.templateCode)}
                {p.edmSubcategory && (
                  <span className="text-ph-charcoal/45"> · {SUBCATEGORY_LABELS[p.edmSubcategory] ?? p.edmSubcategory}</span>
                )}
                {p.educationSubcategory && (
                  <span className="text-ph-charcoal/45"> · {SUBCATEGORY_LABELS[p.educationSubcategory] ?? p.educationSubcategory}</span>
                )}
              </td>
              <td className="py-2 pr-4 text-ph-charcoal/70">{p.brandName}</td>
              <td className="py-2 pr-4 text-ph-charcoal/70">{p.audienceName}</td>
              <td className="py-2 pr-4 text-ph-charcoal/70">{p.publisherName}</td>
              <td className="py-2 pr-4 text-ph-charcoal/60">{datesSummary(p)}</td>
              <td className="py-2 pr-4 text-right tabular-nums text-ph-charcoal/80">
                {p.mediaCost.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })}
              </td>
              <td className="py-2 text-right whitespace-nowrap">
                <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(p.id)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  title="Duplicate"
                  disabled={dup.isPending}
                  onClick={() => dup.mutate(p.id)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={del.isPending}
                  onClick={() => {
                    if (confirm(`Delete placement “${p.name}”?`)) del.mutate(p.id);
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
  brandId: z.string().min(1, 'Pick a brand'),
  audienceId: z.string().min(1, 'Pick an audience'),
  publisherId: z.string().min(1, 'Pick a publisher'),
  templateId: z.string().min(1, 'Pick a template'),
  name: z.string().min(1, 'Name required'),
  objective: z.enum(OBJECTIVES),
  assetType: z.string().optional(),
  creativeCode: z.string().optional(),
  osCode: z.string().optional(),
  utmUrl: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  edmSubcategory: z.string().optional(),
  educationSubcategory: z.string().optional(),
  mediaCost: z.coerce.number().nonnegative('Must be ≥ 0'),
  plannedMediaCost: z.coerce.number().nonnegative('Must be ≥ 0').optional(),
  cpdInvestmentCost: z.coerce.number().nonnegative('Must be ≥ 0').optional(),
  isBonus: z.boolean(),
  isCpdPackage: z.boolean(),
  circulation: z.coerce.number().nonnegative('Must be ≥ 0').optional(),
  placementsCount: z.coerce.number().int().nonnegative('Must be ≥ 0').optional(),
});
type Values = z.infer<typeof schema>;

const BLANK: Values = {
  brandId: '', audienceId: '', publisherId: '', templateId: '', name: '',
  objective: 'awareness', assetType: '', creativeCode: '', osCode: '', utmUrl: '',
  startDate: '', endDate: '', edmSubcategory: '', educationSubcategory: '',
  mediaCost: 0, plannedMediaCost: undefined, cpdInvestmentCost: undefined, isBonus: false, isCpdPackage: false,
  circulation: undefined, placementsCount: undefined,
};

// Actuals can span years (education ranges), so the grid is keyed by
// year + month + metric.
const actualKey = (year: number, month: number, metric: string) => `${year}:${month}:${metric}`;

function PlacementEditor({
  clientSlug,
  placementId,
  selectedYear,
  brands,
  audiences,
  publishers,
  templates,
  onDone,
}: {
  clientSlug: string;
  placementId: string | null;
  selectedYear: number;
  brands: BrandRow[];
  audiences: AudienceRow[];
  publishers: Publisher[];
  templates: MetricTemplate[];
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = placementId !== null;

  const { data: detail } = useQuery({
    queryKey: ['manage', 'clients', clientSlug, 'placements', placementId],
    queryFn: () => getPlacement(clientSlug, placementId!),
    enabled: isEdit,
  });

  // The placement's fixed reporting year (its year when editing; the tab's year for a new one).
  const placementYear = detail?.year ?? selectedYear;

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: BLANK });
  const [liveMonths, setLiveMonths] = useState<number[]>([]);
  const [kpiInputs, setKpiInputs] = useState<Record<string, string>>({});
  const [actualInputs, setActualInputs] = useState<Record<string, string>>({});
  const [artworkKey, setArtworkKey] = useState<string | null>(null);
  const [artworkPreview, setArtworkPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Prefill scalar fields, live months, KPI targets and artwork when detail loads.
  useEffect(() => {
    if (!detail) return;
    form.reset({
      brandId: detail.brandId,
      audienceId: detail.audienceId,
      publisherId: detail.publisherId,
      templateId: detail.templateId,
      name: detail.name,
      objective: (OBJECTIVES as readonly string[]).includes(detail.objective)
        ? (detail.objective as (typeof OBJECTIVES)[number])
        : 'awareness',
      assetType: detail.assetType ?? '',
      creativeCode: detail.creativeCode ?? '',
      osCode: detail.osCode ?? '',
      utmUrl: detail.utmUrl ?? '',
      startDate: detail.startDate ?? '',
      endDate: detail.endDate ?? '',
      edmSubcategory: detail.edmSubcategory ?? '',
      educationSubcategory: detail.educationSubcategory ?? '',
      mediaCost: detail.mediaCost,
      plannedMediaCost: detail.plannedMediaCost ?? undefined,
      cpdInvestmentCost: detail.cpdInvestmentCost ?? undefined,
      isBonus: detail.isBonus,
      isCpdPackage: detail.isCpdPackage,
      circulation: detail.circulation ?? undefined,
      placementsCount: detail.placementsCount ?? undefined,
    });
    setLiveMonths(detail.liveMonths);
    setKpiInputs(Object.fromEntries(detail.kpis.map((k) => [k.metricKey, String(k.targetValue)])));
    setArtworkKey(detail.artworkUrl);
    setArtworkPreview(null);
  }, [detail, form]);

  // Seed the actuals grid from the placement's saved actuals (across all years,
  // so an education range's full history shows).
  useEffect(() => {
    if (!detail) return;
    const next: Record<string, string> = {};
    for (const a of detail.actuals) {
      next[actualKey(a.year, a.month, a.metricKey)] = String(a.value);
    }
    setActualInputs(next);
  }, [detail]);

  const selectedPublisherId = form.watch('publisherId');
  const selectedTemplateId = form.watch('templateId');

  const availableTemplates = useMemo(() => {
    const publisher = publishers.find((p) => p.id === selectedPublisherId);
    if (!publisher) return [];
    const ids = new Set(publisher.templates.map((t) => t.templateId));
    return templates.filter((t) => ids.has(t.id));
  }, [publishers, templates, selectedPublisherId]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId],
  );
  const isPrint = selectedTemplate?.code === 'print';
  const isEdm = selectedTemplate?.code === 'edm';
  const isEducation = selectedTemplate?.code === 'education';
  // Only non-calculated fields are stored — calculated ones (CTR, CPM…) are derived in views.
  const storableFields: MetricField[] = useMemo(
    () => (selectedTemplate?.fields ?? []).filter((f) => !f.isCalculated),
    [selectedTemplate],
  );

  const watchStart = form.watch('startDate');
  const watchEnd = form.watch('endDate');

  // The (year, month) columns of the actuals grid, per date shape: education
  // spans its range; eDM is the send month; others are the live months in the
  // placement's year. Months that already have saved actuals are always included
  // so legacy data stays editable.
  const periods = useMemo(() => {
    const map = new Map<string, { year: number; month: number }>();
    const add = (y: number, m: number) => map.set(`${y}:${m}`, { year: y, month: m });
    if (isEducation && watchStart && watchEnd) {
      for (const p of enumerateMonths(watchStart, watchEnd)) add(p.year, p.month);
    } else if (isEdm) {
      if (watchStart) {
        const [y, m] = watchStart.split('-').map(Number);
        if (y && m) add(y, m);
      }
    } else {
      for (const m of liveMonths) add(placementYear, m);
    }
    for (const a of detail?.actuals ?? []) add(a.year, a.month);
    return [...map.values()].sort((a, b) => a.year - b.year || a.month - b.month);
  }, [isEducation, isEdm, watchStart, watchEnd, liveMonths, placementYear, detail]);

  const periodsSpanYears = useMemo(
    () => new Set(periods.map((p) => p.year)).size > 1,
    [periods],
  );

  // Existing notes, preserved on actuals upsert so the grid doesn't wipe them.
  const existingNotes = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const a of detail?.actuals ?? []) map[actualKey(a.year, a.month, a.metricKey)] = a.note;
    return map;
  }, [detail]);

  const toBody = (v: Values): PlacementWriteBody => ({
    brandId: v.brandId,
    audienceId: v.audienceId,
    publisherId: v.publisherId,
    templateId: v.templateId,
    year: placementYear,
    name: v.name.trim(),
    objective: v.objective,
    assetType: v.assetType?.trim() || null,
    creativeCode: v.creativeCode?.trim() || null,
    osCode: v.osCode?.trim() || null,
    utmUrl: v.utmUrl?.trim() || null,
    artworkUrl: artworkKey,
    // Date shape + sub-category follow the template; the API also normalises,
    // but sending the right shape keeps the payload honest.
    liveMonths: isEdm || isEducation ? [] : liveMonths,
    startDate: isEdm || isEducation ? v.startDate || null : null,
    endDate: isEducation ? v.endDate || null : null,
    edmSubcategory: isEdm ? v.edmSubcategory || null : null,
    educationSubcategory: isEducation ? v.educationSubcategory || null : null,
    mediaCost: v.mediaCost,
    plannedMediaCost: v.plannedMediaCost ?? null,
    cpdInvestmentCost: v.cpdInvestmentCost ?? null,
    isBonus: v.isBonus,
    isCpdPackage: v.isCpdPackage,
    circulation: isPrint ? v.circulation ?? null : null,
    placementsCount: isPrint ? v.placementsCount ?? null : null,
  });

  const collectKpis = (): PlacementKpi[] =>
    storableFields
      .map((f) => ({ metricKey: f.key, raw: kpiInputs[f.key] }))
      .filter((x) => x.raw !== undefined && x.raw.trim() !== '')
      .map((x) => ({ metricKey: x.metricKey, targetValue: Number(x.raw) }));

  const collectActuals = (): PlacementActual[] => {
    // Every non-empty cell in the grid (keys are `${year}:${month}:${metric}`).
    // The API upserts by (year, month, metric).
    const rows: PlacementActual[] = [];
    for (const [key, raw] of Object.entries(actualInputs)) {
      if (raw === undefined || raw.trim() === '') continue;
      const [yearStr, monthStr, ...rest] = key.split(':');
      const year = Number(yearStr);
      const month = Number(monthStr);
      const metricKey = rest.join(':');
      rows.push({
        year,
        month,
        metricKey,
        value: Number(raw),
        note: existingNotes[actualKey(year, month, metricKey)] ?? null,
      });
    }
    return rows;
  };

  const invalidateList = () =>
    queryClient.invalidateQueries({ queryKey: ['manage', 'clients', clientSlug, 'placements'] });

  const create = useMutation({
    mutationFn: (v: Values) => createPlacement(clientSlug, toBody(v)),
    onSuccess: () => {
      invalidateList();
      onDone();
    },
  });

  const update = useMutation({
    mutationFn: async (v: Values) => {
      await updatePlacement(clientSlug, placementId!, toBody(v));
      await setPlacementKpis(clientSlug, placementId!, collectKpis());
      await setPlacementActuals(clientSlug, placementId!, collectActuals());
    },
    onSuccess: () => {
      invalidateList();
      // Refetch detail so the form resyncs to the persisted state (stay open for iterative editing).
      queryClient.invalidateQueries({
        queryKey: ['manage', 'clients', clientSlug, 'placements', placementId],
      });
    },
  });

  const active = isEdit ? update : create;
  const error = active.error instanceof ApiError ? active.error.message : null;

  async function handleUpload(file: File) {
    if (!placementId) return;
    setUploading(true);
    setUploadError(null);
    try {
      const { uploadUrl, objectKey } = await requestArtworkUploadUrl(clientSlug, placementId, {
        fileName: file.name,
        contentType: file.type,
      });
      const put = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      if (!put.ok) throw new Error('Upload to storage failed');
      setArtworkKey(objectKey);
      setArtworkPreview(URL.createObjectURL(file));
    } catch (e) {
      setUploadError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-baseline gap-2 text-base font-semibold text-ph-charcoal">
          {isEdit ? 'Edit placement' : 'New placement'}
          <span className="text-sm font-normal text-ph-charcoal/50">· {placementYear}</span>
        </h2>
        <div className="flex items-center gap-3">
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>
            ← Back to list
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form
            onSubmit={form.handleSubmit((v) => active.mutate(v))}
            className="grid grid-cols-1 gap-3 sm:grid-cols-3"
          >
            <Select label="Brand" {...form.register('brandId')} error={form.formState.errors.brandId?.message}>
              <option value="">—</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>

            <Select label="Audience" {...form.register('audienceId')} error={form.formState.errors.audienceId?.message}>
              <option value="">—</option>
              {audiences.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>

            <Select label="Objective" {...form.register('objective')} error={form.formState.errors.objective?.message}>
              {OBJECTIVES.map((o) => <option key={o} value={o}>{o}</option>)}
            </Select>

            <Select
              label="Publisher"
              {...form.register('publisherId')}
              error={form.formState.errors.publisherId?.message}
            >
              <option value="">—</option>
              {publishers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>

            <Select
              label="Template"
              {...form.register('templateId')}
              error={form.formState.errors.templateId?.message}
              disabled={!selectedPublisherId}
            >
              <option value="">—</option>
              {availableTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>

            <LabeledField label="Name" error={form.formState.errors.name?.message}>
              <Input {...form.register('name')} placeholder="e.g. AJP Solus eDM — Pharmacists" />
            </LabeledField>

            <LabeledField label="Asset type">
              <Input {...form.register('assetType')} placeholder="banner, solus_edm, dps…" />
            </LabeledField>
            <LabeledField label="Creative code">
              <Input {...form.register('creativeCode')} placeholder="RB0686" />
            </LabeledField>
            <LabeledField label="OS code">
              <Input {...form.register('osCode')} placeholder="RT-M-Zv9qDM" />
            </LabeledField>

            <LabeledField label="Media cost (AUD)" error={form.formState.errors.mediaCost?.message}>
              <Input type="number" step="any" {...form.register('mediaCost')} />
            </LabeledField>
            <LabeledField label="Planned media cost (AUD)" error={form.formState.errors.plannedMediaCost?.message}>
              <Input type="number" step="any" {...form.register('plannedMediaCost')} />
            </LabeledField>
            <LabeledField label="CPD investment (AUD)" error={form.formState.errors.cpdInvestmentCost?.message}>
              <Input type="number" step="any" {...form.register('cpdInvestmentCost')} />
            </LabeledField>
            <LabeledField label="UTM URL">
              <Input {...form.register('utmUrl')} placeholder="https://…" />
            </LabeledField>

            {isPrint && (
              <>
                <LabeledField label="Circulation" error={form.formState.errors.circulation?.message}>
                  <Input type="number" step="any" {...form.register('circulation')} />
                </LabeledField>
                <LabeledField label="Placements count" error={form.formState.errors.placementsCount?.message}>
                  <Input type="number" step="1" {...form.register('placementsCount')} />
                </LabeledField>
              </>
            )}

            {isEdm && (
              <>
                <LabeledField label="Send date">
                  <Input type="date" {...form.register('startDate')} />
                </LabeledField>
                <Select label="eDM type" {...form.register('edmSubcategory')}>
                  <option value="">—</option>
                  {EDM_SUBCATEGORIES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </Select>
              </>
            )}

            {isEducation && (
              <>
                <LabeledField label="Start date">
                  <Input type="date" {...form.register('startDate')} />
                </LabeledField>
                <LabeledField label="End date">
                  <Input type="date" {...form.register('endDate')} />
                </LabeledField>
                <Select label="Education type" {...form.register('educationSubcategory')}>
                  <option value="">—</option>
                  {EDUCATION_SUBCATEGORIES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </Select>
              </>
            )}

            <div className="col-span-full flex flex-wrap items-center gap-4">
              <Checkbox label="Bonus placement" {...form.register('isBonus')} />
              <Checkbox label="Part of CPD package" {...form.register('isCpdPackage')} />
            </div>

            {!isEdm && !isEducation && (
              <div className="col-span-full">
                <label className="text-xs font-medium text-ph-charcoal">Live months</label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {MONTHS.map((m) => {
                    const on = liveMonths.includes(m.n);
                    return (
                      <button
                        key={m.n}
                        type="button"
                        onClick={() =>
                          setLiveMonths((prev) =>
                            prev.includes(m.n) ? prev.filter((x) => x !== m.n) : [...prev, m.n].sort((a, b) => a - b),
                          )
                        }
                        className={
                          'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ' +
                          (on
                            ? 'border-ph-purple bg-ph-purple text-white'
                            : 'border-ph-charcoal/20 text-ph-charcoal/70 hover:border-ph-purple')
                        }
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {!isEdit && (
              <p className="col-span-full text-xs text-ph-charcoal/60">
                Save the placement first — KPI targets seed from baselines, then you can enter actuals
                and upload artwork.
              </p>
            )}

            {isEdit && (
              <>
                <KpiSection
                  fields={storableFields}
                  values={kpiInputs}
                  onChange={(key, value) => setKpiInputs((prev) => ({ ...prev, [key]: value }))}
                />

                <ActualsSection
                  fields={storableFields}
                  periods={periods}
                  spanYears={periodsSpanYears}
                  values={actualInputs}
                  onChange={(year, month, metric, value) =>
                    setActualInputs((prev) => ({ ...prev, [actualKey(year, month, metric)]: value }))
                  }
                />

                <ArtworkSection
                  previewUrl={artworkPreview ?? detail?.artworkViewUrl ?? null}
                  objectKey={artworkKey}
                  uploading={uploading}
                  error={uploadError}
                  onPick={handleUpload}
                  onClear={() => {
                    setArtworkKey(null);
                    setArtworkPreview(null);
                  }}
                />
              </>
            )}

            <div className="col-span-full flex items-center gap-2 border-t border-ph-charcoal/10 pt-4">
              <Button type="submit" size="sm" disabled={active.isPending}>
                {active.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create placement'}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={onDone}>
                {isEdit ? 'Done' : 'Cancel'}
              </Button>
              {error && <span className="text-xs text-red-600">{error}</span>}
              {isEdit && update.isSuccess && !update.isPending && (
                <span className="text-xs text-green-700">Saved ✓</span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiSection({
  fields,
  values,
  onChange,
}: {
  fields: MetricField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="col-span-full">
      <h3 className="text-sm font-semibold text-ph-charcoal">KPI targets</h3>
      {fields.length === 0 ? (
        <p className="mt-1 text-xs text-ph-charcoal/60">This template has no stored metrics.</p>
      ) : (
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {fields.map((f) => (
            <LabeledField key={f.key} label={f.unit ? `${f.label} (${f.unit})` : f.label}>
              <Input
                type="number"
                step="any"
                value={values[f.key] ?? ''}
                placeholder="—"
                onChange={(e) => onChange(f.key, e.target.value)}
              />
            </LabeledField>
          ))}
        </div>
      )}
    </div>
  );
}

function ActualsSection({
  fields,
  periods,
  spanYears,
  values,
  onChange,
}: {
  fields: MetricField[];
  periods: { year: number; month: number }[];
  spanYears: boolean;
  values: Record<string, string>;
  onChange: (year: number, month: number, metric: string, value: string) => void;
}) {
  const colLabel = (p: { year: number; month: number }) =>
    spanYears ? `${MONTHS[p.month - 1]?.label} '${String(p.year).slice(2)}` : MONTHS[p.month - 1]?.label;

  return (
    <div className="col-span-full">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ph-charcoal">Monthly actuals</h3>
      </div>

      {fields.length === 0 ? (
        <p className="mt-1 text-xs text-ph-charcoal/60">This template has no stored metrics.</p>
      ) : periods.length === 0 ? (
        <p className="mt-1 text-xs text-ph-charcoal/60">
          Set the placement&apos;s dates above to enter actuals.
        </p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="text-sm">
            <thead className="text-xs uppercase tracking-wide text-ph-charcoal/60">
              <tr>
                <th className="py-1 pr-3 text-left font-medium">Metric</th>
                {periods.map((p) => (
                  <th key={`${p.year}:${p.month}`} className="px-1 py-1 text-center font-medium">
                    {colLabel(p)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fields.map((f) => (
                <tr key={f.key}>
                  <td className="py-1 pr-3 font-medium text-ph-charcoal/80">
                    {f.unit ? `${f.label} (${f.unit})` : f.label}
                  </td>
                  {periods.map((p) => (
                    <td key={`${p.year}:${p.month}`} className="px-1 py-1">
                      <input
                        type="number"
                        step="any"
                        value={values[`${p.year}:${p.month}:${f.key}`] ?? ''}
                        placeholder="—"
                        onChange={(e) => onChange(p.year, p.month, f.key, e.target.value)}
                        className="h-8 w-24 rounded-md border border-ph-charcoal/20 bg-white px-2 text-sm text-ph-charcoal focus:border-ph-purple focus:outline-none"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ArtworkSection({
  previewUrl,
  objectKey,
  uploading,
  error,
  onPick,
  onClear,
}: {
  previewUrl: string | null;
  objectKey: string | null;
  uploading: boolean;
  error: string | null;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="col-span-full">
      <h3 className="text-sm font-semibold text-ph-charcoal">Artwork</h3>
      <div className="mt-2 flex items-start gap-4">
        <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-md border border-ph-charcoal/15 bg-ph-charcoal/5">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Placement artwork"
              className="h-full w-full object-contain"
              onError={(e) => {
                (e.currentTarget.style.display = 'none');
              }}
            />
          ) : (
            <span className="text-xs text-ph-charcoal/40">No artwork</span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onPick(file);
              e.target.value = '';
            }}
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              {uploading ? 'Uploading…' : 'Upload artwork'}
            </Button>
            {objectKey && (
              <Button type="button" size="sm" variant="ghost" onClick={onClear}>
                Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-ph-charcoal/50">PNG, JPEG, WebP, GIF or PDF. Saved when you save the placement.</p>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-2 rounded bg-ph-charcoal/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ph-charcoal/70">
      {children}
    </span>
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

const Checkbox = ({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => (
  <label className="flex items-center gap-2 text-sm text-ph-charcoal">
    <input type="checkbox" {...props} className="h-4 w-4 rounded border-ph-charcoal/30" />
    {label}
  </label>
);
