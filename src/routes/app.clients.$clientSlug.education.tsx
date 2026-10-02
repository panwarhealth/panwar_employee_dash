import { useEffect, useMemo, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/api/client';
import { usePublishYears, useWorkspaceYear } from '@/lib/workspaceYear';
import { blockNonNumericKey } from '@/lib/numberKeys';
import { EducationBarChart, EducationLegend, type ChartSeries } from '@/components/education/EducationBarChart';
import { PALETTE } from '@/components/education/palette';
import {
  listEducationPages,
  getEducationPage,
  createEducationPage,
  updateEducationPage,
  deleteEducationPage,
  createEducationChart,
  updateEducationChart,
  deleteEducationChart,
  createEducationAnnotation,
  updateEducationAnnotation,
  deleteEducationAnnotation,
  createEducationAsset,
  updateEducationAsset,
  deleteEducationAsset,
  setEducationAssetValues,
  type EducationPageTree,
  type EducationChart as EduChart,
  type EducationAsset as EduAsset,
} from '@/api/education';

export const Route = createFileRoute('/app/clients/$clientSlug/education')({
  component: EducationTab,
});

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
  // Asset mutations return the fresh page tree - write it into the cache
  // directly so the grid updates instantly instead of waiting on a refetch.
  const applyTree = (tree?: EducationPageTree) => {
    if (tree) queryClient.setQueryData(['manage', 'education', clientSlug, 'page', pageId], tree);
    else invalidate();
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
    tree?.assets.forEach((a) => a.statuses.forEach((st) => st.points.forEach((p) => set.add(p.year))));
    return [...set].sort((a, b) => a - b);
  }, [tree]);

  const { year: dataYear, initYear } = useWorkspaceYear();
  usePublishYears(yearsWithData);
  // Default the workspace year to the latest with chart data - unless the
  // user (or another tab) already set one.
  useEffect(() => {
    if (yearsWithData.length) initYear(yearsWithData[yearsWithData.length - 1]);
  }, [yearsWithData, initYear]);

  if (isLoading || !tree) return <p className="text-sm text-ph-charcoal/60">Loading…</p>;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3 border-t border-ph-charcoal/10 pt-4">
        {editingName ? (
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              if (name.trim() && name.trim() !== tree.page.name) renamePage.mutate(name.trim());
              setEditingName(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') {
                setName(tree.page.name);
                setEditingName(false);
              }
            }}
            className="h-8 w-56"
            autoFocus
          />
        ) : (
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ph-charcoal">
            {tree.page.name}
            <button type="button" onClick={() => setEditingName(true)} className="text-ph-charcoal/40 hover:text-ph-purple">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </h2>
        )}
        <div className="flex items-center gap-2">
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
          groupOptions={[...new Set(tree.assets.map((a) => a.groupLabel))]}
          dataYear={dataYear}
          onChanged={invalidate}
        />
      ))}

      <AssetsEditor clientSlug={clientSlug} tree={tree} dataYear={dataYear} onChanged={applyTree} />
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
  brand: string;
  year: number;
  month: number;
  // present when editing an existing annotation
  annotationId?: string;
  text?: string;
}

