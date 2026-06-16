import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/api/client';

export interface NamedRow {
  id: string;
  name: string;
  slug: string;
  color?: string | null;
  placementCount: number;
}

interface NamedEntityTabProps {
  entityLabel: string;            // "brand" / "audience"
  entityPluralLabel: string;       // "brands" / "audiences"
  queryKey: readonly unknown[];
  /** Show a display-colour picker (brands only - colours the brand cell on client dashboards). */
  withColor?: boolean;
  list: () => Promise<NamedRow[]>;
  create: (body: { name: string; slug: string; color?: string }) => Promise<NamedRow>;
  update: (id: string, body: { name: string; slug: string; color?: string }) => Promise<NamedRow>;
  remove: (id: string) => Promise<void>;
}

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z
    .string()
    .regex(/^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/, 'Lowercase letters, numbers, hyphens only'),
  // '' = no colour; the API clears the colour on empty string.
  color: z.string().optional(),
});
type Values = z.infer<typeof schema>;

// null = no form open; 'new' = create; a row = edit that row.
type FormState = NamedRow | 'new' | null;

export function NamedEntityTab({
  entityLabel,
  entityPluralLabel,
  queryKey,
  withColor = false,
  list,
  create,
  update,
  remove,
}: NamedEntityTabProps) {
  const [formState, setFormState] = useState<FormState>(null);
  const { data = [], isLoading } = useQuery({ queryKey, queryFn: list });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ph-charcoal/70">
          {data.length} {entityPluralLabel}.
        </p>
        {formState === null && (
          <Button type="button" size="sm" onClick={() => setFormState('new')}>
            <Plus className="h-4 w-4" />
            New {entityLabel}
          </Button>
        )}
      </div>

      {formState !== null && (
        <EntityForm
          entityLabel={entityLabel}
          queryKey={queryKey}
          withColor={withColor}
          editing={formState === 'new' ? null : formState}
          create={create}
          update={update}
          onDone={() => setFormState(null)}
        />
      )}

      <Card>
        <CardContent className="pt-6">
          {isLoading && <p className="text-sm text-ph-charcoal/60">Loading…</p>}
          {!isLoading && data.length === 0 && (
            <p className="text-sm text-ph-charcoal/60">
              None yet — create the first {entityLabel}.
            </p>
          )}
          {data.length > 0 && (
            <EntityTable
              rows={data}
              queryKey={queryKey}
              remove={remove}
              entityLabel={entityLabel}
              onEdit={(row) => setFormState(row)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EntityForm({
  entityLabel,
  queryKey,
  withColor,
  editing,
  create,
  update,
  onDone,
}: {
  entityLabel: string;
  queryKey: readonly unknown[];
  withColor: boolean;
  editing: NamedRow | null;
  create: (body: { name: string; slug: string; color?: string }) => Promise<NamedRow>;
  update: (id: string, body: { name: string; slug: string; color?: string }) => Promise<NamedRow>;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [savedId, setSavedId] = useState<string | null>(editing?.id ?? null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: editing?.name ?? '', slug: editing?.slug ?? '', color: editing?.color ?? '' },
  });

  useEffect(() => {
    setSavedId(editing?.id ?? null);
    form.reset({ name: editing?.name ?? '', slug: editing?.slug ?? '', color: editing?.color ?? '' });
  }, [editing, form]);

  const mutation = useMutation({
    mutationFn: async (values: Values) => {
      const body = {
        name: values.name.trim(),
        slug: values.slug.trim(),
        ...(withColor ? { color: values.color ?? '' } : {}),
      };
      if (savedId) await update(savedId, body);
      else {
        const created = await create(body);
        setSavedId(created.id);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
  const error = mutation.error instanceof ApiError ? mutation.error.message : null;
  const color = form.watch('color') ?? '';

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

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="text-base font-semibold text-ph-charcoal">
          {savedId ? `Edit ${entityLabel}` : `New ${entityLabel}`}
        </h2>
        <form onBlur={triggerSave} className="mt-4 flex flex-wrap items-start gap-3">
          <div className="flex w-full max-w-64 flex-col gap-1.5">
            <Input placeholder="Name" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-xs text-red-600">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="flex w-full max-w-64 flex-col gap-1.5">
            <Input placeholder="slug" {...form.register('slug')} />
            {form.formState.errors.slug && (
              <p className="text-xs text-red-600">{form.formState.errors.slug.message}</p>
            )}
          </div>
          {withColor && (
            <div className="flex h-10 items-center gap-1.5">
              <input
                type="color"
                value={color || '#888888'}
                onChange={(e) => form.setValue('color', e.target.value)}
                className="h-8 w-8 cursor-pointer rounded border border-ph-charcoal/20 bg-white p-0.5"
                title="Display colour (used to highlight the brand on the client dashboard)"
              />
              {color ? (
                <Button type="button" size="sm" variant="ghost" onClick={() => { form.setValue('color', ''); triggerSave(); }}>
                  Clear
                </Button>
              ) : (
                <span className="text-xs text-ph-charcoal/50">No colour</span>
              )}
            </div>
          )}
          <div className="flex h-10 items-center gap-1.5">
            <Button type="button" size="sm" variant="ghost" onClick={flushDone}>Done</Button>
            {mutation.isPending && <span className="text-xs text-ph-charcoal/50">Saving…</span>}
            {!mutation.isPending && mutation.isSuccess && <span className="text-xs text-green-700">Saved ✓</span>}
            {!savedId && <span className="text-xs text-ph-charcoal/45">Fill name &amp; slug to save</span>}
          </div>
          {error && <p className="w-full text-xs text-red-600">{error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}

function EntityTable({
  rows,
  queryKey,
  remove,
  entityLabel,
  onEdit,
}: {
  rows: NamedRow[];
  queryKey: readonly unknown[];
  remove: (id: string) => Promise<void>;
  entityLabel: string;
  onEdit: (row: NamedRow) => void;
}) {
  const queryClient = useQueryClient();
  const del = useMutation({
    mutationFn: remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : 'Failed to delete';
      alert(msg);
    },
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-ph-charcoal/10 text-xs uppercase tracking-wide text-ph-charcoal/60">
          <tr>
            <th className="py-2 pr-4 font-medium">Name</th>
            <th className="py-2 pr-4 font-medium">Slug</th>
            <th className="py-2 pr-4 text-right font-medium">Placements</th>
            <th className="py-2 text-right font-medium" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-ph-charcoal/5 last:border-0">
              <td className="py-2 pr-4 font-medium text-ph-charcoal">
                <span className="flex items-center gap-2">
                  {r.color && (
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-sm border border-ph-charcoal/10"
                      style={{ backgroundColor: r.color }}
                    />
                  )}
                  {r.name}
                </span>
              </td>
              <td className="py-2 pr-4 font-mono text-xs text-ph-charcoal/60">{r.slug}</td>
              <td className="py-2 pr-4 text-right tabular-nums text-ph-charcoal/80">
                {r.placementCount}
              </td>
              <td className="py-2 text-right">
                <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(r)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={del.isPending}
                  onClick={() => {
                    if (confirm(`Delete ${entityLabel} "${r.name}"?`)) del.mutate(r.id);
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
