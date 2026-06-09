import { useEffect, useMemo, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/api/client';
import { YearPicker } from '@/components/YearPicker';
import { EducationBarChart, EducationLegend, PALETTE } from '@/components/education/EducationBarChart';
import {
  listEducationPages,
  getEducationPage,
  createEducationPage,
  updateEducationPage,
  deleteEducationPage,
  createEducationChart,
  updateEducationChart,
  deleteEducationChart,
  createEducationSeries,
  updateEducationSeries,
  deleteEducationSeries,
  setEducationSeriesData,
  createEducationAnnotation,
  updateEducationAnnotation,
  deleteEducationAnnotation,
  type EducationPageTree,
  type EducationChart as EduChart,
  type EducationSeries as EduSeries,
} from '@/api/education';

export const Route = createFileRoute('/app/clients/$clientSlug/education')({
  component: EducationTab,
});

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CURRENT_YEAR = new Date().getFullYear();

function EducationTab() {
  const { clientSlug } = Route.useParams();
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: pages = [], isLoading } = useQuery({
    queryKey: ['manage', 'education', clientSlug, 'pages'],
    queryFn: () => listEducationPages(clientSlug),
  });

  // Default to the first page once loaded.
  useEffect(() => {
    if (selectedPageId === null && pages.length > 0) setSelectedPageId(pages[0].id);
  }, [pages, selectedPageId]);

  const createPage = useMutation({
    mutationFn: (name: string) => createEducationPage(clientSlug, { name }),
    onSuccess: (tree) => {
      queryClient.invalidateQueries({ queryKey: ['manage', 'education', clientSlug, 'pages'] });
      setSelectedPageId(tree.page.id);
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ph-charcoal/70">
        Build named education pages (e.g. "Pharmacy Education") of completion bar charts. Add as many
        charts as you like; each chart has its own modules (bars) and monthly completions. Click a bar
        to add a note that floats above it on the client dashboard.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {pages.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSelectedPageId(p.id)}
            className={
              'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ' +
              (p.id === selectedPageId
                ? 'border-ph-purple bg-ph-purple text-white'
                : 'border-ph-charcoal/20 text-ph-charcoal/70 hover:border-ph-purple')
            }
          >
            {p.name}
          </button>
        ))}
        <NewPageButton onCreate={(name) => createPage.mutate(name)} pending={createPage.isPending} />
      </div>

      {isLoading && <p className="text-sm text-ph-charcoal/60">Loading…</p>}
      {!isLoading && pages.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-ph-charcoal/60">No education pages yet — create the first one above.</p>
          </CardContent>
        </Card>
      )}

      {selectedPageId && <PageEditor clientSlug={clientSlug} pageId={selectedPageId} onDeleted={() => setSelectedPageId(null)} />}
    </div>
  );
}

function NewPageButton({ onCreate, pending }: { onCreate: (name: string) => void; pending: boolean }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  if (!adding) {
    return (
      <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(true)}>
        <Plus className="h-4 w-4" />
        New page
      </Button>
    );
  }
  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) {
          onCreate(name.trim());
          setName('');
          setAdding(false);
        }
      }}
    >
      <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Page name" className="h-8 w-44" />
      <Button type="submit" size="sm" disabled={pending}>Add</Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
    </form>
  );
}