function ChartEditor({
  clientSlug,
  chart,
  groupOptions,
  dataYear,
  onChanged,
}: {
  clientSlug: string;
  chart: EduChart;
  groupOptions: string[];
  dataYear: number;
  onChanged: () => void;
}) {
  const series: ChartSeries[] = chart.brandSeries.map((b, i) => ({
    id: b.id,
    label: b.label,
    color: b.color ?? PALETTE[i % PALETTE.length],
    points: b.points,
  }));
  const annotations = chart.annotations.map((a) => ({ ...a, seriesId: a.brand }));
  const toggleGroup = (g: string) => {
    const next = chart.groupLabels.includes(g)
      ? chart.groupLabels.filter((x) => x !== g)
      : [...chart.groupLabels, g];
    updateChart.mutate({ groupLabels: next });
  };
  const mut = <T,>(fn: () => Promise<T>) => fn().then(() => onChanged());

  // Preview window follows the workspace year filter, like the entry grid.
  const from = `${dataYear}-01`;
  const to = `${dataYear}-12`;

  const [annTarget, setAnnTarget] = useState<AnnotationTarget | null>(null);

  const updateChart = useMutation({
    mutationFn: (body: { title?: string; subtitle?: string | null; groupLabels?: string[] }) =>
      updateEducationChart(clientSlug, chart.id, body),
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
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            {editTitle ? (
              <Input
                value={titleVal}
                onChange={(e) => setTitleVal(e.target.value)}
                onBlur={() => {
                  if (titleVal.trim() && titleVal.trim() !== chart.title) updateChart.mutate({ title: titleVal.trim() });
                  setEditTitle(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  if (e.key === 'Escape') {
                    setTitleVal(chart.title);
                    setEditTitle(false);
                  }
                }}
                className="h-8"
                autoFocus
              />
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

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="font-semibold text-ph-charcoal">Asset groups feeding this chart</span>
          {groupOptions.length === 0 && <span className="text-ph-charcoal/50">Add assets below first.</span>}
          {groupOptions.map((g) => (
            <label key={g} className="flex cursor-pointer items-center gap-1.5 text-ph-charcoal/80">
              <input
                type="checkbox"
                checked={chart.groupLabels.includes(g)}
                onChange={() => toggleGroup(g)}
                className="h-3.5 w-3.5 accent-ph-purple"
              />
              {g}
            </label>
          ))}
          {chart.groupLabels.length === 0 && groupOptions.length > 0 && (
            <span className="text-ph-charcoal/50">None ticked = all groups.</span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0 rounded-md border border-ph-charcoal/10 p-2">
            {series.length === 0 ? (
              <p className="p-6 text-center text-sm text-ph-charcoal/50">No completions in the asset tables for this chart yet.</p>
            ) : (
              <EducationBarChart
                series={series}
                annotations={annotations}
                from={from}
                to={to}
                onBarClick={(brand, year, month) => setAnnTarget({ brand, year, month })}
                onAnnotationClick={(id) => {
                  const a = chart.annotations.find((x) => x.id === id);
                  if (a) setAnnTarget({ brand: a.brand, year: a.year, month: a.month, annotationId: a.id, text: a.text });
                }}
              />
            )}
            {series.length > 0 && (
              <p className="px-2 pb-1 text-xs text-ph-charcoal/40">Bars are completions by brand, summed from the asset tables. Click a bar to add or edit its note.</p>
            )}
          </div>
          <div className="lg:max-h-[360px] lg:overflow-y-auto">
            <EducationLegend series={series} />
          </div>
        </div>

        {/* Annotations list - scoped to the workspace year like the preview */}
        {chart.annotations.some((a) => a.year === dataYear) && (
          <div>
            <h4 className="text-sm font-semibold text-ph-charcoal">Notes</h4>
            <ul className="mt-2 flex flex-col gap-1">
              {chart.annotations.filter((a) => a.year === dataYear).map((a) => {
                return (
                  <li key={a.id} className="flex items-center justify-between gap-2 rounded border border-ph-charcoal/10 px-2 py-1 text-xs">
                    <span className="text-ph-charcoal/80">
                      <span className="font-medium">{MONTHS[a.month - 1]} {a.year}</span>
                      <span className="text-ph-charcoal/50"> · {a.brand}</span> - {a.text}
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
    <Input
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => {
        if (val.trim() !== (value ?? '')) onSave(val.trim());
        setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setVal(value ?? '');
          setEditing(false);
        }
      }}
      className="mt-1 h-7 text-xs"
      placeholder="Subtitle"
      autoFocus
    />
  );
}

const MONTHS_FULL = MONTHS;

const EDU_STATUSES = ['Completed', 'Enrolled', 'Views'];

/**
 * Editor for the page's detail table (the workbook's per-asset education
 * table). Assets are grouped by publisher block; each asset has one monthly
 * input row per status, entered for the selected workspace year. Values are
 * keyed across all years so switching years never wipes unsaved edits.
 */
function AssetsEditor({
  clientSlug,
  tree,
  dataYear,
  onChanged,
}: {
  clientSlug: string;
  tree: EducationPageTree;
  dataYear: number;
  onChanged: (tree?: EducationPageTree) => void;
}) {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [extraStatuses, setExtraStatuses] = useState<Record<string, string[]>>({});
  const [removedStatuses, setRemovedStatuses] = useState<Record<string, string[]>>({});
  const [formState, setFormState] = useState<EduAsset | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const a of tree.assets) {
      for (const s of a.statuses) {
        for (const p of s.points) next[`${a.id}|${s.status}|${p.year}|${p.month}`] = String(p.value);
      }
    }
    setInputs(next);
    setExtraStatuses((prev) => {
      const pruned: Record<string, string[]> = {};
      for (const a of tree.assets) {
        const saved = new Set(a.statuses.map((s) => s.status));
        const keep = (prev[a.id] ?? []).filter((s) => !saved.has(s));
        if (keep.length > 0) pruned[a.id] = keep;
      }
      return pruned;
    });
    setRemovedStatuses((prev) => {
      const pruned: Record<string, string[]> = {};
      for (const a of tree.assets) {
        const saved = new Set(a.statuses.map((s) => s.status));
        const keep = (prev[a.id] ?? []).filter((s) => saved.has(s));
        if (keep.length > 0) pruned[a.id] = keep;
      }
      return pruned;
    });
  }, [tree]);

  const inputsRef = useRef(inputs);
  useEffect(() => { inputsRef.current = inputs; }, [inputs]);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  useEffect(() => () => { for (const t of Object.values(saveTimers.current)) clearTimeout(t); }, []);

  const saveAsset = useMutation({
    mutationFn: (assetId: string) => {
      const values: { status: string; year: number; month: number; value: number }[] = [];
      for (const [key, raw] of Object.entries(inputsRef.current)) {
        if (!key.startsWith(`${assetId}|`) || raw.trim() === '') continue;
        const [, status, yearStr, monthStr] = key.split('|');
        values.push({ status, year: Number(yearStr), month: Number(monthStr), value: Number(raw) });
      }
      return setEducationAssetValues(clientSlug, assetId, values);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Save failed'),
  });

  // The server replace isn't safe under concurrent saves of the same asset, so
  // serialise per asset: one in flight at a time; if edits land mid-flight,
  // re-save once after it settles.
  const inFlight = useRef<Set<string>>(new Set());
  const pendingResave = useRef<Set<string>>(new Set());
  const runSave = (assetId: string) => {
    if (inFlight.current.has(assetId)) {
      pendingResave.current.add(assetId);
      return;
    }
    inFlight.current.add(assetId);
    saveAsset.mutate(assetId, {
      onSettled: () => {
        inFlight.current.delete(assetId);
        if (pendingResave.current.delete(assetId)) runSave(assetId);
      },
    });
  };

  const scheduleSave = (assetId: string) => {
    setError(null);
    clearTimeout(saveTimers.current[assetId]);
    saveTimers.current[assetId] = setTimeout(() => runSave(assetId), 600);
  };

  const removeStatusRow = (assetId: string, status: string) => {
    setRemovedStatuses((prev) => ({ ...prev, [assetId]: [...(prev[assetId] ?? []), status] }));
    removeStatusLocal(assetId, status);
    scheduleSave(assetId);
  };

  const cancelSaves = (assetId: string) => {
    clearTimeout(saveTimers.current[assetId]);
    pendingResave.current.delete(assetId);
  };

  const statusesOf = (a: EduAsset) => {
    const removed = new Set(removedStatuses[a.id] ?? []);
    const fromData = a.statuses.map((s) => s.status).filter((s) => !removed.has(s));
    const extras = (extraStatuses[a.id] ?? []).filter((s) => !fromData.includes(s) && !removed.has(s));
    return [...fromData, ...extras];
  };

  const removeStatusLocal = (assetId: string, status: string) => {
    setExtraStatuses((prev) => ({
      ...prev,
      [assetId]: (prev[assetId] ?? []).filter((s) => s !== status),
    }));
    setInputs((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        const [aid, s] = key.split('|');
        if (aid === assetId && s === status) delete next[key];
      }
      return next;
    });
  };

  const groups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const assets = q
      ? tree.assets.filter((a) =>
          [a.title, a.brand, a.type, a.groupLabel].some((s) => (s ?? '').toLowerCase().includes(q)),
        )
      : tree.assets;
    const out: { label: string; rows: EduAsset[] }[] = [];
    for (const a of assets) {
      const g = out.find((x) => x.label === a.groupLabel);
      if (g) g.rows.push(a);
      else out.push({ label: a.groupLabel, rows: [a] });
    }
    return out;
  }, [tree.assets, filter]);

  const shownCount = useMemo(() => groups.reduce((n, g) => n + g.rows.length, 0), [groups]);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-ph-charcoal">Detail table</h3>
            <p className="mt-0.5 text-xs text-ph-charcoal/60">
              The per-asset table shown under the charts on the client page. Monthly numbers per
              status, entered for {dataYear}; switch the year to enter other years. Changes save
              automatically.
            </p>
          </div>
          {formState === null && (
            <Button type="button" size="sm" onClick={() => setFormState('new')}>
              <Plus className="h-4 w-4" />
              Add asset
            </Button>
          )}
        </div>

        {formState !== null && (
          <AssetForm
            clientSlug={clientSlug}
            pageId={tree.page.id}
            editing={formState === 'new' ? null : formState}
            groupOptions={groups.map((g) => g.label)}
            onDone={(t) => {
              const wasCreate = formState === 'new';
              setFormState(null);
              if (wasCreate && t) {
                const knownIds = new Set(tree.assets.map((a) => a.id));
                const created = t.assets.find((a) => !knownIds.has(a.id));
                if (created) {
                  setExtraStatuses((prev) => ({ ...prev, [created.id]: ['Completed'] }));
                  setInputs((prev) => {
                    const next = { ...prev };
                    for (let m = 1; m <= 12; m++) {
                      const key = `${created.id}|Completed|${dataYear}|${m}`;
                      if (!next[key]?.trim()) next[key] = '0';
                    }
                    return next;
                  });
                  scheduleSave(created.id);
                }
              }
              onChanged(t);
            }}
            onCancel={() => setFormState(null)}
          />
        )}

        {tree.assets.length === 0 && formState === null && (
          <p className="text-sm text-ph-charcoal/60">No assets yet - add the first one above.</p>
        )}

        {tree.assets.length > 0 && (
          <div className="flex items-center gap-2">
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter assets (title, brand, type, group)…"
              className="h-8 max-w-md text-sm"
            />
            {filter && (
              <Button type="button" size="sm" variant="ghost" onClick={() => setFilter('')}>
                Reset
              </Button>
            )}
            <span className="ml-auto text-xs text-ph-charcoal/50">
              {shownCount} of {tree.assets.length}
            </span>
          </div>
        )}

        {groups.map((g) => (
          <div key={g.label}>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-ph-charcoal/60">{g.label}</h4>
            <div className="mt-1 overflow-x-auto">
              <table className="text-sm">
                <thead className="text-xs uppercase tracking-wide text-ph-charcoal/60">
                  <tr>
                    <th className="py-1 pl-3 pr-3 text-left font-medium">Asset</th>
                    <th className="py-1 pr-2 text-left font-medium">Status</th>
                    {MONTHS_FULL.map((m) => (
                      <th key={m} className="px-1 py-1 text-center font-medium">{m}</th>
                    ))}
                    <th className="pr-3" />
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((a, i) => (
                    <AssetRows
                      key={a.id}
                      clientSlug={clientSlug}
                      asset={a}
                      zebra={i % 2 === 1}
                      statuses={statusesOf(a)}
                      dataYear={dataYear}
                      inputs={inputs}
                      onCell={(status, month, value) =>
                        setInputs((prev) => ({ ...prev, [`${a.id}|${status}|${dataYear}|${month}`]: value }))
                      }
                      onSave={() => scheduleSave(a.id)}
                      onAddStatus={(name) => {
                        setRemovedStatuses((prev) => ({ ...prev, [a.id]: (prev[a.id] ?? []).filter((s) => s !== name) }));
                        setExtraStatuses((prev) => ({ ...prev, [a.id]: [...(prev[a.id] ?? []), name] }));
                        setInputs((prev) => {
                          const next = { ...prev };
                          for (let m = 1; m <= 12; m++) {
                            const key = `${a.id}|${name}|${dataYear}|${m}`;
                            if (!next[key]?.trim()) next[key] = '0';
                          }
                          return next;
                        });
                        scheduleSave(a.id);
                      }}
                      onRemoveStatus={(status) => removeStatusRow(a.id, status)}
                      cancelSaves={() => cancelSaves(a.id)}
                      onEdit={() => setFormState(a)}
                      onChanged={onChanged}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {tree.assets.length > 0 && (
          <div className="flex h-4 items-center gap-2 text-xs">
            {saveAsset.isPending ? (
              <span className="text-ph-charcoal/50">Saving…</span>
            ) : error ? (
              <span className="text-red-600">{error}</span>
            ) : saveAsset.isSuccess ? (
              <span className="text-green-700">All changes saved ✓</span>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AssetRows({
  clientSlug,
  asset,
  zebra,
  statuses,
  dataYear,
  inputs,
  onCell,
  onSave,
  onAddStatus,
  onRemoveStatus,
  cancelSaves,
  onEdit,
  onChanged,
}: {
  clientSlug: string;
  asset: EduAsset;
  zebra: boolean;
  statuses: string[];
  dataYear: number;
  inputs: Record<string, string>;
  onCell: (status: string, month: number, value: string) => void;
  onSave: () => void;
  onAddStatus: (name: string) => void;
  onRemoveStatus: (status: string) => void;
  cancelSaves: () => void;
  onEdit: () => void;
  onChanged: (tree?: EducationPageTree) => void;
}) {
  const removeAsset = useMutation({
    mutationFn: () => deleteEducationAsset(clientSlug, asset.id),
    onSuccess: () => onChanged(),
    onError: (e) => alert(e instanceof ApiError ? e.message : 'Failed to delete asset'),
  });

  const meta = [asset.brand, asset.type, asset.author].filter(Boolean).join(' · ');
  const rows: (string | null)[] = statuses.length > 0 ? statuses : [null];

  return (
    <>
      {rows.map((status, si) => (
        <tr
          key={status ?? 'none'}
          className={`${zebra ? 'bg-slate-100/50' : ''} ${si === rows.length - 1 ? 'border-b border-ph-charcoal/5' : ''}`}
        >
          {si === 0 && (
            <td rowSpan={rows.length} className="max-w-72 py-1.5 pl-3 pr-3 align-top">
              <div className="text-xs font-medium text-ph-charcoal">{asset.title}</div>
              {(meta || asset.expiry) && (
                <div className="text-[11px] text-ph-charcoal/50">
                  {meta}
                  {asset.expiry ? `${meta ? ' · ' : ''}exp ${asset.expiry}` : ''}
                </div>
              )}
              <div className="mt-1 flex items-center gap-2">
                <button type="button" onClick={onEdit} className="text-ph-charcoal/40 hover:text-ph-purple" title="Edit asset">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="text-ph-charcoal/40 hover:text-red-600"
                  title="Delete asset"
                  onClick={() => {
                    if (confirm(`Delete asset "${asset.title}" and all its values?`)) {
                      cancelSaves();
                      removeAsset.mutate();
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <AddStatusInline existing={statuses} onAdd={onAddStatus} />
              </div>
            </td>
          )}
          <td className="py-1 pr-2 text-xs text-ph-charcoal/80 whitespace-nowrap">
            {status ?? <span className="italic text-ph-charcoal/40">add a status to enter values</span>}
          </td>
          {status ? (
            MONTHS_FULL.map((_, i) => {
              const m = i + 1;
              return (
                <td key={m} className="px-0.5 py-1">
                  <input
                    type="number"
                    step="any"
                    inputMode="numeric"
                    value={inputs[`${asset.id}|${status}|${dataYear}|${m}`] ?? ''}
                    placeholder="0"
                    onKeyDown={blockNonNumericKey}
                    onChange={(e) => onCell(status, m, e.target.value.replace(/[^\d.]/g, ''))}
                    onBlur={onSave}
                    className="h-7 w-14 rounded-md border border-ph-charcoal/20 bg-white px-1 text-center text-xs text-ph-charcoal focus:border-ph-purple focus:outline-none"
                  />
                </td>
              );
            })
          ) : (
            <td colSpan={12} />
          )}
          <td className="pl-1 pr-3">
            {status && (
              <button
                type="button"
                className="text-ph-charcoal/40 hover:text-red-600"
                title={`Remove ${status} row`}
                onClick={() => {
                  if (confirm(`Remove status "${status}" and its saved values?`)) onRemoveStatus(status);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </td>
        </tr>
      ))}
    </>
  );
}

function AddStatusInline({ existing, onAdd }: { existing: string[]; onAdd: (name: string) => void }) {
  const available = EDU_STATUSES.filter((s) => !existing.includes(s));
  if (available.length === 0) return null;
  return (
    <select
      value=""
      onChange={(e) => {
        if (e.target.value) onAdd(e.target.value);
      }}
      title="Add a status row"
      className="h-6 rounded-md border border-ph-charcoal/20 bg-white px-1 text-[11px] font-medium text-ph-charcoal/50 hover:text-ph-purple focus:border-ph-purple focus:outline-none"
    >
      <option value="">+ status</option>
      {available.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}

function AssetForm({
  clientSlug,
  pageId,
  editing,
  groupOptions,
  onDone,
  onCancel,
}: {
  clientSlug: string;
  pageId: string;
  editing: EduAsset | null;
  groupOptions: string[];
  onDone: (tree?: EducationPageTree) => void;
  onCancel: () => void;
}) {
  const [group, setGroup] = useState(editing?.groupLabel ?? '');
  const [brand, setBrand] = useState(editing?.brand ?? '');
  const [type, setType] = useState(editing?.type ?? '');
  const [title, setTitle] = useState(editing?.title ?? '');
  const [author, setAuthor] = useState(editing?.author ?? '');
  const [expiry, setExpiry] = useState(editing?.expiry ?? '');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        groupLabel: group.trim(),
        brand: brand.trim(),
        type: type.trim(),
        title: title.trim(),
        author: author.trim(),
        expiry: expiry || undefined,
        clearExpiry: editing && !expiry ? true : undefined,
      };
      return editing
        ? updateEducationAsset(clientSlug, editing.id, body)
        : createEducationAsset(clientSlug, pageId, body);
    },
    onSuccess: (t) => onDone(t),
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Save failed'),
  });

  const field = 'h-8 w-full rounded-md border border-ph-charcoal/20 bg-white px-2 text-xs text-ph-charcoal focus:border-ph-purple focus:outline-none';
  const lbl = 'flex flex-col gap-1 text-[11px] font-medium text-ph-charcoal';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onCancel}>
      <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-ph-charcoal">{editing ? 'Edit asset' : 'Add asset'}</h3>
        <form
          className="mt-3 grid grid-cols-2 gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (group.trim() && title.trim()) save.mutate();
          }}
        >
          <label className={lbl}>
            Group (publisher block)
            <input list="asset-group-suggestions" value={group} onChange={(e) => setGroup(e.target.value)} placeholder="e.g. the publisher's name" className={field} required />
            <datalist id="asset-group-suggestions">
              {groupOptions.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </label>
          <label className={lbl}>
            Brand
            <input value={brand} onChange={(e) => setBrand(e.target.value)} className={field} />
          </label>
          <label className={lbl}>
            Type
            <input list="asset-type-suggestions" value={type} onChange={(e) => setType(e.target.value)} className={field} />
            <datalist id="asset-type-suggestions">
              {['Article', 'Podcast', 'Webinar', 'Module', 'Video', 'Webcast'].map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </label>
          <label className={lbl}>
            By
            <input value={author} onChange={(e) => setAuthor(e.target.value)} className={field} />
          </label>
          <label className={`${lbl} col-span-2`}>
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} required />
          </label>
          <label className={lbl}>
            Expiry
            <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className={field} />
          </label>
          <div className="col-span-2 flex items-center gap-2 border-t border-ph-charcoal/10 pt-3">
            <Button type="submit" size="sm" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : editing ? 'Save asset' : 'Add asset'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        </form>
      </div>
    </div>
  );
}

function AnnotationModal({
  clientSlug,
  chartId,
  target,
  onClose,
  onSaved,
}: {
  clientSlug: string;
  chartId: string;
  target: AnnotationTarget;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [text, setText] = useState(target.text ?? '');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      target.annotationId
        ? updateEducationAnnotation(clientSlug, target.annotationId, { text })
        : createEducationAnnotation(clientSlug, chartId, {
            brand: target.brand,
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
          {target.brand} · {MONTHS[target.month - 1]} {target.year}
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
