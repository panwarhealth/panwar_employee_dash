import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/api/client';

export interface NamedRow {
  id: string;
  name: string;
  slug: string;
  placementCount: number;
}

interface NamedEntityTabProps {
  entityLabel: string;            // "brand" / "audience"
  entityPluralLabel: string;       // "brands" / "audiences"
  queryKey: readonly unknown[];
  list: () => Promise<NamedRow[]>;
  create: (body: { name: string; slug: string }) => Promise<NamedRow>;
  remove: (id: string) => Promise<void>;
}

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z
    .string()
    .regex(/^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/, 'Lowercase letters, numbers, hyphens only'),
});
type Values = z.infer<typeof schema>;

export function NamedEntityTab({
  entityLabel,
  entityPluralLabel,
  queryKey,
  list,
  create,
  remove,
}: NamedEntityTabProps) {
  const [showForm, setShowForm] = useState(false);
  const { data = [], isLoading } = useQuery({ queryKey, queryFn: list });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ph-charcoal/70">
          {data.length} {entityPluralLabel}.
        </p>
        {!showForm && (
          <Button type="button" size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
            New {entityLabel}
          </Button>
        )}
      </div>

      {showForm && (
        <AddForm
          entityLabel={entityLabel}
          queryKey={queryKey}
          create={create}
          onDone={() => setShowForm(false)}
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
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AddForm({
  entityLabel,
  queryKey,
  create,
  onDone,
}: {
  entityLabel: string;
  queryKey: readonly unknown[];
  create: (body: { name: string; slug: string }) => Promise<NamedRow>;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: '', slug: '' } });
  const mutation = useMutation({
    mutationFn: (values: Values) => create({ name: values.name.trim(), slug: values.slug.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      onDone();
    },
  });
  const error = mutation.error instanceof ApiError ? mutation.error.message : null;

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="text-base font-semibold text-ph-charcoal">New {entityLabel}</h2>
        <form
          onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
          className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto_auto]"
        >
          <div className="flex flex-col gap-1.5">
            <Input placeholder="Name" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-xs text-red-600">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Input placeholder="slug" {...form.register('slug')} />
            {form.formState.errors.slug && (
              <p className="text-xs text-red-600">{form.formState.errors.slug.message}</p>
            )}
          </div>
          <Button type="submit" size="sm" disabled={mutation.isPending}>
            {mutation.isPending ? 'Creating…' : 'Create'}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          {error && <p className="col-span-full text-xs text-red-600">{error}</p>}
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
}: {
  rows: NamedRow[];
  queryKey: readonly unknown[];
  remove: (id: string) => Promise<void>;
  entityLabel: string;
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
              <td className="py-2 pr-4 font-medium text-ph-charcoal">{r.name}</td>
              <td className="py-2 pr-4 font-mono text-xs text-ph-charcoal/60">{r.slug}</td>
              <td className="py-2 pr-4 text-right tabular-nums text-ph-charcoal/80">
                {r.placementCount}
              </td>
              <td className="py-2 text-right">
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
