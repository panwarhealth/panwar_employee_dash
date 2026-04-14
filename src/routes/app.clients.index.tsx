import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/api/client';
import {
  createClient,
  listClients,
  type CreateClientPayload,
  type ManagedClient,
} from '@/api/clients';

export const Route = createFileRoute('/app/clients/')({
  component: ClientsPage,
});

function ClientsPage() {
  const [showForm, setShowForm] = useState(false);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['manage', 'clients'],
    queryFn: listClients,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ph-charcoal">Clients</h1>
          <p className="mt-1 text-sm text-ph-charcoal/70">
            Onboard pharma clients, set per-client branding, and manage who can sign in.
          </p>
        </div>
        {!showForm && (
          <Button type="button" size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
            New client
          </Button>
        )}
      </div>

      {showForm && <NewClientForm onDone={() => setShowForm(false)} />}

      <Card>
        <CardContent className="pt-6">
          {isLoading && <p className="text-sm text-ph-charcoal/60">Loading clients…</p>}
          {!isLoading && clients.length === 0 && (
            <p className="text-sm text-ph-charcoal/60">No clients yet — create the first one.</p>
          )}
          {clients.length > 0 && <ClientsTable clients={clients} />}
        </CardContent>
      </Card>
    </div>
  );
}

function ClientsTable({ clients }: { clients: ManagedClient[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-ph-charcoal/10 text-xs uppercase tracking-wide text-ph-charcoal/60">
          <tr>
            <th className="py-2 pr-4 font-medium">Client</th>
            <th className="py-2 pr-4 font-medium">Slug</th>
            <th className="py-2 pr-4 text-right font-medium">Users</th>
            <th className="py-2 text-right font-medium" />
          </tr>
        </thead>
        <tbody>
          {clients.map((c) => (
            <tr key={c.id} className="border-b border-ph-charcoal/5 last:border-0">
              <td className="py-3 pr-4">
                <div className="flex items-center gap-3">
                  {c.logoUrl ? (
                    <img src={c.logoUrl} alt={c.name} className="h-8 w-8 rounded object-contain" />
                  ) : (
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded text-xs font-semibold text-white"
                      style={{ backgroundColor: c.primaryColor ?? '#702f8f' }}
                    >
                      {c.name.charAt(0)}
                    </div>
                  )}
                  <span className="font-medium text-ph-charcoal">{c.name}</span>
                </div>
              </td>
              <td className="py-3 pr-4 font-mono text-xs text-ph-charcoal/60">{c.slug}</td>
              <td className="py-3 pr-4 text-right tabular-nums text-ph-charcoal/80">
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {c.userCount}
                </span>
              </td>
              <td className="py-3 text-right">
                <Link
                  to="/app/clients/$clientSlug/details"
                  params={{ clientSlug: c.slug }}
                  className="text-sm font-medium text-ph-purple hover:underline"
                >
                  Manage →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const slugPattern = /^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/;

const newClientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().regex(slugPattern, 'Lowercase letters, numbers, hyphens only'),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a #RRGGBB hex').or(z.literal('')),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a #RRGGBB hex').or(z.literal('')),
});
type NewClientValues = z.infer<typeof newClientSchema>;

function NewClientForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const form = useForm<NewClientValues>({
    resolver: zodResolver(newClientSchema),
    defaultValues: { name: '', slug: '', primaryColor: '', accentColor: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: NewClientValues) => {
      const payload: CreateClientPayload = {
        name: values.name.trim(),
        slug: values.slug.trim(),
        primaryColor: values.primaryColor || undefined,
        accentColor: values.accentColor || undefined,
      };
      return createClient(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manage', 'clients'] });
      onDone();
    },
  });

  const error = mutation.error instanceof ApiError ? mutation.error.message : null;

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="text-base font-semibold text-ph-charcoal">New client</h2>
        <form
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <Field label="Name" error={form.formState.errors.name?.message}>
            <Input {...form.register('name')} placeholder='Abbott Pharmaceuticals' />
          </Field>
          <Field label="Slug" error={form.formState.errors.slug?.message}>
            <Input {...form.register('slug')} placeholder='abbott' />
          </Field>
          <Field label="Primary colour (optional)" error={form.formState.errors.primaryColor?.message}>
            <Input {...form.register('primaryColor')} placeholder='#2563EB' />
          </Field>
          <Field label="Accent colour (optional)" error={form.formState.errors.accentColor?.message}>
            <Input {...form.register('accentColor')} placeholder='#60A5FA' />
          </Field>
          <div className="col-span-full flex items-center gap-2">
            <Button type="submit" size="sm" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating…' : 'Create client'}
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