function PageEditor({ clientSlug, pageId, onDeleted }: { clientSlug: string; pageId: string; onDeleted: () => void }) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['manage', 'education', clientSlug, 'page', pageId] });
    queryClient.invalidateQueries({ queryKey: ['manage', 'education', clientSlug, 'pages'] });
  };

  const { data: tree, isLoading } = useQuery({
    queryKey: ['manage', 'education', clientSlug, 'page', pageId],
    queryFn: () => getEducationPage(clientSlug, pageId),
  });

  const renamePage = useMutation({
    mutationFn: (name: string) => updateEducationPage(clientSlug, pageId, { name }),
    onSuccess: invalidate,
  });
  const removePage = useMutation({
    mutationFn: () => deleteEducationPage(clientSlug, pageId),
    onSuccess: () => {
      invalidate();
      onDeleted();
    },
  });
  const addChart = useMutation({
    mutationFn: (title: string) => createEducationChart(clientSlug, pageId, { title }),
    onSuccess: invalidate,
  });

  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState('');
  useEffect(() => {
    if (tree) setName(tree.page.name);
  }, [tree]);

  // One shared year for the whole page — drives every chart's entry grid.
  const yearsWithData = useMemo(() => {
    const set = new Set<number>();
    tree?.charts.forEach((c) => c.series.forEach((s) => s.points.forEach((p) => set.add(p.year))));
    return [...set].sort((a, b) => a - b);
  }, [tree]);

  const [dataYear, setDataYear] = useState<number>(CURRENT_YEAR);
  const yearInitialised = useRef(false);
  useEffect(() => {
    if (!yearInitialised.current && yearsWithData.length) {
      setDataYear(yearsWithData[yearsWithData.length - 1]);
      yearInitialised.current = true;
    }
  }, [yearsWithData]);

  if (isLoading || !tree) return <p className="text-sm text-ph-charcoal/60">Loading…</p>;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3 border-t border-ph-charcoal/10 pt-4">
        {editingName ? (
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) renamePage.mutate(name.trim());
              setEditingName(false);
            }}
          >
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 w-56" autoFocus />
            <Button type="submit" size="sm">Save</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditingName(false)}>Cancel</Button>
          </form>
        ) : (
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ph-charcoal">
            {tree.page.name}
            <button type="button" onClick={() => setEditingName(true)} className="text-ph-charcoal/40 hover:text-ph-purple">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </h2>
        )}
        <div className="flex items-center gap-2">
          <YearPicker year={dataYear} onChange={setDataYear} yearsWithData={yearsWithData} />
          <AddChartButton onCreate={(t) => addChart.mutate(t)} pending={addChart.isPending} />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              if (confirm(`Delete page "${tree.page.name}" and all its charts?`)) removePage.mutate();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {tree.charts.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-ph-charcoal/60">No charts on this page yet — add one above.</p>
          </CardContent>
        </Card>
      )}

      {tree.charts.map((chart) => (
        <ChartEditor
          key={chart.id}
          clientSlug={clientSlug}
          chart={chart}
          tree={tree}
          dataYear={dataYear}
          onChanged={invalidate}
        />
      ))}
    </div>
  );
}

function AddChartButton({ onCreate, pending }: { onCreate: (title: string) => void; pending: boolean }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  if (!adding) {
    return (
      <Button type="button" size="sm" onClick={() => setAdding(true)}>
        <Plus className="h-4 w-4" />
        Add chart
      </Button>
    );
  }
  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim()) {
          onCreate(title.trim());
          setTitle('');
          setAdding(false);
        }
      }}
    >
      <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Chart title" className="h-8 w-56" />
      <Button type="submit" size="sm" disabled={pending}>Add</Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
    </form>
  );
}

interface AnnotationTarget {
  seriesId: string;
  year: number;
  month: number;
  // present when editing an existing annotation
  annotationId?: string;
  text?: string;
}

