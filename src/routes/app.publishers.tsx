import { useState } from 'react';
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
  createPublisher,
  deletePublisher,
  listPublishers,
  listTemplates,
  type MetricTemplate,
  type Publisher,
} from '@/api/taxonomy';

export const Route = createFileRoute('/app/publishers')({
  component: PublishersPage,
});

function PublishersPage() {
  const [showForm, setShowForm] = useState(false);

  const { data: publishers = [], isLoading } = useQuery({
    queryKey: ['manage', 'publishers'],
    queryFn: listPublishers,
  });
  const { data: templates = [] } = useQuery({
    queryKey: ['manage', 'templates'],
    queryFn: listTemplates,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ph-charcoal">Publishers</h1>
          <p className="mt-1 text-sm text-ph-charcoal/70">
            Shared registry of media outlets. Each publisher supports one or more metric
            templates — these define the input fields for placements on that publisher.
          </p>
        </div>
        {!showForm && (
          <Button type="button" size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
            New publisher
          </Button>
        )}
      </div>

      {showForm && <NewPublisherForm templates={templates} onDone={() => setShowForm(false)} />}

      <Card>
        <CardContent className="pt-6">
          {isLoading && <p className="text-sm text-ph-charcoal/60">Loading publishers…</p>}
          {!isLoading && publishers.length === 0 && (
            <p className="text-sm text-ph-charcoal/60">
              No publishers yet — create the first one.
            </p>
          )}
          {publishers.length > 0 && <PublisherTable publishers={publishers} />}
        </CardContent>
      </Card>
    </div>
  );
}

function PublisherTable({ publishers }: { publishers: Publisher[] }) {
  const queryClient = useQueryClient();
  const del = useMutation({
    mutationFn: deletePublisher,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['manage', 'publishers'] }),
    onError: (err) => alert(err instanceof ApiError ? err.message : 'Failed to delete'),
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-ph-charcoal/10 text-xs uppercase tracking-wide text-ph-charcoal/60">
          <tr>
            <th className="py-2 pr-4 font-medium">Publisher</th>
            <th className="py-2 pr-4 font-medium">Slug</th>
            <th className="py-2 pr-4 font-medium">Website</th>
            <th className="py-2 pr-4 font-medium">Templates</th>
            <th className="py-2 text-right font-medium" />
          </tr>
        </thead>
        <tbody>
          {publishers.map((p) => (
            <tr key={p.id} className="border-b border-ph-charcoal/5 last:border-0">
              <td className="py-2 pr-4 font-medium text-ph-charcoal">{p.name}</td>
              <td className="py-2 pr-4 font-mono text-xs text-ph-charcoal/60">{p.slug}</td>
              <td className="py-2 pr-4 text-ph-charcoal/60">
                {p.website ? (
                  <a href={p.website} target="_blank" rel="noreferrer" className="hover:underline">
                    {p.website.replace(/^https?:\/\//, '')}
                  </a>
                ) : (
                  '—'
                )}
              </td>
              <td className="py-2 pr-4">
                <div className="flex flex-wrap gap-1">
                  {p.templates.map((t) => (
                    <span
                      key={t.templateId}
                      className="rounded bg-ph-charcoal/5 px-1.5 py-0.5 text-[11px] text-ph-charcoal/80"
                    >
                      {t.templateName}
                    </span>
                  ))}
                  {p.templates.length === 0 && (
                    <span className="text-xs text-ph-charcoal/40">none</span>
                  )}
                </div>
              </td>
              <td className="py-2 text-right">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={del.isPending}
                  onClick={() => {
                    if (confirm(`Delete publisher "${p.name}"?`)) del.mutate(p.id);
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
  name: z.string().min(1, 'Name is required'),
  slug: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/, 'Invalid slug'),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  templateIds: z.array(z.string()).min(1, 'Select at least one template'),
});
type Values = z.infer<typeof schema>;

function NewPublisherForm({
  templates,
  onDone,
}: {
  templates: MetricTemplate[];
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', slug: '', website: '', templateIds: [] },
  });

  const selectedIds = form.watch('templateIds');

  const mutation = useMutation({
    mutationFn: (values: Values) =>
      createPublisher({
        name: values.name.trim(),
        slug: values.slug.trim(),
        website: values.website?.trim() || undefined,
        templateIds: values.templateIds,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manage', 'publishers'] });
      onDone();
    },
  });

  const error = mutation.error instanceof ApiError ? mutation.error.message : null;

  const toggleTemplate = (id: string) => {
    const current = form.getValues('templateIds');
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    form.setValue('templateIds', next, { shouldValidate: true });
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="text-base font-semibold text-ph-charcoal">New publisher</h2>
        <form
          onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
          className="mt-4 flex flex-col gap-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Name" error={form.formState.errors.name?.message}>
              <Input {...form.register('name')} placeholder="AJP Magazine" />
            </Field>
            <Field label="Slug" error={form.formState.errors.slug?.message}>
              <Input {...form.register('slug')} placeholder="ajp" />
            </Field>
            <Field label="Website (optional)" error={form.formState.errors.website?.message}>
              <Input {...form.register('website')} placeholder="https://ajp.com.au" />
            </Field>
          </div>

          <div>
            <label className="text-xs font-medium text-ph-charcoal">Metric templates</label>
            <p className="mt-0.5 text-xs text-ph-charcoal/60">
              Pick every template this publisher supports. Each determines which metric fields a
              placement on this publisher will capture.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {templates.map((t) => {
                const active = selectedIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTemplate(t.id)}
                    className={
                      active
                        ? 'rounded-md bg-ph-purple px-3 py-1.5 text-xs font-medium text-white'
                        : 'rounded-md border border-ph-charcoal/20 px-3 py-1.5 text-xs font-medium text-ph-charcoal hover:border-ph-purple'
                    }
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
            {form.formState.errors.templateIds && (
              <p className="mt-1 text-xs text-red-600">
                {form.formState.errors.templateIds.message}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating…' : 'Create publisher'}
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

function Field({
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
