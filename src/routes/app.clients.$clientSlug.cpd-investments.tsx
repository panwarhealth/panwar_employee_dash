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
import { listBrands, listAudiences, listPublishers } from '@/api/taxonomy';
import {
  listCpdInvestments,
  createCpdInvestment,
  updateCpdInvestment,
  deleteCpdInvestment,
  CPD_FORMATS,
  cpdFormatLabel,
  MONTHS,
  monthRangeLabel,
  type CpdInvestmentListItem,
  type CpdInvestmentWriteBody,
} from '@/api/cpdInvestments';

export const Route = createFileRoute('/app/clients/$clientSlug/cpd-investments')({
  component: CpdInvestmentsTab,
});

const currency = (n: number) => n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });

type SortKey = 'brand' | 'audience' | 'publisher' | 'format' | 'title' | 'cost';

const sortValue = (it: CpdInvestmentListItem, key: SortKey): string | number => {
  switch (key) {
    case 'brand': return it.brandName.toLowerCase();
    case 'audience': return it.audienceName.toLowerCase();
    case 'publisher': return it.publisherName.toLowerCase();
    case 'format': return cpdFormatLabel(it.format).toLowerCase();
    case 'title': return it.title.toLowerCase();
    case 'cost': return it.cost;
  }
};

function CpdInvestmentsTab() {
  const { clientSlug } = Route.useParams();
  const { year, initYear } = useWorkspaceYear();
  const [editing, setEditing] = useState<CpdInvestmentListItem | 'new' | null>(null);
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'brand', dir: 'asc' });

  const { data, isLoading } = useQuery({
    queryKey: ['manage', 'clients', clientSlug, 'cpd-investments', year],
    queryFn: () => listCpdInvestments(clientSlug, year),
  });
  const items = data?.items ?? [];
  usePublishYears(data?.years);
  useEffect(() => {
    if (data?.years?.length) initYear(data.years[data.years.length - 1]);
  }, [data?.years, initYear]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const rows = q
      ? items.filter((it) =>
          [it.brandName, it.audienceName, it.publisherName, it.title, cpdFormatLabel(it.format)].some((s) =>
            s.toLowerCase().includes(q),
          ),
        )
      : items;
    return [...rows].sort((a, b) => {
      const av = sortValue(a, sort.key);
      const bv = sortValue(b, sort.key);
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [items, filter, sort]);

  const total = useMemo(() => visible.reduce((s, it) => s + it.cost, 0), [visible]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  const isDefault = filter === '' && sort.key === 'brand' && sort.dir === 'asc';
  const reset = () => {
    setFilter('');
    setSort({ key: 'brand', dir: 'asc' });
  };

  const SortTh = ({ k, label, align = 'left' }: { k: SortKey; label: string; align?: 'left' | 'right' }) => (
    <th className={`py-2 ${align === 'right' ? 'text-right' : ''} pr-4 font-medium`}>
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-ph-charcoal/70">
          Other CPD investments included in the client&apos;s &quot;Spend (incl CPD)&quot; total.
        </p>
        {editing === null && (
          <Button type="button" size="sm" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" />
            New CPD investment
          </Button>
        )}
      </div>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={`${year} · ${editing === 'new' ? 'New CPD investment' : 'Edit CPD investment'}`}
      >
        {editing !== null && (
          <CpdEditor
            key={editing === 'new' ? 'new' : editing.id}
            clientSlug={clientSlug}
            year={year}
            existing={editing === 'new' ? null : editing}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>

      <Card>
        <CardContent className="pt-6">
          {isLoading && <p className="text-sm text-ph-charcoal/60">Loading…</p>}
          {!isLoading && items.length === 0 && (
            <p className="text-sm text-ph-charcoal/60">No CPD investments for {year} yet.</p>
          )}
          {items.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filter (brand, audience, publisher, title)…"
                  className="h-8 max-w-md text-sm"
                />
                {!isDefault && (
                  <Button type="button" size="sm" variant="ghost" onClick={reset}>
                    Reset
                  </Button>
                )}
                <span className="ml-auto text-xs text-ph-charcoal/50">
                  {visible.length} of {items.length}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-ph-charcoal/10 text-xs uppercase tracking-wide text-ph-charcoal/60">
                    <tr>
                      <SortTh k="brand" label="Brand" />
                      <SortTh k="audience" label="Audience" />
                      <SortTh k="publisher" label="Publisher" />
                      <SortTh k="format" label="Format" />
                      <SortTh k="title" label="Title" />
                      <th className="py-2 pr-4 font-medium">Period</th>
                      <SortTh k="cost" label="Cost" align="right" />
                      <th className="py-2 text-right font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((it, i) => (
                      <tr
                        key={it.id}
                        className={`border-b border-ph-charcoal/5 last:border-0 ${i % 2 === 1 ? 'bg-slate-100/50' : ''}`}
                      >
                        <td className="py-2 pr-4 font-medium text-ph-charcoal">{it.brandName}</td>
                        <td className="py-2 pr-4 text-ph-charcoal/70">{it.audienceName}</td>
                        <td className="py-2 pr-4 text-ph-charcoal/70">{it.publisherName}</td>
                        <td className="py-2 pr-4 text-ph-charcoal/70">{cpdFormatLabel(it.format)}</td>
                        <td className="py-2 pr-4 text-ph-charcoal/80">{it.title}</td>
                        <td className="py-2 pr-4 text-ph-charcoal/70">{monthRangeLabel(it.startMonth, it.endMonth)}</td>
                        <td className="py-2 pr-4 text-right tabular-nums text-ph-charcoal/80">{currency(it.cost)}</td>
                        <td className="py-2 text-right whitespace-nowrap">
                          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(it)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <DeleteButton clientSlug={clientSlug} id={it.id} title={it.title} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-ph-charcoal/10 font-medium text-ph-charcoal">
                      <td className="py-3 pr-4" colSpan={6}>
                        Total CPD investment
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">{currency(total)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DeleteButton({ clientSlug, id, title }: { clientSlug: string; id: string; title: string }) {
  const queryClient = useQueryClient();
  const del = useMutation({
    mutationFn: () => deleteCpdInvestment(clientSlug, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['manage', 'clients', clientSlug, 'cpd-investments'] }),
  });
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={del.isPending}
      onClick={() => {
        if (confirm(`Delete CPD investment “${title}”?`)) del.mutate();
      }}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}

const monthField = z.preprocess(
  (v) => (v === '' || v == null ? undefined : Number(v)),
  z.number().int().min(1).max(12).optional(),
);

const schema = z
  .object({
    brandId: z.string().min(1, 'Pick a brand'),
    audienceId: z.string().min(1, 'Pick an audience'),
    publisherId: z.string().min(1, 'Pick a publisher'),
    format: z.string().min(1, 'Pick a format'),
    title: z.string().min(1, 'Title required'),
    cost: z.coerce.number().nonnegative('Must be 0 or more'),
    startMonth: monthField,
    endMonth: monthField,
    notes: z.string().optional(),
  })
  .refine((d) => d.startMonth == null || d.endMonth == null || d.startMonth <= d.endMonth, {
    message: 'End month must be on or after the start',
    path: ['endMonth'],
  });
type Values = z.infer<typeof schema>;

function CpdEditor({
  clientSlug,
  year,
  existing,
  onDone,
}: {
  clientSlug: string;
  year: number;
  existing: CpdInvestmentListItem | null;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();

  const brandsQ = useQuery({ queryKey: ['manage', 'clients', clientSlug, 'brands'], queryFn: () => listBrands(clientSlug) });
  const audiencesQ = useQuery({ queryKey: ['manage', 'clients', clientSlug, 'audiences'], queryFn: () => listAudiences(clientSlug) });
  const publishersQ = useQuery({ queryKey: ['manage', 'publishers'], queryFn: listPublishers });
  const brands = brandsQ.data ?? [];
  const audiences = audiencesQ.data ?? [];
  const publishers = publishersQ.data ?? [];
  const optionsLoading = brandsQ.isLoading || audiencesQ.isLoading || publishersQ.isLoading;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: existing
      ? {
          brandId: existing.brandId,
          audienceId: existing.audienceId,
          publisherId: existing.publisherId,
          format: existing.format,
          title: existing.title,
          cost: existing.cost,
          startMonth: existing.startMonth ?? undefined,
          endMonth: existing.endMonth ?? undefined,
          notes: existing.notes ?? '',
        }
      : { brandId: '', audienceId: '', publisherId: '', format: 'article', title: '', cost: 0, startMonth: undefined, endMonth: undefined, notes: '' },
  });

  const save = useMutation({
    mutationFn: async (v: Values) => {
      const body: CpdInvestmentWriteBody = {
        brandId: v.brandId,
        audienceId: v.audienceId,
        publisherId: v.publisherId,
        year,
        format: v.format,
        title: v.title.trim(),
        cost: v.cost || 0,
        startMonth: v.startMonth ?? v.endMonth ?? null,
        endMonth: v.endMonth ?? v.startMonth ?? null,
        notes: v.notes?.trim() || null,
      };
      if (existing) {
        await updateCpdInvestment(clientSlug, existing.id, body);
      } else {
        await createCpdInvestment(clientSlug, body);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manage', 'clients', clientSlug, 'cpd-investments'] });
      onDone();
    },
  });

  const error = save.error instanceof ApiError ? save.error.message : null;

  if (optionsLoading) {
    return <div className="p-6 text-sm text-ph-charcoal/60">Loading...</div>;
  }

  return (
    <div className="p-6">
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select label="Brand" {...form.register('brandId')} error={form.formState.errors.brandId?.message}>
            <option value="">-</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
          <Select label="Audience" {...form.register('audienceId')} error={form.formState.errors.audienceId?.message}>
            <option value="">-</option>
            {audiences.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
          <Select label="Publisher" {...form.register('publisherId')} error={form.formState.errors.publisherId?.message}>
            <option value="">-</option>
            {publishers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>

          <Select label="Format" {...form.register('format')} error={form.formState.errors.format?.message}>
            {CPD_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </Select>
          <LabeledField label="Title" error={form.formState.errors.title?.message}>
            <Input {...form.register('title')} placeholder="e.g. Paracetamol Article" />
          </LabeledField>
          <LabeledField label="Cost (AUD)" error={form.formState.errors.cost?.message}>
            <Input type="number" step="any" {...form.register('cost')} />
          </LabeledField>
          <Select label="Start month (optional)" {...form.register('startMonth')} error={form.formState.errors.startMonth?.message}>
            <option value="">-</option>
            {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </Select>
          <Select label="End month (optional)" {...form.register('endMonth')} error={form.formState.errors.endMonth?.message}>
            <option value="">-</option>
            {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </Select>
          <LabeledField label="Notes (optional)">
            <Input {...form.register('notes')} />
          </LabeledField>

          <div className="col-span-full flex items-center gap-2 border-t border-ph-charcoal/10 pt-4">
            <Button type="submit" size="sm" disabled={save.isPending}>
              {save.isPending ? 'Saving...' : existing ? 'Save changes' : 'Create'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
            {error && <span className="text-xs text-red-600">{error}</span>}
          </div>
        </form>
    </div>
  );
}

function LabeledField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
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
      className="h-9 rounded-md border border-ph-charcoal/20 bg-white px-2 text-sm text-ph-charcoal focus:border-ph-purple focus:outline-none"
    >
      {children}
    </select>
    {error && <p className="text-xs text-red-600">{error}</p>}
  </div>
);