function ChartEditor({
  clientSlug,
  chart,
  tree,
  dataYear,
  onChanged,
}: {
  clientSlug: string;
  chart: EduChart;
  tree: EducationPageTree;
  dataYear: number;
  onChanged: () => void;
}) {
  const mut = <T,>(fn: () => Promise<T>) => fn().then(() => onChanged());

  // Preview window: full data span, else the page's selected year.
  const from = tree.period.availableFrom ?? `${dataYear}-01`;
  const to = tree.period.availableTo ?? `${dataYear}-12`;

  const [annTarget, setAnnTarget] = useState<AnnotationTarget | null>(null);

  const updateChart = useMutation({
    mutationFn: (body: { title?: string; subtitle?: string | null }) => updateEducationChart(clientSlug, chart.id, body),
    onSuccess: onChanged,
  });
  const removeChart = useMutation({
    mutationFn: () => deleteEducationChart(clientSlug, chart.id),
    onSuccess: onChanged,
  });

  const [editTitle, setEditTitle] = useState(false);
  const [titleVal, setTitleVal] = useState(chart.title);
  useEffect(() => setTitleVal(chart.title), [chart.title]);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        {/* Chart header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            {editTitle ? (
              <form
                className="flex items-center gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (titleVal.trim()) updateChart.mutate({ title: titleVal.trim() });
                  setEditTitle(false);
                }}
              >
                <Input value={titleVal} onChange={(e) => setTitleVal(e.target.value)} className="h-8" autoFocus />
                <Button type="submit" size="sm">Save</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditTitle(false)}>Cancel</Button>
              </form>
            ) : (
              <h3 className="flex items-center gap-2 text-base font-semibold text-ph-charcoal">
                {chart.title}
                <button type="button" onClick={() => setEditTitle(true)} className="text-ph-charcoal/40 hover:text-ph-purple">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </h3>
            )}
            <SubtitleField
              value={chart.subtitle}
              onSave={(v) => updateChart.mutate({ subtitle: v })}
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              if (confirm(`Delete chart "${chart.title}"?`)) removeChart.mutate();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Preview + legend */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
          <div className="rounded-md border border-ph-charcoal/10 p-2">
            {chart.series.length === 0 ? (
              <p className="p-6 text-center text-sm text-ph-charcoal/50">Add a module below to start the chart.</p>
            ) : (
              <EducationBarChart
                series={chart.series}
                annotations={chart.annotations}
                from={from}
                to={to}
                onBarClick={(seriesId, year, month) => setAnnTarget({ seriesId, year, month })}
                onAnnotationClick={(id) => {
                  const a = chart.annotations.find((x) => x.id === id);
                  if (a) setAnnTarget({ seriesId: a.seriesId, year: a.year, month: a.month, annotationId: a.id, text: a.text });
                }}
              />
            )}
            {chart.series.length > 0 && (
              <p className="px-2 pb-1 text-xs text-ph-charcoal/40">Tip: click a bar to add or edit its note.</p>
            )}
          </div>
          <div className="lg:max-h-[360px] lg:overflow-y-auto">
            <EducationLegend series={chart.series} />
          </div>
        </div>

        {/* Series + data grid */}
        <SeriesDataEditor
          clientSlug={clientSlug}
          chart={chart}
          dataYear={dataYear}
          onChanged={onChanged}
        />

        {/* Annotations list */}
        {chart.annotations.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-ph-charcoal">Notes</h4>
            <ul className="mt-2 flex flex-col gap-1">
              {chart.annotations.map((a) => {
                const s = chart.series.find((x) => x.id === a.seriesId);
                return (
                  <li key={a.id} className="flex items-center justify-between gap-2 rounded border border-ph-charcoal/10 px-2 py-1 text-xs">
                    <span className="text-ph-charcoal/80">
                      <span className="font-medium">{MONTHS[a.month - 1]} {a.year}</span>
                      {s && <span className="text-ph-charcoal/50"> · {s.label}</span>} — {a.text}
                    </span>
                    <button
                      type="button"
                      className="text-ph-charcoal/40 hover:text-red-600"
                      onClick={() => mut(() => deleteEducationAnnotation(clientSlug, a.id))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>

      {annTarget && (
        <AnnotationModal
          clientSlug={clientSlug}
          chartId={chart.id}
          target={annTarget}
          series={chart.series}
          onClose={() => setAnnTarget(null)}
          onSaved={() => {
            setAnnTarget(null);
            onChanged();
          }}
        />
      )}
    </Card>
  );
}

function SubtitleField({ value, onSave }: { value: string | null; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value ?? '');
  useEffect(() => setVal(value ?? ''), [value]);
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-0.5 text-left text-xs text-ph-charcoal/50 hover:text-ph-purple"
      >
        {value || 'Add a subtitle…'}
      </button>
    );
  }
  return (
    <form
      className="mt-1 flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(val.trim());
        setEditing(false);
      }}
    >
      <Input value={val} onChange={(e) => setVal(e.target.value)} className="h-7 text-xs" placeholder="Subtitle" autoFocus />
      <Button type="submit" size="sm">Save</Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
    </form>
  );
}

function SeriesDataEditor({
  clientSlug,
  chart,
  dataYear,
  onChanged,
}: {
  clientSlug: string;
  chart: EduChart;
  dataYear: number;
  onChanged: () => void;
}) {
  // Grid inputs keyed `${seriesId}:${year}:${month}` — across ALL years, so
  // stepping between years never wipes unsaved edits. Seeded from every point.
  const [inputs, setInputs] = useState<Record<string, string>>({});
  useEffect(() => {
    const next: Record<string, string> = {};
    chart.series.forEach((s) =>
      s.points.forEach((p) => {
        next[`${s.id}:${p.year}:${p.month}`] = String(p.value);
      }),
    );
    setInputs(next);
  }, [chart]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addSeries = useMutation({
    mutationFn: () =>
      createEducationSeries(clientSlug, chart.id, {
        label: `Module ${chart.series.length + 1}`,
        color: PALETTE[chart.series.length % PALETTE.length],
      }),
    onSuccess: onChanged,
  });

  async function saveData() {
    setSaving(true);
    setError(null);
    try {
      // Each series is a full replace of every non-empty cell across all years
      // currently in the grid (keys are `${seriesId}:${year}:${month}`).
      for (const s of chart.series) {
        const points: { year: number; month: number; value: number }[] = [];
        for (const [key, raw] of Object.entries(inputs)) {
          if (!key.startsWith(`${s.id}:`)) continue;
          if (raw === undefined || raw.trim() === '') continue;
          const [, yearStr, monthStr] = key.split(':');
          points.push({ year: Number(yearStr), month: Number(monthStr), value: Number(raw) });
        }
        await setEducationSeriesData(clientSlug, s.id, points);
      }
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-t border-ph-charcoal/10 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-ph-charcoal">
          Modules &amp; completions <span className="font-normal text-ph-charcoal/50">· {dataYear}</span>
        </h4>
      </div>

      {chart.series.length === 0 ? (
        <p className="mt-2 text-xs text-ph-charcoal/60">No modules yet.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="text-sm">
            <thead className="text-xs uppercase tracking-wide text-ph-charcoal/60">
              <tr>
                <th className="py-1 pr-3 text-left font-medium">Module</th>
                {MONTHS_FULL.map((m) => (
                  <th key={m} className="px-1 py-1 text-center font-medium">{m}</th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {chart.series.map((s) => (
                <SeriesRow
                  key={s.id}
                  clientSlug={clientSlug}
                  series={s}
                  dataYear={dataYear}
                  inputs={inputs}
                  onCell={(month, value) => setInputs((prev) => ({ ...prev, [`${s.id}:${dataYear}:${month}`]: value }))}
                  onChanged={onChanged}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => addSeries.mutate()} disabled={addSeries.isPending}>
          <Plus className="h-4 w-4" />
          Add module
        </Button>
        {chart.series.length > 0 && (
          <Button type="button" size="sm" onClick={saveData} disabled={saving}>
            {saving ? 'Saving…' : 'Save completions'}
          </Button>
        )}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}

const MONTHS_FULL = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function SeriesRow({
  clientSlug,
  series,
  dataYear,
  inputs,
  onCell,
  onChanged,
}: {
  clientSlug: string;
  series: EduSeries;
  dataYear: number;
  inputs: Record<string, string>;
  onCell: (month: number, value: string) => void;
  onChanged: () => void;
}) {
  const updateSeries = useMutation({
    mutationFn: (body: { label?: string; color?: string }) => updateEducationSeries(clientSlug, series.id, body),
    onSuccess: onChanged,
  });
  const removeSeries = useMutation({
    mutationFn: () => deleteEducationSeries(clientSlug, series.id),
    onSuccess: onChanged,
  });

  const [label, setLabel] = useState(series.label);
  useEffect(() => setLabel(series.label), [series.label]);

  return (
    <tr>
      <td className="py-1 pr-3">
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            value={series.color ?? '#888888'}
            onChange={(e) => updateSeries.mutate({ color: e.target.value })}
            className="h-6 w-6 shrink-0 cursor-pointer rounded border border-ph-charcoal/20 bg-white p-0"
            title="Bar colour"
          />
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={() => label.trim() && label !== series.label && updateSeries.mutate({ label: label.trim() })}
            className="h-7 w-56 rounded-md border border-ph-charcoal/20 bg-white px-2 text-xs text-ph-charcoal focus:border-ph-purple focus:outline-none"
          />
        </div>
      </td>
      {MONTHS_FULL.map((_, i) => {
        const m = i + 1;
        return (
          <td key={m} className="px-0.5 py-1">
            <input
              type="number"
              step="any"
              value={inputs[`${series.id}:${dataYear}:${m}`] ?? ''}
              placeholder="—"
              onChange={(e) => onCell(m, e.target.value)}
              className="h-7 w-14 rounded-md border border-ph-charcoal/20 bg-white px-1 text-center text-xs text-ph-charcoal focus:border-ph-purple focus:outline-none"
            />
          </td>
        );
      })}
      <td className="pl-1">
        <button
          type="button"
          className="text-ph-charcoal/40 hover:text-red-600"
          onClick={() => {
            if (confirm(`Delete module "${series.label}"?`)) removeSeries.mutate();
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}

function AnnotationModal({
  clientSlug,
  chartId,
  target,
  series,
  onClose,
  onSaved,
}: {
  clientSlug: string;
  chartId: string;
  target: AnnotationTarget;
  series: EduSeries[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [text, setText] = useState(target.text ?? '');
  const [error, setError] = useState<string | null>(null);
  const s = series.find((x) => x.id === target.seriesId);

  const save = useMutation({
    mutationFn: () =>
      target.annotationId
        ? updateEducationAnnotation(clientSlug, target.annotationId, { text })
        : createEducationAnnotation(clientSlug, chartId, {
            seriesId: target.seriesId,
            year: target.year,
            month: target.month,
            text,
          }),
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Save failed'),
  });
  const remove = useMutation({
    mutationFn: () => deleteEducationAnnotation(clientSlug, target.annotationId!),
    onSuccess: onSaved,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-ph-charcoal">
          {target.annotationId ? 'Edit note' : 'Add note'}
        </h3>
        <p className="mt-1 text-xs text-ph-charcoal/60">
          {s?.label} · {MONTHS[target.month - 1]} {target.year}
        </p>
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="e.g. Paracetamol CPD article live"
          className="mt-3 w-full rounded-md border border-ph-charcoal/20 bg-white px-2 py-1.5 text-sm text-ph-charcoal focus:border-ph-purple focus:outline-none"
        />
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={!text.trim() || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
          </div>
          {target.annotationId && (
            <Button type="button" size="sm" variant="ghost" onClick={() => remove.mutate()}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
